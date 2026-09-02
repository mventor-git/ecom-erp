const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');
const shippingService = require('../services/shippingService');

// ── Providers ──
router.get('/providers', adminAuth, requirePermission('inventory.view'), (req, res) => {
  try { res.json(shippingService.listProviders(true)); } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/providers', adminAuth, requirePermission('inventory.manage'), (req, res) => {
  try { res.status(201).json(shippingService.createProvider(req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); }
});

router.put('/providers/:id', adminAuth, requirePermission('inventory.manage'), (req, res) => {
  try { res.json(shippingService.updateProvider(parseInt(req.params.id), req.body || {})); } catch (err) { res.status(400).json({ error: err.message }); }
});

router.delete('/providers/:id', adminAuth, requirePermission('inventory.manage'), (req, res) => {
  try { res.json(shippingService.deleteProvider(parseInt(req.params.id))); } catch (err) { res.status(400).json({ error: err.message }); }
});

// ── Shipments ──
router.get('/shipments', adminAuth, requirePermission('inventory.view'), (req, res) => {
  try {
    res.json(shippingService.listShipments({
      status: req.query.status || undefined,
      providerId: req.query.provider_id ? parseInt(req.query.provider_id) : undefined,
    }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/admin/shipping/shipments - create shipment for an order
// body: { order_id, provider_id, tracking_number?, estimated_delivery?, notes? }
router.post('/shipments', adminAuth, requirePermission('inventory.manage'), (req, res) => {
  try {
    const { order_id, provider_id, tracking_number, estimated_delivery, notes } = req.body || {};
    if (!order_id) return res.status(400).json({ error: 'order_id is required' });
    const shipment = shippingService.createShipment({
      orderId: parseInt(order_id),
      providerId: provider_id ? parseInt(provider_id) : null,
      trackingNumber: tracking_number || '',
      estimatedDelivery: estimated_delivery || null,
      notes: notes || '',
      userId: req.session.username || 'admin',
    });
    res.status(201).json(shipment);
  } catch (err) {
    const status = err.message.includes('cannot be shipped') || err.message.includes('already has') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

// PUT /api/admin/shipping/shipments/:id/status - update shipment status
// body: { status, delivered_at?, notes? }
router.put('/shipments/:id/status', adminAuth, requirePermission('inventory.manage'), (req, res) => {
  try {
    const { status, delivered_at, notes } = req.body || {};
    if (!status) return res.status(400).json({ error: 'status is required' });
    const shipment = shippingService.updateShipmentStatus(parseInt(req.params.id), status, {
      deliveredAt: delivered_at || null,
      notes: notes || '',
      userId: req.session.username || 'admin',
    });
    res.json(shipment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/admin/shipping/shipments/:id/tracking - tracking info (abstraction)
router.get('/shipments/:id/tracking', adminAuth, requirePermission('inventory.view'), (req, res) => {
  try {
    const s = require('../db').prepare(`
      SELECT s.*, sp.name as provider_name, sp.type as provider_type, sp.tracking_url_template
      FROM shipments s LEFT JOIN shipment_providers sp ON sp.id = s.provider_id
      WHERE s.id = ?
    `).get(req.params.id);
    if (!s) return res.status(404).json({ error: 'Shipment not found' });
    res.json({
      tracking_number: s.tracking_number,
      carrier: s.provider_name || '—',
      status: s.status,
      tracking_url: shippingService.trackingUrl({ type: s.provider_type, tracking_url_template: s.tracking_url_template }, s.tracking_number),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
