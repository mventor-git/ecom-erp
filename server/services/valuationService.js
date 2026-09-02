/**
 * Valuation Service — Configurable Inventory Costing + Configurable Retail Pricing.
 *
 * TWO INDEPENDENT SYSTEMS (must never be collapsed into one calculation):
 *
 *  SYSTEM A — INVENTORY COSTING  (`inventory_costing_method`)
 *    FIFO   → consume the OLDEST applicable cost layer first.
 *    LATEST → value issued goods at the NEWEST applicable purchase cost.
 *    HIGHEST→ value issued goods at the HIGHEST applicable purchase cost.
 *    Answers: "what is the COGS of inventory that is issued?"
 *
 *  SYSTEM B — RETAIL PRICING  (`retail_cost_basis` + `retail_pricing_method` + markup)
 *    retail_cost_basis: FIFO_COST | LATEST_PURCHASE_COST | HIGHEST_PURCHASE_COST
 *    retail_pricing_method: MARKUP_PERCENT
 *    Retail = cost_basis × (1 + markup/100).  Answers: "what price does the customer see?"
 *
 * THE HARD RULE: costing and retail are INDEPENDENT. If costing is FIFO and
 * retail basis is HIGHEST, an issue is COGS'd at FIFO cost while the customer
 * price is HIGHEST × markup. Do NOT feed the FIFO layer cost into retail.
 *
 * Source of truth: `inventory_cost_layers` (populated on stock-in receipt).
 * Reading is via `db.prepare` (the codebase convention) — NOT the buggy
 * getDb().exec pattern in inventoryCostLayers.js.
 *
 * Money is INTEGER cents throughout.
 */

const db = require('../db');

// Ensure the valuation config keys exist so settingsService.set can update them.
try { ensureConfig(); } catch {} // function declaration is hoisted; runs once at module load

const COSTING_METHODS = ['FIFO', 'LATEST', 'HIGHEST'];
const RETAIL_BASIS = ['FIFO_COST', 'LATEST_PURCHASE_COST', 'HIGHEST_PURCHASE_COST'];
const RETAIL_METHODS = ['MARKUP_PERCENT'];
const DEFAULT_MARKUP = 20;

// ── Config keys (direct reads; inserted idempotently so settingsService.set works later) ──

const CONFIG_DEFS = [
  { key: 'inventory_costing_method', value: 'FIFO', type: 'string', category: 'inventory', description: 'Inventory COGS method: FIFO | LATEST | HIGHEST' },
  { key: 'retail_cost_basis', value: 'HIGHEST_PURCHASE_COST', type: 'string', category: 'pricing', description: 'Retail cost input: FIFO_COST | LATEST_PURCHASE_COST | HIGHEST_PURCHASE_COST' },
  { key: 'retail_pricing_method', value: 'MARKUP_PERCENT', type: 'string', category: 'pricing', description: 'Retail pricing method (currently MARKUP_PERCENT)' },
  { key: 'retail_markup_percent', value: String(DEFAULT_MARKUP), type: 'number', category: 'pricing', description: 'Retail markup % over the selected cost basis' },
];

function ensureConfig() {
  const ins = db.prepare(
    `INSERT INTO settings (key, value, type, category, description, is_public)
     SELECT ?, ?, ?, ?, ?, 0 WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = ?)`
  );
  CONFIG_DEFS.forEach(d => { try { ins.run(d.key, d.value, d.type, d.category, d.description, d.key); } catch {} });
}

/** Read a config key directly from the settings table (bypasses the module cache). */
function _rawSetting(key, fallback) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

// ── Public getters (validated, never arbitrary values) ──

function getCostingMethod() {
  const v = String(_rawSetting('inventory_costing_method', 'FIFO')).toUpperCase();
  return COSTING_METHODS.includes(v) ? v : 'FIFO';
}

function getRetailBasis() {
  const v = String(_rawSetting('retail_cost_basis', 'HIGHEST_PURCHASE_COST')).toUpperCase();
  return RETAIL_BASIS.includes(v) ? v : 'HIGHEST_PURCHASE_COST';
}

function getRetailMethod() {
  const v = String(_rawSetting('retail_pricing_method', 'MARKUP_PERCENT')).toUpperCase();
  return RETAIL_METHODS.includes(v) ? v : 'MARKUP_PERCENT';
}

function getMarkupPercent() {
  const n = Number(_rawSetting('retail_markup_percent', DEFAULT_MARKUP));
  return Number.isFinite(n) ? n : DEFAULT_MARKUP;
}

// ── Cost layers ──

/** Layers with remaining stock, oldest first (FIFO order). */
function getLayers(productId, warehouseId = null) {
  let sql = `SELECT * FROM inventory_cost_layers WHERE product_id = ? AND remaining_quantity > 0`;
  const params = [productId];
  if (warehouseId) { sql += ' AND warehouse_id = ?'; params.push(warehouseId); }
  sql += ' ORDER BY created_at ASC, id ASC';
  return db.prepare(sql).all(...params);
}

/** Append a cost layer for stock received. Preserves multiple/overlapping costs. */
function addLayer({ productId, warehouseId, variantId = null, shelfId = null, qty, unitCost, sourceMovementId = null, supplierId = null }) {
  const q = Math.round(Number(qty) || 0);
  const c = Math.round(Number(unitCost) || 0);
  if (q <= 0) throw new Error('addLayer: quantity must be > 0');
  if (c < 0) throw new Error('addLayer: unit cost cannot be negative');
  // `supplier_id` is tolerated if a future migration adds it (COLUMN may not exist yet).
  const cols = ['product_id', 'variant_id', 'warehouse_id', 'shelf_id', 'source_movement_id', 'original_quantity', 'remaining_quantity', 'unit_cost'];
  const vals = [productId, variantId, warehouseId, shelfId, sourceMovementId, q, q, c];
  if (supplierId != null) {
    try { db.prepare('SELECT supplier_id FROM inventory_cost_layers LIMIT 1').get(); cols.push('supplier_id'); vals.push(supplierId); } catch {}
  }
  const placeholders = cols.map(() => '?').join(',');
  const res = db.prepare(`INSERT INTO inventory_cost_layers (${cols.join(',')}) VALUES (${placeholders})`).run(...vals);
  return db.prepare('SELECT * FROM inventory_cost_layers WHERE id = ?').get(res.lastInsertRowid);
}

/** Reduce layer remaining quantities (physical depletion). Returns consumed lines. */
function consumeLayers(productId, qty, warehouseId = null) {
  const layers = getLayers(productId, warehouseId);
  let remaining = Math.round(Number(qty) || 0);
  const consumed = [];
  for (const l of layers) {
    if (remaining <= 0) break;
    const take = Math.min(l.remaining_quantity, remaining);
    db.prepare('UPDATE inventory_cost_layers SET remaining_quantity = remaining_quantity - ? WHERE id = ?').run(take, l.id);
    consumed.push({ layerId: l.id, qty: take, unit_cost: l.unit_cost, total_cost: take * l.unit_cost });
    remaining -= take;
  }
  return { consumed, remaining, cost: consumed.reduce((s, c) => s + c.total_cost, 0) };
}

// ── SYSTEM A: costing ──

/** Single-unit COST BASIS for a product under a given method. */
function unitCostFor(productId, method, warehouseId = null) {
  const layers = getLayers(productId, warehouseId);
  if (layers.length === 0) return null;
  switch (method) {
    case 'FIFO': return layers[0].unit_cost;              // oldest applicable
    case 'LATEST': return layers[layers.length - 1].unit_cost; // newest (created_at asc → last)
    case 'HIGHEST': return Math.max(...layers.map(l => l.unit_cost));
    default: throw new Error('Invalid costing method: ' + method);
  }
}

/**
 * Deterministic layer CONSUMPTION order per method — this is what makes the
 * valuation decision explainable/auditable (which layer was "consumed"):
 *   FIFO    → oldest layer first (created_at ASC, id ASC)
 *   LATEST  → newest layer first (created_at DESC, id DESC)
 *   HIGHEST → highest-cost layer first (unit_cost DESC, then oldest for ties)
 * Returns a new array (never mutates `layers`).
 */
function layerOrderForMethod(layers, method) {
  const arr = [...layers];
  if (method === 'LATEST') {
    return arr.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')) || b.id - a.id);
  }
  if (method === 'HIGHEST') {
    return arr.sort((a, b) => b.unit_cost - a.unit_cost || String(a.created_at || '').localeCompare(String(b.created_at || '')) || a.id - b.id);
  }
  return arr; // FIFO — already created_at ASC, id ASC
}

/** Reduce layer remaining_quantity consuming in a given order. Returns consumed lines. */
function consumeInOrder(productId, orderedLayers, qty) {
  let remaining = Math.round(Number(qty) || 0);
  const consumed = [];
  for (const l of orderedLayers) {
    if (remaining <= 0) break;
    const take = Math.min(l.remaining_quantity, remaining);
    db.prepare('UPDATE inventory_cost_layers SET remaining_quantity = remaining_quantity - ? WHERE id = ?').run(take, l.id);
    consumed.push({ layerId: l.id, qty: take, unit_cost: l.unit_cost, total_cost: take * l.unit_cost });
    remaining -= take;
  }
  return { consumed, remaining, cost: consumed.reduce((s, c) => s + c.total_cost, 0) };
}

/**
 * COGS for issuing `qty`. Rejects insufficient stock (no partial by default).
 * Depletes layers per the method's consumption order and returns the exact
 * layers consumed (auditable for FIFO, LATEST and HIGHEST alike).
 * @returns { cost, method, unit_cost, lines, remaining }
 */
function cogsForIssue(productId, qty, method = null, warehouseId = null) {
  const Q = Math.round(Number(qty) || 0);
  if (Q < 0) throw new Error('Invalid quantity: cannot be negative');
  if (Q === 0) return { cost: 0, method: method || getCostingMethod(), unit_cost: 0, lines: [], remaining: 0 };
  const m = (method || getCostingMethod()).toUpperCase();
  if (!COSTING_METHODS.includes(m)) throw new Error('Invalid costing method: ' + m);

  const layers = getLayers(productId, warehouseId);
  if (layers.length === 0) throw new Error('No inventory cost layers for this product');
  const available = layers.reduce((s, l) => s + l.remaining_quantity, 0);
  if (Q > available) throw new Error(`Insufficient stock. Available: ${available}, requested: ${Q}`);

  const ordered = layerOrderForMethod(layers, m);
  const depleted = consumeInOrder(productId, ordered, Q);
  const unit = Q ? Math.round(depleted.cost / Q) : 0;
  return { cost: depleted.cost, method: m, unit_cost: unit, lines: depleted.consumed, remaining: depleted.remaining };
}

/** Persist per-layer cost consumption (audit). Idempotent-ish; best-effort. */
function persistConsumption(orderId, productId, method, lines, orderItemId = null) {
  let n = 0;
  for (const l of (lines || [])) {
    try {
      db.prepare(`INSERT INTO cost_consumption (order_id, order_item_id, cost_layer_id, qty_consumed, unit_cost, total_cost)
                  VALUES (?, ?, ?, ?, ?, ?)`)
        .run(orderId, orderItemId, l.layerId || null, l.qty, l.unit_cost, l.total_cost);
      n++;
    } catch { /* best-effort */ }
  }
  return n;
}

// ── SYSTEM B: retail (independent) ──

/** Retail cost-basis unit price for a product (the cost INPUT to retail). */
function costBasis(productId, basis = null, warehouseId = null) {
  const b = (basis || getRetailBasis()).toUpperCase();
  if (!RETAIL_BASIS.includes(b)) throw new Error('Invalid retail cost basis: ' + b);
  const layers = getLayers(productId, warehouseId);
  if (layers.length === 0) return null;
  switch (b) {
    case 'FIFO_COST': return layers[0].unit_cost;
    case 'LATEST_PURCHASE_COST': return layers[layers.length - 1].unit_cost;
    case 'HIGHEST_PURCHASE_COST': return Math.max(...layers.map(l => l.unit_cost));
    default: return null;
  }
}

/** Authoritative retail price (cents) = cost_basis × (1 + markup%). */
function retailPrice(productId, warehouseId = null, opts = {}) {
  const basis = opts.basis || getRetailBasis();
  const markup = opts.markup != null ? Number(opts.markup) : getMarkupPercent();
  const base = costBasis(productId, basis, warehouseId);
  if (base == null) return null; // no layers yet → no price
  const raw = base * (1 + (Number.isFinite(markup) ? markup : DEFAULT_MARKUP) / 100);
  return Math.round(raw);
}

// ── Supplier wholesale-price history (multiple costs per supplier-product preserved) ──

/**
 * Historic unit costs for a supplier+product, derived from real purchase history.
 * Reads from a supplied list of rows (e.g. supply_order_items / purchase_order_items
 * joined to supplier) so it never guesses — the caller passes the actual lines.
 */
function supplierCostHistory(supplierProductLines) {
  // lines: [{ unit_cost, purchased_at/date, reference }]
  if (!Array.isArray(supplierProductLines)) return [];
  return supplierProductLines
    .map(l => ({ unit_cost: Math.round(Number(l.unit_cost) || 0), date: l.purchased_at || l.date || l.created_at || null, reference: l.reference || null }))
    .filter(l => l.unit_cost > 0)
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
}

module.exports = {
  COSTING_METHODS, RETAIL_BASIS, RETAIL_METHODS, DEFAULT_MARKUP,
  ensureConfig, getCostingMethod, getRetailBasis, getRetailMethod, getMarkupPercent,
  getLayers, addLayer, consumeLayers, layerOrderForMethod, consumeInOrder,
  unitCostFor, cogsForIssue, persistConsumption,
  costBasis, retailPrice, supplierCostHistory,
};
