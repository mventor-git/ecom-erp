// Phase 5 — FIFO Cost Layer Engine (read-only source; no business workflow changes yet)
const db = require('../db');

// Get cost layers for product/variant/warehouse ordered oldest first (FIFO)
function getCostLayers(productId, variantId = null, warehouseId = null) {
  const sql = `SELECT * FROM inventory_cost_layers
    WHERE product_id = ? AND (variant_id = ? OR ? IS NULL) AND (warehouse_id = ? OR ? IS NULL)
    ORDER BY created_at ASC, id ASC`;
  // Note: sql.js prepare/exec pattern; simplified for documentation
  const sqlDb = require('../db').getDb();
  const res = sqlDb ? sqlDb.exec(sql, [productId, variantId, variantId, warehouseId, warehouseId]) : null; return res && res.length ? res[0].values.map((v,i) => ({id: v[0], product_id: v[1], variant_id: v[2], warehouse_id: v[3], shelf_id: v[4], source_movement_id: v[5], original_quantity: v[6], remaining_quantity: v[7], unit_cost: v[8], created_at: v[9]})) : [];
}

// Consume FIFO: reduce remaining_quantity from oldest layers; return consumption record
function consumeFifo(productId, qty, warehouseId = null) {
  const layers = getCostLayers(productId, null, warehouseId);
  const result = { consumed: [], remainingQty: qty, costSnapshot: 0 };
  for (const layer of layers) {
    if (result.remainingQty <= 0) break;
    const consumeFromLayer = Math.min(layer.remaining_quantity, result.remainingQty);
    result.consumed.push({ layerId: layer.id, qty: consumeFromLayer, unitCost: layer.unit_cost, cost: consumeFromLayer * layer.unit_cost });
    result.costSnapshot += consumeFromLayer * layer.unit_cost;
    result.remainingQty -= consumeFromLayer;
  }
  return result;
}

module.exports = { getCostLayers, consumeFifo };

// Persist consumption record (for audit)
function persistConsumption(orderId, orderItemId, layerId, qty, unitCost) {
  const total = qty * unitCost;
  // Use db.prepare/run by project convention
  const db = require('../db');
  db.prepare('INSERT INTO cost_consumption (order_id, order_item_id, cost_layer_id, qty_consumed, unit_cost, total_cost) VALUES (?, ?, ?, ?, ?, ?)').run(orderId, orderItemId || null, layerId, qty, unitCost, total);
  return { orderId, layerId, qty, total };
}
module.exports.persistConsumption = persistConsumption;
