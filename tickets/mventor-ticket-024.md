# mventor-ticket-024: Inventory Movement Engine

**Status:** Planned
**Priority:** Critical
**Phase:** ERP Core
**Created:** 2026-07-28
**Author:** CODEX

---

## Objective

Implement the inventory movement engine â€” the core of the ERP inventory system. Every stock change is a movement with a reason code, not a silent UPDATE. Stock is always the result of movements.

---

## Current State

- Stock is a simple number on the products table
- Stock is updated directly via `UPDATE products SET stock = ?`
- No audit trail for stock changes
- No way to trace why stock changed

---

## Target State

### Movement Types

| Type | Direction | Description |
|------|-----------|-------------|
| `opening_balance` | + | Initial stock migration |
| `receipt` | + | Goods received (from PO) |
| `issue` | - | Goods issued (for SO) |
| `adjustment` | +/- | Physical count correction |
| `transfer` | +/- | Between warehouses |
| `return` | + | Customer return |
| `damage` | - | Write-off |
| `reservation` | - | Hold for pending order |
| `release` | + | Release held stock |
| `correction` | +/- | Error fix |
| `count` | +/- | Inventory count result |

### Movement Service

```javascript
// server/services/inventoryService.js
const inventoryService = {
  async createMovement({ productId, warehouseId, locationId, type, reason, referenceType, referenceId, qtyChange, unitCost, note, userId }) {
    // 1. Validate movement type
    // 2. Calculate qty_before from current inventory
    // 3. Calculate qty_after = qty_before + qty_change
    // 4. Prevent negative stock (unless adjustment/correction)
    // 5. Insert movement record
    // 6. Update inventory table
    // 7. Emit event (inventory_adjusted)
    // 8. Check low stock alerts
    // 9. Return movement record
  },

  async getStock(productId, warehouseId, locationId) {
    // Calculate from movements OR read from inventory table
    // Both must match
  },

  async replayMovements(productId, warehouseId) {
    // Replay all movements to verify stock
    // Used for audit and reconciliation
  },

  async getMovements(filters) {
    // Query movements with filters: product, warehouse, type, date range
  }
};
```

### Integration with Orders

- Stripe webhook `checkout.session.completed` â†’ create `issue` movement for each order item
- Order cancellation â†’ create `return` movement
- Admin stock adjustment â†’ create `adjustment` movement

---

## Acceptance Criteria

- [ ] Inventory service implemented with all movement types
- [ ] Movement creation validates qty_before/qty_after
- [ ] Negative stock prevented (except adjustments)
- [ ] Stripe webhook creates `issue` movements on order completion
- [ ] Order cancellation creates `return` movements
- [ ] API: `POST /api/admin/inventory/movements` (manual adjustment)
- [ ] API: `GET /api/admin/inventory/movements` (list with filters)
- [ ] API: `GET /api/admin/inventory/stock/:productId` (current stock)
- [ ] API: `GET /api/admin/inventory/replay/:productId` (verify from movements)
- [ ] Low stock check after each movement
- [ ] Events emitted for each movement
- [ ] Tests pass

---

## Dependencies

- mventor-ticket-021 (Database Schema Redesign)
- mventor-ticket-022 (Event System)

---

## Notes

- Inventory is NEVER a number â€” it's the result of movements
- Every stock value must be reproducible by replaying movements
- Never update stock directly â€” always create movements
- This is the heart of the ERP inventory system
