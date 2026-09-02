const express = require('express');
const router = express.Router();
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');
const printService = require('../services/printService');
const warehouseOrderService = require('../services/warehouseOrderService');
const settingsService = require('../services/settingsService');

// Every endpoint returns a VIEW of the document. Printing happens FROM the view
// (the viewer page includes a Print / Save PDF button).
// ?embed=1 → returns only the document sheet (for the Drive-style floating viewer)

async function sendView(res, html) {
  const embed = res.req.query.embed === '1';
  res.setHeader('Content-Type', 'text/html');
  res.send(embed ? printService.extractSheet(html) : html);
}

// ── Invoice (order) ──
router.get('/invoice/:orderId', adminAuth, requirePermission('orders.manage'), async (req, res) => {
  try {
    const order = db.prepare(`
      SELECT o.*, c.email as customer_email, c.name as customer_name
      FROM orders o LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?
    `).get(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    try { order.items = JSON.parse(order.items || '[]'); } catch { order.items = []; }
    sendView(res, await printService.invoiceHtml(order));
  } catch (err) {
    console.error('Error viewing invoice:', err);
    res.status(500).json({ error: 'Failed to view invoice' });
  }
});

// ── Customer receipt (order) ──
router.get('/receipt/:orderId', adminAuth, requirePermission('orders.manage'), async (req, res) => {
  try {
    const order = db.prepare(`
      SELECT o.*, c.email as customer_email, c.name as customer_name
      FROM orders o LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?
    `).get(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    try { order.items = JSON.parse(order.items || '[]'); } catch { order.items = []; }
    sendView(res, await printService.receiptHtml(order));
  } catch (err) {
    console.error('Error viewing receipt:', err);
    res.status(500).json({ error: 'Failed to view receipt' });
  }
});

// ── Inventory receipt (movement) ──
router.get('/movement/:movementId', adminAuth, requirePermission('inventory.view'), async (req, res) => {
  try {
    const movement = db.prepare(`
      SELECT m.*, p.name as product_name, w.name as warehouse_name, l.name as location_name
      FROM inventory_movements m
      LEFT JOIN products p ON p.id = m.product_id
      LEFT JOIN warehouses w ON w.id = m.warehouse_id
      LEFT JOIN locations l ON l.id = m.location_id
      WHERE m.id = ?
    `).get(req.params.movementId);
    if (!movement) return res.status(404).json({ error: 'Movement not found' });
    sendView(res, await printService.movementReceiptHtml(movement));
  } catch (err) {
    console.error('Error viewing movement:', err);
    res.status(500).json({ error: 'Failed to view movement' });
  }
});

// ── Supply order ──
router.get('/supply-order/:id', adminAuth, requirePermission('inventory.view'), async (req, res) => {
  try {
    const order = warehouseOrderService.getSupplyOrder(parseInt(req.params.id));
    if (!order) return res.status(404).json({ error: 'Supply order not found' });
    sendView(res, await printService.supplyOrderHtml(order));
  } catch (err) {
    console.error('Error viewing supply order:', err);
    res.status(500).json({ error: 'Failed to view supply order' });
  }
});

// ── Issue order ──
router.get('/issue-order/:id', adminAuth, requirePermission('inventory.view'), async (req, res) => {
  try {
    const order = warehouseOrderService.getIssueOrder(parseInt(req.params.id));
    if (!order) return res.status(404).json({ error: 'Issue order not found' });
    sendView(res, await printService.issueOrderHtml(order));
  } catch (err) {
    console.error('Error viewing issue order:', err);
    res.status(500).json({ error: 'Failed to view issue order' });
  }
});

// ── Shipping label (courier) ──
router.get('/shipping/:orderId', adminAuth, requirePermission('orders.manage'), async (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    try { order.items = JSON.parse(order.items || '[]'); } catch { order.items = []; }
    const shipment = db.prepare(`
      SELECT s.*, sp.name as provider_name, sp.tracking_url_template
      FROM shipments s LEFT JOIN shipment_providers sp ON sp.id = s.provider_id
      WHERE s.order_id = ?
    `).get(order.id);
    const settings = {
      courier_name: shipment?.provider_name || settingsService.get('courier_name', ''),
      courier_website: settingsService.get('courier_website', ''),
      courier_tracking_prefix: settingsService.get('courier_tracking_prefix', ''),
      shipping_from_address: settingsService.get('shipping_from_address', ''),
      courier_phone: settingsService.get('courier_phone', ''),
      tracking_number: shipment?.tracking_number || '',
    };
    sendView(res, await printService.shippingLabelHtml(order, settings));
  } catch (err) {
    console.error('Error viewing shipping label:', err);
    res.status(500).json({ error: 'Failed to view shipping label' });
  }
});

// ── Shipping policy ──
router.get('/shipping-policy', adminAuth, requirePermission('orders.manage'), async (req, res) => {
  try {
    const settings = {
      courier_name: settingsService.get('courier_name', ''),
      courier_website: settingsService.get('courier_website', ''),
      shipping_policy: settingsService.get('shipping_policy', ''),
    };
    sendView(res, await printService.shippingPolicyHtml(settings));
  } catch (err) {
    console.error('Error viewing shipping policy:', err);
    res.status(500).json({ error: 'Failed to view shipping policy' });
  }
});

// ── Picking sheet ──
router.get('/picking/:orderId', adminAuth, requirePermission('inventory.view'), async (req, res) => {
  try {
    const order = db.prepare(`
      SELECT o.*, c.email as customer_email, c.name as customer_name
      FROM orders o LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?
    `).get(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    try { order.items = JSON.parse(order.items || '[]'); } catch { order.items = []; }
    const task = db.prepare('SELECT * FROM picking_tasks WHERE order_id = ?').get(order.id) || {};
    sendView(res, await printService.pickingSheetHtml(order, task));
  } catch (err) {
    console.error('Error viewing picking sheet:', err);
    res.status(500).json({ error: 'Failed to view picking sheet' });
  }
});

// -- Packing sheet --
router.get('/packing/:orderId', adminAuth, requirePermission('inventory.view'), async (req, res) => {
  try {
    const order = db.prepare(`
      SELECT o.*, c.email as customer_email, c.name as customer_name
      FROM orders o LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?
    `).get(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    try { order.items = JSON.parse(order.items || '[]'); } catch { order.items = []; }
    const task = db.prepare('SELECT * FROM packing_tasks WHERE order_id = ?').get(order.id) || {};
    sendView(res, await printService.packingSheetHtml(order, task));
  } catch (err) {
    console.error('Error viewing packing sheet:', err);
    res.status(500).json({ error: 'Failed to view packing sheet' });
  }
});

// ── Email the customer receipt (SendGrid / SMTP) ──
router.post('/receipt/:orderId/email', adminAuth, requirePermission('orders.manage'), async (req, res) => {
  try {
    const order = db.prepare(`
      SELECT o.*, c.email as customer_email, c.name as customer_name
      FROM orders o LEFT JOIN customers c ON o.customer_id = c.id
      WHERE o.id = ?
    `).get(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    try { order.items = JSON.parse(order.items || '[]'); } catch { order.items = []; }

    const email = require('../email');
    const html = await printService.receiptEmailHtml(order, order.customer_email);
    const sent = await email.sendMail({
      to: order.customer_email,
      subject: `Your Receipt — Order #${order.id}`,
      html,
    });
    res.json({ success: sent, sent, to: order.customer_email || '' });
  } catch (err) {
    console.error('Error emailing receipt:', err);
    res.status(500).json({ error: 'Failed to email receipt' });
  }
});

module.exports = router;
