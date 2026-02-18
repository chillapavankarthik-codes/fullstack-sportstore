(async function () {
  App.layout("orders", `<h1 class="reveal" style="margin-top:0;">Order History</h1><section id="ordersList"></section>`);
  await App.loadUser();
  if (!App.state.user) {
    location.href = "/auth.html";
    return;
  }

  const data = await App.request("/api/orders", { method: "GET" });
  const orders = data.orders;
  const root = document.getElementById("ordersList");

  if (!orders.length) {
    root.innerHTML = `<div class="panel reveal"><p>No orders yet.</p><a class="btn btn-primary" href="/index.html">Start shopping</a></div>`;
    App.reveal(document);
    return;
  }

  root.innerHTML = orders
    .map((order) => {
      const items = order.items
        .map(
          (item) => `
        <div class="cart-item">
          <img
            src="${App.productImage(item.image)}"
            data-fallback="${App.productImage(item.backupImage)}"
            alt="${App.escape(item.name)}"
            onerror="if(!this.dataset.retry && this.dataset.fallback){this.dataset.retry='1';this.src=this.dataset.fallback;}else{this.onerror=null;this.src='/images/placeholder.svg';}"
          />
          <div>
            <strong>${App.escape(item.name)}</strong>
            <div class="meta">Qty: ${item.qty}</div>
          </div>
          <div style="text-align:right;"><strong>${App.currency(item.subtotal)}</strong></div>
        </div>`
        )
        .join("");

      return `
      <article class="panel reveal" style="margin-bottom:14px;">
        <div class="row">
          <div>
            <strong>${order.id}</strong>
            <div class="meta">Placed on ${App.date(order.createdAt)}</div>
          </div>
          <span class="status ${String(order.status || "").toLowerCase()}">${App.escape(order.status || "Processing")}</span>
        </div>
        ${items}
        <hr style="border:none;border-top:1px solid var(--line);margin:10px 0;" />
        <div class="row"><span>Payment</span><strong>${App.escape(order.paymentMethod)} (${App.escape(order.paymentStatus)})</strong></div>
        <div class="row"><span>Total</span><strong>${App.currency(order.totals.total)}</strong></div>
      </article>`;
    })
    .join("");

  App.reveal(document);
})();
