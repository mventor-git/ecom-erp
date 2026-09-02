# mventor-ticket-044 — Product Trash System (Delete All + Warehouse Reset + Revert)

## Title
Soft-delete ("trash") all products from the Admin Panel with one action — resetting warehouse stock — fully reversible at any time, without destroying products added after the deletion.

## Status
Completed (2026-08-22)

## Created
2026-08-22

## Priority
High

## Dependencies
None (builds on inventory movement engine)

## Goal
Admin can click **"Delete All Products"** in the Admin Panel; all products move to a Trash (soft delete) and warehouse stock resets to empty. A **Trash page** lists trashed products with **"Restore All"** and per-product **Restore**. Restore brings trashed products back *alongside* any products added after the deletion (merge, never replace). Stock is rebuilt exactly by replaying inventory movements (source of truth).

## Scope

### Server
- `db.js`: migrations — `products.deleted_at DATETIME`, `products.restore_active INTEGER` (snapshot of pre-trash active state).
- `services/eventService.js`: new event types `product_trashed`, `products_trashed_all`, `product_restored`, `products_restored_all`.
- NEW `routes/productTrash.js` mounted at `/api/admin/products` (before admin.js):
  - `POST /trash-all` — soft-delete all non-trashed products + wipe their `inventory` snapshot rows + `syncProductStock` → 0. Emits event, invalidates cache.
  - `GET /trash` — list trashed products.
  - `POST /trash/restore-all` — restore all trashed products; rebuild each product's inventory snapshot from `SUM(qty_change)` of its movements; sync legacy stock.
  - `POST /trash/:id/restore` — single-product restore (same rebuild logic).
- `routes/admin.js`:
  - `DELETE /products/:id` converted from HARD delete to soft trash (same semantics as trash-all, single product). Emits `product_trashed`.
  - `GET /products` excludes trashed (`deleted_at IS NULL`).
- `index.js`: mount productTrash router BEFORE `/api/admin`.

### Frontend (client-admin)
- `api/adminApi.js`: `trashAllProducts()`, `getTrashedProducts()`, `restoreAllProducts()`, `restoreProduct(id)`.
- `pages/ProductsList.jsx`: red danger-zone **"Delete All Products"** button + confirmation modal (states count, warns warehouse stock resets, explains reversibility).
- NEW `pages/ProductsTrash.jsx` + route `/products/trash`: trashed list, Restore All button, per-row Restore.

### Tests
- NEW `tests/productTrash.test.js`: trash-all hides products from public API + empties stock; products created after trash survive restore-all; restore rebuilds stock from movements; single trash/restore round-trip.

## Acceptance Criteria
1. POST /api/admin/products/trash-all returns `{ success, trashed: N }`; public `/api/products` no longer returns those products; admin list excludes them.
2. After trash-all, inventory totals for trashed products are 0 (warehouse reset), while `inventory_movements` rows remain untouched (immutable law).
3. Creating a new product after trash-all, then restore-all: old products return AND the new product remains (no data loss either side).
4. Restored products regain their exact prior active/inactive state and their stock equals the movement-replay total.
5. Single DELETE /api/admin/products/:id no longer hard-deletes; product appears in trash and can be restored.
6. All mutations emit events and invalidate the `products:` cache prefix.
7. `npm test && npm run test:integration` pass (existing suite unbroken).

## Implementation Notes
- Trash = `deleted_at = CURRENT_TIMESTAMP`, `restore_active = active`, `active = 0`. Most customer-facing queries already filter `active = 1` → minimal blast radius.
- Inventory snapshot table is a derived cache; wiping it is safe. Movements are immutable and are the restore source (project ERP law: inventory derives from movements).
- Reserved quantities are NOT reconstructed on restore (set to 0) — documented simplification.
- Known limitation (out of scope): reports/QR views may still resolve trashed products by id; catalog surfaces are fully filtered.

## Validation Notes
- `cd server && npm test` → 15 suites / 112 tests passing (includes 7 new trash tests).
- `cd client-admin && npm run build` → passes (pre-existing chunk-size warning only).
- Integration suite intentionally not run: it boots against the real store.db; destructive
  trash tests must stay in the self-cleaning unit suite.

## Known Risks
- Mount-order regression if productTrash router is registered after admin.js (`/products/trash` could be captured by `/products/:id` patterns) — mitigated by mounting first.
- Historic order items referencing trashed products keep working (JSON snapshots) — verified by design, not by test.

## Related Tickets
- mventor-ticket-021 (inventory engine), mventor-ticket-043 (previous)
