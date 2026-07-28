# Johnson Zoglo — Portfolio & JZ Market

A creator portfolio, learning academy, and general marketplace for games, phones, laptops, cars, gadgets, and other products.

## Run locally

Node.js is required. From this folder, seed the owner password and start the server:

```powershell
npm run seed:admin
npm start
```

Then open:

- Portfolio: <http://localhost:8000>
- Market: <http://localhost:8000/shop.html>
- JZ Academy: <http://localhost:8000/streams.html>
- Owner dashboard: <http://localhost:8000/admin.html>
- Business operations: <http://localhost:8000/operations.html>
- Team access: <http://localhost:8000/team.html>

You can also use the launcher:

```powershell
powershell -ExecutionPolicy Bypass -File .\server.ps1 -Port 8000 -AdminPassword 'choose-a-private-password'
```

The password prompt hides the value while you type. There is no default admin password.

## Deploy with Dokploy

1. Create a Docker Compose service from this GitHub repository.
2. Copy `.env.example` to a private `.env` configuration and set the public URL and long random signing secrets.
3. Add Stripe and Resend credentials when card payments and transactional email are required.
4. Deploy using `docker-compose.yml`.
5. Open the `portfolio` container terminal and run `npm run seed:admin`.
6. Enter a unique password of at least 12 characters at the hidden prompt.
7. In the Domains tab, add an HTTPS domain for the `portfolio` service on port `8000`.
8. In Stripe, send `checkout.session.completed` webhooks to `https://your-domain/api/payments/stripe/webhook`.

The data, uploads, and backup named volumes preserve business records and media across redeployments. Automated full snapshots use `BACKUP_INTERVAL_HOURS` and remove snapshots older than `BACKUP_RETENTION_DAYS`. Run `npm run seed:admin` whenever the owner password needs to be reset.

## Commerce features

- Products are stored in `data/products.json`.
- Orders are stored in `data/orders.json`.
- The owner dashboard manages product details, pricing, inventory, condition, visibility, and product photos.
- Products support galleries, collections, variants, sale pricing, featured placement, and bulk inventory actions.
- Checkout supports Stripe card payment, cash on delivery/collection, and bank transfer.
- Stripe webhooks mark orders paid automatically; Academy payments immediately unlock the purchased course.
- Stock is checked and deducted by the server when an order is placed.
- Uploaded product photos are limited to PNG, JPEG, or WebP files under 5MB and stored in `assets/uploads/`.
- The operations center manages customers, delivery zones, tax, discounts, payments, refunds, reports, invoices, audit history, and backup/recovery.

Card payment and transactional email activate when their environment credentials are present. Without credentials, the site safely keeps cash and bank-transfer workflows available.

## Academy storage

JZ Academy is managed from the admin dashboard. Courses support modules, ordered lessons, cover images, scheduled publishing, free or paid access, video links, and downloadable resources. Direct public access to local paid-course files is denied. Enrolled customers receive expiring, signed media links that are checked against their active course access.

## Content, media, and analytics

- Homepage copy, links, SEO preview text, and feature images can be drafted and published from the admin dashboard.
- The reusable media library manages uploaded images, PDFs, and ZIP downloads.
- Privacy-friendly analytics record page, product, course, cart, and checkout activity without storing visitor identities.
- Customer email and WhatsApp actions create editable order-status messages and keep a communication history on each order.

## Production services

- **Payments:** Stripe Checkout. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
- **Email:** Resend. Set `RESEND_API_KEY` and a verified `EMAIL_FROM`.
- **Recovery:** Password-reset links are one-time, hashed in storage, and expire after 30 minutes.
- **Media:** Paid local uploads use signed, one-hour delivery URLs. For large production video libraries, place the origin behind a CDN and keep JZ access checks in front of delivery.
- **Security:** HTTPS should be terminated by the deployment platform. The server adds content, framing, referrer, and browser-permission security headers.
- **Legal:** Terms, privacy, refund, Academy access, and cookie policies are available at `/legal.html`.
- **Health:** Deployment monitoring can call `/api/health`.

## Verification

Run the syntax and launch tests before deployment:

```powershell
npm run check
```
