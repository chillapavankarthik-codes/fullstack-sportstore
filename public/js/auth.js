(async function () {
  App.layout(
    "shop",
    `<section class="panel reveal">
      <h1 style="margin-top:0;">Account Access</h1>
      <p class="meta">Demo admin credentials: <strong>admin@sportstore.local</strong> / <strong>admin123</strong> (change in env).</p>
      <div class="auth-grid">
        <form class="panel reveal" id="loginForm">
          <h3 style="margin-top:0;">Login</h3>
          <input required name="email" type="email" placeholder="Email" />
          <input required name="password" type="password" placeholder="Password" style="margin-top:8px;" />
          <button class="btn-primary" type="submit" style="margin-top:10px;">Login</button>
        </form>
        <form class="panel reveal" id="registerForm">
          <h3 style="margin-top:0;">Create Account</h3>
          <input required name="name" placeholder="Full name" />
          <input required name="email" type="email" placeholder="Email" style="margin-top:8px;" />
          <input required name="password" type="password" minlength="6" placeholder="Password (min 6 chars)" style="margin-top:8px;" />
          <button class="btn-primary" type="submit" style="margin-top:10px;">Register</button>
        </form>
      </div>
      <p id="authMsg" class="meta" style="margin-top:12px;"></p>
    </section>`
  );

  await App.loadUser();
  if (App.state.user) {
    location.href = "/index.html";
    return;
  }

  const msg = document.getElementById("authMsg");

  document.getElementById("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    try {
      const data = await App.request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") })
      });
      App.setUser(data.user);
      location.href = "/index.html";
    } catch (error) {
      msg.textContent = error.message;
      msg.style.color = "var(--danger)";
    }
  });

  document.getElementById("registerForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    try {
      await App.request("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name: form.get("name"), email: form.get("email"), password: form.get("password") })
      });
      msg.textContent = "Registration complete. You can now login.";
      msg.style.color = "var(--ok)";
      event.target.reset();
    } catch (error) {
      msg.textContent = error.message;
      msg.style.color = "var(--danger)";
    }
  });

  App.reveal(document);
})();
