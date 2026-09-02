/**
 * Kashier routes — admin test/probe + public webhook stub.
 * Mounted: /api/admin/kashier (admin) and /api/kashier (public webhook).
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');
const kashierService = require('../services/kashierService');

// POST /api/admin/kashier/test-session — create a 1 EGP hosted session.
// Pay it manually to test SUCCESS; then GET /session/:id/payment to verify.
router.post('/test-session', adminAuth, requirePermission('orders.manage'), async (req, res) => {
  try {
    const customerUrl = String(require('../services/settingsService').get('customer_site_url', '') || '').replace(/\/+$/, '');
    const session = await kashierService.createPaymentSession({
      orderRef: `TEST-${Date.now()}`,
      amountCents: 100,
      currency: 'EGP',
      customerEmail: req.session.userEmail || '',
      redirectUrl: `${customerUrl}/checkout/success`,
      description: 'Kashier integration test',
    });

    db.prepare(`
      INSERT INTO kashier_orders (merchant_order_id, kashier_order_key, amount_cents, currency, status, raw_response)
      VALUES (?, ?, 100, 'EGP', ?, ?)
    `).run(session.sessionId, session.sessionId, session.status, JSON.stringify(session.raw).slice(0, 4000));

    res.json({ success: true, sessionId: session.sessionId, pay_url: session.sessionUrl, status: session.status });
  } catch (err) {
    console.error('kashier test-session error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/admin/kashier/session/:id/payment — poll the payment result
router.get('/session/:id/payment', adminAuth, requirePermission('orders.manage'), async (req, res) => {
  try {
    res.json(await kashierService.getSessionPayment(req.params.id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
