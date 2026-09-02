/**
 * Product Trash Routes (mventor-ticket-044)
 * Mounted at /api/admin/products — BEFORE routes/admin.js so /trash paths
 * are never captured by admin.js '/products/:id' patterns.
 * All logic lives in services/productTrashService.js.
 */

const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const productTrashService = require('../services/productTrashService');

// ── Trash all ──

router.post('/trash-all', adminAuth, (req, res) => {
  try {
    const { count } = productTrashService.trashAll(req.session.username || 'admin');
    res.json({
      success: true,
      trashed: count,
      message: count > 0
        ? `${count} product(s) moved to trash. Warehouse stock was reset. You can restore them anytime from the Trash page.`
        : 'No products to delete.',
    });
  } catch (err) {
    console.error('Error trashing all products:', err);
    res.status(500).json({ error: 'Failed to move products to trash' });
  }
});

// ── List trashed ──

router.get('/trash', adminAuth, (req, res) => {
  try {
    res.json(productTrashService.listTrashed());
  } catch (err) {
    console.error('Error listing trashed products:', err);
    res.status(500).json({ error: 'Failed to load trash' });
  }
});

// ── Restore all ──

router.post('/trash/restore-all', adminAuth, (req, res) => {
  try {
    const { count } = productTrashService.restoreAll(req.session.username || 'admin');
    res.json({
      success: true,
      restored: count,
      message: count > 0
        ? `${count} product(s) restored with their original stock.`
        : 'Trash is already empty.',
    });
  } catch (err) {
    console.error('Error restoring all products:', err);
    res.status(500).json({ error: 'Failed to restore products' });
  }
});

// ── Restore single ──

router.post('/trash/:id/restore', adminAuth, (req, res) => {
  try {
    const ok = productTrashService.restoreOne(req.params.id, req.session.username || 'admin');
    if (!ok) {
      return res.status(404).json({ error: 'Product not found in trash' });
    }
    res.json({ success: true, restored: 1, message: 'Product restored.' });
  } catch (err) {
    console.error('Error restoring product:', err);
    res.status(500).json({ error: 'Failed to restore product' });
  }
});

module.exports = router;
