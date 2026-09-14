/**
 * Counter (in-person) sale — walk-in money at the register
 * (mventor-ticket-093, previously a fixed-id debug endpoint).
 *
 * The sale becomes a REAL order (walk-in customer = NULL), priced from
 * validated integer cents, then settled through the canonical settlement
 * seam (cash/card collected now): Dr 1000 / Cr 4000 revenue + Dr 5000 COGS /
 * Cr 1300 from the SAME FIFO cost snapshots every other channel uses.
 * Stock issuance, order rows, payment stamps, journal and audit happen in
 * ONE transaction — a closed period or a posting failure leaves nothing
 * behind (409 SETTLEMENT_BLOCKED), so counter sales can no longer create
 * unbooked revenue or unjournalled stock shrink.
 *
 * Response keeps the historical keys { order, orderItem, fifoResult,
 * costLayers, message } for the existing storefront debug page and adds
 * `settlement` for the honest GL trail.
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');
const adminSaleService = require('../services/adminSaleService');
const salesSettlement = require('../services/salesSettlementService');
const priceListService = require('../services/priceListService');

const MAX_QTY = 10000;

router.post('/', adminAuth, requirePermission('orders.create'), (req, res) => {
  const { productId, variantId, warehouseId, qty } = req.body || {};
  const pid = parseInt(productId, 10);
  const wid = parseInt(warehouseId, 10);
  const q = parseInt(qty, 10);
  // cents are ONLY accepted as integers — legacy keys kept but validated hard
  const unitRaw = req.body.unitPriceCents !== undefined ? req.body.unitPriceCents
    : (req.body.finalPrice !== undefined ? req.body.finalPrice : req.body.basePrice);
  const unit = Number(unitRaw);

  if (!Number.isInteger(pid) || pid <= 0) return res.status(400).json({ error: 'product_id must be a positive integer' });
  if (!Number.isInteger(wid) || wid <= 0) return res.status(400).json({ error: 'warehouse_id must be a positive integer' });
  if (!Number.isInteger(q) || q < 1 || q > MAX_QTY) return res.status(400).json({ error: `qty must be an integer between 1 and ${MAX_QTY}` });
  if (!Number.isInteger(unit) || unit < 0) return res.status(400).json({ error: 'unit price must be an INTEGER number of cents (no fractional cents, no silent rounding)' });
  const method = ['cash', 'card', 'wallet'].includes(String(req.body.method || 'cash').toLowerCase())
    ? String(req.body.method).toLowerCase() : 'cash';

  const product = db.prepare('SELECT id, name, active, deleted_at FROM products WHERE id = ?').get(pid);
  if (!product || product.deleted_at) return res.status(404).json({ error: 'Product not found' });
  if (!product.active) return res.status(400).json({ error: `Product "${product.name}" is inactive — activate it or choose another` });

  let outcome = null;
  try {
    db.transaction(() => {
      // 1) the walk-in order — real pricing, no invented customer ids
      const total = unit * q;
      const listCode = priceListService.storefrontListCode();
      const orderRes = db.prepare(`
        INSERT INTO orders (customer_id, total, status, items, price_list_code, payment_method)
        VALUES (NULL, ?, 'pending', '[]', ?, ?)
      `).run(total, listCode, method);
      const orderId = orderRes.lastInsertRowid;

      // 2) FIFO issue + order_items snapshot (service does the costing)
      const result = adminSaleService.createAdminSale({
        productId: pid,
        variantId: variantId ? parseInt(variantId, 10) : null,
        warehouseId: wid,
        qty: q,
        orderId,
        basePrice: unit,
        finalPrice: unit,
        userId: req.session.username || req.user?.email || 'counter-operator',
      });

      // 3) canonical settlement: payment evidence + journal + audit, same txn
      const settlement = salesSettlement.settleCounterSale(orderId, {
        actor: req.session.username || req.user?.email || 'counter',
        method,
        reason: String(req.body.reason || 'counter sale').slice(0, 300),
      });

      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      const item = db.prepare('SELECT * FROM order_items WHERE order_id = ?').get(orderId);
      const layers = db.prepare(
        'SELECT id, original_quantity, remaining_quantity, unit_cost FROM inventory_cost_layers WHERE product_id = ? ORDER BY id ASC'
      ).all(pid);
      outcome = {
        order,
        orderItem: item,
        fifoResult: result,
        costLayers: layers.map((r) => [r.id, r.original_quantity, r.remaining_quantity, r.unit_cost]),
        settlement: { settled: settlement.settled, replayed: !!settlement.replayed, journal: settlement.entry ? settlement.entry.entry_no : null },
        message: `Cash counter sale #${orderId} completed via FIFO + settled journal`,
      };
    });
  } catch (err) {
    const m = String(err && err.message || err);
    if (/closed financial period|refusing to post/i.test(m)) {
      return res.status(409).json({ code: 'SETTLEMENT_BLOCKED', error: `Sale NOT taken: ${m}` });
    }
    if (/Insufficient stock/i.test(m)) return res.status(409).json({ error: m });
    if (/inactive|not found|no positive total|integer number of cents/i.test(m)) return res.status(400).json({ error: m });
    console.error('Admin sale error:', m);
    return res.status(500).json({ error: 'Counter sale failed — nothing was changed (order, stock and journal are one transaction)' });
  }
  res.status(201).json(outcome);
});

module.exports = router;
