# Ecom-ERP — E-commerce + ERP, zero hosting cost

Self-hosted store + back-office in one repo. Runs from a local PC: Node.js API, two React frontends, file-based SQLite, optional public tunnel. No monthly hosting bill — payment providers take only per-transaction fees.

## What it does

- **Storefront** — catalog, search, variants (color/size), cart, COD + online checkout, wishlist, order history, Google sign-in.
- **Admin ERP** — inventory movements ledger, warehouses/locations, suppliers, purchase orders, document numbering, reports + CSV, settings engine, notifications, QR codes, webhooks, users/roles/permissions, immutable event audit trail.
- **Mobile** — customer app + staff worker app (Expo), server-side cart, proof-of-delivery.
- **Payments** — Kashier (live), cash on delivery; Stripe route kept as legacy fallback; Paymob planned.

## Requirements

- Node.js 18+

## Quick start

### 1. Configure secrets

```bash
copy server\.env.example server\.env
```

Edit `server/.env` and set real values (never commit this file):

```
PORT=5172
ADMIN_USERNAME=<admin-user>
ADMIN_PASSWORD=<strong-password>
SESSION_SECRET=<random-string>
JWT_SECRET=<random-string>
CLIENT_URL=http://localhost:5173
```

Payment / mail / AI keys are managed at runtime via the admin Integrations page (stored in the settings table, secrets masked). `.env` is only the bootstrap.

### 2. Install & run

```bash
start.ps1
```

Or manually — one terminal per surface:

```bash
cd server && npm install && npm start        # API → http://localhost:5172
cd client && npm install && npm run dev      # storefront → http://localhost:5173
cd client-admin && npm install && npm run dev  # admin ERP → http://localhost:5174
```

Health: `http://localhost:5172/api/health`

### 3. Expose publicly (optional, free)

```bash
start.ps1 tunnel
```

Point the payment provider webhook at the public URL. Inspect traffic at the tunnel's local UI while testing.

## Project structure

```
ecom-erp/
├── start.ps1        # one-click launcher (app / tunnel / prod)
├── server/          # Express API (index.js, db.js, routes/, services/, middleware/)
├── client/          # customer storefront (React + Vite)
├── client-admin/    # admin ERP panel (React + Vite)
├── mobile-app/      # customer app (Expo, separate nested repo)
├── worker-app/      # staff app (Expo, separate nested repo)
├── docs/            # PROJECT_STATE, HANDOVER, BACKLOG, CHANGELOG, guides
├── deps/            # external reference material (read-only, never imported)
└── tickets/         # local working tickets (not committed)
```

## Configuration rules

- Every configurable value lives in the **settings table** (admin UI editable).
- `.env` holds **secrets + per-machine hosts only**.
- Store identity (name, logo, tagline, currency) comes from `GET /api/settings/public` — never hardcoded in UI.
- Inventory is movement-derived only; documents are never deleted (cancelled is a status); every mutation emits an event.

## Testing

```bash
cd server
npm test                 # unit
npm run test:integration # API (boots the real DB — never destructive)
```

Both suites must pass before any change is considered done.

## Security

- Secrets only in `server/.env` (gitignored) or the masked settings store.
- Session + JWT auth, RBAC re-validated backend-side, CSRF on admin mutations, rate limits, Helmet headers, parameterized queries.
- Rotate all keys before exposing any public URL.

## Docs

Start with `docs/PROJECT_STATE.md`, then `docs/HANDOVER.md`, `docs/SETUP.md`, `docs/API_DOCUMENTATION.md`.

## License

MIT
