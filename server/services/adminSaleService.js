// Phase 7 — Admin Sale → FIFO → Historical COGS (production workflow)
const db = require('../db');
const inventoryService = require('./inventoryService');
const { consumeFifo, persistConsumption } = require('./inventoryCostLayers');
const priceListService = require('./priceListService');

function createAdminSale({ productId, variantId, warehouseId, qty, orderId, basePrice, finalPrice, userId = '' }) {
  // 1. Inventory validation
  const stock = inventoryService.getStock(productId, warehouseId);
  if (!stock || stock.qty_on_hand < qty) {
    throw new Error('Insufficient stock: available ' + (stock ? stock.qty_on_hand : 0) + ', requested ' + qty);
  }

  // 2. FIFO consume (uses actual cost layers)
  const fifoResult = consumeFifo(productId, qty, warehouseId);

  // 3. Persist order_items (normalized) with the site-default list snapshot (066)
  // + mirrors (069): qty/base/final mirror the inputs; cost_snapshot is the
  // REAL FIFO unit cost consumed for this exact line (in hand — not fabricated)
  // Duplicate protection: reject if same order already has this item
  const existing=db.prepare("SELECT id FROM order_items WHERE order_id = ? AND product_id = ?").get(orderId, productId);
  if(existing){ throw new Error("Duplicate order item for this order/product"); }
  const unitCost = qty > 0 ? Math.round((fifoResult.costSnapshot || 0) / qty) : 0;
  const itemResult = db.prepare(`
    INSERT INTO order_items (order_id, product_id, product_name, quantity, price, variant_color, variant_size, price_list_code,
      qty, base_price, final_price, cost_snapshot)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(orderId, productId, "Product " + productId, qty, finalPrice || 0, null, null, priceListService.storefrontListCode(),
    qty, Math.round(Number(basePrice) || 0), Math.round(Number(finalPrice) || 0), unitCost);

  // 4. Persist cost consumption
  for (const consumed of fifoResult.consumed) {
    persistConsumption(orderId, itemResult.lastInsertRowid, consumed.layerId, consumed.qty, consumed.unitCost);
  }

  // 5. Inventory movement (ISSUE / SALE type) — through the engine (083),
  // gaining trash/negative/stock guards, qty books, sync, alerts, events.
  // FIFO unit passed explicitly (wholesale default never triggers here).
  const fifoUnit = qty > 0 ? Math.round((fifoResult.costSnapshot || 0) / qty) : 0;
  const movementResult = inventoryService.createMovement({
    productId,
    warehouseId,
    type: 'issue',
    reason: 'Admin sale / FIFO',
    referenceType: 'order',
    referenceId: orderId,
    qtyChange: -qty,
    unitCost: fifoUnit,
    note: 'FIFO consumption via admin sale',
    userId,
  });

  // 6. Update cost layer remaining quantities (manual — in real DB should update layer rows)
  // Note: consumeFifo logic reduces remaining; for persistence we must update DB
  for (const consumed of fifoResult.consumed) {
    db.prepare('UPDATE inventory_cost_layers SET remaining_quantity = remaining_quantity - ? WHERE id = ?')
      .run(consumed.qty, consumed.layerId);
  }

  return {
    orderItemId: itemResult.lastInsertRowid,
    cogs: fifoResult.costSnapshot,
    movementId: movementResult.id,
    consumedLayers: fifoResult.consumed,
    remainingQty: fifoResult.remainingQty
  };
}

module.exports = { createAdminSale };
