/**
 * Mobile API v1 - Cart
 * Mobile-optimized cart endpoints
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/jwtAuth');

/**
 * GET /api/v1/cart
 * Get user's cart
 */
router.get('/', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;

    // Get cart items
    const items = db.prepare(`
      SELECT 
        ci.id,
        ci.product_id,
        ci.quantity,
        ci.variant_color,
        ci.variant_size,
        p.name as product_name,
        p.price,
        p.image_url as product_image,
        p.stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = ?
      ORDER BY ci.created_at DESC
    `).all(userId);

    if (items.length === 0) {
      return res.json({
        success: true,
        data: {
          items: [],
          total_items: 0,
          subtotal: 0,
          subtotal_formatted: '\u062C.\u0645 0.00',
          shipping: 0,
          shipping_formatted: '\u062C.\u0645 0.00',
          total: 0,
          total_formatted: '\u062C.\u0645 0.00',
        },
      });
    }

    // Calculate totals
    let subtotal = 0;
    let totalItems = 0;

    const formattedItems = items.map(item => {
      const itemTotal = item.price * item.quantity;
      subtotal += itemTotal;
      totalItems += item.quantity;

      return {
        id: item.id,
        product_id: item.product_id,
        product_name: item.product_name,
        product_image: item.product_image,
        price: item.price,
        price_formatted: `\u062C.\u0645 ${(item.price / 100).toFixed(2)}`,
        quantity: item.quantity,
        subtotal: itemTotal,
        subtotal_formatted: `\u062C.\u0645 ${(itemTotal / 100).toFixed(2)}`,
        variant: {
          color: item.variant_color,
          size: item.variant_size,
        },
        in_stock: item.stock >= item.quantity,
      };
    });

    // Calculate shipping (free over 500 JOD)
    const shippingThreshold = 50000; // 500 JOD in cents
    const shipping = subtotal >= shippingThreshold ? 0 : 5000; // 50 JOD

    const total = subtotal + shipping;

    res.json({
      success: true,
      data: {
        items: formattedItems,
        total_items: totalItems,
        subtotal,
        subtotal_formatted: `\u062C.\u0645 ${(subtotal / 100).toFixed(2)}`,
        shipping,
        shipping_formatted: `\u062C.\u0645 ${(shipping / 100).toFixed(2)}`,
        total,
        total_formatted: `\u062C.\u0645 ${(total / 100).toFixed(2)}`,
        free_shipping_progress: subtotal < shippingThreshold 
          ? {
              current: subtotal,
              threshold: shippingThreshold,
              remaining: shippingThreshold - subtotal,
              remaining_formatted: `\u062C.\u0645 ${((shippingThreshold - subtotal) / 100).toFixed(2)}`,
            }
          : null,
      },
    });
  } catch (err) {
    console.error('Get cart error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch cart',
      },
    });
  }
});

/**
 * POST /api/v1/cart/items
 * Add item to cart
 */
router.post('/items', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { product_id, quantity = 1, variant } = req.body;

    if (!product_id) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Product ID is required',
        },
      });
    }

    // Check if product exists and has stock
    const product = db.prepare(`
      SELECT id, stock, active FROM products WHERE id = ?
    `).get(product_id);

    if (!product || !product.active) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Product not found',
        },
      });
    }

    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: 'Not enough stock available',
        },
      });
    }

    // Check if item already in cart
    const existingItem = db.prepare(`
      SELECT id, quantity FROM cart_items
      WHERE user_id = ? AND product_id = ?
        AND variant_color = ? AND variant_size = ?
    `).get(
      userId,
      product_id,
      variant?.color || null,
      variant?.size || null
    );

    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + quantity;
      
      if (product.stock < newQuantity) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: 'Not enough stock available',
          },
        });
      }

      db.prepare(`
        UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newQuantity, existingItem.id);

      return res.json({
        success: true,
        message: 'Cart updated',
        data: {
          cart_item_id: existingItem.id,
          quantity: newQuantity,
        },
      });
    }

    // Add new item
    const result = db.prepare(`
      INSERT INTO cart_items (user_id, product_id, quantity, variant_color, variant_size)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      userId,
      product_id,
      quantity,
      variant?.color || null,
      variant?.size || null
    );

    res.status(201).json({
      success: true,
      message: 'Item added to cart',
      data: {
        cart_item_id: result.lastInsertRowid,
      },
    });
  } catch (err) {
    console.error('Add to cart error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to add item to cart',
      },
    });
  }
});

/**
 * PUT /api/v1/cart/items/:itemId
 * Update cart item quantity
 */
router.put('/items/:itemId', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Quantity must be at least 1',
        },
      });
    }

    // Get cart item
    const cartItem = db.prepare(`
      SELECT ci.*, p.stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.id = ? AND ci.user_id = ?
    `).get(itemId, userId);

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Cart item not found',
        },
      });
    }

    if (cartItem.stock < quantity) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: 'Not enough stock available',
        },
      });
    }

    db.prepare(`
      UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(quantity, itemId);

    res.json({
      success: true,
      message: 'Cart updated',
      data: {
        cart_item_id: parseInt(itemId),
        quantity,
      },
    });
  } catch (err) {
    console.error('Update cart error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update cart',
      },
    });
  }
});

/**
 * DELETE /api/v1/cart/items/:itemId
 * Remove item from cart
 */
router.delete('/items/:itemId', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;

    const result = db.prepare(`
      DELETE FROM cart_items WHERE id = ? AND user_id = ?
    `).run(itemId, userId);

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Cart item not found',
        },
      });
    }

    res.json({
      success: true,
      message: 'Item removed from cart',
    });
  } catch (err) {
    console.error('Remove from cart error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to remove item from cart',
      },
    });
  }
});

/**
 * DELETE /api/v1/cart
 * Clear entire cart
 */
router.delete('/', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;

    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);

    res.json({
      success: true,
      message: 'Cart cleared',
    });
  } catch (err) {
    console.error('Clear cart error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to clear cart',
      },
    });
  }
});

module.exports = router;
