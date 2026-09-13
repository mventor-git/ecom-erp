/**
 * Mobile API v1 - Worker (staff app)
 * Order execution endpoints for the worker app (drivers, pickers, packers).
 * All routes require a staff JWT (role !== 'customer').
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db');
const { authenticateToken } = require('../middleware/jwtAuth');
const workflow = require('../services/orderWorkflowService');
const settlement = require('../services/salesSettlementService');
const eventService = require('../services/eventService');

const PROOF_DIR = path.join(__dirname, '..', 'public', 'uploads', 'worker-proofs');
if (!fs.existsSync(PROOF_DIR)) fs.mkdirSync(PROOF_DIR, { recursive: true });

const proofUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, PROOF_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `proof-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
});

// Staff-only guard: customers must never access worker endpoints
function requireStaff(req, res, next) {
  if (!req.user || req.user.role === 'customer') {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Staff access only' },
    });
  }
  next();
}

const ACTIVE_STATUSES = ['pending', 'paid', 'confirmed', 'picking', 'packing', 'ready_for_shipping', 'shipped', 'delivered'];

const orderSelect = `
  SELECT o.id, o.order_number, o.status, o.total, o.subtotal, o.shipping,
         o.payment_method, o.payment_status, o.notes, o.created_at, o.delivered_at,
         o.shipping_name, o.shipping_phone, o.shipping_address, o.shipping_city,
         o.shipping_governorate, o.shipping_postal_code, o.status_reason,
         o.proof_image, o.proof_note, o.paid_at,
         c.name as customer_name, c.email as customer_email,
         (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as items_count
  FROM orders o
  LEFT JOIN customers c ON o.customer_id = c.id
`;

/**
 * GET /api/v1/worker/orders
 * List active orders (excludes draft/cancelled/refunded/admin_review).
 * Query: status (optional filter), page, limit
 */
router.get('/orders', authenticateToken, requireStaff, (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const where = ['o.status NOT IN ("draft","cancelled","refunded","admin_review")'];
    const params = [];
    if (status) {
      where.push('o.status = ?');
      params.push(status);
    }

    const count = db.prepare(`SELECT COUNT(*) as total FROM orders o WHERE ${where.join(' AND ')}`).get(...params);
    const orders = db.prepare(`
      ${orderSelect}
      WHERE ${where.join(' AND ')}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset);

    res.json({
      success: true,
      data: orders.map(o => ({
        ...o,
        total_formatted: `\u062C.\u0645 ${(o.total / 100).toFixed(2)}`,
      })),
      pagination: { page: pageNum, limit: limitNum, total: count.total, total_pages: Math.ceil(count.total / limitNum) },
    });
  } catch (err) {
    console.error('Worker list orders error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to list orders' } });
  }
});

/**
 * GET /api/v1/worker/orders/:id
 * Full order detail with items + allowed transitions
 */
router.get('/orders/:id', authenticateToken, requireStaff, (req, res) => {
  try {
    const order = db.prepare(`${orderSelect} WHERE o.id = ?`).get(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }

    const items = db.prepare(`
      SELECT product_id, product_name, quantity, price, variant_color, variant_size
      FROM order_items WHERE order_id = ?
    `).all(order.id);

    const transitions = workflow.validStatuses().filter(s => workflow.canTransition(order.status || 'pending', s));

    res.json({
      success: true,
      data: {
        ...order,
        total_formatted: `\u062C.\u0645 ${(order.total / 100).toFixed(2)}`,
        subtotal_formatted: `\u062C.\u0645 ${(order.subtotal / 100).toFixed(2)}`,
        shipping_formatted: `\u062C.\u0645 ${(order.shipping / 100).toFixed(2)}`,
        items: items.map(i => ({ ...i, price_formatted: `\u062C.\u0645 ${(i.price / 100).toFixed(2)}` })),
        allowed_transitions: transitions,
      },
    });
  } catch (err) {
    console.error('Worker order detail error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load order' } });
  }
});

/**
 * PUT /api/v1/worker/orders/:id/status
 * Advance an order through the workflow (validated by orderWorkflowService).
 * Body: { status, reason? } — COD orders marked delivered are auto-paid.
 */
router.put('/orders/:id/status', authenticateToken, requireStaff, (req, res) => {
  try {
    const { status, reason } = req.body;
    const orderId = parseInt(req.params.id);

    if (!status) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'status is required' } });
    }

    // 091 gate-fix: the worker lifecycle endpoint must not be able to
    // fabricate money states either — 'paid' comes only from settlement
    // (COD collection fires on 'delivered' via the settlement service;
    // online payment from the provider webhook) and 'refunded' only from
    // the refund seam. Same guard the admin status route got in 091.
    if (status === 'paid') {
      return res.status(400).json({
        success: false,
        error: { code: 'SETTLEMENT_REQUIRED', message: 'Workers never mark orders paid — COD money is settled at delivery (status delivered) and online payments by the provider. Use the admin settlement path with evidence for anything else.' },
      });
    }
    if (status === 'refunded') {
      return res.status(400).json({
        success: false,
        error: { code: 'REFUND_REQUIRED', message: 'Refunds go through the refund seam (evidence + immutable reversal journal) — see the admin refund endpoint.' },
      });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }

    try {
      let codResult = null;
      db.transaction(() => {
        const updated = workflow.transitionOrder(orderId, status, { userId: `worker-${req.user.id}`, reason: reason || '' });
        // COD payment capture on delivery — canonical settlement (evidence
        // + journal) in ONE transaction. A driver marking delivered is not a
        // bookkeeping fact by itself: money is proven by the posted sale
        // journal, so a failed posting rolls back the payment stamp.
        if (status === 'delivered') {
          codResult = settlement.settleCodOnDelivery(orderId, {
            actor: `worker-${req.user.id}`,
            reason: 'COD cash collected at delivery',
          });
        }
        return updated;
      });
      // Event for the web admin feed
      eventService.emit(
        eventService.EVENT_TYPES.ORDER_STATUS_CHANGED,
        eventService.ENTITY_TYPES.ORDER,
        orderId,
        {
          userId: req.user.id,
          userRole: req.user.role,
          payload: { from: order.status, to: status, worker: true },
        }
      );
      const fresh = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      res.json({ success: true, message: 'Status updated', data: fresh, cod_settled: !!(codResult && codResult.settled) });
    } catch (err) {
      // Settlement failures (closed period, integrity) must surface loudly —
      // they are NOT silent best-effort; the whole delivery mutation rolled back.
      if (String(err.message).includes('closed financial period') || String(err.message).includes('refusing to post')) {
        console.error('[worker] COD settlement blocked by financial control:', err.message);
        return res.status(409).json({ success: false, error: { code: 'SETTLEMENT_BLOCKED', message: err.message } });
      }
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TRANSITION', message: err.message },
      });
    }
  } catch (err) {
    console.error('Worker status update error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update status' } });
  }
});

/**
 * POST /api/v1/worker/orders/:id/proof
 * Upload proof-of-delivery photo (+ optional note). Marks the order delivered
 * and collects COD payment.
 * Body: multipart/form-data — field 'photo' (file), field 'note' (text)
 */
router.post('/orders/:id/proof', authenticateToken, requireStaff, proofUpload.single('photo'), (req, res) => {
  try {
    const orderId = parseInt(req.params.id);
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'photo file is required' } });
    }

    if (['cancelled', 'refunded', 'completed'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_TRANSITION', message: `Cannot add proof to a ${order.status} order` },
      });
    }

    const proofUrl = `/uploads/worker-proofs/${req.file.filename}`;
    const note = req.body.note || '';

    // Delivery + proof + COD settlement are ONE transaction: the money
    // fact (posted journal) and the physical fact (proof) commit together
    // or not at all (091). Settlement is delegated to the canonical
    // service — no accounting in routes.
    let current = order;
    let codResult = null;
    try {
      db.transaction(() => {
        if (current.status !== 'delivered') {
          current = workflow.transitionOrder(orderId, 'delivered', { userId: `worker-${req.user.id}`, reason: 'proof-of-delivery' });
        }
        db.prepare(`
          UPDATE orders
          SET proof_image = ?, proof_note = ?, delivered_at = COALESCE(delivered_at, CURRENT_TIMESTAMP),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(proofUrl, note || null, orderId);
        codResult = settlement.settleCodOnDelivery(orderId, {
          actor: `worker-${req.user.id}`,
          reference: proofUrl,
          reason: 'COD collected at proof-of-delivery',
        });
      });
    } catch (err) {
      // Remove the uploaded file — the transaction is what matters
      try { fs.unlinkSync(req.file.path); } catch {}
      if (String(err.message).includes('Invalid transition')) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_TRANSITION', message: err.message },
        });
      }
      if (String(err.message).includes('closed financial period') || String(err.message).includes('refusing to post')) {
        console.error('[worker] COD settlement blocked by financial control:', err.message);
        return res.status(409).json({ success: false, error: { code: 'SETTLEMENT_BLOCKED', message: err.message } });
      }
      throw err;
    }

    res.status(201).json({
      success: true,
      message: 'Proof of delivery saved',
      data: { proof_image: proofUrl, order_id: orderId, status: current.status, cod_settled: !!(codResult && codResult.settled) },
    });
  } catch (err) {
    console.error('Worker proof upload error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to save proof' } });
  }
});

/**
 * GET /api/v1/worker/stats
 * Today's numbers for the worker home screen.
 */
router.get('/stats', authenticateToken, requireStaff, (req, res) => {
  try {
    const today = db.prepare(`
      SELECT
        COUNT(*) as active_orders,
        COALESCE(SUM(CASE WHEN status = 'shipped' OR status = 'delivered' THEN 1 ELSE 0 END), 0) as in_delivery
      FROM orders
      WHERE status NOT IN ('draft','cancelled','refunded','admin_review')
    `).get();

    const todayRow = db.prepare(`
      SELECT
        COUNT(*) as delivered_today,
        COALESCE(SUM(CASE WHEN payment_method = 'cod' THEN total ELSE 0 END), 0) as cod_collected_today
      FROM orders
      WHERE status IN ('delivered','completed') AND date(delivered_at) = date('now')
    `).get();

    res.json({
      success: true,
      data: {
        active_orders: todayRow ? today.active_orders : 0,
        in_delivery: todayRow ? today.in_delivery : 0,
        delivered_today: todayRow.delivered_today,
        cod_collected_today: todayRow.cod_collected_today,
        cod_collected_formatted: `\u062C.\u0645 ${((todayRow.cod_collected_today || 0) / 100).toFixed(2)}`,
      },
    });
  } catch (err) {
    console.error('Worker stats error:', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to load stats' } });
  }
});

module.exports = router;
