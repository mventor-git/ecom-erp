const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');
const warehouseOrderService = require('../services/warehouseOrderService');
const documentService = require('../services/documentService');
const fs = require('fs');

// ── Supply Orders ──
router.get('/supply-orders', adminAuth, requirePermission('inventory.view'), (req, res) => {
  try {
    res.json(warehouseOrderService.listSupplyOrders());
  } catch (err) {
    console.error('Error listing supply orders:', err);
    res.status(500).json({ error: 'Failed to list supply orders' });
  }
});

router.get('/supply-orders/:id', adminAuth, requirePermission('inventory.view'), (req, res) => {
  try {
    const order = warehouseOrderService.getSupplyOrder(parseInt(req.params.id));
    if (!order) return res.status(404).json({ error: 'Supply order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/supply-orders', adminAuth, requirePermission('inventory.manage'), (req, res) => {
  try {
    const order = warehouseOrderService.createSupplyOrder(req.body || {});
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/supply-orders/:id/items', adminAuth, requirePermission('inventory.manage'), (req, res) => {
  try {
    const { product_id, qty, unit_cost } = req.body;
    const item = warehouseOrderService.addSupplyItem(parseInt(req.params.id), parseInt(product_id), parseInt(qty), parseInt(unit_cost || 0));
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/supply-order-items/:itemId', adminAuth, requirePermission('inventory.manage'), (req, res) => {
  try {
    res.json(warehouseOrderService.removeSupplyItem(parseInt(req.params.itemId)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/supply-orders/:id/issue', adminAuth, requirePermission('inventory.manage'), async (req, res) => {
  try {
    const userId = req.session.username || req.user?.email || 'admin';
    const result = await warehouseOrderService.issueSupplyOrder(parseInt(req.params.id), userId);
    res.json(result);
  } catch (err) {
    console.error('Error issuing supply order:', err);
    res.status(400).json({ error: err.message });
  }
});

router.post('/supply-orders/:id/cancel', adminAuth, requirePermission('inventory.manage'), (req, res) => {
  try {
    res.json(warehouseOrderService.cancelSupplyOrder(parseInt(req.params.id)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Issue Orders ──
router.get('/issue-orders', adminAuth, requirePermission('inventory.view'), (req, res) => {
  try {
    const q = req.query;
    const result = warehouseOrderService.listIssueOrders({
      status: q.status || '',
      search: q.search || '',
      from: q.from || '',
      to: q.to || '',
      page: parseInt(q.page || '1'),
      limit: parseInt(q.limit || '25'),
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list issue orders' });
  }
});

router.get('/issue-orders/:id', adminAuth, requirePermission('inventory.view'), (req, res) => {
  try {
    const order = warehouseOrderService.getIssueOrder(parseInt(req.params.id));
    if (!order) return res.status(404).json({ error: 'Issue order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/issue-orders', adminAuth, requirePermission('inventory.manage'), (req, res) => {
  try {
    const order = warehouseOrderService.createIssueOrder(req.body || {});
    res.status(201).json(order);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/issue-orders/:id/items', adminAuth, requirePermission('inventory.manage'), (req, res) => {
  try {
    const { product_id, qty, unit_cost } = req.body;
    const item = warehouseOrderService.addIssueItem(parseInt(req.params.id), parseInt(product_id), parseInt(qty), parseInt(unit_cost || 0));
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/issue-order-items/:itemId', adminAuth, requirePermission('inventory.manage'), (req, res) => {
  try {
    res.json(warehouseOrderService.removeIssueItem(parseInt(req.params.itemId)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/issue-orders/:id/issue', adminAuth, requirePermission('inventory.manage'), async (req, res) => {
  try {
    const userId = req.session.username || req.user?.email || 'admin';
    const { warehouse_id } = req.body || {};
    const result = await warehouseOrderService.issueIssueOrder(parseInt(req.params.id), parseInt(warehouse_id), userId);
    res.json(result);
  } catch (err) {
    console.error('Error issuing issue order:', err);
    const status = err.message.includes('Insufficient') ? 409 : 400;
    res.status(status).json({ error: err.message });
  }
});

router.post('/issue-orders/:id/cancel', adminAuth, requirePermission('inventory.manage'), (req, res) => {
  try {
    res.json(warehouseOrderService.cancelIssueOrder(parseInt(req.params.id)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Financial Periods ──
router.get('/financial-periods', adminAuth, requirePermission('inventory.view'), (req, res) => {
  try {
    res.json(warehouseOrderService.listFinancialPeriods());
  } catch (err) {
    res.status(500).json({ error: 'Failed to list financial periods' });
  }
});

router.post('/financial-periods', adminAuth, requirePermission('inventory.manage'), (req, res) => {
  try {
    const { name, months } = req.body || {};
    const period = warehouseOrderService.createFinancialPeriod({ name, months });
    res.status(201).json(period);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/financial-periods/:id/close', adminAuth, requirePermission('inventory.manage'), (req, res) => {
  try {
    res.json(warehouseOrderService.closeFinancialPeriod(parseInt(req.params.id)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Set opening balance: body { warehouse_id, items: [{product_id, qty}] }
router.post('/financial-periods/:id/opening-balance', adminAuth, requirePermission('inventory.manage'), (req, res) => {
  try {
    const { warehouse_id, items } = req.body || {};
    if (!warehouse_id) return res.status(400).json({ error: 'warehouse_id is required' });
    const userId = req.session.username || req.user?.email || 'admin';
    const period = warehouseOrderService.setOpeningBalance(parseInt(req.params.id), parseInt(warehouse_id), items, userId);
    res.json(period);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Documents (.md with QR + barcode) ──
router.get('/documents/:type', adminAuth, requirePermission('documents.manage'), (req, res) => {
  try {
    res.json(documentService.listDocuments(req.params.type.toUpperCase()));
  } catch (err) {
    res.status(500).json({ error: 'Failed to list documents' });
  }
});

router.get('/documents/:type/:filename', adminAuth, requirePermission('documents.manage'), (req, res) => {
  try {
    const file = documentService.documentPath(req.params.type.toUpperCase(), req.params.filename);
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'Document not found' });
    res.type('text/markdown').download(file);
  } catch (err) {
    res.status(500).json({ error: 'Failed to download document' });
  }
});

// ── Fulfillment pipeline (mventor-ticket-057) ──
// issued → packed → sent → delivering → delivered, with driver claim/assign.

router.post('/issue-orders/:id/pack', adminAuth, requirePermission('inventory.manage'), (req, res) => {
  try {
    res.json(warehouseOrderService.packIssue(parseInt(req.params.id), req.session.username || 'admin'));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/issue-orders/:id/assign-driver', adminAuth, requirePermission('inventory.manage'), (req, res) => {
  try {
    const { driver_id } = req.body || {};
    if (!driver_id) return res.status(400).json({ error: 'driver_id is required' });
    res.json(warehouseOrderService.assignDriver(parseInt(req.params.id), parseInt(driver_id), req.session.username));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

// Driver actions — any authenticated staff; service validates role fit via claim ownership.
const driverAction = (fn, getDriver) => (req, res) => {
  try {
    const driverId = getDriver(req);
    if (!driverId) return res.status(400).json({ error: 'driver id required' });
    res.json(fn(parseInt(req.params.id), driverId));
  } catch (err) { res.status(400).json({ error: err.message }); }
};

router.post('/issue-orders/:id/claim', adminAuth, requirePermission('inventory.view'),
  driverAction((id, d) => warehouseOrderService.claimIssue(id, d), req => req.body?.driver_id));

router.post('/issue-orders/:id/unclaim', adminAuth, requirePermission('inventory.view'),
  driverAction((id, d) => warehouseOrderService.unclaimIssue(id, d), req => req.body?.driver_id));

router.post('/issue-orders/:id/send', adminAuth, requirePermission('inventory.manage'), (req, res) => {
  try {
    const { external_provider_id } = req.body || {};
    res.json(warehouseOrderService.markSent(
      parseInt(req.params.id),
      req.session.username || 'admin',
      externalProviderId ? { externalProviderId: parseInt(external_provider_id) } : {}
    ));
  } catch (err) { res.status(400).json({ error: err.message }); }
});

router.post('/issue-orders/:id/delivering', adminAuth, requirePermission('inventory.view'),
  driverAction((id, d) => warehouseOrderService.markDelivering(id, d), req => req.body?.driver_id));

router.post('/issue-orders/:id/delivered', adminAuth, requirePermission('inventory.view'),
  driverAction((id, d) => warehouseOrderService.markDelivered(id, d), req => req.body?.driver_id));

module.exports = router;
