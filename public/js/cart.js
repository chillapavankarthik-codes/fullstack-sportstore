(async function () {
  App.layout("cart", `<h1 class="reveal" style="margin-top:0;">Shopping Cart</h1><section class="page reveal"><div class="panel reveal" id="cartPanel"></div><aside class="panel reveal" id="summaryPanel"></aside></section>`);
  await App.loadUser();

  const data = await App.request("/api/products", { method: "GET" });
  const products = data.products;

  function detailedItems() {
    return App.state.cart
      .map((entry) => {
        const product = products.find((p) => p.id === entry.productId);
        if (!product) return null;
        return {
          product,
          qty: entry.qty,
          subtotal: Number((product.price * entry.qty).toFixed(2))
        };
      })
      .filter(Boolean);
  }

  function totals(items) {
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const shipping = subtotal > 150 || subtotal === 0 ? 0 : 14.99;
    const tax = Number((subtotal * 0.08).toFixed(2));
    return { subtotal, shipping, tax, total: Number((subtotal + shipping + tax).toFixed(2)) };
  }

  function render() {
    const items = detailedItems();
    const cartPanel = document.getElementById("cartPanel");
    const summaryPanel = document.getElementById("summaryPanel");

    if (!items.length) {
      cartPanel.innerHTML = `<p>Your cart is empty.</p><a href="/index.html" class="btn btn-primary">Continue shopping</a>`;
      summaryPanel.innerHTML = `<h3>Summary</h3><p>No items selected.</p>`;
      App.reveal(document);
      return;
    }

    cartPanel.innerHTML = items
      .map(
        (item) => `
      <article class="cart-item">
        <img
          src="${App.productImage(item.product.images?.[0])}"
          data-fallback="${App.productImage(item.product.images?.[1])}"
          alt="${App.escape(item.product.name)}"
          onerror="if(!this.dataset.retry && this.dataset.fallback){this.dataset.retry='1';this.src=this.dataset.fallback;}else{this.onerror=null;this.src='/images/placeholder.svg';}"
        />
        <div>
          <strong>${App.escape(item.product.name)}</strong>
          <div class="meta">${App.escape(item.product.shortDescription || "")}</div>
          <div class="meta">${App.currency(item.product.price)} each</div>
          <div style="max-width:140px; margin-top:8px;"><input type="number" min="1" max="${item.product.stock}" value="${item.qty}" data-qty="${item.product.id}" /></div>
        </div>
        <div style="text-align:right;">
          <div><strong>${App.currency(item.subtotal)}</strong></div>
          <button class="btn-secondary" data-remove="${item.product.id}" style="margin-top:8px;">Remove</button>
        </div>
      </article>`
      )
      .join("");

    const t = totals(items);
    summaryPanel.innerHTML = `
      <h3 style="margin-top:0;">Order Summary</h3>
      <div class="row"><span>Subtotal</span><strong>${App.currency(t.subtotal)}</strong></div>
      <div class="row"><span>Shipping</span><strong>${t.shipping ? App.currency(t.shipping) : "Free"}</strong></div>
      <div class="row"><span>Tax</span><strong>${App.currency(t.tax)}</strong></div>
      <hr style="border:none;border-top:1px solid var(--line);margin:10px 0;" />
      <div class="row"><span>Total</span><strong>${App.currency(t.total)}</strong></div>
      <a href="/checkout.html" class="btn btn-primary" style="display:block;text-align:center;margin-top:10px;">Proceed to Checkout</a>
    `;

    cartPanel.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => {
        App.removeCartItem(btn.dataset.remove);
        render();
      });
    });

    cartPanel.querySelectorAll("[data-qty]").forEach((input) => {
      input.addEventListener("change", () => {
        App.setCartQty(input.dataset.qty, Number(input.value || "1"));
        render();
      });
    });

    App.reveal(document);
  }

  render();
})();
