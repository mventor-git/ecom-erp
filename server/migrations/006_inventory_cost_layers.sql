-- Phase 5 — Inventory Cost Layers + FIFO Foundation (additive only)
CREATE TABLE IF NOT EXISTS inventory_cost_layers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  variant_id INTEGER REFERENCES product_variants(id),
  warehouse_id INTEGER REFERENCES warehouses(id),
  shelf_id INTEGER REFERENCES locations(id),
  source_movement_id INTEGER REFERENCES inventory_movements(id),
  source_receipt_id INTEGER, -- reserve for future purchase receipt link
  original_quantity INTEGER NOT NULL DEFAULT 0,
  remaining_quantity INTEGER NOT NULL DEFAULT 0,
  unit_cost INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_inventory_cost_layers_product ON inventory_cost_layers(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_cost_layers_variant ON inventory_cost_layers(variant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_cost_layers_warehouse ON inventory_cost_layers(warehouse_id);
