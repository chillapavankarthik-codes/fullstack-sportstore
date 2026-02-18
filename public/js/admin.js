(async function () {
  const categoryOptions = App.categories
    .filter((category) => category !== "All")
    .map((category) => `<option value="${App.escape(category)}">${App.escape(category)}</option>`)
    .join("");

  App.layout(
    "admin",
    `<section class="panel reveal">
      <h1 style="margin-top:0;">Admin Studio</h1>
      <p class="meta" style="margin-top:-4px;">Only admin users can create and manage products from this page.</p>
    </section>

    <section class="panel reveal" style="margin-top:16px;">
      <h3 style="margin-top:0;">Add Product (Admin)</h3>
      <form id="addProductForm">
        <div class="row">
          <input required name="name" placeholder="Product name" />
          <input required name="brand" placeholder="Brand" />
        </div>

        <div class="row" style="margin-top:8px;">
          <select required name="category">
            <option value="">Choose category</option>
            ${categoryOptions}
          </select>
          <input required name="price" type="number" step="0.01" min="0" placeholder="Price" />
          <input required name="stock" type="number" min="0" placeholder="Stock" />
        </div>

        <input required name="shortDescription" placeholder="Short description" style="margin-top:8px;" />
        <textarea required name="description" placeholder="Long description" style="margin-top:8px;"></textarea>

        <div class="row" style="margin-top:8px;">
          <input name="imageUrl" placeholder="Primary image URL" />
          <input name="imageUrl2" placeholder="Secondary image URL (optional)" />
        </div>

        <textarea name="highlights" placeholder="Highlights (one per line)" style="margin-top:8px;"></textarea>
        <textarea name="specs" placeholder="Specs (one per line in Key: Value format)" style="margin-top:8px;"></textarea>

        <div class="row" style="margin-top:8px;">
          <input id="imageFile" type="file" accept="image/*" />
          <button type="button" class="btn-secondary" id="uploadBtn">Upload Image</button>
        </div>

        <p class="meta" id="uploadMsg"></p>
        <button class="btn-primary" type="submit">Create Product</button>
      </form>
      <p id="adminMsg" class="meta"></p>
    </section>

    <section class="panel reveal" style="margin-top:16px;">
      <h3 style="margin-top:0;">Inventory</h3>
      <div class="table-wrap"><table id="productTable"></table></div>
    </section>

    <section class="panel reveal" style="margin-top:16px;">
      <h3 style="margin-top:0;">Orders</h3>
      <div class="table-wrap"><table id="orderTable"></table></div>
    </section>`
  );

  await App.loadUser();
  if (!App.state.user || !App.state.user.isAdmin) {
    location.href = "/auth.html";
    return;
  }

  async function loadProducts() {
    return (await App.request("/api/products", { method: "GET" })).products;
  }

  async function loadOrders() {
    return (await App.request("/api/orders", { method: "GET" })).orders;
  }

  async function renderProducts() {
    const products = await loadProducts();
    document.getElementById("productTable").innerHTML = `
      <thead><tr><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Save</th></tr></thead>
      <tbody>
        ${products
          .map(
            (p) => `
          <tr>
            <td>${App.escape(p.name)}</td>
            <td>${App.escape(p.category)}</td>
            <td><input type="number" step="0.01" min="0" value="${p.price}" data-price="${p.id}" /></td>
            <td><input type="number" min="0" value="${p.stock}" data-stock="${p.id}" /></td>
            <td><button class="btn-primary" data-save-product="${p.id}">Update</button></td>
          </tr>`
          )
          .join("")}
      </tbody>`;

    document.querySelectorAll("[data-save-product]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.saveProduct;
        const price = Number(document.querySelector(`[data-price='${id}']`).value);
        const stock = Number(document.querySelector(`[data-stock='${id}']`).value);
        await App.request(`/api/products/${id}`, { method: "PUT", body: JSON.stringify({ price, stock }) });
        btn.textContent = "Saved";
        setTimeout(() => (btn.textContent = "Update"), 700);
      });
    });
  }

  async function renderOrders() {
    const orders = await loadOrders();
    document.getElementById("orderTable").innerHTML = `
      <thead><tr><th>Order</th><th>User</th><th>Date</th><th>Total</th><th>Status</th><th>Save</th></tr></thead>
      <tbody>
        ${orders
          .map(
            (o) => `
          <tr>
            <td>${o.id}</td>
            <td>${App.escape(o.userName)}</td>
            <td>${App.date(o.createdAt)}</td>
            <td>${App.currency(o.totals.total)}</td>
            <td>
              <select data-status="${o.id}">
                ${["Processing", "Shipped", "Delivered"]
                  .map((s) => `<option ${s === o.status ? "selected" : ""}>${s}</option>`)
                  .join("")}
              </select>
            </td>
            <td><button class="btn-primary" data-save-order="${o.id}">Update</button></td>
          </tr>`
          )
          .join("")}
      </tbody>`;

    document.querySelectorAll("[data-save-order]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.saveOrder;
        const status = document.querySelector(`[data-status='${id}']`).value;
        await App.request(`/api/orders/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) });
        btn.textContent = "Saved";
        setTimeout(() => (btn.textContent = "Update"), 700);
      });
    });
  }

  document.getElementById("uploadBtn").addEventListener("click", async () => {
    const fileInput = document.getElementById("imageFile");
    const file = fileInput.files && fileInput.files[0];
    const msg = document.getElementById("uploadMsg");
    if (!file) {
      msg.textContent = "Choose an image first.";
      msg.style.color = "var(--danger)";
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const result = String(reader.result);
        const contentBase64 = result.split(",")[1] || "";
        const upload = await App.request("/api/upload", {
          method: "POST",
          body: JSON.stringify({ filename: file.name, contentBase64 })
        });
        document.querySelector("[name='imageUrl']").value = upload.url;
        msg.textContent = `Uploaded: ${upload.url}`;
        msg.style.color = "var(--ok)";
      } catch (error) {
        msg.textContent = error.message;
        msg.style.color = "var(--danger)";
      }
    };
    reader.readAsDataURL(file);
  });

  document.getElementById("addProductForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);

    const highlights = String(form.get("highlights") || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const specs = {};
    String(form.get("specs") || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        const idx = line.indexOf(":");
        if (idx > 0) {
          const key = line.slice(0, idx).trim();
          const value = line.slice(idx + 1).trim();
          if (key && value) specs[key] = value;
        }
      });

    const image1 = String(form.get("imageUrl") || "").trim();
    const image2 = String(form.get("imageUrl2") || "").trim();

    const payload = {
      name: form.get("name"),
      brand: form.get("brand"),
      category: form.get("category"),
      price: Number(form.get("price")),
      stock: Number(form.get("stock")),
      images: [image1 || "/images/placeholder.svg", image2 || "/images/placeholder.svg"],
      shortDescription: form.get("shortDescription"),
      description: form.get("description"),
      highlights,
      specs
    };

    const msg = document.getElementById("adminMsg");
    try {
      await App.request("/api/products", { method: "POST", body: JSON.stringify(payload) });
      msg.textContent = "Product created by admin.";
      msg.style.color = "var(--ok)";
      App.toast("Product created successfully");
      event.target.reset();
      await renderProducts();
    } catch (error) {
      msg.textContent = error.message;
      msg.style.color = "var(--danger)";
    }
  });

  await renderProducts();
  await renderOrders();
  App.reveal(document);
})();
