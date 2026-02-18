const App = {
  state: {
    user: null,
    cart: JSON.parse(localStorage.getItem("nimble_cart_v1") || "[]")
  },

  categories: [
    "All",
    "Basketball",
    "Soccer",
    "Tennis",
    "Fitness",
    "Yoga",
    "Cycling",
    "Running",
    "Swimming",
    "Badminton",
    "Cricket",
    "Baseball",
    "Volleyball",
    "Boxing",
    "Hiking",
    "Climbing",
    "Skating",
    "Table Tennis",
    "Golf",
    "Recovery",
    "Camping"
  ],

  saveCart() {
    localStorage.setItem("nimble_cart_v1", JSON.stringify(this.state.cart));
  },

  cartCount() {
    return this.state.cart.reduce((sum, item) => sum + item.qty, 0);
  },

  setUser(user) {
    this.state.user = user;
    this.renderUserActions();
  },

  async request(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }
    return data;
  },

  async loadUser() {
    try {
      const data = await this.request("/api/auth/me", { method: "GET" });
      this.setUser(data.user || null);
    } catch {
      this.setUser(null);
    }
  },

  currency(v) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
  },

  date(v) {
    return new Date(v).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  },

  stars(rating) {
    const rounded = Math.round(rating);
    return "★".repeat(rounded) + "☆".repeat(Math.max(0, 5 - rounded));
  },

  escape(v) {
    return String(v)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  },

  productImage(url) {
    const raw = String(url || "").trim();
    return raw || "/images/placeholder.svg";
  },

  toast(message) {
    let container = document.getElementById("toastContainer");
    if (!container) {
      container = document.createElement("div");
      container.id = "toastContainer";
      container.className = "toast-container";
      document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 10);
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 220);
    }, 1700);
  },

  reveal(root = document) {
    const targets = root.querySelectorAll(".reveal");
    if (!targets.length) return;

    if (!("IntersectionObserver" in window)) {
      targets.forEach((el) => el.classList.add("in-view"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -5% 0px" }
    );

    targets.forEach((node, index) => {
      node.style.setProperty("--reveal-delay", `${Math.min(index * 50, 380)}ms`);
      observer.observe(node);
    });
  },

  nav(active) {
    const categoryOptions = this.categories
      .map((category) => `<option>${this.escape(category)}</option>`)
      .join("");

    return `
      <header>
        <div class="topbar">
          <a class="brand" href="/index.html">Nim<span>ble</span></a>
          <form class="search" id="searchForm">
            <input id="searchInput" type="text" placeholder="Search sports equipment" />
            <select id="searchCategory">${categoryOptions}</select>
            <button type="submit">Search</button>
          </form>
          <nav class="nav">
            <a class="${active === "shop" ? "active" : ""}" href="/index.html">Shop</a>
            <a class="${active === "cart" ? "active" : ""}" href="/cart.html">Cart (<span id="miniCart">0</span>)</a>
            <a class="${active === "orders" ? "active" : ""}" href="/orders.html">Orders</a>
            <a class="${active === "admin" ? "active" : ""}" href="/admin.html">Admin</a>
            <span id="userActions"></span>
          </nav>
        </div>
      </header>
    `;
  },

  layout(active, innerHtml) {
    document.body.innerHTML = `${this.nav(active)}<main class="container">${innerHtml}</main><footer>Nimble full-stack demo. Stripe checkout works when server env vars are configured.</footer>`;
    this.bindCommonSearch();
    this.renderUserActions();
    this.updateMiniCart();
    this.reveal(document);
  },

  bindCommonSearch() {
    const form = document.getElementById("searchForm");
    if (!form) return;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const q = document.getElementById("searchInput").value.trim();
      const category = document.getElementById("searchCategory").value;
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (category && category !== "All") params.set("category", category);
      location.href = `/index.html${params.toString() ? `?${params.toString()}` : ""}`;
    });
  },

  renderUserActions() {
    const container = document.getElementById("userActions");
    if (!container) return;
    if (!this.state.user) {
      container.innerHTML = `<a href="/auth.html">Login</a>`;
      return;
    }
    const title = `${this.state.user.isAdmin ? "Admin" : "Customer"}: ${this.state.user.name}`;
    container.innerHTML = `<a class="account-chip" href="/auth.html" title="${this.escape(title)}">Account</a><button id="logoutBtn">Logout</button>`;
    const logout = document.getElementById("logoutBtn");
    if (logout) {
      logout.addEventListener("click", async () => {
        await this.request("/api/auth/logout", { method: "POST" });
        this.setUser(null);
        location.href = "/index.html";
      });
    }
  },

  updateMiniCart() {
    const node = document.getElementById("miniCart");
    if (node) node.textContent = String(this.cartCount());
  },

  addToCart(productId, qty = 1) {
    const item = this.state.cart.find((entry) => entry.productId === productId);
    if (item) item.qty += qty;
    else this.state.cart.push({ productId, qty });
    this.saveCart();
    this.updateMiniCart();
  },

  removeCartItem(productId) {
    this.state.cart = this.state.cart.filter((item) => item.productId !== productId);
    this.saveCart();
    this.updateMiniCart();
  },

  setCartQty(productId, qty) {
    if (qty <= 0) return this.removeCartItem(productId);
    this.state.cart = this.state.cart.map((item) => (item.productId === productId ? { ...item, qty } : item));
    this.saveCart();
    this.updateMiniCart();
  }
};
