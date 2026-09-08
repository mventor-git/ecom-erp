# Inventory Reality — Ecom-ERP (Audit Only)

SOURCE OF TRUTH: inventory_movements (ledger); inventory table is read snapshot.
STOCK INCREASE: receipt / opening_balance / transfer / correction / count / return / supply_orders (to inventory_movements, qty_before→qty_after; unit_cost captured).
STOCK DECREASE: issue / adjustment / transfer / damage / reservation / release / issue_orders.
WAREHOUSE: warehouses + locations (bins/shelves). Inventory unique on (product, variant, warehouse, location).
VARIANT: product_variants (SKU, barcode, serial, lot, batch, expiry, JSON attributes). Inventory references variant_id.
LEGACY MIGRATION: db.js automatically migrates products.stock > 0 to inventory + opening_balance movement on init if inventory empty.
DANGER: product.cost_price = current cost only; no historical cost table; calculating actual COGS for sold stock may use current cost rather than purchase cost (FIFO/weighted average not implemented in DB).
NO PYTHON USED.
