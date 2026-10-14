# Walk & Talk Event — Event Platform

#Find site at this ip
        ||
        \/
http://65.21.8.185:5050/

An approval-first event management and ticketing platform (Luma-style). An admin
publishes events; customers request tickets; the admin reviews each request and
approves or rejects it; approved customers pay; a verified payment produces
exactly one ticket with a QR code; the admin checks attendees in at the door.

## Architecture

| Layer    | Stack                                                        |
| -------- | ------------------------------------------------------------ |
| Frontend | React 19, Vite, TypeScript, React Router 7, Axios, plain CSS |
| Backend  | Node.js, Express 5, TypeScript, Prisma 7, PostgreSQL         |
| Auth     | JWT (bearer), bcrypt password hashing, ADMIN / CUSTOMER roles |
| Payments | Razorpay (orders, signature + webhook verification)          |

## Project layout

```
backend/    Express API (src/app.ts = app, src/server.ts = HTTP server)
  prisma/   schema, migrations, seed
  tests/    vitest + supertest integration tests (separate test database)
frontend/   React SPA (src/api, src/context, src/router, src/pages)
```

## Quick start (local development)

Prerequisites: Node.js 20+, a PostgreSQL server.

```bash
# 1. Backend
cd backend
cp .env.example .env          # then fill in real values (see below)
npm install
npm run ensure-db             # creates the database from DATABASE_URL if missing
npx prisma migrate deploy     # apply migrations
npm run seed                  # create the admin user (+ demo data if enabled)
npm run dev                   # http://localhost:5000

# 2. Frontend (new terminal)
cd frontend
cp .env.example .env          # VITE_API_URL=http://localhost:5000/api
npm install
npm run dev                   # http://localhost:5173
```

Default seeded admin (change `ADMIN_EMAIL` / `ADMIN_PASSWORD` before seeding):
`admin@eventplatform.com` / `Admin@12345`.

> Note: `prisma migrate dev` needs an interactive terminal. In headless
> environments create migrations with
> `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`
> saved into a new folder under `prisma/migrations/`, then `npx prisma migrate deploy`.

## Backend environment variables

| Variable                   | Required | Purpose                                             |
| -------------------------- | -------- | --------------------------------------------------- |
| `PORT`                     | no       | HTTP port (default 5000)                            |
| `NODE_ENV`                 | no       | `production` disables the dev payment bypass        |
| `CORS_ORIGIN`              | no       | Comma-separated allowed frontend origins            |
| `DATABASE_URL`             | yes      | PostgreSQL connection string                        |
| `JWT_ACCESS_SECRET`        | yes      | Secret for signing access tokens                    |
| `JWT_ACCESS_EXPIRES_IN`    | no       | Token TTL (default `15m`)                           |
| `PAYMENT_RESERVATION_MINUTES` | no    | How long an approval holds a seat (default 30)      |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | no  | Seed credentials for the admin account              |
| `SEED_DEMO_DATA`           | no       | `true` seeds a demo customer + published event      |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | no | Razorpay standard keys (test mode to start) |
| `RAZORPAY_WEBHOOK_SECRET`  | no       | Razorpay webhook signing secret                     |

`.env` is git-ignored. Copy `.env.example` and fill values; never commit secrets.

## Payments (Razorpay)

The payment flow is server-authoritative:

1. `POST /api/payments` creates the internal payment record (amount always from the DB).
2. `POST /api/payments/:id/razorpay-order` creates the Razorpay order and stores `providerOrderId`.
3. The browser pays via Razorpay Checkout (`key_id` is public, safe for the client).
4. `POST /api/payments/verify` checks the checkout signature (`order_id|payment_id` HMAC) and fulfills.
5. `POST /api/webhooks/razorpay` (raw body, `x-razorpay-signature` HMAC) fulfills/refunds idempotently.

Fulfilment is a single DB transaction (`fulfillPayment`): payment → SUCCESS,
request → PAID, one ticket with QR token — safe under duplicate webhook delivery.

**Without Razorpay keys** the pay buttons stay disabled and the API fails closed
(503/400). A `PATCH /api/payments/:id/complete` dev simulation exists for local
development only and is **never mounted when `NODE_ENV=production`**.

Setup checklist for real payments (test mode first):
1. Create a Razorpay account → Settings → API Keys → generate **test** key pair.
2. Put `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` in `backend/.env`.
3. Dashboard → Settings → Webhooks → add `https://<your-domain>/api/webhooks/razorpay`,
   secret = `RAZORPAY_WEBHOOK_SECRET`, subscribe to `payment.captured` + `payment.failed`.
4. Test a full payment with Razorpay test cards before switching to live keys.

## Testing

Backend integration tests (vitest + supertest) run against a **separate
database** (`walkandtalk_test`, derived from your `DATABASE_URL` with the name
swapped) — your development data is never touched:

```bash
cd backend
npm run test        # or: npx vitest run
```

Frontend: `cd frontend && npm run build && npm run lint`.

## Security notes

- All secrets live in env vars; nothing sensitive is exposed to the frontend
  (only the public Razorpay `key_id` and feature flags).
- Role checks are enforced on every admin route; ownership checks on every
  customer payment/ticket/request lookup.
- Capacity is protected with row-level locking (`SELECT … FOR UPDATE` on the
  event inside a transaction) plus reservation expiry; the capacity check
  cannot race under concurrent approvals.
- Login/register are rate-limited; Helmet sets security headers; CORS is
  restricted to `CORS_ORIGIN`.
- QR codes contain an opaque random token only — no personal data.

## Deployment notes

- Build: `cd backend && npm run build` (tsc → `dist/`), `cd frontend && npm run build`.
- Run: `node backend/dist/server.js` with production env; serve `frontend/dist`
  from any static host/CDN. Set `CORS_ORIGIN` to the frontend origin and
  `VITE_API_URL` at build time to the public API URL.
- Use HTTPS in production (Razorpay webhooks + camera-based QR scanning need it).
- Back up PostgreSQL regularly; run `npx prisma migrate deploy` on each release.
- Keep `NODE_ENV=production` so the dev payment bypass stays disabled.
