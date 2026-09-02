const express = require('express');
const router = express.Router();
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');

// Get all announcements (admin)
router.get('/', adminAuth, (req, res) => {
  try {
    const announcements = db.prepare(`
      SELECT * FROM announcements 
      ORDER BY sort_order ASC, created_at DESC
    `).all();
    res.json(announcements);
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// Get active announcements (public)
router.get('/active', (req, res) => {
  try {
    const now = new Date().toISOString();
    const announcements = db.prepare(`
      SELECT * FROM announcements 
      WHERE is_active = 1 
        AND (start_date IS NULL OR start_date <= ?)
        AND (end_date IS NULL OR end_date >= ?)
      ORDER BY sort_order ASC, created_at DESC
    `).all(now, now);
    res.json(announcements);
  } catch (error) {
    console.error('Error fetching active announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// Create announcement
router.post('/', adminAuth, (req, res) => {
  try {
    const { text, text_ar, icon, is_active, start_date, end_date, sort_order } = req.body;

    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Announcement text is required' });
    }

    const result = db.prepare(`
      INSERT INTO announcements (text, text_ar, icon, is_active, start_date, end_date, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      text.trim(),
      String(text_ar || '').trim(),
      icon || '📢',
      is_active !== undefined ? (is_active ? 1 : 0) : 1,
      start_date || null,
      end_date || null,
      sort_order || 0
    );

    const announcement = db.prepare('SELECT * FROM announcements WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(announcement);
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

// Update announcement
router.put('/:id', adminAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { text, text_ar, icon, is_active, start_date, end_date, sort_order } = req.body;

    const existing = db.prepare('SELECT * FROM announcements WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    db.prepare(`
      UPDATE announcements
      SET text = ?, text_ar = ?, icon = ?, is_active = ?, start_date = ?, end_date = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      text !== undefined ? text.trim() : existing.text,
      text_ar !== undefined ? String(text_ar).trim() : (existing.text_ar || ''),
      icon !== undefined ? icon : existing.icon,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      start_date !== undefined ? start_date : existing.start_date,
      end_date !== undefined ? end_date : existing.end_date,
      sort_order !== undefined ? sort_order : existing.sort_order,
      id
    );

    const announcement = db.prepare('SELECT * FROM announcements WHERE id = ?').get(id);
    res.json(announcement);
  } catch (error) {
    console.error('Error updating announcement:', error);
    res.status(500).json({ error: 'Failed to update announcement' });
  }
});

// Delete announcement
router.delete('/:id', adminAuth, (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = db.prepare('SELECT * FROM announcements WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    db.prepare('DELETE FROM announcements WHERE id = ?').run(id);
    res.json({ success: true, message: 'Announcement deleted' });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({ error: 'Failed to delete announcement' });
  }
});

// Reorder announcements
// POST /api/announcements/:id/email � send this announcement to ALL
// customers with an email address (BCC batch, brand-styled).
router.post('/:id/email', adminAuth, async (req, res) => {
  try {
    const ann = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id);
    if (!ann) return res.status(404).json({ error: 'Announcement not found' });

    const customers = db.prepare(`
      SELECT email, name FROM customers
      WHERE email IS NOT NULL AND email != '' AND email NOT LIKE '%@mventor.test'
    `).all();
    if (customers.length === 0) return res.status(400).json({ error: 'No customers with emails yet' });

    const email = require('../email');
    const settingsService = require('../services/settingsService');
    const siteName = settingsService.siteIdentity().name;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
        <div style="background:#1f857a;padding:18px;text-align:center">
          <h2 style="color:#fff;margin:0;font-size:20px">${siteName} � Announcement</h2>
        </div>
        <div style="padding:26px;text-align:center">
          ${ann.icon ? `<div style="font-size:34px;margin-bottom:8px">${ann.icon}</div>` : ''}
          <p style="font-size:19px;font-weight:bold;color:#111;margin:0 0 10px">${ann.text}</p>
          <p style="color:#777;font-size:12px;margin-top:16px">You received this because you are a valued customer of ${siteName}.</p>
        </div>
      </div>`;

    // Batch in chunks of 50 BCC recipients to stay under provider limits
    let sent = 0;
    for (let i = 0; i < customers.length; i += 50) {
      const chunk = customers.slice(i, i + 50);
      const bcc = chunk.map(c => c.email).join(',');
      try {
        await email.sendMail({
          from: `"${siteName}" <${process.env.SMTP_USER || 'noreply@mventor.test'}>`,
          bcc,
          subject: `${ann.icon || '??'} ${ann.text}`.slice(0, 120),
          html,
        });
        sent += chunk.length;
      } catch (e) {
        console.error('Announcement email chunk failed:', e.message);
      }
    }

    res.json({ success: true, sent, total_customers: customers.length });
  } catch (err) {
    console.error('Announcement email error:', err);
    res.status(500).json({ error: 'Failed to send announcement emails' });
  }
});
router.put('/reorder', adminAuth, (req, res) => {
  try {
    const { order } = req.body; // Array of {id, sort_order}
    
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'Order must be an array' });
    }

    const updateStmt = db.prepare('UPDATE announcements SET sort_order = ? WHERE id = ?');
    
    db.run('BEGIN TRANSACTION');
    try {
      for (const item of order) {
        updateStmt.run(item.sort_order, item.id);
      }
      db.run('COMMIT');
      res.json({ success: true });
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error reordering announcements:', error);
    res.status(500).json({ error: 'Failed to reorder announcements' });
  }
});

module.exports = router;
