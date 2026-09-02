const express = require('express');
const router = express.Router();
const db = require('../db');
const adminAuth = require('../middleware/adminAuth');

// Get all hero slides (admin)
router.get('/', adminAuth, (req, res) => {
  try {
    const slides = db.prepare(`
      SELECT hs.*, p.name as product_name, p.image_url as product_image
      FROM hero_slides hs
      LEFT JOIN products p ON hs.product_id = p.id
      ORDER BY hs.sort_order ASC, hs.created_at DESC
    `).all();
    res.json(slides);
  } catch (error) {
    console.error('Error fetching hero slides:', error);
    res.status(500).json({ error: 'Failed to fetch hero slides' });
  }
});

// Get active hero slides (public)
router.get('/active', (req, res) => {
  try {
    const slides = db.prepare(`
      SELECT hs.*, p.name as product_name, p.image_url as product_image, p.price as product_price
      FROM hero_slides hs
      LEFT JOIN products p ON hs.product_id = p.id
      WHERE hs.is_active = 1
      ORDER BY hs.sort_order ASC, hs.created_at DESC
    `).all();
    res.json(slides);
  } catch (error) {
    console.error('Error fetching active hero slides:', error);
    res.status(500).json({ error: 'Failed to fetch hero slides' });
  }
});

// Create hero slide
router.post('/', adminAuth, (req, res) => {
  try {
    const { title, title_ar, description, description_ar, cta_text, cta_link, product_id, image_url, is_active, sort_order } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = db.prepare(`
      INSERT INTO hero_slides (title, title_ar, description, description_ar, cta_text, cta_link, product_id, image_url, is_active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title.trim(),
      String(title_ar || '').trim(),
      description || null,
      String(description_ar || ''),
      cta_text || 'Shop Now',
      cta_link || '/products',
      product_id || null,
      image_url || null,
      is_active !== undefined ? (is_active ? 1 : 0) : 1,
      sort_order || 0
    );

    const slide = db.prepare(`
      SELECT hs.*, p.name as product_name, p.image_url as product_image
      FROM hero_slides hs
      LEFT JOIN products p ON hs.product_id = p.id
      WHERE hs.id = ?
    `).get(result.lastInsertRowid);
    
    res.status(201).json(slide);
  } catch (error) {
    console.error('Error creating hero slide:', error);
    res.status(500).json({ error: 'Failed to create hero slide' });
  }
});

// Update hero slide
router.put('/:id', adminAuth, (req, res) => {
  try {
    const { id } = req.params;
    const { title, title_ar, description, description_ar, cta_text, cta_link, product_id, image_url, is_active, sort_order } = req.body;

    const existing = db.prepare('SELECT * FROM hero_slides WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Hero slide not found' });
    }

    db.prepare(`
      UPDATE hero_slides
      SET title = ?, title_ar = ?, description = ?, description_ar = ?, cta_text = ?, cta_link = ?, product_id = ?, image_url = ?, is_active = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title !== undefined ? title.trim() : existing.title,
      title_ar !== undefined ? String(title_ar).trim() : (existing.title_ar || ''),
      description !== undefined ? description : existing.description,
      description_ar !== undefined ? String(description_ar) : (existing.description_ar || ''),
      cta_text !== undefined ? cta_text : existing.cta_text,
      cta_link !== undefined ? cta_link : existing.cta_link,
      product_id !== undefined ? product_id : existing.product_id,
      image_url !== undefined ? image_url : existing.image_url,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      sort_order !== undefined ? sort_order : existing.sort_order,
      id
    );

    const slide = db.prepare(`
      SELECT hs.*, p.name as product_name, p.image_url as product_image
      FROM hero_slides hs
      LEFT JOIN products p ON hs.product_id = p.id
      WHERE hs.id = ?
    `).get(id);
    
    res.json(slide);
  } catch (error) {
    console.error('Error updating hero slide:', error);
    res.status(500).json({ error: 'Failed to update hero slide' });
  }
});

// Delete hero slide
router.delete('/:id', adminAuth, (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = db.prepare('SELECT * FROM hero_slides WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Hero slide not found' });
    }

    db.prepare('DELETE FROM hero_slides WHERE id = ?').run(id);
    res.json({ success: true, message: 'Hero slide deleted' });
  } catch (error) {
    console.error('Error deleting hero slide:', error);
    res.status(500).json({ error: 'Failed to delete hero slide' });
  }
});

// Reorder hero slides
router.put('/reorder', adminAuth, (req, res) => {
  try {
    const { order } = req.body; // Array of {id, sort_order}
    
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'Order must be an array' });
    }

    const updateStmt = db.prepare('UPDATE hero_slides SET sort_order = ? WHERE id = ?');
    
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
    console.error('Error reordering hero slides:', error);
    res.status(500).json({ error: 'Failed to reorder hero slides' });
  }
});

module.exports = router;
