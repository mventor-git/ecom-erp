const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const adminSaleService = require('../services/adminSaleService');

router.use(adminAuth);

router.post('/', async (req, res) => {
  try {
    const { productId, variantId, warehouseId, qty, basePrice, finalPrice } = req.body;
    // Find or create a temporary/admin order for this sale
    // (066: snapshot site-default list code like every other creation path)
    const db = require('../db');
    const adminPriceListCode = require('../services/priceListService').storefrontListCode();
    const orderRes = db.prepare("INSERT INTO orders (customer_id, stripe_session_id, total, status, items, price_list_code) VALUES (?, ?, ?, ?, ?, ?)").run(1, "tmp_" + Math.floor(Math.random()*1000000), 0, "pending", "[]", adminPriceListCode);
    const orderId = orderRes.lastInsertRowid;
    db.prepare("UPDATE orders SET stripe_session_id = ? WHERE id = ?").run("admin_" + orderId, orderId);
    const result = adminSaleService.createAdminSale({
      productId: parseInt(productId) || 1,
      variantId: variantId ? parseInt(variantId) : null,
      warehouseId: parseInt(warehouseId) || 1,
      qty: parseInt(qty) || 1,
      orderId,
      basePrice: basePrice || 1000,
      finalPrice: finalPrice || 1000,
      userId: req.session.username || 'admin'
    });
    // Return full result
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    const item = db.prepare('SELECT * FROM order_items WHERE order_id = ?').get(orderId);
    const layers = db.exec('SELECT id, original_quantity, remaining_quantity, unit_cost FROM inventory_cost_layers WHERE product_id = ? ORDER BY id ASC', [parseInt(productId) || 1]);
    res.status(201).json({
      order,
      orderItem: item,
      fifoResult: result,
      costLayers: layers[0] ? layers[0].values : [],
      message: 'Admin sale completed via FIFO'
    });
  } catch (e) {
    console.error('Admin sale error:', e);
    res.status(500).json({ error: e.message || 'Admin sale failed' });
  }
});

module.exports = router;
