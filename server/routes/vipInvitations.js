const express = require('express');
const router = express.Router();
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');

// Create VIP invitation
router.post('/', adminAuth, requirePermission('customers.manage'), (req, res) => {
  try {
    const { customer_name, customer_email, segment_type, discount_pct, invite_code } = req.body || {};
    const code = invite_code || `INV-${Date.now()}-${Math.floor(Math.random()*10000)}`;
    // vip_invites schema: id, code (UNIQUE), invite_name, created_by, created_at, used_by, used_at
    const stmt = db.prepare(`
      INSERT INTO vip_invites (code, invite_name, created_by)
      VALUES (?, ?, ?)
    `);
    const info = stmt.run(code, customer_name || 'VIP', req.session?.userId || 'system');
    res.status(201).json({ id: info.lastInsertRowid, invite_code: code, customer_name: customer_name || '', discount_pct: discount_pct || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get VIP invites
router.get('/', adminAuth, requirePermission('customers.view'), (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM vip_invites ORDER BY created_at DESC').all();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update VIP customer discount
router.put('/:customer_id', adminAuth, requirePermission('customers.manage'), (req, res) => {
  try {
    const { discount_pct, is_active } = req.body || {};
    const stmt = db.prepare(`
      INSERT INTO vip_customer_policies (customer_id, discount_pct, is_active)
      VALUES (?, ?, ?)
      ON CONFLICT(customer_id) DO UPDATE SET discount_pct=excluded.discount_pct, is_active=excluded.is_active, updated_at=CURRENT_TIMESTAMP
    `);
    stmt.run(parseInt(req.params.customer_id), discount_pct || 0, is_active !== undefined ? (is_active ? 1 : 0) : 1);
    res.json({ updated: true, customer_id: parseInt(req.params.customer_id), discount_pct: discount_pct || 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
