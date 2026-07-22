# Johnson Zoglo — Portfolio & JZ Market

A creator portfolio, local Stream Vault, and general marketplace for games, phones, laptops, cars, gadgets, and other products.

## Run locally

Node.js is required. From this folder, seed the owner password and start the server:

```powershell
npm run seed:admin
npm start
```

Then open:

- Portfolio: <http://localhost:8002>
- Market: <http://localhost:8002/shop.html>
- Stream Vault: <http://localhost:8002/streams.html>
- Owner dashboard: <http://localhost:8002/admin.html>
- Business operations: <http://localhost:8002/operations.html>
- Team access: <http://localhost:8002/team.html>

You can also use the launcher:

```powershell
powershell -ExecutionPolicy Bypass -File .\server.ps1 -Port 8002 -AdminPassword 'choose-a-private-password'
```

The password prompt hides the value while you type. There is no default admin password.

## Deploy with Dokploy

1. Create a Docker Compose service from this GitHub repository.
2. Deploy using `docker-compose.yml`.
3. Open the `portfolio` container terminal and run `npm run seed:admin`.
4. Enter a password of at least 12 characters at the hidden prompt.
5. In the Domains tab, add a domain for the `portfolio` service on port `8002`.

The `portfolio_data_clean` and `portfolio_uploads_clean` named volumes preserve store data and uploaded product photos across redeployments. Run `npm run seed:admin` again whenever the owner password needs to be reset.

## Commerce features

- Products are stored in `data/products.json`.
- Orders are stored in `data/orders.json`.
- The owner dashboard manages product details, pricing, inventory, condition, visibility, and product photos.
- Guest checkout supports cash on delivery/collection and bank transfer after confirmation.
- Stock is checked and deducted by the server when an order is placed.
- Uploaded product photos are limited to PNG, JPEG, or WebP files under 5MB and stored in `assets/uploads/`.
- The operations center manages customers, delivery zones, tax, discounts, payments, refunds, reports, invoices, audit history, and backup/recovery.

Online card payments, transactional email, delivery pricing, tax, customer accounts, and production database hosting still require external services and production configuration.

## Stream storage

The Stream Vault stores uploaded replay videos locally in the current browser with IndexedDB. A public version needs authenticated cloud video storage.
