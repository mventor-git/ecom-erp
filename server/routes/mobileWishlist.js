/**
 * Mobile API v1 - Wishlist
 * Wishlist management for mobile app customers
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/jwtAuth');

/**
 * GET /api/v1/wishlist
 * Get the customer's wishlist with product details
 */
router.get('/', authenticateToken, (req, res) => {
  try {
    const customerId = req.user.id;

    const items = db.prepare(`
      SELECT
        w.id,
        w.product_id,
        w.created_at,
        p.name as product_name,
        p.price,
        p.image_url,
        p.stock,
        p.active
      FROM wishlist w
      JOIN products p ON w.product_id = p.id
      WHERE w.customer_id = ?
      ORDER BY w.created_at DESC
    `).all(customerId);

    res.json({
      success: true,
      data: items.map(i => ({
        ...i,
        price_formatted: `\u062C.\u0645 ${(i.price / 100).toFixed(2)}`,
      })),
    });
  } catch (err) {
    console.error('Get wishlist error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get wishlist',
      },
    });
  }
});

/**
 * GET /api/v1/wishlist/ids
 * Get just the product ids in the wishlist (lightweight check)
 */
router.get('/ids', authenticateToken, (req, res) => {
  try {
    const customerId = req.user.id;
    const rows = db.prepare(`
      SELECT product_id FROM wishlist WHERE customer_id = ?
    `).all(customerId);

    res.json({
      success: true,
      data: rows.map(r => r.product_id),
    });
  } catch (err) {
    console.error('Get wishlist ids error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get wishlist ids',
      },
    });
  }
});

/**
 * POST /api/v1/wishlist/items
 * Add a product to the wishlist
 */
router.post('/items', authenticateToken, (req, res) => {
  try {
    const customerId = req.user.id;
    const { product_id } = req.body;

    if (!product_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'product_id is required',
        },
      });
    }

    const product = db.prepare('SELECT id FROM products WHERE id = ? AND active = 1').get(product_id);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Product not found',
        },
      });
    }

    db.prepare(`
      INSERT OR IGNORE INTO wishlist (customer_id, product_id)
      VALUES (?, ?)
    `).run(customerId, product_id);

    res.status(201).json({
      success: true,
      message: 'Product added to wishlist',
    });
  } catch (err) {
    console.error('Add wishlist item error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to add to wishlist',
      },
    });
  }
});

/**
 * DELETE /api/v1/wishlist/items/:productId
 * Remove a product from the wishlist
 */
router.delete('/items/:productId', authenticateToken, (req, res) => {
  try {
    const customerId = req.user.id;
    const productId = req.params.productId;

    const result = db.prepare(`
      DELETE FROM wishlist
      WHERE customer_id = ? AND product_id = ?
    `).run(customerId, productId);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Product not in wishlist',
        },
      });
    }

    res.json({
      success: true,
      message: 'Product removed from wishlist',
    });
  } catch (err) {
    console.error('Remove wishlist item error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to remove from wishlist',
      },
    });
  }
});

module.exports = router;
