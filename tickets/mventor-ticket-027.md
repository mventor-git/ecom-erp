# mventor-ticket-027: Purchase Order System

**Status:** Planned
**Priority:** High
**Phase:** ERP Core
**Created:** 2026-07-28
**Author:** CODEX

---

## Objective

Implement the purchase order system â€” the procurement workflow for restocking inventory from suppliers.

---

## Current State

- No purchase order system
- No way to track what was ordered from suppliers
- No goods receipt workflow

---

## Target State

### Purchase Order Tables

```sql
CREATE TABLE purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_number TEXT NOT NULL UNIQUE, -- e.g., PO-2026-0001
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  status TEXT DEFAULT 'draft', -- draft, sent, confirmed, received_partial, received, cancelled
  total_cost INTEGER, -- cents
  notes TEXT,
  ordered_at DATETIME,
  expected_at DATETIME,
  received_at DATETIME,
  created_by TEXT,
  approved_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE purchase_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  po_id INTEGER NOT NULL REFERENCES purchase_orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty_ordered INTEGER NOT NULL,
  qty_received INTEGER DEFAULT 0,
  unit_cost INTEGER NOT NULL, -- cents
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### PO Workflow

```
draft â†’ sent â†’ confirmed â†’ received_partial â†’ received
                                    â†“
                               cancelled (at any point)
```

### Goods Receipt

- When PO is marked "received" â†’ create `receipt` inventory movements
- Partial receipts supported (receive some items now, rest later)
- Each receipt creates movement with reference to PO

---

## Acceptance Criteria

- [ ] Purchase orders table created
- [ ] Purchase order items table created
- [ ] Document numbering: PO-YYYY-NNNN
- [ ] API: `GET /api/admin/purchase-orders` (list)
- [ ] API: `POST /api/admin/purchase-orders` (create)
- [ ] API: `PUT /api/admin/purchase-orders/:id` (update)
- [ ] API: `PUT /api/admin/purchase-orders/:id/status` (change status)
- [ ] API: `POST /api/admin/purchase-orders/:id/receive` (goods receipt)
- [ ] API: `GET /api/admin/purchase-orders/:id` (detail with items)
- [ ] Goods receipt creates inventory movements
- [ ] Partial receipt supported
- [ ] Admin UI: PO list page
- [ ] Admin UI: PO create/edit page
- [ ] Admin UI: PO detail page with receipt actions
- [ ] Auto-generate PO from low-stock list
- [ ] Tests pass

---

## Dependencies

- mventor-ticket-021 (Database Schema Redesign)
- mventor-ticket-024 (Inventory Movement Engine)
- mventor-ticket-026 (Supplier Management)
- mventor-ticket-028 (Document Numbering System)

---

## Notes

- Everything is a document â€” POs have unique numbers, status, timeline
- Never delete documents â€” cancelled is a status
- Goods receipt creates inventory movements (receipt type)
- PO drives the procurement cycle
