(async function () {
  App.layout("shop", `<div id="productRoot"></div>`);
  await App.loadUser();

  const params = new URLSearchParams(location.search);
  const id = params.get("id");

  if (!id) {
    document.getElementById("productRoot").innerHTML = `<div class="panel reveal">Product id missing.</div>`;
    App.reveal(document);
    return;
  }

  let product;
  try {
    const data = await App.request(`/api/products/${id}`, { method: "GET" });
    product = data.product;
  } catch {
    document.getElementById("productRoot").innerHTML = `<div class="panel reveal">Product not found.</div>`;
    App.reveal(document);
    return;
  }

  const highlights = product.highlights.map((x) => `<li>${App.escape(x)}</li>`).join("");
  const specs = Object.entries(product.specs)
    .map(([k, v]) => `<tr><td>${App.escape(k)}</td><td>${App.escape(v)}</td></tr>`)
    .join("");

  const primaryImage = App.productImage(product.images?.[0]);
  const fallbackImage = App.productImage(product.images?.[1]);

  document.getElementById("productRoot").innerHTML = `
    <section class="page reveal">
      <div class="panel reveal">
        <div class="gallery">
          <div class="thumbs" id="thumbs"></div>
          <img id="mainImage" class="main-image" src="${primaryImage}" data-fallback="${fallbackImage}" alt="${App.escape(product.name)}"
            onerror="if(!this.dataset.retry && this.dataset.fallback){this.dataset.retry='1';this.src=this.dataset.fallback;}else{this.onerror=null;this.src='/images/placeholder.svg';}" />
        </div>
      </div>
      <aside class="panel reveal">
        <span class="badge">${App.escape(product.category)}</span>
        <h1 style="margin:8px 0;">${App.escape(product.name)}</h1>
        <div class="meta">by ${App.escape(product.brand)}</div>
        <div class="meta">${App.stars(product.rating)} ${product.rating} (${product.reviewCount.toLocaleString()} ratings)</div>
        <p>${App.escape(product.description)}</p>
        <div class="price">${App.currency(product.price)}</div>
        <div class="meta ${product.stock <= 10 ? "stock low" : ""}">${product.stock > 0 ? `${product.stock} available` : "Out of stock"}</div>
        <div class="row" style="margin-top:10px;">
          <label for="qty">Qty</label>
          <input id="qty" type="number" min="1" max="${Math.max(1, product.stock)}" value="1" style="max-width:120px;" />
        </div>
        <div class="actions" style="margin-top:10px;">
          <button id="addBtn" class="btn-primary" ${product.stock === 0 ? "disabled" : ""}>Add to Cart</button>
          <a href="/cart.html" class="btn btn-secondary">Go to Cart</a>
        </div>
      </aside>
    </section>
    <section class="panel reveal" style="margin-top:16px;">
      <h3 style="margin-top:0;">About this item</h3>
      <ul class="list">${highlights}</ul>
    </section>
    <section class="panel reveal" style="margin-top:16px;">
      <h3 style="margin-top:0;">Technical Details</h3>
      <table class="specs">${specs}</table>
    </section>
  `;

  const images = Array.isArray(product.images) && product.images.length ? product.images : ["/images/placeholder.svg"];
  document.getElementById("thumbs").innerHTML = images
    .map(
      (img, i) => `<img src="${App.productImage(img)}" data-src="${App.productImage(img)}" alt="${App.escape(product.name)} image ${i + 1}"
      onerror="this.onerror=null;this.src='/images/placeholder.svg';" />`
    )
    .join("");

  document.querySelectorAll("#thumbs img").forEach((img) => {
    img.addEventListener("click", () => {
      const mainImage = document.getElementById("mainImage");
      mainImage.dataset.retry = "";
      mainImage.src = img.dataset.src;
    });
  });

  const addBtn = document.getElementById("addBtn");
  if (addBtn) {
    addBtn.addEventListener("click", () => {
      const qty = Number(document.getElementById("qty").value || "1");
      App.addToCart(product.id, Math.min(qty, product.stock));
      App.toast("Successfully added to cart");
      addBtn.textContent = "Added to Cart";
    });
  }

  App.reveal(document);
})();
