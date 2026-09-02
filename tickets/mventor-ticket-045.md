# mventor-ticket-045 — ERP/Warehouse Hardening for Trash Integration

## Status
Completed (2026-08-22)

## Goal
Make every ERP surface trash-aware so the Delete All / Trash feature cannot corrupt warehouse data, reports, or QR lookups — and trashed products are frozen until restored.

## Changes
- `services/inventoryService.js`: `createMovement` now rejects movements for trashed products ("in the trash" error) and for missing products.
- `routes/inventory.js`: `/low-stock` and `/summary` exclude trashed products; movement POST maps trash-guard errors to 409.
- `services/reportService.js`: `_buildProductFilterWhere` adds `AND p.deleted_at IS NULL` (covers inventory value, stock aging, dead stock, low stock, out of stock, stockout frequency); turnover rate filter updated separately. Historical sales reports intentionally still resolve trashed products.
- `services/qrService.js`: product QR payload now includes `trashed` flag.

## Validation
- `tests/productTrash.test.js` extended to 9 tests: movement guard (reject → restore → works), low-stock report exclusion + re-inclusion after restore. Full suite: **15 suites / 114 tests passing**.
- Test helper fixed to create movements via the real service (maintains derived inventory snapshot).
