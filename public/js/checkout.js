(async function () {
  App.layout(
    "cart",
    `<h1 class="reveal" style="margin-top:0;">Checkout</h1>
    <section class="page reveal">
      <div class="panel reveal">
        <form id="checkoutForm">
          <h3 style="margin-top:0;">Shipping Information</h3>
          <div class="row"><input required name="name" placeholder="Full name" /><input required name="phone" placeholder="Phone" /></div>
          <input required name="address" placeholder="Street address" style="margin-top:8px;" />
          <div class="row"><input required name="city" placeholder="City" /><input required name="state" placeholder="State" /><input required name="zip" placeholder="ZIP" /></div>
          <h3>Payment Method</h3>
          <select name="paymentMethod" required>
            <option value="">Select payment</option>
            <option value="mock">Mock Card Payment</option>
            <option value="stripe">Stripe Checkout</option>
          </select>
          <button type="submit" class="btn-primary" style="margin-top:10px;">Place Order</button>
        </form>
        <p id="checkoutMsg" class="meta" style="margin-top:10px;"></p>
      </div>
      <aside class="panel reveal" id="summary"></aside>
    </section>`
  );

  await App.loadUser();
  if (!App.state.user) {
    location.href = "/auth.html";
    return;
  }

  const products = (await App.request("/api/products", { method: "GET" })).products;

  const items = App.state.cart
    .map((entry) => {
      const p = products.find((x) => x.id === entry.productId);
      if (!p) return null;
      return { productId: p.id, name: p.name, qty: entry.qty, subtotal: p.price * entry.qty };
    })
    .filter(Boolean);

  if (!items.length) {
    document.getElementById("summary").innerHTML = `<p>Your cart is empty. <a href="/index.html">Go shopping</a>.</p>`;
    document.getElementById("checkoutForm").classList.add("hidden");
    App.reveal(document);
    return;
  }

  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const shipping = subtotal > 150 ? 0 : 14.99;
  const tax = subtotal * 0.08;
  const total = subtotal + shipping + tax;

  document.getElementById("summary").innerHTML = `
    <h3 style="margin-top:0;">Your Items</h3>
    ${items.map((i) => `<div class="row"><span>${i.qty} x ${App.escape(i.name)}</span><strong>${App.currency(i.subtotal)}</strong></div>`).join("")}
    <hr style="border:none;border-top:1px solid var(--line);margin:10px 0;" />
    <div class="row"><span>Subtotal</span><strong>${App.currency(subtotal)}</strong></div>
    <div class="row"><span>Shipping</span><strong>${shipping ? App.currency(shipping) : "Free"}</strong></div>
    <div class="row"><span>Tax</span><strong>${App.currency(tax)}</strong></div>
    <div class="row"><span>Total</span><strong>${App.currency(total)}</strong></div>
  `;

  const msg = document.getElementById("checkoutMsg");

  document.getElementById("checkoutForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    try {
      const payload = {
        items: App.state.cart,
        paymentMethod: form.get("paymentMethod"),
        shipping: {
          name: form.get("name"),
          phone: form.get("phone"),
          address: form.get("address"),
          city: form.get("city"),
          state: form.get("state"),
          zip: form.get("zip")
        }
      };
      const data = await App.request("/api/checkout", { method: "POST", body: JSON.stringify(payload) });
      if (data.order.checkoutUrl) {
        location.href = data.order.checkoutUrl;
        return;
      }
      App.state.cart = [];
      App.saveCart();
      App.updateMiniCart();
      msg.textContent = `Order ${data.order.id} placed successfully.`;
      msg.style.color = "var(--ok)";
      setTimeout(() => (location.href = "/orders.html"), 900);
    } catch (error) {
      msg.textContent = error.message;
      msg.style.color = "var(--danger)";
    }
  });

  App.reveal(document);
})();
