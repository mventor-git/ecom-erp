/**
 * Kashier payment routes (mventor-ticket-061) — replaces Paymob.
 *
 * Admin (session-auth):
 *   GET  /config              current Kashier settings
 *   POST /test-session        create a 1 EGP hosted session (credential test)
 *   GET  /sessions            recent sessions
 *   GET  /transactions         alias of sessions (transaction view)
 *
 * Public (storefront checkout):
 *   POST /session             create a hosted payment session for a cart
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');
const kashierService = require('../services/kashierService');

// ── Admin ──

router.get('/config', adminAuth, requirePermission('orders.manage'), (req, res) => {
  try {
    const c = kashierService.cfg();
    res.json({
      merchantId: c.merchantId,
      apiKey: c.apiKey,
      secretKey: c.secretKey,
      mode: c.mode,
      baseUrl: c.baseUrl,
      configured: kashierService.isConfigured(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load Kashier config' });
  }
});

router.post('/test-session', adminAuth, requirePermission('orders.manage'), async (req, res) => {
  try {
    const customerUrl = String(require('../services/settingsService').get('customer_site_url', '') || '').replace(/\/+$/, '');
    const session = await kashierService.createPaymentSession({
      orderRef: `TEST-${Date.now()}`,
      amountCents: 100,
      currency: 'EGP',
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

router.get('/sessions', adminAuth, requirePermission('orders.manage'), (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM kashier_orders ORDER BY created_at DESC LIMIT 100').all());
  } catch {
    res.status(500).json({ error: 'Failed to load sessions' });
  }
});

router.get('/transactions', adminAuth, requirePermission('orders.manage'), (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM kashier_orders ORDER BY created_at DESC LIMIT 100').all();
    res.json({ source: 'kashier', count: rows.length, transactions: rows });
  } catch {
    res.status(500).json({ error: 'Failed to load transactions' });
  }
});

// ── Public: storefront checkout creates a hosted payment session ──

router.post('/session', async (req, res) => {
  try {
    const { orderRef, items = [], customerEmail = '', redirectPath = '/checkout/success', allowedMethods } = req.body || {};
    if (!orderRef) return res.status(400).json({ error: 'orderRef is required' });

    // SECURITY (P0.4): the charge is the DB order total, NOT a client-sent amount.
    // The order total itself was recomputed server-side at order creation.
    const order = db.prepare('SELECT id, status, total FROM orders WHERE id = ?').get(orderRef);
    if (!order) return res.status(400).json({ error: 'Order not found' });
    const amountCents = Number(order.total) || 0;
    if (!(amountCents > 0)) return res.status(400).json({ error: 'Order has no payable amount' });

    const customerUrl = String(require('../services/settingsService').get('customer_site_url', '') || '').replace(/\/+$/, '');
    const session = await kashierService.createPaymentSession({
      orderRef,
      amountCents,
      currency: 'EGP',
      customerEmail,
      redirectUrl: `${customerUrl}${redirectPath}`,
      description: `Order ${orderRef}`,
      allowedMethods: allowedMethods || 'card,wallet',
    });

    db.prepare(`
      INSERT INTO kashier_orders (merchant_order_id, kashier_order_key, amount_cents, currency, status, order_id, raw_response)
      VALUES (?, ?, ?, 'EGP', ?, ?, ?)
    `).run(session.sessionId, session.sessionId, amountCents, session.status, Number(orderRef), JSON.stringify(session.raw).slice(0, 4000));

    res.json({ success: true, sessionId: session.sessionId, pay_url: session.sessionUrl });
  } catch (err) {
    console.error('kashier session error:', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});


// GET /api/kashier/checkout/status - public gateway availability
router.get('/status', (req, res) => {
  try {
    res.json({
      kashierEnabled: kashierService.isConfigured(),
      methods: ['card', 'wallet'],
    });
  } catch {
    res.status(500).json({ error: 'Failed to load Kashier status' });
  }
});
module.exports = router;
