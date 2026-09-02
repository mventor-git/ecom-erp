-- Phase 4.1 — Reconcile order_items to design; preserve existing fields; add missing fields; add variant_id FK; create VIP tables if missing

-- 1. Add missing fields to existing order_items (additive ALTER / ADD COLUMN safe in SQLite with sql.js)
ALTER TABLE order_items ADD COLUMN variant_id INTEGER REFERENCES product_variants(id);
ALTER TABLE order_items ADD COLUMN sku TEXT DEFAULT '';
ALTER TABLE order_items ADD COLUMN base_price INTEGER DEFAULT 0;
ALTER TABLE order_items ADD COLUMN discount_type TEXT DEFAULT 'none';
ALTER TABLE order_items ADD COLUMN discount_value INTEGER DEFAULT 0;
ALTER TABLE order_items ADD COLUMN discount_amount INTEGER DEFAULT 0;
ALTER TABLE order_items ADD COLUMN final_price INTEGER DEFAULT 0;
ALTER TABLE order_items ADD COLUMN price_list_code TEXT DEFAULT 'retail';
ALTER TABLE order_items ADD COLUMN tax_rate REAL DEFAULT 0;
ALTER TABLE order_items ADD COLUMN tax_amount INTEGER DEFAULT 0;
ALTER TABLE order_items ADD COLUMN cost_snapshot INTEGER DEFAULT 0;

-- 2. VIP tables (if not present in DB state; schema defines them but DB missing them per audit)
CREATE TABLE IF NOT EXISTS vip_customer_policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) UNIQUE,
  discount_pct INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS customer_invitation_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  invite_id INTEGER NOT NULL REFERENCES vip_invites(id),
  attribution_confirmed INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
