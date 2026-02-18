(async function () {
  App.layout(
    "shop",
    `<section class="hero reveal">
      <h1>Precision Gear. Minimal Interface.</h1>
      <p>Explore a premium sports catalog with rich product details, smooth interactions, and quick checkout flow.</p>
      <div class="kpi-row" id="kpiRow"></div>
    </section>
    <section style="margin-top:14px;">
      <div class="row">
        <strong id="resultsLabel">Products</strong>
        <select id="sortSelect" style="max-width:230px;">
          <option value="popular">Sort: Most Popular</option>
          <option value="price-low">Price: Low to High</option>
          <option value="price-high">Price: High to Low</option>
          <option value="rating">Customer Rating</option>
        </select>
      </div>
      <div class="grid" id="grid"></div>
    </section>`
  );

  await App.loadUser();

  const params = new URLSearchParams(location.search);
  const query = params.get("q") || "";
  const category = params.get("category") || "";

  if (query) document.getElementById("searchInput").value = query;
  if (category) document.getElementById("searchCategory").value = category;

  function renderKpis(products) {
    const avgRating =
      products.reduce((sum, product) => sum + Number(product.rating || 0), 0) / Math.max(products.length, 1);
    const stockUnits = products.reduce((sum, product) => sum + Number(product.stock || 0), 0);

    document.getElementById("kpiRow").innerHTML = `
      <div class="kpi"><div class="v">${products.length}</div><div>Products</div></div>
      <div class="kpi"><div class="v">${avgRating.toFixed(1)}</div><div>Avg Rating</div></div>
      <div class="kpi"><div class="v">${stockUnits}</div><div>Units in Stock</div></div>
      <div class="kpi"><div class="v">${new Set(products.map((p) => p.category)).size}</div><div>Sports Categories</div></div>
    `;
  }

  function attachCardTilt(grid) {
    const cards = grid.querySelectorAll(".product-card");
    cards.forEach((card) => {
      card.addEventListener("mousemove", (event) => {
        if (window.matchMedia("(pointer: coarse)").matches) return;
        const rect = card.getBoundingClientRect();
        const px = (event.clientX - rect.left) / rect.width;
        const py = (event.clientY - rect.top) / rect.height;
        const rotateY = (px - 0.5) * 5;
        const rotateX = (0.5 - py) * 5;
        card.style.transform = `translateY(-6px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      });
      card.addEventListener("mouseleave", () => {
        card.style.transform = "translateY(0) rotateX(0) rotateY(0)";
      });
    });
  }

  async function fetchProducts(sort = "popular") {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (category) p.set("category", category);
    p.set("sort", sort);
    const data = await App.request(`/api/products?${p.toString()}`, { method: "GET" });
    return data.products;
  }

  function render(list) {
    document.getElementById("resultsLabel").textContent = `${list.length} result(s)`;
    renderKpis(list);
    const grid = document.getElementById("grid");

    grid.innerHTML = list
      .map((p) => {
        const primaryImage = App.productImage(p.images?.[0]);
        const fallbackImage = App.productImage(p.images?.[1]);

        return `
          <article class="card product-card reveal">
            <a href="/product.html?id=${p.id}">
              <img
                src="${primaryImage}"
                data-fallback="${fallbackImage}"
                alt="${App.escape(p.name)}"
                onerror="if(!this.dataset.retry && this.dataset.fallback){this.dataset.retry='1';this.src=this.dataset.fallback;}else{this.onerror=null;this.src='/images/placeholder.svg';}"
              />
            </a>
            <div class="card-content">
              <span class="badge">${App.escape(p.category)}</span>
              <strong><a href="/product.html?id=${p.id}">${App.escape(p.name)}</a></strong>
              <div class="meta">${App.stars(p.rating)} ${p.rating} (${p.reviewCount.toLocaleString()} reviews)</div>
              <div class="meta">${App.escape(p.brand)}</div>
              <div class="price">${App.currency(p.price)}</div>
              <div class="meta ${p.stock <= 10 ? "stock low" : ""}">${p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}</div>
              <div class="actions">
                <button class="btn-primary" data-add="${p.id}" ${p.stock === 0 ? "disabled" : ""}>Add to Cart</button>
                <a class="btn btn-secondary" href="/product.html?id=${p.id}">Details</a>
              </div>
            </div>
          </article>`;
      })
      .join("");

    grid.querySelectorAll("[data-add]").forEach((btn) => {
      btn.addEventListener("click", () => {
        App.addToCart(btn.dataset.add, 1);
        App.toast("Successfully added to cart");
        btn.textContent = "Added";
        setTimeout(() => (btn.textContent = "Add to Cart"), 700);
      });
    });

    App.reveal(grid);
    attachCardTilt(grid);
  }

  async function load(sort = "popular") {
    const products = await fetchProducts(sort);
    render(products);
  }

  document.getElementById("sortSelect").addEventListener("change", (event) => load(event.target.value));
  await load();
})();
