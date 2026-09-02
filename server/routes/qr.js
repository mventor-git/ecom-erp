const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const { requirePermission, isAuthenticated } = require('../middleware/rbac');
const qrService = require('../services/qrService');

// POST /api/admin/qr/generate — Generate QR code for an entity (admin only)
router.post('/generate', adminAuth, async (req, res) => {
  try {
    const { entityType, entityId, productId, locationId, docType, docId } = req.body;

    let dataUrl;

    if (productId) {
      dataUrl = await qrService.generateForProduct(productId);
    } else if (locationId) {
      dataUrl = await qrService.generateForLocation(locationId);
    } else if (docType && docId) {
      dataUrl = await qrService.generateForDocument(docType, docId);
    } else if (entityType && entityId) {
      dataUrl = await qrService.generate(entityType, entityId);
    } else {
      return res.status(400).json({
        error: 'Provide entityType+entityId, productId, locationId, or docType+docId',
      });
    }

    res.json({ qrCode: dataUrl });
  } catch (err) {
    console.error('Error generating QR code:', err);
    res.status(err.message.includes('not found') ? 404 : 500).json({ error: err.message });
  }
});

// POST /api/qr/resolve — Resolve a QR code to entity info (authenticated users)
router.post('/resolve', isAuthenticated, (req, res) => {
  try {
    const { qrData } = req.body;

    if (!qrData) {
      return res.status(400).json({ error: 'qrData is required' });
    }

    const entity = qrService.resolve(qrData, {
      role: req.user.role,
      permissions: req.user.permissions || [],
    });

    if (!entity) {
      return res.status(404).json({ error: 'QR code could not be resolved' });
    }

    res.json(entity);
  } catch (err) {
    console.error('Error resolving QR code:', err);
    res.status(500).json({ error: 'Failed to resolve QR code' });
  }
});

// GET /api/qr/resolve/:data — Resolve QR code via URL path (for scanner redirects)
router.get('/resolve/:data', isAuthenticated, (req, res) => {
  try {
    const { data } = req.params;

    const entity = qrService.resolve(data, {
      role: req.user.role,
      permissions: req.user.permissions || [],
    });

    if (!entity) {
      return res.status(404).json({ error: 'QR code could not be resolved' });
    }

    res.json(entity);
  } catch (err) {
    console.error('Error resolving QR code:', err);
    res.status(500).json({ error: 'Failed to resolve QR code' });
  }
});

module.exports = router;
