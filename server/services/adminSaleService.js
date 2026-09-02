// Phase 7 — Admin Sale → FIFO → Historical COGS (production workflow)
const db = require('../db');
const inventoryService = require('./inventoryService');
const { consumeFifo, persistConsumption } = require('./inventoryCostLayers');

function createAdminSale({ productId, variantId, warehouseId, qty, orderId, basePrice, finalPrice }) {
  // 1. Inventory validation
  const stock = inventoryService.getStock(productId, warehouseId);
  if (!stock || stock.qty_on_hand < qty) {
    throw new Error('Insufficient stock: available ' + (stock ? stock.qty_on_hand : 0) + ', requested ' + qty);
  }

  // 2. FIFO consume (uses actual cost layers)
  const fifoResult = consumeFifo(productId, qty, warehouseId);

  // 3. Persist order_items (normalized)
  // Duplicate protection: reject if same order already has this item
  const existing=db.prepare("SELECT id FROM order_items WHERE order_id = ? AND product_id = ?").get(orderId, productId);
  if(existing){ throw new Error("Duplicate order item for this order/product"); }
  const itemResult = db.prepare(`
    INSERT INTO order_items (order_id, product_id, product_name, quantity, price, variant_color, variant_size)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(orderId, productId, "Product " + productId, qty, finalPrice || 0, null, null);

  // 4. Persist cost consumption
  for (const consumed of fifoResult.consumed) {
    persistConsumption(orderId, itemResult.lastInsertRowid, consumed.layerId, consumed.qty, consumed.unitCost);
  }

  // 5. Inventory movement (ISSUE / SALE type)
  const movementResult = db.prepare(`
    INSERT INTO inventory_movements (product_id, warehouse_id, type, qty_change, reason, reference_type, reference_id, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(productId, warehouseId, 'issue', -qty, 'Admin sale / FIFO', 'order', orderId, 'FIFO consumption via admin sale');

  // 6. Update cost layer remaining quantities (manual — in real DB should update layer rows)
  // Note: consumeFifo logic reduces remaining; for persistence we must update DB
  for (const consumed of fifoResult.consumed) {
    db.prepare('UPDATE inventory_cost_layers SET remaining_quantity = remaining_quantity - ? WHERE id = ?')
      .run(consumed.qty, consumed.layerId);
  }

  return {
    orderItemId: itemResult.lastInsertRowid,
    cogs: fifoResult.costSnapshot,
    movementId: movementResult.lastInsertRowid,
    consumedLayers: fifoResult.consumed,
    remainingQty: fifoResult.remainingQty
  };
}

module.exports = { createAdminSale };
