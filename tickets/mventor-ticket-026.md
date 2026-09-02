# mventor-ticket-026: Supplier Management

**Status:** Planned
**Priority:** High
**Phase:** ERP Core
**Created:** 2026-07-28
**Author:** CODEX

---

## Objective

Implement supplier management â€” the foundation for purchase orders and procurement.

---

## Current State

- No supplier tracking
- No way to know who supplies what
- No purchase order system

---

## Target State

### Supplier Table

```sql
CREATE TABLE suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  lead_time_days INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  supplier_sku TEXT,
  unit_cost INTEGER, -- cents
  is_preferred INTEGER DEFAULT 0,
  lead_time_days INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Admin UI

- Supplier list page
- Supplier detail page (with linked products)
- Add/edit supplier form
- Assign suppliers to products

---

## Acceptance Criteria

- [ ] Suppliers table created
- [ ] Product-suppliers link table created
- [ ] API: `GET /api/admin/suppliers` (list)
- [ ] API: `POST /api/admin/suppliers` (create)
- [ ] API: `PUT /api/admin/suppliers/:id` (update)
- [ ] API: `DELETE /api/admin/suppliers/:id` (deactivate)
- [ ] API: `GET /api/admin/suppliers/:id/products` (linked products)
- [ ] API: `POST /api/admin/products/:id/suppliers` (assign supplier)
- [ ] Admin UI: Supplier list page
- [ ] Admin UI: Supplier detail page
- [ ] Admin UI: Assign supplier to product
- [ ] Tests pass

---

## Dependencies

- mventor-ticket-021 (Database Schema Redesign)

---

## Notes

- Suppliers are the foundation for purchase orders (mventor-ticket-027)
- Each product can have multiple suppliers (one preferred)
- Supplier SKU = the supplier's own product code
