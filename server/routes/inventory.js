const express = require('express');
const router = express.Router();
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');
const inventoryService = require('../services/inventoryService');

// All inventory endpoints require admin authentication
router.get('/stock', adminAuth, requirePermission('inventory.read'), (req, res) => {
  try {
    const { product_id, warehouse_id, location_id } = req.query;
    if (!product_id || !warehouse_id) {
      return res.status(400).json({ error: 'product_id and warehouse_id are required' });
    }
    const stock = inventoryService.getStock(parseInt(product_id), parseInt(warehouse_id), location_id ? parseInt(location_id) : null);
    res.json(stock || { qty_on_hand: 0, qty_reserved: 0 });
  } catch (err) {
    console.error('Error fetching stock:', err);
    res.status(500).json({ error: 'Failed to fetch stock' });
  }
});

router.get('/movements', adminAuth, requirePermission('inventory.read'), (req, res) => {
  try {
    const filters = {
      productId: req.query.product_id ? parseInt(req.query.product_id) : undefined,
      warehouseId: req.query.warehouse_id ? parseInt(req.query.warehouse_id) : undefined,
      locationId: req.query.location_id ? parseInt(req.query.location_id) : undefined,
      type: req.query.type,
      referenceType: req.query.reference_type,
      referenceId: req.query.reference_id ? parseInt(req.query.reference_id) : undefined,
      userId: req.query.user_id,
      dateFrom: req.query.date_from,
      dateTo: req.query.date_to,
      limit: Math.min(parseInt(req.query.limit) || 50, 200),
      offset: parseInt(req.query.offset) || 0,
    };
    const movements = inventoryService.getMovements(filters);
    res.json(movements);
  } catch (err) {
    console.error('Error fetching movements:', err);
    res.status(500).json({ error: 'Failed to fetch movements' });
  }
});

router.post('/movements', adminAuth, requirePermission('inventory.adjust'), require('../services/idempotencyService').idempotency, (req, res) => {
  try {
    const { product_id, warehouse_id, location_id, type, reason, reference_type, reference_id, qty_change, counted_qty, unit_cost, note } = req.body;

    if (!product_id || !warehouse_id || !type) {
      return res.status(400).json({ error: 'product_id, warehouse_id, and type are required' });
    }
    if (type !== 'count' && qty_change === undefined) {
      return res.status(400).json({ error: 'qty_change is required (use counted_qty for counts)' });
    }

    const movement = inventoryService.createMovement({
      productId: parseInt(product_id),
      warehouseId: parseInt(warehouse_id),
      locationId: location_id ? parseInt(location_id) : null,
      type,
      reason,
      referenceType: reference_type,
      referenceId: reference_id ? parseInt(reference_id) : null,
      qtyChange: qty_change !== undefined ? parseInt(qty_change) : undefined,
      countedQty: counted_qty !== undefined ? parseInt(counted_qty) : undefined,
      unitCost: unit_cost ? parseInt(unit_cost) : 0,
      note,
      userId: req.session.username || req.session.user?.email || '',
      setProductCost: req.body.set_product_cost !== false,
      deriveRetail: !!req.body.derive_retail,
    });

    res.status(201).json(movement);
  } catch (err) {
    console.error('Error creating movement:', err);
    if (err.message.includes('Insufficient')) {
      return res.status(409).json({ error: err.message });
    }
    if (err.message.includes('Invalid movement type') || err.message.includes('required')) {
      return res.status(400).json({ error: err.message });
    }
    if (err.message.includes('in the trash') || err.message.includes('not found')) {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to create movement' });
  }
});

router.get('/replay/:productId/:warehouseId', adminAuth, requirePermission('inventory.read'), (req, res) => {
  try {
    const result = inventoryService.replayMovements(
      parseInt(req.params.productId),
      parseInt(req.params.warehouseId)
    );
    res.json(result);
  } catch (err) {
    console.error('Error replaying movements:', err);
    res.status(500).json({ error: 'Failed to replay movements' });
  }
});

router.get('/low-stock', adminAuth, requirePermission('inventory.read'), (req, res) => {
  try {
    const { warehouse_id } = req.query;
    let sql = `
      SELECT i.*, p.name as product_name, p.sku, p.reorder_point, p.min_stock
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      WHERE i.qty_on_hand <= p.reorder_point AND p.reorder_point > 0 AND p.deleted_at IS NULL
    `;
    const params = [];

    if (warehouse_id) {
      sql += ' AND i.warehouse_id = ?';
      params.push(parseInt(warehouse_id));
    }

    sql += ' ORDER BY i.qty_on_hand ASC';

    const items = db.prepare(sql).all(...params);
    res.json(items);
  } catch (err) {
    console.error('Error fetching low stock:', err);
    res.status(500).json({ error: 'Failed to fetch low stock items' });
  }
});

router.get('/summary', adminAuth, requirePermission('inventory.read'), (req, res) => {
  try {
    const { product_id, warehouse_id } = req.query;
    let sql = `
      SELECT i.*, p.name as product_name, p.sku, w.name as warehouse_name, w.code as warehouse_code, l.name as location_name
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      JOIN warehouses w ON w.id = i.warehouse_id
      LEFT JOIN locations l ON l.id = i.location_id
      WHERE p.deleted_at IS NULL
    `;
    const params = [];

    if (product_id) {
      sql += ' AND i.product_id = ?';
      params.push(parseInt(product_id));
    }
    if (warehouse_id) {
      sql += ' AND i.warehouse_id = ?';
      params.push(parseInt(warehouse_id));
    }

    sql += ' ORDER BY p.name ASC';

    const items = db.prepare(sql).all(...params);
    res.json(items);
  } catch (err) {
    console.error('Error fetching inventory summary:', err);
    res.status(500).json({ error: 'Failed to fetch inventory summary' });
  }
});

// GET /api/admin/inventory/:id/receipt.pdf — invoice-style PDF for one movement
// QR code encodes a public link: {customer_site_url}/movement/{id}
router.get('/:id/receipt.pdf', adminAuth, async (req, res) => {
  try {
    const m = db.prepare('SELECT * FROM inventory_movements WHERE id = ?').get(req.params.id);
    if (!m) return res.status(404).json({ error: 'Movement not found' });

    const printService = require('../services/printService');
    const pdf = await printService.movementReceiptPdf(m);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="MOV-${m.id}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error('Movement receipt PDF error:', err);
    res.status(500).json({ error: 'Failed to generate receipt PDF' });
  }
});

module.exports = router;
