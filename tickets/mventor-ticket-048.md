# mventor-ticket-048 — Sales ↔ Inventory Bridge

## Status
Completed (2026-08-22)

## Goal
Connect customer orders to the movement engine so stock is reserved on confirmation, taken on shipping/payment, and returned on cancellation — closing the biggest gap from the Aug-2026 investigation (web checkout decremented nothing; mobile decremented outside the engine).

## Changes
- NEW `services/salesInventoryBridge.js`: `issueForOrder` / `reserveForOrder` / `releaseForOrder`,
  idempotent per order+movement type; warehouse resolved via product default → WH-MAIN → first active;
  insufficient stock NEVER blocks a paid/COD order — emits `order_stock_issue_failed` instead.
- `services/inventoryService.js`: RESERVATION/RELEASE now move only `qty_reserved`
  (fixes double-count bug); replay excludes them so consistency invariant holds.
- `services/orderWorkflowService.js`: confirmed→reserve · shipped→release+issue · cancelled/refunded→release.
- `routes/stripe.js`: legacy flow issues stock in BOTH webhook branches when an order becomes paid.
- `routes/orders.js`: web COD orders (no stripe session) issue at creation.
- `routes/mobileOrders.js`: direct `products.stock` decrement replaced by bridge ISSUE at creation;
  cancel restores via release + correction movements (no more raw UPDATEs).

## Validation
- NEW `tests/salesBridge.test.js` (4 tests): issue+idempotency, reserve/release cycle,
  safe no-op release, failure reporting. Full suite: **16 suites / 118 tests passing**.
