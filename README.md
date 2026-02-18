# Nimble Full-Stack

Full-stack sports equipment shopping website with:
- Product catalog with search and sort
- Product detail pages with rich images/descriptions
- Cart and checkout
- User auth (register/login/logout)
- Order history
- Admin panel (inventory + order status)
- Admin image upload support
- Stripe Checkout integration (when configured)

## Open in VS Code

1. Open VS Code.
2. Click `File -> Open Folder...`.
3. Choose:
   `/Users/pavankarthikchilla/Documents/first codex proejct/fullstack-sportstore`

## Run

```bash
cd "/Users/pavankarthikchilla/Documents/first codex proejct/fullstack-sportstore"
npm start
```

Then open:
- `http://127.0.0.1:3000`

## Demo credentials

- Email: `admin@sportstore.local`
- Password: `admin123`

These are auto-seeded on first server start. Change with env vars for real use.

## Stripe setup

1. Copy `.env.example` to `.env`.
2. Set `STRIPE_SECRET_KEY`.
3. Optionally set `APP_ORIGIN` if host/port changes.
4. In checkout, select `Stripe Checkout`.

If Stripe key is missing, checkout returns a clear error.

## Notes

- Data is persisted in `data/db.json`.
- Uploaded admin images are stored in `uploads/` and served from `/uploads/...`.
- This is a practical starter implementation for learning and prototyping.
