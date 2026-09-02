# mventor-ticket-021: Database Schema Redesign â€” Products vs Inventory Separation

**Status:** Completed
**Priority:** Critical
**Phase:** ERP Core
**Created:** 2026-07-28
**Completed:** 2026-07-28
**Author:** CODEX

---

## Objective

Redesign the database schema to separate **Products** (what something IS) from **Inventory** (WHERE it is and HOW MUCH exists). This is the foundational change that enables the ERP platform to evolve without rewrites.

---

## Current State

- Products table has a single `stock` field
- No concept of warehouses or locations
- No inventory movement tracking
- Stock is updated directly (violates ERP philosophy)

---

## Target State

### New Tables

```sql
-- Warehouses (physical storage locations)
CREATE TABLE warehouses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Locations (bins/shelves within warehouses)
CREATE TABLE locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  name TEXT NOT NULL,
  barcode TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Inventory Movements (the source of truth for stock)
CREATE TABLE inventory_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  location_id INTEGER REFERENCES locations(id),
  type TEXT NOT NULL, -- opening_balance, receipt, issue, adjustment, transfer, return, damage, reservation, release, correction, count
  reason TEXT,
  reference_type TEXT, -- purchase_order, sales_order, transfer_order, adjustment, etc.
  reference_id INTEGER,
  qty_change INTEGER NOT NULL,
  qty_before INTEGER NOT NULL,
  qty_after INTEGER NOT NULL,
  unit_cost INTEGER, -- cents
  note TEXT,
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Product Variants (for future SKU/barcode/serial tracking)
CREATE TABLE product_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  sku TEXT UNIQUE,
  barcode TEXT,
  qr_code TEXT,
  serial_number TEXT,
  lot_number TEXT,
  batch_number TEXT,
  expiry_date DATE,
  attributes TEXT DEFAULT '{}', -- JSON: {size: "Large", color: "Red"}
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Inventory (current stock per product per warehouse per location)
CREATE TABLE inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  variant_id INTEGER REFERENCES product_variants(id),
  warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
  location_id INTEGER REFERENCES locations(id),
  qty_on_hand INTEGER DEFAULT 0,
  qty_reserved INTEGER DEFAULT 0,
  qty_available INTEGER GENERATED ALWAYS AS (qty_on_hand - qty_reserved) STORED,
  min_stock INTEGER DEFAULT 0,
  max_stock INTEGER DEFAULT 0,
  reorder_point INTEGER DEFAULT 0,
  last_counted_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(product_id, variant_id, warehouse_id, location_id)
);
```

### Modified Products Table

```sql
-- Add new columns to products
ALTER TABLE products ADD COLUMN cost_price INTEGER DEFAULT 0; -- cents
ALTER TABLE products ADD COLUMN weight_kg REAL DEFAULT 0;
ALTER TABLE products ADD COLUMN is_trackable INTEGER DEFAULT 1; -- track inventory?
ALTER TABLE products ADD COLUMN default_warehouse_id INTEGER REFERENCES warehouses(id);
```

---

## Migration Strategy

1. Create new tables (warehouses, locations, inventory_movements, product_variants, inventory)
2. Seed default warehouse: "Main Warehouse" (code: WH-MAIN)
3. Migrate existing product stock to inventory table
4. Create opening_balance movements for all existing stock
5. Keep `products.stock` temporarily for backward compatibility
6. Deprecate `products.stock` in future tickets

---

## Acceptance Criteria

- [ ] All new tables created with proper constraints and indexes
- [ ] Default warehouse seeded
- [ ] Existing product stock migrated to inventory table
- [ ] Opening balance movements created for all products
- [ ] Foreign key relationships validated
- [ ] No data loss during migration
- [ ] Backward compatibility maintained (products.stock still works)
- [ ] Tests pass

---

## Dependencies

- None (foundational ticket)

---

## Notes

- This is the most critical ticket in the ERP evolution
- Inventory is NEVER a number â€” it's the result of movements
- Every stock value must be reproducible by replaying movements
- Never update stock directly â€” always create movements
