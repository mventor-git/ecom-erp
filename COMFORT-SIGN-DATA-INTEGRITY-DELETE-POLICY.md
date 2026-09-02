# Comfort Sign — Data Integrity & Delete Policy (FK-enforcement consequences)

Date: 2026-09-01 (rev. 2 — bridge checkpoint closed) · Scope: consequences of correctly enabling `PRAGMA foreign_keys = ON`.
**FK enforcement stays ON. No constraint weakened. No orphan deleted blindly.**

## 0. Status as of 2026-09-01 — FK Insert-Path Checkpoint

| Item | State | Evidence |
|---|---|---|
| FK remains ON | **PROVEN** | `PRAGMA foreign_keys` = 1; orphan INSERT rejected (SQL: `FOREIGN KEY constraint failed`) |
| Valid relational fixtures exist | **PROVEN** | `tests/salesBridge.test.js` `createRealOrder()` creates real `customers`→`orders`; suite 4/4 pass |
| `salesBridge` passes | **PROVEN** | `npx jest tests/salesBridge.test.js` → 4 passed, 0 failed |
| Invalid order → intentional rejection | **PROVEN** | `createIssueForOrder(999999, …)` throws `Order #999999 not found — cannot create issue order` (clean domain error before any mutation) |
| No partial bridge writes | **PROVEN** | Failure-injection in `issue_order_items` insert → `db.transaction()` rolls back the parent `issue_orders` row (delta=0) |
| `salesInventoryBridge.issueForOrder` works with real order | **PROVEN** | issued=1; onHand 118→116 (correct −2) |

---

## 1. Relational graph / delete behavior (matrix)
| Parent | Child | FK column | Recommended delete policy | Business meaning |
|---|---|---|---|---|
| PRODUCT | inventory_movements | product_id | NO hard delete → soft (deleted_at) | sales/stock history must survive |
| PRODUCT | inventory_cost_layers | product_id | NO hard delete → soft | costing history |
| PRODUCT | issue_order_items | product_id | NO hard delete → soft | issue history |
| PRODUCT | order_items | product_id | NO hard delete → soft | order history |
| PRODUCT | product_suppliers | product_id | NO hard delete → soft | supplier sourcing |
| SUPPLIER | product_suppliers | supplier_id | DEACTIVATE (`is_active`) not hard delete | keep sourcing/purchase price history |
| SUPPLIER | purchase_orders | supplier_id | DEACTIVATE | procurement history |
| CUSTOMER | orders | customer_id | NO hard delete → soft/anonymize | order/revenue history |
| ORDER | order_items | order_id | NO hard delete | line-item history |
| ORDER | issue_orders | order_id | NO hard delete | fulfillment history |
| ORDER | shipments / payments / webhook events | order_id | NO hard delete | payment/audit history |
| WAREHOUSE | inventory / inventory_movements | warehouse_id | DEACTIVATE (`is_active`) | stock location history |

**Rule adopted:** historical records (product, order, movement, cost, audit) must survive. Prefer **soft-delete / deactivate** (`is_active`, `deleted_at`, existing shell) over hard `DELETE`. No destructive cascade.

## 2. Orphan classification (live DB, FK was previously OFF)
| Orphan | count | Meaning | Recommended |
|---|---|---|---|
| inventory_movements → products | 40 | ledger entries for hard-deleted products | **REQUIRES DATA-MIGRATION DECISION** — preserve as historical, represent missing product explicitly (not junk) |
| issue_order_items → products | 24 | issue lines for hard-deleted products | **REQUIRES DECISION** |
| product_suppliers → products | 2 | sourcing for hard-deleted product | minor; reconcile |
| product_suppliers → suppliers | 4 | sourcing for deleted supplier | reconcile (restore or tag) |

**Not blindly deleted.** Could represent legitimate historical transactions whose product master was hard-deleted. Options per config: restore parent (if reconstructible), keep child + `legacy/orphaned` marker, archive, or delete ONLY with a verified backup. **Bold recommendation: preserve + mark,** never destroy history to satisfy FK.

## 3. Product / Supplier / Order delete semantics
- **Product:** must NOT be hard-deleted once it has sales/inventory/cost/supplier history. Reuse `is_active` + existing trash (`deleted_at`) instead.
- **Supplier:** reuse `is_active` (deactivate) — already used by `DELETE /api/admin/suppliers/:id` (which sets `is_active=0`). ✓ correct — keep.
- **Customer/Order:** hard deletion inappropriate once payment/COGS/refund/audit exists. Prefer soft/anonymize.

## 4. Backup / migration safety — VERIFIED ✅
`server/services/backupService.js`: daily scheduled (2AM) + manual trigger, 30-day retention, writes `server/backups/db-<ts>.sqlite`; also `data/backups/store-PRE-*.db` manual pre-wipe snapshots. On disk: `db-2026-09-01-020001.sqlite` etc. — **a readable/restorable backup exists** before any migration.

## 5. Consequences surfaced (honest — FK stays ON) — CLOSED 2026-09-01
- Test cleanups must delete **children-first** — all FK-exposed suites migrated to children-first cleanup (salesBridge, workflow, shipping, profitReports, customers, pickingPacking, rbacMultiRole). `npm test` → **118/118 PASS**.
- Test-body insert paths no longer violate FK: fixtures now use real `customers`→`orders`→`products` (unique emails; fetched category/supplier ids; correct `roles`/`permissions` inserts). Hardcoded `category_id=1` and `roles.description` removed where the live schema says otherwise.
- **`salesInventoryBridge` auto-issue-order now satisfies FK under ON**: `createIssueForOrder` validates the referenced order exists (business guard) and wraps insert+items+status in `db.transaction()`. The bridge's own mutators (`issueForOrder`/`reserveForOrder`/`releaseForOrder`) also guard order existence, so no dangling `reference_id` is created. FK remains the final net — never disabled.
- **Nested-transaction fix**: `db.transaction()` is now SAVEPOINT-nesting-aware, so the payment path (`handleTransactionSuccess` → `issueForOrder` → `createIssueForOrder`) no longer throws `cannot start a transaction within a transaction`. The fulfillment issue-order is now actually created for webhook-paid orders (was silently skipped).

## Verdict
`FK ENFORCEMENT: PASS (verified)` · `LIVE DATA MIGRATION: REQUIRES DECISION` (40/24/2/4 orphans quantified, not mutated) · `DELETE SEMANTICS: documented — soft/deactivate` · `BACKUP: PASS` · **INSERT-PATH FK COMPLIANCE: CLOSED (118/118 unit tests green)** · `PAYMENT ATOMICITY: VERIFIED (nested-transaction fix)`. Remaining: the 40/24/2/4 orphans are a DATA-MIGRATION DECISION; `api`/`mobileApi` are integration tests (live server); `phase4_1`/`phase6` are stale legacy using the obsolete sql.js file-reading API.
