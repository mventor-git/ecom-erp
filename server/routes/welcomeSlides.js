const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/welcome-slides - Get active welcome slides for the welcome page
router.get('/', (req, res) => {
  try {
    const slides = db.prepare(`
      SELECT ws.*, p.name as product_name, p.image_url as product_image, 
             p.price as product_price, p.description as product_description
      FROM welcome_slides ws
      LEFT JOIN products p ON ws.product_id = p.id
      WHERE ws.is_active = 1
      ORDER BY ws.sort_order ASC
    `).all();
    res.json(slides);
  } catch (err) {
    console.error('Error fetching welcome slides:', err);
    res.status(500).json({ error: 'Failed to fetch welcome slides' });
  }
});

module.exports = router;
