# Accounting Domain Gap Map — ECOM-ERP vs SmartAccounting reference (074)

Reference = semantics/invariants/tests ONLY (journal model, balance rules, report meanings). Rejected: Flask/app.py/database.py/global-state/SQLite-as-target/REAL-money/credentials/seeds. ECOM-ERP keeps INTEGER cents (stronger than reference REAL — never adopt float money).

## Concept map (Present / Partial / Missing → truth → risk → next)

| Reference concept | ECOM-ERP equivalent | State | Source of truth today | Risk | Next extraction |
|---|---|---|---|---|---|
| Chart of Accounts (typed, coded, dup-guarded) | — | Missing | — | No account to post to; blocks all journals | Ticket B |
| Journal entry + lines (balanced, no D+C same line) | — | Missing | — | Same as above | Ticket C |
| Draft vs posted + posted protection | Documents never deleted; events immutable | Partial (pattern, no journal) | `eventService.js`, doc statuses | Must mirror philosophy, not code | Ticket D |
| General ledger (posted-only running balances) | `pricingManager` profit-report (movements-based, operational) | Partial | `inventory_movements` | Operational ≠ accounting; no posted filter concept | Ticket E |
| Trial balance (period D==C) | — | Missing | — | No balanced-double-entry to prove | Ticket E |
| Income statement (rev−exp from posted) | `reportService` profit (JSON + current cost) | Partial | `orders.items` + `products.cost_price` | Current-cost, not historical; honest gap | Ticket M |
| Balance sheet / cash flow / budget-vs-actual | — | Missing | — | No cash-account concept; no budgets | Ticket M |
| Accounting periods + close lock | `financial_periods` (honest timeline, 055) | Partial | `warehouseOrderService.js:601-662` | Close flips status only; blocks nothing; no reopen/reversal | Ticket F |
| Branch/region dimension | Warehouses/locations exist; no entry dimension | Missing | — | Needed only when multi-branch accounting starts | Later |
| Audit trail | Immutable `events` + `cost_consumption` | Present | `eventService.js:16-135` | Reuse, don't duplicate | Ticket G |
| Duplicate protection | `event_key`+UNIQUE, `idempotency_key`, `orderAlreadyHas`, INSERT OR IGNORE | Present | `kashierWebhookService.js:41-63`, bridge | Reuse for posting refs; never build a second system | Ticket G |
| RBAC least-privilege | 6 roles, 26 permissions, per-route guards | Present | `rbac.js`, `seed-rbac.js` | Add `accounting.*` only with real UI/API | Ticket N |
| Money exactness | INTEGER cents everywhere; `Math.round` boundaries | Present (stronger than reference) | `products/orders/movements/kashier amount_cents` | Single-currency EGP only → Known Unknown | Keep; never REAL |
| Invoices | On-demand xlsx docs (`INV-{id}`), no AR table | Partial | `invoiceService.js` | No receivable record; numbers regenerable, not sequential-ledger | Ticket I/J |
| Payments + settlement | States + verified-paid atomic txn + HMAC/amount verify | Partial | `kashierWebhookService.js:79-124` | No clearing/reconciliation records; no fee handling | Ticket K |
| Refunds/returns/reversals | Status + `refund_amount/at`; no goods-return receipt; no reversal primitive | Partial | `admin.js:1126-1145`, workflow | Money and goods can diverge silently | Ticket L |
| Tax accounting | 14% display-only on invoices | Partial | `invoiceService.js`, settings | No tax liability records | Owner decision |
| Discounts | List % + per-product overrides, mirrored immutable | Present (operational) | `priceListService`, 069 mirrors | Fine as posting inputs | Postings consume |

## 15 posting flows (source → tables → idempotent? → reversal? → missing)

1. Purchase receipt → PO receive (`purchaseOrders.js:333`) → movements+layers+`po_received` event, txn-wrapped. Idempotent? VERIFY (no `orderAlreadyHas` equivalent seen). Reversal? No. Missing: payable + inventory-asset posting.
2. Supplier payable creation → MISSING (no AP). Owner decision: recognition at receipt vs supplier invoice.
3. Supplier payment → MISSING (no AP payment path at all).
4. Sales completion / revenue point → `paid`/`completed` + verified evidence; no revenue journal. Owner decision: paid vs delivered vs completed.
5. Customer receivable → MISSING (COD/`pending_approval` are operational, not AR).
6. Customer payment → Kashier verified txn + COD-at-delivery states; no cash journal. Idempotent webhook ✅.
7. Inventory issue / COGS → movements + `cost_consumption` + snapshots; per-unit basis real (layer/fallback). Closest to posting-ready. Missing: COGS + inventory-asset journal only.
8. Adjustment → `createMovement` adjustment; OUT-types book current wholesale. Missing: approval + revaluation policy (owner decision).
9. Damage/write-off → damage movements at cost; no write-off journal. Owner decision: account + approval.
10. Customer return → refund status path exists; goods-return receipt UNVERIFIED — mark VERIFY before posting design.
11. Supplier return → no path found — VERIFY, likely missing.
12. Gateway settlement/reconciliation → sessions + verified flag; no fee/clearing records. Owner decision: fee treatment.
13. Shipping/delivery cost → `shipments` ops table; financial use unknown. Owner decision: expense vs capitalize.
14. Opening balance → proven OB movements reconciling on-hand (055 test); no equity offset. Owner decision: opening-equity account.
15. Period close → status flip; blocks nothing; no reopen. Owner decision: close policy + reopen/reversal rules.

## Money model (keep)
- INTEGER cents at rest (`price/cost_price/total/unit_cost/amount_cents`); EGP single-currency (settings); `Math.round` at boundaries (`cents/100` out, `round(in*100)`); tax 14% display-only; discounts mirrored immutable; costs from layers/fallback with snapshots. Multi-currency: NOT supported → Known Unknown, never invented here.

## Invariants → adoption
- Balanced entry / no-D+C-same-line / valid accounts → implement in C/D (no journal exists yet).
- Posted protection → mirror existing immutable-events philosophy (new primitive, same spirit).
- Closed-period respect → needs Ticket F (periods currently unenforced — verified: single CLOSED write, no guards).
- Duplicate-posting prevention → REUSE `event_key`/idempotency/bridge-skip patterns (Ticket G); never a second system.
- Explicit reversal → missing everywhere (operational too); Ticket L.
- Exact money → already cents (advantage banked); keep rejecting float.
- Derive-from-journals / auditability → events + cost_consumption are the reuse patterns.

## Owner decisions required (do NOT implement without)
Revenue point; COGS policy (configurable FIFO/LATEST/HIGHEST exists — accounting needs ONE); account mapping (needs CoA); tax; refund/return policy; payable point; Kashier clearing+fees; close/reopen rules; adjustment/damage approval+accounts; shipping treatment; opening-equity; multi-currency future.

## Recommended Ticket B (Chart of Accounts foundation, nothing more)
`accounts` table (code UNIQUE, name, type, `is_active`, no business seeds — neutral skeleton or empty+CRUD); service with dup-code + delete-if-referenced guards (mirror SmartAccounting 400-rules + our 064 guard pattern); RBAC reads existing permissions only (no new perms until UI); characterization tests (add/dup/edit/delete-used). No journals, no UI, no postings.
