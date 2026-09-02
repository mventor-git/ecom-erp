/**
 * Customers — list, profile (phone + Google metadata + recommendation),
 * and CSV exports of customer actions.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');
const customerService = require('../services/customerService');
const vipService = require('../services/vipService');
const settingsService = require('../services/settingsService');

// ── VIP Invitations (mventor-ticket-060) ──

router.post('/vip-invites', adminAuth, requirePermission('users.read'), (req, res) => {
  try {
    const inv = vipService.createInvite(req.body?.name, req.session.username || 'admin');
    const customerUrl = String(settingsService.get('customer_site_url', '') || '').replace(/\/+$/, '');
    res.json({ ...inv, link: `${customerUrl}/login?invite=${inv.code}` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/vip-invites', adminAuth, requirePermission('users.read'), (req, res) => {
  try {
    const customerUrl = String(settingsService.get('customer_site_url', '') || '').replace(/\/+$/, '');
    const rows = vipService.listInvites().map(v => ({ ...v, link: `${customerUrl}/login?invite=${v.code}` }));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list invitations' });
  }
});

// Printable RTL invitation card (browser print → PDF). Logo optional:
// defaults to the site logo; ?logo=<url> overrides.
router.get('/vip-invites/:code/card', adminAuth, requirePermission('users.read'), async (req, res) => {
  try {
    const inv = vipService.getInvite(req.params.code);
    if (!inv) return res.status(404).json({ error: 'Invitation not found' });
    const identity = settingsService.siteIdentity();
    const customerUrl = String(settingsService.get('customer_site_url', '') || '').replace(/\/+$/, '');
    const link = `${customerUrl}/login?invite=${inv.code}`;
    const logo = req.query.logo || identity.logoUrl;
    const QRCode = require('qrcode');
    const qr = await QRCode.toDataURL(link, { margin: 2, width: 260 });
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<title>دعوة VIP — ${inv.invite_name}</title>
<style>
 body{font-family:'Segoe UI',Tahoma,Arial;background:#0c0a09;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
 .card{width:420px;background:linear-gradient(160deg,#1c1917,#292524);border-radius:24px;padding:36px;text-align:center;color:#e7e5e4;border:1px solid #44403c;box-shadow:0 20px 60px rgba(0,0,0,.5)}
 .logo{max-height:64px;margin-bottom:12px}
 h1{font-size:26px;margin:8px 0 2px;color:#fafaf9}
 .sub{color:#a8a29e;font-size:13px;margin-bottom:18px}
 .name{font-size:30px;font-weight:800;color:#b3e5de;margin:10px 0}
 .qr{background:#fff;padding:14px;border-radius:16px;display:inline-block}
 .code{font-family:monospace;font-size:20px;letter-spacing:3px;color:#fbbf24;margin-top:14px}
 .hint{font-size:12px;color:#a8a29e;margin-top:14px;line-height:1.7}
 @media print{body{background:#fff}.card{box-shadow:none;border-color:#d6d3d1}}
</style></head><body>
<div class="card">
 ${logo ? `<img class="logo" src="${logo}" alt="logo"/>` : ''}
 <div class="sub">دعوة خاصة من ${identity.name}</div>
 <h1>دعوة VIP</h1>
 <div class="name">${inv.invite_name}</div>
 <div class="qr"><img src="${qr}" width="200" height="200" alt="QR"/></div>
 <div class="code">${inv.code}</div>
 <p class="hint">امسح رمز QR وسجّل بحساب Google ليتم إضافتك كعميل VIP<br/>Scan the QR and sign in with Google to activate your VIP access.</p>
</div>
<script>window.onload=()=>setTimeout(()=>window.print(),400)</script>
</body></html>`;
    res.type('html').send(html);
  } catch (err) {
    console.error('VIP card error:', err);
    res.status(500).json({ error: 'Failed to build invitation card' });
  }
});

// ── VIP cart management (staff adds items FOR the customer) ──

router.get('/vip-cart/:customerId', adminAuth, requirePermission('users.read'), (req, res) => {
  try { res.json(vipService.getVipCart(parseInt(req.params.customerId))); }
  catch (err) { res.status(500).json({ error: 'Failed to load VIP cart' }); }
});

router.post('/vip-cart/:customerId', adminAuth, requirePermission('users.read'), (req, res) => {
  try {
    vipService.addToVipCart(parseInt(req.params.customerId), parseInt(req.body?.product_id), req.body?.qty, req.session.username || 'admin');
    res.json({ success: true, cart: vipService.getVipCart(parseInt(req.params.customerId)) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/vip-cart/:customerId/:itemId', adminAuth, requirePermission('users.read'), (req, res) => {
  try {
    vipService.removeVipCartItem(parseInt(req.params.customerId), parseInt(req.params.itemId));
    res.json({ success: true, cart: vipService.getVipCart(parseInt(req.params.customerId)) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

// GET /api/admin/customers - all customers with stats
router.get('/', adminAuth, requirePermission('users.read'), (req, res) => {
  try {
    res.json(customerService.customersWithStats(req.query.q || null, req.query.status || null, req.query.page || 1, req.query.limit || 10));
  } catch (err) {
    console.error('Error listing customers:', err);
    res.status(500).json({ error: 'Failed to list customers' });
  }
});

// GET /api/admin/customers/:id - full profile
router.get('/:id', adminAuth, requirePermission('users.read'), (req, res) => {
  try {
    const profile = customerService.getCustomerProfile(parseInt(req.params.id));
    if (!profile) return res.status(404).json({ error: 'Customer not found' });
    res.json(profile);
  } catch (err) {
    console.error('Error fetching customer profile:', err);
    res.status(500).json({ error: 'Failed to fetch customer profile' });
  }
});

// GET /api/admin/customers/:id/export - customer actions CSV
router.get('/:id/export', adminAuth, requirePermission('users.read'), (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const customer = db.prepare('SELECT id, name, email FROM customers WHERE id = ?').get(id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const csv = customerService.toCsv(customerService.customerActionRows(id));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="customer_${customer.id}_actions.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('Error exporting customer actions:', err);
    res.status(500).json({ error: 'Failed to export customer actions' });
  }
});

// GET /api/admin/customers/export - all customers CSV with stats
router.get('/export', adminAuth, requirePermission('users.read'), (req, res) => {
  try {
    const csv = customerService.toCsv(customerService.customersWithStats(req.query.q || null));
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="customers_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('Error exporting customers:', err);
    res.status(500).json({ error: 'Failed to export customers' });
  }
});

module.exports = router;
