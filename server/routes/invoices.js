const express = require('express');
const router = express.Router();
const fs = require('fs');
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');
const invoiceService = require('../services/invoiceService');

// GET /api/admin/invoices - List generated invoices (newest first)
router.get('/', adminAuth, requirePermission('reports.read'), (req, res) => {
  try {
    res.json(invoiceService.listInvoices());
  } catch (err) {
    console.error('Error listing invoices:', err);
    res.status(500).json({ error: 'Failed to list invoices' });
  }
});

// POST /api/admin/invoices/generate - Generate an .xlsx invoice
// Body: { order_id?: number } — omit for a test invoice from the template
router.post('/generate', adminAuth, requirePermission('reports.read'), (req, res) => {
  try {
    const { order_id } = req.body || {};
    const result = invoiceService.generateInvoice({ orderId: order_id || null });
    res.status(201).json(result);
  } catch (err) {
    console.error('Error generating invoice:', err);
    res.status(500).json({ error: 'Failed to generate invoice' });
  }
});

// GET /api/admin/invoices/movement-types - Supported movement document templates
router.get('/movement-types', adminAuth, requirePermission('reports.read'), (req, res) => {
  try {
    res.json(invoiceService.getSupportedMovementTypes());
  } catch (err) {
    console.error('Error listing movement types:', err);
    res.status(500).json({ error: 'Failed to list movement types' });
  }
});

// POST /api/admin/invoices/generate-movement - Generate a movement document (.xlsx)
// Body: { type: string, movement_id?: number } — omit movement_id for a test document
router.post('/generate-movement', adminAuth, requirePermission('inventory.adjust'), (req, res) => {
  try {
    const { type, movement_id } = req.body || {};
    if (!type) {
      return res.status(400).json({ error: 'type is required' });
    }
    const result = invoiceService.generateMovementDocument({ type, movementId: movement_id || null });
    res.status(201).json(result);
  } catch (err) {
    console.error('Error generating movement document:', err);
    res.status(500).json({ error: err.message || 'Failed to generate movement document' });
  }
});

// GET /api/admin/invoices/download/:filename - Download a generated invoice
router.get('/download/:filename', adminAuth, requirePermission('reports.read'), (req, res) => {
  try {
    const file = invoiceService.invoicePath(req.params.filename);
    if (!fs.existsSync(file)) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.download(file);
  } catch (err) {
    console.error('Error downloading invoice:', err);
    res.status(500).json({ error: 'Failed to download invoice' });
  }
});

module.exports = router;
