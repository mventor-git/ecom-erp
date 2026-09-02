# Comfort Sign — Test Accounts Matrix

Date: 2026-09-02 · Reflects the ACTUAL auth/role model (no invented roles).
All emails use the reserved `example.com` / `example` domains — synthetic only, never real people.

---

## Staff / Admin identities (`users` table — the staff identity source of truth)

| Account | Role (`roles.name`) | Email (TEST-ONLY) | Login | Permissions (pattern) | Test purpose |
|---|---|---|---|---|---|
| Admin | `admin` (role_id 1) | `admin@store.local` | `admin` | all 35 permissions (`users.*`, `orders.*`, `inventory.*`, `suppliers.*`, `customers.*`, …) | Full access; manage users/signatures; approve/decline VIP on-bill; RBAC escalation guard. |
| Warehouse | `warehouse_employee` (role_id 3) | `warehouse@example.com` | `warehouse` | `inventory.*`, `suppliers.*`, `purchase_orders.*` (probe-seeded) | Issue/supply orders, stock-in, receipt docs, own personal signature. |
| Delivery | `delivery_employee` (role_id 4) | `delivery@example.com` | `delivery` | delivery/orders work | Mark shipped/delivered, proof-of-delivery. |
| Sales (role exists, no seed user) | `sales_employee` (role_id 2) | `sales.qa@example.com` (create locally) | — | sales/orders/customers read+write | Sales console; orders; customer profile. Create via the Users page (RBAC `users.create`). |

> Passwords above are **TEST-ONLY** local seed values (`warehouse`/`delivery`/`admin`) — production uses the
> `ADMIN_PASSWORD` env guard which rejects known defaults. Never commit production credentials.

## Customer / VIP identities (`customers` table)

Normal customers and VIP customers live in one `customers` table (a `vip` flag + `invite_name` distinguish VIPs).
Orders reference a customer; there is NO separate "customer user" login on the admin side.

| Account | Type | Email (TEST-ONLY) | Payment behavior | Signature relevance |
|---|---|---|---|---|
| Customer Normal | guest/registered customer | `cust.normal@example.com` | Kashier (card/wallet) or COD; order starts `pending` → verified webhook → `paid` | N/A (customers don't sign internal docs) |
| Customer (changed address) | registered | `cust.addrchange@example.com` | order-time address snapshot is order-stable (test `addressSnapshot`) | N/A |
| VIP Customer | VIP | `cust.vip@example.com` | `onbill` → `pending_approval` + `temp_issue=1`; admin accept→`confirmed` / decline→`cancelled`; may ALSO pay Kashier normally | N/A |
| VIP invitation (pending) | invite record | `vip.invite@example.com` | created via Customers → VIP & Invitations tab; link/QR card; acceptance flips the invite | N/A |

## Signature testing (`users` table)

Every employee has their OWN personal signature (the document engine pulls the acting user's signature — never a
static/global signature, never a client-supplied "signed by X").

| Purpose | Test account | Route | Expected |
|---|---|---|---|
| Upload own signature | any signed-in staff (e.g. `warehouse`) | `PUT /api/admin/users/me/signature` (multipart PNG) | `signature_path` (`/images/signatures/…`) set; `signature_updated_at` stamped |
| Admin sets another's signature | `admin` | `PUT /api/admin/users/5/signature` (requires `users.update`) | updates Warehouse's signature |
| Remove signature | the owner or `admin` | `DELETE …/signature` | reference cleared; file removed |
| RBAC | non-admin staff without `users.update` | `PUT /api/admin/users/<otherId>/signature` | 403 (only self OR `users.update`) |

## Payment classifications (for anti-fraud tests)

| Classification | Evidence requirement |
|---|---|
| Payment-domain test | signed webhook + amount == order.total + currency EGP + merchantOrderId match ⇒ `paid` (verified evidence) |
| Amount mismatch / currency mismatch | webhook rejected ⇒ order stays `pending`, no inventory change, `paid_at` NULL |
| VIP on-bill | `payment_method='onbill'` + `status='pending_approval'` + `temp_issue=1` — NEVER `payment_method='kashier'`/`payment_status='verified'` |
| Manual admin override | must be an audited manual operation (reason/actor/method); never fabricates Kashier evidence |

## Related test files

- `server/tests/paymentDomain.test.js` — verified paid evidence; amount/currency mismatch rejection.
- `server/tests/addressSnapshot.test.js` — order-stable address snapshot.
- `server/tests/signature.test.js` — signature upload/storage/RBAC/removal.
