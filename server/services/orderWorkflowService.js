/**
 * Order Workflow Service — full order lifecycle + quadruple confirmation engine.
 * mventor-ticket-045
 *
 * Lifecycle (configurable via settings `order_statuses`):
 *   draft → payment_pending → payment_verified → admin_review → confirmed
 *   → picking → packing → ready_for_shipping → shipped → delivered → completed
 *
 * Quadruple confirmation (all configurable):
 *   1. Payment verified
 *   2. Stock available
 *   3. Manual admin approval
 *   4. Auto-approval after configurable timeout (logged + notified)
 *
 * When `order_flow_enabled` is OFF, the legacy flow (pending/paid/shipped)
 * continues to work exactly as before — backward compatible.
 */

const db = require('../db');
const settingsService = require('./settingsService');
const eventService = require('./eventService');
const inventoryService = require('./inventoryService');

const LEGACY_STATUSES = ['pending', 'paid', 'shipped', 'cancelled'];

function getStatuses() {
  const configured = settingsService.get('order_statuses', null);
  if (Array.isArray(configured) && configured.length > 0) return configured;
  return LEGACY_STATUSES;
}

function flowEnabled() {
  return !!settingsService.get('order_flow_enabled', false);
}

function validStatuses() {
  return flowEnabled() ? getStatuses() : LEGACY_STATUSES;
}

// ── Transition map (data-driven; cancellable from most states) ──

function transitionMap() {
  const s = validStatuses();
  const map = {};
  s.forEach(status => { map[status] = []; });

  for (let i = 0; i < s.length; i++) {
    const next = s[i + 1];
    if (next && next !== 'cancelled') map[s[i]].push(next);
  }
  // cancelled is reachable from active states
  s.forEach(status => {
    if (status !== 'cancelled' && status !== 'completed' && status !== 'draft') {
      map[status].push('cancelled');
    }
  });
  // refunds: payable orders can be refunded (recorded flow; Stripe/Paymob API refund is best-effort)
  s.forEach(status => {
    if (['confirmed', 'picking', 'packing', 'ready_for_shipping', 'shipped', 'delivered', 'completed'].includes(status)) {
      map[status].push('refunded');
    }
  });
  // draft can be cancelled or start the flow
  if (map['draft']) {
    map['draft'] = ['payment_pending', 'cancelled'];
  }
  return map;
}

function canTransition(from, to) {
  if (!flowEnabled()) {
    // legacy transitions: pending→paid→shipped, cancellable from pending/paid/shipped
    if (to === 'cancelled') return ['pending', 'paid', 'shipped'].includes(from);
    if (to === 'refunded') return ['paid', 'shipped'].includes(from);
    return (from === 'pending' && to === 'paid') || (from === 'paid' && to === 'shipped');
  }
  const map = transitionMap();
  return Array.isArray(map[from]) && map[from].includes(to);
}

// ── Confirmation engine ──

function orderTotals(order) {
  let items = [];
  try { items = JSON.parse(order.items || '[]'); } catch { items = []; }
  const total = items.reduce((sum, it) => sum + ((it.price || 0) * (it.qty || it.quantity || 1)), 0);
  return { items, total };
}

function paymentVerified(order) {
  // Stripe webhook marks orders 'paid' — treat paid as verified; also any explicit flag
  return order.status === 'paid' || order.status === 'payment_verified' || order.status === 'confirmed'
    || (order.payment_status && ['paid', 'verified'].includes(order.payment_status));
}

function stockAvailable(order) {
  const { items } = orderTotals(order);
  if (items.length === 0) return true; // nothing to verify
  for (const it of items) {
    const pid = it.id || it.product_id;
    if (!pid) continue;
    const total = inventoryService.getTotalStock(pid);
    const need = it.qty || it.quantity || 1;
    if (total < need) return false;
  }
  return true;
}

/**
 * Run the quadruple confirmation checks for an order.
 * `manual` = true when an admin is explicitly approving now.
 * @returns {{paymentVerified:boolean, stockAvailable:boolean, manualApproval:boolean, autoApproval:boolean, allPassed:boolean}}
 */
function runConfirmationChecks(order, { manual = false } = {}) {
  const checks = {
    paymentVerified: !settingsService.get('confirm_payment_verified', true) || paymentVerified(order),
    stockAvailable: !settingsService.get('confirm_stock_available', true) || stockAvailable(order),
    manualApproval: !settingsService.get('confirm_manual_approval', true) || manual,
    autoApproval: false,
  };

  // Auto-approval path: order waited in admin_review past the configurable timeout
  if (!manual && settingsService.get('confirm_manual_approval', true)) {
    const timeoutHours = Number(settingsService.get('confirm_auto_timeout_hours', 24)) || 0;
    if (timeoutHours > 0 && order.status === 'admin_review' && order.admin_review_at) {
      // SQLite stores CURRENT_TIMESTAMP as UTC ("YYYY-MM-DD HH:MM:SS") — parse as UTC
      const reviewMs = Date.parse(String(order.admin_review_at).replace(' ', 'T') + 'Z');
      if (!isNaN(reviewMs)) {
        const deadline = reviewMs + timeoutHours * 3600 * 1000;
        checks.autoApproval = Date.now() >= deadline;
      }
    }
  }

  checks.allPassed = checks.paymentVerified && checks.stockAvailable && (checks.manualApproval || checks.autoApproval);

  return checks;
}

function usersWithPermission(permission) {
  return require('./permissionService').usersWithPermission(permission);
}

function notifyAdmins(title, message, link = null) {
  const notificationService = require('./notificationService');
  usersWithPermission('orders.manage').forEach(uid => {
    notificationService.sendInApp(uid, title, message, link).catch(() => {});
  });
}

function logOrderEvent(orderId, type, userId, payload = {}) {
  eventService.emit(type, eventService.ENTITY_TYPES.ORDER, orderId, {
    userId: userId || 'system',
    payload: { orderId, ...payload },
  });
}

/**
 * Transition an order to a new status (validated).
 * Runs confirmation checks when entering `confirmed`.
 * Notifies admins + customers at key points.
 */
function transitionOrder(orderId, toStatus, { userId = 'admin', reason = '' } = {}) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) throw new Error('Order not found');

  const from = order.status || 'pending';

  if (from === toStatus) return order;
  if (!canTransition(from, toStatus)) {
    throw new Error(`Invalid transition: ${from} → ${toStatus}`);
  }

  // Entering admin_review — stamp the review start time (drives auto-approval)
  let extraSql = '';
  const params = [];
  if (toStatus === 'admin_review') {
    extraSql = ', admin_review_at = COALESCE(admin_review_at, CURRENT_TIMESTAMP)';
  }
  if (toStatus === 'confirmed') {
    extraSql += ', confirmed_at = CURRENT_TIMESTAMP';
  }

  db.prepare(`
    UPDATE orders
    SET status = ?, updated_at = CURRENT_TIMESTAMP ${extraSql}, status_reason = ?
    WHERE id = ?
  `).run(toStatus, reason || '', orderId);

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);

  // ── Confirmation engine ──
  if (toStatus === 'confirmed') {
    const checks = runConfirmationChecks(updated, { manual: true });
    if (checks.allPassed) {
      logOrderEvent(orderId, eventService.EVENT_TYPES.ORDER_CONFIRMED, userId, { reason, checks });
      notifyAdmins('Order Confirmed', `Order #${orderId} passed all confirmation checks`, '/orders');
    } else {
      // failed checks → move back to admin_review for review
      db.prepare("UPDATE orders SET status = 'admin_review', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(orderId);
      const failed = Object.entries(checks).filter(([, v]) => v === false).map(([k]) => k);
      logOrderEvent(orderId, 'order_confirmation_failed', userId, { failed });
      notifyAdmins('Confirmation Blocked', `Order #${orderId} failed checks: ${failed.join(', ')}`, '/orders');
      return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    }
  }

  // ── Warehouse / packing task hooks (mventor-ticket-048) ──
  // -- Sales ? Inventory bridge (mventor-ticket-048) --
  // All bridge calls are idempotent per order + movement type.
  const bridge = require('./salesInventoryBridge');
  const orderItems = bridge.parseOrderItems(updated);
  if (toStatus === 'confirmed') {
    bridge.reserveForOrder(orderId, orderItems, userId);
  }
  if (toStatus === 'shipped') {
    bridge.releaseForOrder(orderId, orderItems, userId); // free the promise�
    const issued = bridge.issueForOrder(orderId, orderItems, userId);   // �then take the goods
    try {
      require('./orderLines').applyLineCosts(orderId, (issued && issued.costs) || []);
    } catch (costErr) {
      console.error('Line cost snapshot error:', costErr.message);
    }
  }
  if (toStatus === 'cancelled' || toStatus === 'refunded') {
    bridge.releaseForOrder(orderId, orderItems, userId);
  }

  if (toStatus === 'picking') {
    const pp = require('./pickingPackingService');
    pp.startPicking(orderId, { userId });
  }
  if (toStatus === 'packing') {
    const pp = require('./pickingPackingService');
    pp.createPackingTask(orderId, { userId });
  }

  // ── Events + notifications per transition ──
  const eventMap = {
    paid: eventService.EVENT_TYPES.ORDER_PAID,
    cancelled: eventService.EVENT_TYPES.ORDER_CANCELLED,
    shipped: eventService.EVENT_TYPES.ORDER_SHIPPED,
    delivered: eventService.EVENT_TYPES.ORDER_DELIVERED,
    completed: eventService.EVENT_TYPES.ORDER_COMPLETED,
    refunded: eventService.EVENT_TYPES.ORDER_REFUNDED,
    packing: eventService.EVENT_TYPES.ORDER_PACKING,
    ready_for_shipping: eventService.EVENT_TYPES.ORDER_READY,
  };
  logOrderEvent(orderId, eventMap[toStatus] || eventService.EVENT_TYPES.ORDER_STATUS_CHANGED, userId, { from, to: toStatus, reason });

  notifyAdmins(`Order #${orderId} → ${toStatus.replace(/_/g, ' ')}`, reason || `Status changed from ${from} to ${toStatus}`, '/orders');

  // Customer notification (email) for key states
  notifyCustomer(updated, toStatus);

  return updated;
}

function notifyCustomer(order, status) {
  const email = require('../email');
  const customerEmail = (order.customer_email || '').trim();
  if (!customerEmail) return;

  const etaHours = Number(settingsService.get('estimated_delivery_hours', 48)) || 48;
  const etaText = `${etaHours} hours`;
  const statusLabels = {
    confirmed: 'Your order has been confirmed!',
    shipped: 'Your order has been shipped!',
    delivered: 'Your order has been delivered!',
    cancelled: 'Your order was cancelled',
    packing: 'Your order is being packed',
    ready_for_shipping: 'Your order is ready for shipping',
    completed: 'Your order is completed — thank you!',
  };
  const subject = statusLabels[status] || `Order #${order.id} status update`;

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
    <div style="background:#2563eb;padding:20px;text-align:center;color:#fff;">
      <h2 style="margin:0;font-size:20px;">${subject}</h2>
    </div>
    <div style="padding:24px;">
      <p>Order <b>#${order.id}</b> — status: <b>${status.replace(/_/g, ' ')}</b></p>
      <p style="color:#555;">${status === 'confirmed' ? `Estimated delivery: <b>${etaText}</b> from confirmation.` : ''}</p>
      <p style="color:#999;font-size:12px;">${require('./settingsService').siteIdentity().name} — ${new Date().toLocaleString('en-GB')}</p>
    </div>
  </div>`;

  email.sendMail({ to: customerEmail, subject: `${subject} — ${require('./settingsService').siteIdentity().name}`, html }).catch(() => {});
}

// ── Auto-approval sweep (called by the server scheduler) ──

function checkAutoApprovals() {
  if (!flowEnabled()) return { checked: 0, approved: 0 };
  if (!settingsService.get('confirm_manual_approval', true)) return { checked: 0, approved: 0 };

  const timeoutHours = Number(settingsService.get('confirm_auto_timeout_hours', 24)) || 0;
  if (timeoutHours <= 0) return { checked: 0, approved: 0 };

  const pending = db.prepare(`
    SELECT * FROM orders
    WHERE status = 'admin_review' AND admin_review_at IS NOT NULL
  `).all();

  let approved = 0;
  const now = Date.now();
  pending.forEach(order => {
    const deadline = new Date(new Date(order.admin_review_at).getTime() + timeoutHours * 3600 * 1000);
    if (now >= deadline.getTime()) {
      const checks = runConfirmationChecks(order); // manual=false → autoApproval path
      if (checks.paymentVerified && checks.stockAvailable && checks.autoApproval) {
        db.prepare("UPDATE orders SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(order.id);
        logOrderEvent(order.id, eventService.EVENT_TYPES.ORDER_AUTO_APPROVED, 'system', { timeoutHours });
        notifyAdmins('Order Auto-Approved', `Order #${order.id} auto-approved after ${timeoutHours}h (no manual action)`, '/orders');
        notifyCustomer(db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id), 'confirmed');
        approved++;
      }
    }
  });

  return { checked: pending.length, approved };
}

module.exports = {
  LEGACY_STATUSES,
  getStatuses,
  validStatuses,
  flowEnabled,
  canTransition,
  transitionMap,
  transitionOrder,
  runConfirmationChecks,
  checkAutoApprovals,
};
