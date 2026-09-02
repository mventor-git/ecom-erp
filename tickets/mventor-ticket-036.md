# mventor-ticket-036 â€” Worker App (Admin Mobile) â€” v1

**Status:** v1 Complete (Delivery-first MVP)
**Created:** 2026-08-02
**Priority:** High

## Vision
One mobile app for all workers (drivers, pickers, packers, cashiers, field sales) â€” task-based screens, permission-gated by the existing RBAC, camera + offline-first.

## v1 Scope (this ticket) â€” Delivery execution
- **`worker-app/`** â€” new Expo (React Native + TypeScript) app, separate from the customer app
- **Staff JWT login** via existing `/api/v1/auth/mobile/*` (login/refresh/me/logout) â€” roles come from the token
- **Home**: today's stats (active orders, delivered today, COD collected) + active order list with status filters
- **Order detail**: customer/shipping/items/totals/payment + workflow actions from `allowed_transitions` (workflow-validated)
- **Proof of delivery**: camera photo + optional note â†’ marks order delivered, auto-collects COD (payment_status=paid)
- **Profile**: staff identity + role badge + sign out

## Backend (new)
- `server/routes/worker.js` mounted at `/api/v1/worker` (staff-JWT only; customers get 403):
  - `GET /orders` â€” active orders (excludes draft/cancelled/refunded/admin_review), status filter, pagination
  - `GET /orders/:id` â€” detail + items + `allowed_transitions` (from orderWorkflowService)
  - `PUT /orders/:id/status` â€” workflow-validated transition (events + picking/packing hooks preserved); COD auto-pay on delivered
  - `POST /orders/:id/proof` â€” multipart photo upload â†’ `public/uploads/worker-proofs/`, delivered_at stamp, COD paid; invalid transitions rejected (upload rolled back)
  - `GET /stats` â€” today's active/delivered/COD totals
- `server/index.js`: mounted route + `/uploads` static mount
- `db.js`: `orders.proof_image`, `proof_note`, `paid_at` columns (try/catch migration)

## App structure
```
worker-app/
  App.tsx                     â€” AuthProvider + stack (Login â†’ Home â†’ OrderDetail, Profile)
  src/config.ts               â€” API_BASE_URL
  src/api.ts                  â€” staff token client (refresh, FormData upload)
  src/types.ts
  src/auth/AuthContext.tsx    â€” staff login/session-restore/logout
  src/screens/LoginScreen.tsx / HomeScreen.tsx / OrderDetailScreen.tsx / ProfileScreen.tsx
```

## Acceptance Criteria
- [x] `tsc --noEmit` clean
- [x] `expo export --platform android` bundles
- [x] Integration suite: **107/107** (12 new worker tests: auth guards, list, detail, transitions, proof rejection paths, stats)
- [x] Staff-only enforcement (customer JWT â†’ 403)

## Next (v2)
- Order **assignment** to workers (assigned_to + queue per worker)
- Picker/Packer persona: scan-to-pick with camera (barcode/QR)
- Notifications: push "new order assigned"
- Offline queue for status updates (SyncAdapter)
- APK via EAS (mirror customer-app setup: eas.json, `eas build -p android --profile preview`)
- Webhook/admin-web visibility: proof photo shown in admin order detail

## Related
- Uses: `/api/v1/auth/mobile` (mventor-ticket-035a), orderWorkflowService (mventor-ticket-048 era), eventService
- Customer app: `mobile-app/` (mventor-ticket-039/040)
