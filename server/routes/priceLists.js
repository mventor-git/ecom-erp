const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');
const priceListService = require('../services/priceListService');

// GET /api/admin/price-lists - List price lists (admin)
router.get('/', adminAuth, requirePermission('inventory.view'), (req, res) => {
  try {
    res.json(priceListService.listPriceLists(true));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/price-lists - Create a price list
router.post('/', adminAuth, requirePermission('inventory.manage'), (req, res) => {
  try {
    const list = priceListService.createPriceList(req.body || {});
    res.status(201).json(list);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/admin/price-lists/:id - Update a price list
router.put('/:id', adminAuth, requirePermission('inventory.manage'), (req, res) => {
  try {
    res.json(priceListService.updatePriceList(parseInt(req.params.id), req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/admin/price-lists/:id - Delete a price list
router.delete('/:id', adminAuth, requirePermission('inventory.manage'), (req, res) => {
  try {
    res.json(priceListService.deletePriceList(parseInt(req.params.id)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/admin/products/:id/prices - Per-product price overrides
router.get('/products/:id/prices', adminAuth, requirePermission('inventory.view'), (req, res) => {
  try {
    res.json(priceListService.getProductPrices(parseInt(req.params.id)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/products/:id/prices - Set per-product price overrides
// body: { overrides: [{ price_list_id, price }] }
router.put('/products/:id/prices', adminAuth, requirePermission('inventory.manage'), (req, res) => {
  try {
    const { overrides } = req.body || {};
    res.json(priceListService.setProductPrices(parseInt(req.params.id), Array.isArray(overrides) ? overrides : []));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
