/**
 * Sales ↔ Inventory Bridge (mventor-ticket-048)
 *
 * Connects customer orders to the movement engine:
 *   - reserveForOrder: RESERVATION movements when an order is confirmed
 *   - releaseForOrder: RELEASE movements on cancel/refund (or before shipping)
 *   - issueForOrder:   ISSUE movements when goods leave (shipped / COD creation / paid webhook)
 *
 * Idempotent: each function first checks whether the same movement type already
 * exists for the order, so lifecycle hooks can fire repeatedly without
 * double-counting stock.
 *
 * Failure policy: a paid/COD order is NEVER rejected because of stock — a failed
 * item emits an 'order_stock_issue_failed' event and processing continues
 * (warehouse reconciles via count/adjustment).
 */

const db = require('../db');
const inventoryService = require('./inventoryService');
const eventService = require('./eventService');

/** Normalize the two item shapes: web JSON items vs mobile order_items rows. */
function normalizeItems(items) {
  return (Array.isArray(items) ? items : [])
    .map(it => ({
      productId: parseInt(it.id || it.product_id || 0) || null,
      qty: parseInt(it.qty || it.quantity || 1) || 1,
    }))
    .filter(it => it.productId && it.qty > 0);
}

function resolveWarehouse(productId) {
  const p = db.prepare('SELECT default_warehouse_id FROM products WHERE id = ?').get(productId);
  if (p && p.default_warehouse_id) return p.default_warehouse_id;
  const main = db.prepare("SELECT id FROM warehouses WHERE code = 'WH-MAIN' AND is_active = 1").get();
  if (main) return main.id;
  const any = db.prepare('SELECT id FROM warehouses WHERE is_active = 1 ORDER BY id LIMIT 1').get();
  return any ? any.id : null;
}

function orderAlreadyHas(orderId, movementType) {
  const row = db.prepare(`
    SELECT id FROM inventory_movements
    WHERE reference_type = 'order' AND reference_id = ? AND type = ?
    LIMIT 1
  `).get(orderId, movementType);
  return !!row;
}

/**
 * BUSINESS GUARD: the bridge's movements are soft-referenced (reference_type/
 * reference_id have no FK), so a bad orderId would create a dangling reference
 * rather than a constraint error. We validate here so every bridge mutation
 * fails as a clean domain error against a genuine missing order — FK stays the
 * final net for hard references, but the bridge never relies on it alone.
 */
function assertOrderExists(orderId) {
  const order = db.prepare('SELECT id FROM orders WHERE id = ?').get(orderId);
  if (!order) throw new Error(`Order #${orderId} not found — cannot move inventory for a missing order`);
  return order;
}

function emitFailure(orderId, userId, items) {
  try {
    eventService.emit('order_stock_issue_failed', eventService.ENTITY_TYPES.ORDER, orderId, {
      userId: userId || 'system',
      payload: { failed_items: items },
    });
  } catch { /* never throw from audit */ }
}

/**
 * Create ISSUE movements for every order item (stock leaves the warehouse).
 * @returns {{issued: number, failed: Array, costs: Array<{productId,qty,unitCost}>}}
 * costs carries the per-line unit COGS for freshly-issued lines only
 * (072: snapshot threading; repeat/skip calls return costs: [] — never
 * overwrite real snapshots with empty data).
 */
function issueForOrder(orderId, items, userId = '') {
  assertOrderExists(orderId);
  if (orderAlreadyHas(orderId, 'issue')) return { issued: 0, failed: [], skipped: true, costs: [] };
  const norm = normalizeItems(items);
  let issued = 0;
  const failed = [];
  const costs = [];

  for (const it of norm) {
    const warehouseId = resolveWarehouse(it.productId);
    if (!warehouseId) { failed.push({ ...it, reason: 'no_active_warehouse' }); continue; }
    // COGS basis: the configured inventory costing method (FIFO / LATEST / HIGHEST)
    // depletes cost layers and returns the per-unit COGS. Falls back to the
    // product's current wholesale for legacy items without cost layers, so
    // existing issues are never broken.
    const prod = db.prepare('SELECT cost_price FROM products WHERE id = ?').get(it.productId);
    let perUnit = prod ? prod.cost_price : 0;
    try {
      const valuationService = require('./valuationService');
      const cogs = valuationService.cogsForIssue(it.productId, it.qty, valuationService.getCostingMethod(), warehouseId);
      perUnit = cogs.cost > 0 ? Math.round(cogs.cost / it.qty) : (prod ? prod.cost_price : 0);
      // Persist the exact per-layer consumption (audit) so COGS is reproducible
      // without relying on the current product cost or config.
      try { valuationService.persistConsumption(orderId, it.productId, cogs.method, cogs.lines); } catch {}
    } catch (costErr) { /* no layers / legacy → keep products.cost_price; createMovement enforces stock */ }
    try {
      inventoryService.createMovement({
        productId: it.productId,
        warehouseId,
        type: 'issue',
        reason: 'sales_order',
        referenceType: 'order',
        referenceId: orderId,
        qtyChange: -it.qty,
        unitCost: perUnit,
        note: `Order #${orderId} shipment`,
        userId,
      });
      costs.push({ productId: it.productId, qty: it.qty, unitCost: perUnit });
      issued++;
    } catch (err) {
      failed.push({ ...it, reason: err.message });
    }
  }
  if (failed.length > 0) emitFailure(orderId, userId, failed);

  // Fulfillment pipeline: auto-create the warehouse Issue Order for this
  // paid order (pick/pack document) — mventor-ticket-057.
  try {
    const warehouseOrderService = require('./warehouseOrderService');
    warehouseOrderService.createIssueForOrder(orderId, items, userId);
  } catch (err) {
    console.error('Auto issue-order creation failed:', err.message);
  }
  return { issued, failed, costs };
}

/**
 * Create RESERVATION movements for every order item (stock promised).
 * @returns {{reserved: number, failed: Array}}
 */
function reserveForOrder(orderId, items, userId = '') {
  assertOrderExists(orderId);
  if (orderAlreadyHas(orderId, 'reservation')) return { reserved: 0, failed: [], skipped: true };
  const norm = normalizeItems(items);
  let reserved = 0;
  const failed = [];

  for (const it of norm) {
    const warehouseId = resolveWarehouse(it.productId);
    if (!warehouseId) { failed.push({ ...it, reason: 'no_active_warehouse' }); continue; }
    try {
      inventoryService.createMovement({
        productId: it.productId,
        warehouseId,
        type: 'reservation',
        reason: 'sales_order_confirmed',
        referenceType: 'order',
        referenceId: orderId,
        qtyChange: -it.qty,
        note: `Order #${orderId} confirmed — stock promised`,
        userId,
      });
      reserved++;
    } catch (err) {
      failed.push({ ...it, reason: err.message });
    }
  }
  if (failed.length > 0) emitFailure(orderId, userId, failed);
  return { reserved, failed };
}

/**
 * Create RELEASE movements for every order item (promises freed).
 * Safe to call even when nothing was reserved — clamped at zero.
 * @returns {{released: number}}
 */
function releaseForOrder(orderId, items, userId = '') {
  assertOrderExists(orderId);
  if (orderAlreadyHas(orderId, 'release')) return { released: 0, skipped: true };
  const norm = normalizeItems(items);
  let released = 0;

  for (const it of norm) {
    const warehouseId = resolveWarehouse(it.productId);
    if (!warehouseId) continue;
    try {
      inventoryService.createMovement({
        productId: it.productId,
        warehouseId,
        type: 'release',
        reason: 'sales_order_released',
        referenceType: 'order',
        referenceId: orderId,
        qtyChange: it.qty,
        note: `Order #${orderId} promise freed`,
        userId,
      });
      released++;
    } catch { /* release is best-effort by design */ }
  }
  return { released };
}

/** Parse an order row's items JSON safely. */
function parseOrderItems(order) {
  try {
    const arr = JSON.parse(order.items || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

module.exports = {
  issueForOrder,
  reserveForOrder,
  releaseForOrder,
  parseOrderItems,
};
