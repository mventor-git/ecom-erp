const express = require('express');
const router = express.Router();
const db = require('../db');
const { isAuthenticated } = require('./auth');

// GET /api/wishlist — current customer's wishlist with full product details
router.get('/', isAuthenticated, (req, res) => {
  try {
    const items = db.prepare(`
      SELECT p.*, c.name as category_name, c.slug as category_slug,
             b.id as brand_id, b.name as brand_name, b.slug as brand_slug, b.icon_url as brand_icon_url,
             w.created_at as wishlisted_at
      FROM wishlist w
      JOIN products p ON p.id = w.product_id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN brands b ON p.brand_id = b.id
      WHERE w.customer_id = ?
      ORDER BY w.created_at DESC
    `).all(req.user.id);
    res.json(items);
  } catch (err) {
    console.error('Error fetching wishlist:', err);
    res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
});

// POST /api/wishlist/:productId — add a product to the wishlist
router.post('/:productId', isAuthenticated, (req, res) => {
  try {
    const productId = parseInt(req.params.productId, 10);
    if (!productId) {
      return res.status(400).json({ error: 'Invalid product id' });
    }
    const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    db.prepare('INSERT OR IGNORE INTO wishlist (customer_id, product_id) VALUES (?, ?)')
      .run(req.user.id, productId);
    res.status(201).json({ success: true, product_id: productId });
  } catch (err) {
    console.error('Error adding to wishlist:', err);
    res.status(500).json({ error: 'Failed to add to wishlist' });
  }
});

// DELETE /api/wishlist/:productId — remove a product from the wishlist
router.delete('/:productId', isAuthenticated, (req, res) => {
  try {
    const productId = parseInt(req.params.productId, 10);
    db.prepare('DELETE FROM wishlist WHERE customer_id = ? AND product_id = ?')
      .run(req.user.id, productId);
    res.json({ success: true, product_id: productId });
  } catch (err) {
    console.error('Error removing from wishlist:', err);
    res.status(500).json({ error: 'Failed to remove from wishlist' });
  }
});

module.exports = router;
