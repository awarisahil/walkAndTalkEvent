# PROJECT PROGRESS — Event Platform Completion

## Current state
- Backend (Express 5 + Prisma 7 + PostgreSQL): auth, roles, events, ticket requests, payments (simulated), customer tickets — builds clean (`npx tsc --noEmit` OK).
- Frontend (React 19 + Vite): bare scaffold, 4 static routes, no API layer. Builds clean after `npm install`.
- DB: created locally (`walkandtalk`), migration `20260922104551_init` applied, admin seeded (admin@eventplatform.com).
- Git: clean except untracked root `package-lock.json`.

## Environment notes
- `.env` had placeholder DB name `YOUR_DATABASE_NAME`; renamed DB to `walkandtalk` and updated `.env` (sed, 1 occurrence). `.env` keys: DATABASE_URL, JWT_ACCESS_EXPIRES_IN, JWT_ACCESS_SECRET, NODE_ENV, PORT. No Razorpay keys yet (to be added in M4).
- Local Postgres on :5432, OS user `botplus` has no DB role; app connects via creds in `.env`.

## Checklist / milestones
- [x] Baseline: builds, DB connectivity, git status
- [ ] M1 Foundations: error middleware, response shape `{success,data|message}`, health endpoint, CORS allowlist, rate limit on auth, .env.example, graceful shutdown
- [ ] M1b Profiles: GET/PATCH /api/users/me (full safe profile), customer profile update (name, phone, age, instagram fields), duplicate-email handling, mass-assignment guard
- [ ] M1c Events: admin list all statuses + search/filter/pagination; public search by title/venue; consistent response shape; safe event serialization
- [ ] M2 Requests: admin filters (event/status/date/search by name-email), customer cancel (PENDING only), capacity correctness (row lock on Event at approve, count PAYMENT_PENDING+PAID), reservation expiry (payment window), one-active-payment guard
- [ ] M3 Attendees + check-in: GET /api/events/:id/attendees (confirmed vs reserved, stats, search, filter, paginate), CSV export, QR token on ticket (populate qrCode with opaque token), POST /api/tickets/check-in (atomic ACTIVE→USED, event match, timestamps + admin), manual entry support
- [ ] M4 Payments: remove/gate dev `PATCH /payments/:id/complete`, internal completePayment service, Razorpay order create + signature verify + webhook (raw body, idempotent, env placeholders, docs) — client callback never sufficient
- [ ] M5 Frontend public: API client, auth context, landing, event discovery + search/filter, event detail, login, register, 404
- [ ] M5b Frontend customer: dashboard, profile edit, my requests (+rejection reasons), awaiting-payment + pay (Razorpay checkout), payments, tickets + QR display
- [ ] M5c Frontend admin: stats, events CRUD + publish/cancel/complete, request review queue (customer profile, approve/reject + reason), payments, attendees (search/filter/stats/CSV), check-in (manual + camera scan w/ fallback)
- [ ] M6 Tests: backend integration tests (auth, RBAC, events, requests, capacity concurrency, payments/tickets idempotency, check-in), frontend build+lint
- [ ] M7 Docs: README (setup, env, migrations, seed, test, deploy), `.env.example` both sides, final report

## Known backend gaps (from audit)
- No centralized error middleware; controllers string-match error messages.
- `Ticket.qrCode` never populated; no check-in; `USED` never set.
- Dev payment bypass `PATCH /api/payments/:id/complete` trusts client.
- Capacity check is count-then-act (race-prone under concurrency).
- No pagination/search/filters on lists; no admin event list (drafts invisible).
- No profile update; `/me` returns only id+role.
- CORS open, no rate limit, no health endpoint, no graceful shutdown.
- Seed has hardcoded admin password; no `.env.example`.
- Stray dead line `payment: false` in ticket.service.ts select.
- No tests.

## Files changed so far
- `backend/scripts/ensure-db.ts` (new): creates DATABASE from .env if missing.
- `backend/.env`: DB name placeholder fixed to `walkandtalk` (no values changed otherwise).

## Build/test results
- backend `npx tsc --noEmit`: PASS (baseline)
- frontend `npm run build`: PASS (baseline)
- `prisma migrate deploy`: applied; schema up to date.

## Next exact actions
1. Read backend src (server, controllers, services, middleware, validators).
2. Implement M1 (error middleware + helpers, health, CORS/rate-limit, env example, shutdown).
3. Then M1b/M1c profile + event endpoints.
