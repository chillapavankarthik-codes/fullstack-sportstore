const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

function loadDotEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const APP_ORIGIN = process.env.APP_ORIGIN || `http://${HOST}:${PORT}`;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_PRICE_CURRENCY = process.env.STRIPE_PRICE_CURRENCY || "usd";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@sportstore.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const TOKEN_SECRET = process.env.TOKEN_SECRET || "change_this_secret";

const ROOT = __dirname;
const DB_PATH = path.join(ROOT, "data", "db.json");
const PUBLIC_DIR = path.join(ROOT, "public");
const UPLOADS_DIR = path.join(ROOT, "uploads");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

let writeQueue = Promise.resolve();

function json(res, statusCode, body) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf("=");
        return [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))];
      })
  );
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, hashedValue) {
  const [salt, hash] = String(hashedValue || "").split(":");
  if (!salt || !hash) return false;
  const testHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(testHash));
}

function signToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const content = `${header}.${body}`;
  const sig = crypto.createHmac("sha256", TOKEN_SECRET).update(content).digest("base64url");
  return `${content}.${sig}`;
}

function verifyToken(token) {
  try {
    const [header, body, sig] = token.split(".");
    if (!header || !body || !sig) return null;
    const content = `${header}.${body}`;
    const check = crypto.createHmac("sha256", TOKEN_SECRET).update(content).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(check))) return null;
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 2_000_000) {
      throw new Error("Body too large");
    }
  }
  if (!raw) return {};
  return JSON.parse(raw);
}

async function ensureDb() {
  await fsp.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fsp.mkdir(UPLOADS_DIR, { recursive: true });
  const exists = fs.existsSync(DB_PATH);
  if (!exists) {
    await fsp.writeFile(DB_PATH, JSON.stringify({ users: [], products: [], orders: [] }, null, 2));
  }
}

async function readDb() {
  await ensureDb();
  const raw = await fsp.readFile(DB_PATH, "utf8");
  return JSON.parse(raw);
}

function writeDb(data) {
  writeQueue = writeQueue.then(() => fsp.writeFile(DB_PATH, JSON.stringify(data, null, 2)));
  return writeQueue;
}

function authFromRequest(req) {
  const cookies = parseCookies(req);
  const header = req.headers.authorization;
  const token = (header && header.startsWith("Bearer ") ? header.slice(7) : "") || cookies.authToken;
  if (!token) return null;
  return verifyToken(token);
}

function mustBeAuthed(req, res) {
  const user = authFromRequest(req);
  if (!user) {
    json(res, 401, { error: "Unauthorized" });
    return null;
  }
  return user;
}

function mustBeAdmin(req, res) {
  const user = mustBeAuthed(req, res);
  if (!user) return null;
  if (!user.isAdmin) {
    json(res, 403, { error: "Admin required" });
    return null;
  }
  return user;
}

function buildTotals(items) {
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const shipping = subtotal > 150 || subtotal === 0 ? 0 : 14.99;
  const tax = Number((subtotal * 0.08).toFixed(2));
  const total = Number((subtotal + shipping + tax).toFixed(2));
  return { subtotal, shipping, tax, total };
}

async function ensureAdminUser() {
  const db = await readDb();
  const exists = db.users.some((u) => u.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
  if (!exists) {
    db.users.push({
      id: `u_${crypto.randomUUID()}`,
      name: "Admin",
      email: ADMIN_EMAIL,
      passwordHash: hashPassword(ADMIN_PASSWORD),
      isAdmin: true,
      createdAt: new Date().toISOString()
    });
    await writeDb(db);
    console.log(`Seeded admin user: ${ADMIN_EMAIL}`);
  }
}

function sanitizeFileName(fileName) {
  return String(fileName || "image")
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

async function createStripeSession(order, req) {
  const lineItems = order.items.map((item) => ({
    price_data: {
      currency: STRIPE_PRICE_CURRENCY,
      product_data: { name: item.name },
      unit_amount: Math.round(item.price * 100)
    },
    quantity: item.qty
  }));

  const params = new URLSearchParams();
  params.append("mode", "payment");
  params.append("success_url", `${APP_ORIGIN}/orders.html?status=success`);
  params.append("cancel_url", `${APP_ORIGIN}/checkout.html?status=cancel`);
  lineItems.forEach((li, idx) => {
    params.append(`line_items[${idx}][price_data][currency]`, li.price_data.currency);
    params.append(`line_items[${idx}][price_data][product_data][name]`, li.price_data.product_data.name);
    params.append(`line_items[${idx}][price_data][unit_amount]`, String(li.price_data.unit_amount));
    params.append(`line_items[${idx}][quantity]`, String(li.quantity));
  });

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Stripe error");
  }
  return data;
}

async function handleApi(req, res, url) {
  const pathname = url.pathname;

  if (req.method === "POST" && pathname === "/api/auth/register") {
    const body = await readBody(req);
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!name || !email || password.length < 6) {
      return json(res, 400, { error: "Provide name, email, and password (6+ chars)" });
    }

    const db = await readDb();
    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      return json(res, 409, { error: "Email already exists" });
    }

    const user = {
      id: `u_${crypto.randomUUID()}`,
      name,
      email,
      passwordHash: hashPassword(password),
      isAdmin: false,
      createdAt: new Date().toISOString()
    };

    db.users.push(user);
    await writeDb(db);

    return json(res, 201, { message: "Registered successfully" });
  }

  if (req.method === "POST" && pathname === "/api/auth/login") {
    const body = await readBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    const db = await readDb();
    const user = db.users.find((u) => u.email.toLowerCase() === email);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return json(res, 401, { error: "Invalid credentials" });
    }

    const token = signToken({ id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin });

    res.setHeader(
      "Set-Cookie",
      `authToken=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`
    );

    return json(res, 200, {
      token,
      user: { id: user.id, name: user.name, email: user.email, isAdmin: user.isAdmin }
    });
  }

  if (req.method === "POST" && pathname === "/api/auth/logout") {
    res.setHeader("Set-Cookie", "authToken=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0");
    return json(res, 200, { message: "Logged out" });
  }

  if (req.method === "GET" && pathname === "/api/auth/me") {
    const tokenUser = authFromRequest(req);
    if (!tokenUser) return json(res, 200, { user: null });
    return json(res, 200, { user: tokenUser });
  }

  if (req.method === "GET" && pathname === "/api/products") {
    const db = await readDb();
    const q = (url.searchParams.get("q") || "").toLowerCase();
    const category = url.searchParams.get("category") || "";
    const sort = url.searchParams.get("sort") || "popular";

    let list = db.products.filter((p) => {
      const okQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q);
      const okCat = !category || category === "All" || p.category === category;
      return okQ && okCat;
    });

    if (sort === "price-low") list.sort((a, b) => a.price - b.price);
    if (sort === "price-high") list.sort((a, b) => b.price - a.price);
    if (sort === "rating") list.sort((a, b) => b.rating - a.rating);
    if (sort === "popular") list.sort((a, b) => b.reviewCount - a.reviewCount);

    return json(res, 200, { products: list });
  }

  if (req.method === "GET" && pathname.startsWith("/api/products/")) {
    const productId = pathname.split("/").pop();
    const db = await readDb();
    const product = db.products.find((p) => p.id === productId);
    if (!product) return json(res, 404, { error: "Product not found" });
    return json(res, 200, { product });
  }

  if (req.method === "POST" && pathname === "/api/products") {
    const user = mustBeAdmin(req, res);
    if (!user) return;

    const body = await readBody(req);
    const required = ["name", "brand", "category", "price", "stock", "images", "description"];
    const missing = required.filter((key) => body[key] == null || body[key] === "");
    if (missing.length) return json(res, 400, { error: `Missing fields: ${missing.join(", ")}` });

    const db = await readDb();
    const product = {
      id: `p_${crypto.randomUUID().slice(0, 8)}`,
      name: String(body.name),
      brand: String(body.brand),
      category: String(body.category),
      price: Number(body.price),
      rating: Number(body.rating || 4.5),
      reviewCount: Number(body.reviewCount || 0),
      stock: Number(body.stock),
      images: Array.isArray(body.images) ? body.images : [String(body.images)],
      shortDescription: String(body.shortDescription || ""),
      description: String(body.description),
      highlights: Array.isArray(body.highlights) ? body.highlights : [],
      specs: body.specs && typeof body.specs === "object" ? body.specs : {}
    };

    db.products.push(product);
    await writeDb(db);
    return json(res, 201, { product });
  }

  if (req.method === "PUT" && pathname.startsWith("/api/products/")) {
    const user = mustBeAdmin(req, res);
    if (!user) return;

    const productId = pathname.split("/").pop();
    const body = await readBody(req);
    const db = await readDb();
    const idx = db.products.findIndex((p) => p.id === productId);
    if (idx === -1) return json(res, 404, { error: "Product not found" });

    db.products[idx] = { ...db.products[idx], ...body };
    await writeDb(db);
    return json(res, 200, { product: db.products[idx] });
  }

  if (req.method === "POST" && pathname === "/api/upload") {
    const user = mustBeAdmin(req, res);
    if (!user) return;

    const body = await readBody(req);
    const fileName = sanitizeFileName(body.filename || "upload.png");
    const contentBase64 = String(body.contentBase64 || "");

    if (!contentBase64) return json(res, 400, { error: "contentBase64 is required" });

    const buffer = Buffer.from(contentBase64, "base64");
    const ext = path.extname(fileName) || ".png";
    const savedName = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}${ext}`;
    const destination = path.join(UPLOADS_DIR, savedName);

    await fsp.writeFile(destination, buffer);
    return json(res, 201, { url: `/uploads/${savedName}` });
  }

  if (req.method === "POST" && pathname === "/api/checkout") {
    const user = mustBeAuthed(req, res);
    if (!user) return;

    const body = await readBody(req);
    const items = Array.isArray(body.items) ? body.items : [];
    const paymentMethod = String(body.paymentMethod || "mock");
    const shipping = body.shipping || {};

    if (!items.length) return json(res, 400, { error: "Cart is empty" });

    const db = await readDb();

    const normalizedItems = items
      .map((entry) => {
        const product = db.products.find((p) => p.id === entry.productId);
        if (!product) return null;
        const qty = Number(entry.qty || 0);
        if (qty <= 0 || qty > product.stock) return null;
        return {
          productId: product.id,
          name: product.name,
          price: product.price,
          qty,
          subtotal: Number((product.price * qty).toFixed(2)),
          image: product.images[0],
          backupImage: product.images[1] || null
        };
      })
      .filter(Boolean);

    if (!normalizedItems.length || normalizedItems.length !== items.length) {
      return json(res, 400, { error: "Invalid cart or insufficient stock" });
    }

    const totals = buildTotals(normalizedItems);

    const order = {
      id: `ORD-${Date.now().toString().slice(-8)}`,
      userId: user.id,
      userName: user.name,
      createdAt: new Date().toISOString(),
      paymentMethod,
      paymentStatus: paymentMethod === "stripe" ? "pending" : "paid",
      stripeSessionId: null,
      status: "Processing",
      shipping,
      items: normalizedItems,
      totals
    };

    for (const item of normalizedItems) {
      const idx = db.products.findIndex((p) => p.id === item.productId);
      db.products[idx].stock -= item.qty;
    }

    if (paymentMethod === "stripe") {
      if (!STRIPE_SECRET_KEY) {
        return json(res, 400, { error: "Stripe is not configured on server" });
      }
      try {
        const stripeSession = await createStripeSession(order, req);
        order.stripeSessionId = stripeSession.id;
        order.paymentStatus = "requires_action";
        order.checkoutUrl = stripeSession.url;
      } catch (error) {
        return json(res, 502, { error: `Stripe checkout creation failed: ${error.message}` });
      }
    }

    db.orders.unshift(order);
    await writeDb(db);

    return json(res, 201, { order });
  }

  if (req.method === "GET" && pathname === "/api/orders") {
    const user = mustBeAuthed(req, res);
    if (!user) return;

    const db = await readDb();
    const orders = user.isAdmin ? db.orders : db.orders.filter((o) => o.userId === user.id);
    return json(res, 200, { orders });
  }

  if (req.method === "PUT" && pathname.startsWith("/api/orders/") && pathname.endsWith("/status")) {
    const user = mustBeAdmin(req, res);
    if (!user) return;

    const parts = pathname.split("/");
    const orderId = parts[3];
    const body = await readBody(req);
    const nextStatus = String(body.status || "Processing");

    const db = await readDb();
    const idx = db.orders.findIndex((o) => o.id === orderId);
    if (idx === -1) return json(res, 404, { error: "Order not found" });

    db.orders[idx].status = nextStatus;
    await writeDb(db);
    return json(res, 200, { order: db.orders[idx] });
  }

  return false;
}

async function serveStatic(req, res, url) {
  let targetPath;

  if (url.pathname.startsWith("/uploads/")) {
    targetPath = path.join(UPLOADS_DIR, url.pathname.replace("/uploads/", ""));
  } else {
    const requested = url.pathname === "/" ? "/index.html" : url.pathname;
    targetPath = path.join(PUBLIC_DIR, requested);
  }

  if (!targetPath.startsWith(PUBLIC_DIR) && !targetPath.startsWith(UPLOADS_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const stat = await fsp.stat(targetPath);
    if (stat.isDirectory()) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }
    const ext = path.extname(targetPath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    fs.createReadStream(targetPath).pipe(res);
  } catch {
    res.writeHead(404);
    res.end("Not Found");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, APP_ORIGIN);

  try {
    if (url.pathname.startsWith("/api/")) {
      const handled = await handleApi(req, res, url);
      if (handled === false) {
        return json(res, 404, { error: "API route not found" });
      }
      return;
    }

    await serveStatic(req, res, url);
  } catch (error) {
    console.error(error);
    json(res, 500, { error: "Internal server error" });
  }
});

(async () => {
  await ensureDb();
  await ensureAdminUser();
  server.listen(PORT, HOST, () => {
    console.log(`SportStore full-stack running at ${APP_ORIGIN}`);
  });
})();
