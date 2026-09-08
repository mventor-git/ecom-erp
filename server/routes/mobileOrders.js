/**
 * Mobile API v1 - Orders
 * Mobile-optimized order endpoints
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/jwtAuth');
const eventService = require('../services/eventService');
const inventoryService = require('../services/inventoryService');

// ── Stock bridge helpers (mventor-ticket-048) ──

function orderAlreadyIssued(orderId) {
  return !!db.prepare(`
    SELECT id FROM inventory_movements
    WHERE reference_type = 'order' AND reference_id = ? AND type = 'issue'
    LIMIT 1
  `).get(orderId);
}

function resolveCancelWarehouse(productId) {
  const p = db.prepare('SELECT default_warehouse_id FROM products WHERE id = ?').get(productId);
  if (p && p.default_warehouse_id) return p.default_warehouse_id;
  const main = db.prepare("SELECT id FROM warehouses WHERE code = 'WH-MAIN' AND is_active = 1").get();
  if (main) return main.id;
  const any = db.prepare('SELECT id FROM warehouses WHERE is_active = 1 ORDER BY id LIMIT 1').get();
  return any ? any.id : null;
}

/**
 * POST /api/v1/orders
 * Create new order from cart
 */
router.post('/', authenticateToken, (req, res) => {
  try {
    const customerId = req.user.id;
    const { shipping_address, payment_method = 'cod', notes } = req.body;

    // Validate shipping address
    if (!shipping_address || !shipping_address.name || !shipping_address.phone || 
        !shipping_address.address || !shipping_address.city) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Complete shipping address is required',
        },
      });
    }

    // Get cart items
    const cartItems = db.prepare(`
      SELECT ci.*, p.name, p.price, p.stock
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = ?
    `).all(customerId);

    if (cartItems.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'EMPTY_CART',
          message: 'Cart is empty',
        },
      });
    }

    // Authoritative repricing (067, web P0.4 parity): never trust raw
    // products.price — resolve overrides/list-discounts server-side exactly
    // like the storefront listing; reject unknown/inactive/bad-qty lines.
    // Identical values while storefront=retail with no overrides.
    const { resolveItem } = require('../services/orderPricing');
    for (const item of cartItems) {
      const priced = resolveItem({ product_id: item.product_id, quantity: item.quantity });
      if (!priced.ok) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ITEM',
            message: `Item cannot be priced (product ${item.product_id}: ${priced.reason})`,
          },
        });
      }
      item.price = priced.unitPrice;
    }

    // Check stock availability
    for (const item of cartItems) {
      if (item.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: `Insufficient stock for ${item.name}`,
          },
        });
      }
    }

    // Calculate totals
    const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shippingThreshold = 50000; // 500 EGP in cents
    const shipping = subtotal >= shippingThreshold ? 0 : 5000; // 50 EGP
    const total = subtotal + shipping;

    // Generate order number
    const orderNumber = `ORD-${Date.now()}`;

    // Create order (066: snapshot storefront list code — same one rule as web checkout)
    const priceListCode = require('../services/priceListService').storefrontListCode();
    const orderResult = db.prepare(`
      INSERT INTO orders (
        customer_id, user_id, order_number, status, subtotal, shipping, total,
        shipping_name, shipping_phone, shipping_address, shipping_city,
        shipping_governorate, shipping_postal_code,
        payment_method, payment_status, notes, price_list_code
      ) VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      customerId,
      customerId,
      orderNumber,
      subtotal,
      shipping,
      total,
      shipping_address.name,
      shipping_address.phone,
      shipping_address.address,
      shipping_address.city,
      shipping_address.governorate || null,
      shipping_address.postal_code || null,
      payment_method,
      notes || null,
      priceListCode
    );

    const orderId = orderResult.lastInsertRowid;

    // Create order items (066: same snapshot code per line;
    // 069: mirror normalized qty/prices — same facts, both names)
    const insertItem = db.prepare(`
      INSERT INTO order_items (
        order_id, product_id, product_name, quantity, price,
        variant_color, variant_size, price_list_code, qty, base_price, final_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of cartItems) {
      insertItem.run(
        orderId,
        item.product_id,
        item.name,
        item.quantity,
        item.price,
        item.variant_color,
        item.variant_size,
        priceListCode,
        item.quantity,
        item.price,
        item.price
      );
    }

    // Sales ↔ Inventory bridge: proper ISSUE movements replace the legacy
    // direct `products.stock` decrement (mventor-ticket-048).
    // Cost threading (072): snapshot the just-computed unit COGS into the
    // lines — best-effort AFTER truthful order+stock, never fails checkout.
    const bridge = require('../services/salesInventoryBridge');
    const bridgeResult = bridge.issueForOrder(
      orderId,
      cartItems.map(ci => ({ product_id: ci.product_id, quantity: ci.quantity })),
      req.user?.id || 'mobile_customer'
    );
    try {
      require('../services/orderLines').applyLineCosts(orderId, bridgeResult.costs || []);
    } catch (costErr) {
      console.error('Line cost snapshot error:', costErr.message);
    }

    // Clear cart
    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(customerId);

    // Emit event
    eventService.emit(
      eventService.EVENT_TYPES.ORDER_CREATED,
      eventService.ENTITY_TYPES.ORDER,
      orderId,
      {
        userId: customerId,
        userRole: req.user.role,
        payload: { order_number: orderNumber, total, item_count: cartItems.length },
      }
    );

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        order_id: orderId,
        order_number: orderNumber,
        status: 'pending',
        total,
        total_formatted: `\u062C.\u0645 ${(total / 100).toFixed(2)}`,
      },
    });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create order',
      },
    });
  }
});

/**
 * GET /api/v1/orders
 * Get customer's order history
 */
router.get('/', authenticateToken, (req, res) => {
  try {
    const customerId = req.user.id;
    const { page = 1, limit = 20, status } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    let where = 'WHERE customer_id = ?';
    const params = [customerId];

    if (status) {
      where += ' AND status = ?';
      params.push(status);
    }

    // Get total count
    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM orders ${where}
    `).get(...params);

    const total = countResult.total;
    const totalPages = Math.ceil(total / limitNum);

    // Get orders
    const orders = db.prepare(`
      SELECT 
        o.id,
        o.order_number,
        o.status,
        o.total,
        o.payment_status,
        o.created_at,
        o.delivered_at,
        COUNT(oi.id) as items_count
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      ${where}
      GROUP BY o.id
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset);

    const formattedOrders = orders.map(o => ({
      id: o.id,
      order_number: o.order_number,
      status: o.status,
      total: o.total,
      total_formatted: `\u062C.\u0645 ${(o.total / 100).toFixed(2)}`,
      payment_status: o.payment_status,
      items_count: o.items_count,
      created_at: o.created_at,
      delivered_at: o.delivered_at,
    }));

    res.json({
      success: true,
      data: formattedOrders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: totalPages,
      },
    });
  } catch (err) {
    console.error('Get orders error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch orders',
      },
    });
  }
});

/**
 * GET /api/v1/orders/:id
 * Get order details
 */
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const customerId = req.user.id;
    const orderId = req.params.id;

    // Get order
    const order = db.prepare(`
      SELECT * FROM orders WHERE id = ? AND customer_id = ?
    `).get(orderId, customerId);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Order not found',
        },
      });
    }

    // Get order items
    const items = db.prepare(`
      SELECT 
        oi.*,
        p.image_url as product_image
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).all(orderId);

    const formattedItems = items.map(item => ({
      product_id: item.product_id,
      product_name: item.product_name,
      product_image: item.product_image,
      price: item.price,
      price_formatted: `\u062C.\u0645 ${(item.price / 100).toFixed(2)}`,
      quantity: item.quantity,
      variant: {
        color: item.variant_color,
        size: item.variant_size,
      },
    }));

    res.json({
      success: true,
      data: {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        items: formattedItems,
        shipping_address: {
          name: order.shipping_name,
          phone: order.shipping_phone,
          address: order.shipping_address,
          city: order.shipping_city,
          governorate: order.shipping_governorate,
          postal_code: order.shipping_postal_code,
        },
        subtotal: order.subtotal,
        subtotal_formatted: `\u062C.\u0645 ${(order.subtotal / 100).toFixed(2)}`,
        shipping: order.shipping,
        shipping_formatted: `\u062C.\u0645 ${(order.shipping / 100).toFixed(2)}`,
        total: order.total,
        total_formatted: `\u062C.\u0645 ${(order.total / 100).toFixed(2)}`,
        payment_method: order.payment_method,
        payment_status: order.payment_status,
        notes: order.notes,
        created_at: order.created_at,
        delivered_at: order.delivered_at,
      },
    });
  } catch (err) {
    console.error('Get order error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch order',
      },
    });
  }
});

/**
 * POST /api/v1/orders/:id/cancel
 * Cancel order
 */
router.post('/:id/cancel', authenticateToken, (req, res) => {
  try {
    const customerId = req.user.id;
    const orderId = req.params.id;

    // Get order
    const order = db.prepare(`
      SELECT * FROM orders WHERE id = ? AND customer_id = ?
    `).get(orderId, customerId);

    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Order not found',
        },
      });
    }

    // Check if order can be cancelled
    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Order cannot be cancelled in current status',
        },
      });
    }

    // Update order status
    db.prepare(`
      UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(orderId);

    // Restore stock via the movement engine (mventor-ticket-048):
    // release any reservation, then return goods with a correction movement.
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
    const bridge = require('../services/salesInventoryBridge');
    try {
      bridge.releaseForOrder(orderId, items, req.user?.id || 'mobile_customer');
      if (!orderAlreadyIssued(orderId)) {
        for (const item of items) {
          const warehouseId = resolveCancelWarehouse(item.product_id);
          if (!warehouseId) continue;
          inventoryService.createMovement({
            productId: item.product_id,
            warehouseId,
            type: 'correction',
            reason: 'mobile_order_cancelled',
            referenceType: 'order',
            referenceId: orderId,
            qtyChange: item.quantity,
            note: `Order #${orderId} cancelled — goods returned`,
            userId: req.user?.id || 'mobile_customer',
          });
        }
      }
    } catch (bridgeErr) {
      console.error('Stock restore error:', bridgeErr.message);
    }

    // Emit event
    eventService.emit(
      eventService.EVENT_TYPES.ORDER_CANCELLED,
      eventService.ENTITY_TYPES.ORDER,
      orderId,
      {
        userId: customerId,
        userRole: req.user.role,
        payload: { order_number: order.order_number },
      }
    );

    res.json({
      success: true,
      message: 'Order cancelled successfully',
    });
  } catch (err) {
    console.error('Cancel order error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to cancel order',
      },
    });
  }
});

module.exports = router;
