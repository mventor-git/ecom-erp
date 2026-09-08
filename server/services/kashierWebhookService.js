/**
 * Kashier Webhook Service (mventor-ticket-061)
 *
 * Production-grade webhook receiver logic, separated from HTTP concerns:
 *   verify signature (HMAC-SHA512 over raw body fields)
 *   → route by event type (explicit mapping)
 *   → idempotent processing (event_key unique log)
 *   → dispatch to business handlers
 *
 * Kashier signature scheme: HMAC-SHA512 hex of
 *   "amount;currency;merchantOrderId;status"
 * computed with the API secret key. The raw body is preserved upstream.
 */

const crypto = require('crypto');
const db = require('../db');

/** Compute the expected Kashier signature for a payload object. */
function computeSignature(payload, secretKey) {
  const data = [
    payload.amount,
    payload.currency,
    payload.merchantOrderId,
    payload.status,
  ].join(';');
  return crypto.createHmac('sha512', secretKey).update(data).digest('hex');
}

/** Verify a webhook's signature against the configured secret. */
function verifySignature(rawBody, signatureHeader, secretKey) {
  if (!secretKey) return false;
  let payload;
  try { payload = JSON.parse(rawBody); } catch { return false; }
  const expected = computeSignature(payload, secretKey);
  const provided = String(signatureHeader || '');
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

/** Deterministic event key for idempotency. */
function eventKey(payload) {
  return [
    payload.eventType || 'kashier-event',
    payload.sessionId || payload._id || '',
    payload.merchantOrderId || '',
    payload.status || '',
  ].join('::');
}

/** Already processed? */
function isDuplicate(eventKeyStr) {
  try {
    const row = db.prepare('SELECT id FROM kashier_webhook_events WHERE event_key = ?').get(eventKeyStr);
    return !!row;
  } catch { return false; }
}

function recordEvent(eventKeyStr, eventType, payload) {
  db.prepare(`
    INSERT OR IGNORE INTO kashier_webhook_events (event_key, event_type, status, payload)
    VALUES (?, ?, ?, ?)
  `).run(eventKeyStr, eventType, payload.status || '', JSON.stringify(payload).slice(0, 4000));
}

// ── Business handlers (idempotent — guarded by event log) ──

const HANDLERS = {
  'transaction-success': handleTransactionSuccess,
  'trans-capture': handleTransactionCapture,
  'trans-authorize': handleTransactionAuthorize,
  'transaction-refund': handleTransactionRefund,
  'trans-void': handleTransactionVoid,
  'transaction-failed': handleTransactionFailed,
  'transfer-initiated': noop,
  'transfer-transferred': noop,
  'transfer-failed': noop,
};

function handleTransactionSuccess(payload) {
  markSession(payload, 'CAPTURED');
  const orderId = findOrderId(payload);
  if (!orderId) return;
  const order = db.prepare('SELECT id, status, items, total FROM orders WHERE id = ?').get(orderId);
  if (!order || !['pending', 'pending_approval'].includes(order.status)) return;

  // SERVER-SIDE VERIFICATION (anti-fraud): we conclude "paid" ONLY when the
  // SIGNED Kashier amount matches this order's authoritative total and the
  // currency matches what we charged. A mismatch means the provider confirmation
  // is not for this order's charge — do NOT conclude payment and do NOT touch
  // inventory. (The signature already binds amount/currency/merchantOrderId, so
  // this is defense-in-depth against provider/amount drift, not a forged payload.)
  const paidAmountCents = Math.round(Number(payload.amount) * 100); // Kashier sends major-units decimal
  if (!Number.isFinite(paidAmountCents) || paidAmountCents <= 0 || paidAmountCents !== order.total) {
    console.warn(`[kashier-webhook] amount mismatch for order ${orderId}: payload ${payload.amount} vs total ${order.total}`);
    return;
  }
  if (payload.currency && payload.currency !== 'EGP') {
    console.warn(`[kashier-webhook] currency mismatch for order ${orderId}: ${payload.currency}`);
    return;
  }

  // ATOMIC (P0): release + issue + verified-payment state are ONE transaction —
  // if any step fails, the whole sequence ROLLS BACK. We record the verification
  // evidence (payment_status='verified', paid_at, payment_method='kashier') so
  // "paid" is never a client- or slider-fabricated state — it only ever comes
  // from a verified provider confirmation.
  db.transaction(() => {
    const bridge = require('./salesInventoryBridge');
    const items = parseItems(order);
    bridge.releaseForOrder(orderId, items, 'kashier-webhook');
    const issued = bridge.issueForOrder(orderId, items, 'kashier-webhook');
    // Cost threading (073): snapshot unit COGS into the lines INSIDE the
    // atomic unit — rolls back with the paid state. Best-effort, logged.
    try {
      require('./orderLines').applyLineCosts(orderId, (issued && issued.costs) || []);
    } catch (costErr) {
      console.error('[kashier-webhook] line cost snapshot error:', costErr.message);
    }
    db.prepare(`
      UPDATE orders SET status = 'paid', payment_status = 'verified', payment_method = 'kashier',
        paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(orderId);
  });
}

function handleTransactionCapture(payload) {
  markSession(payload, 'CAPTURED');
}

function handleTransactionAuthorize(payload) {
  markSession(payload, 'AUTHORIZED');
}

function handleTransactionRefund(payload) {
  const orderId = findOrderId(payload);
  if (orderId) {
    const order = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId);
    if (order && order.status !== 'refunded') {
      db.prepare("UPDATE orders SET status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(orderId);
    }
  }
  markSession(payload, 'REFUNDED');
}

function handleTransactionVoid(payload) {
  const orderId = findOrderId(payload);
  if (orderId) {
    const order = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId);
    if (order && !['delivered', 'completed'].includes(order.status)) {
      db.prepare("UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(orderId);
    }
  }
  markSession(payload, 'VOIDED');
}

function handleTransactionFailed(payload) {
  markSession(payload, 'FAILED');
}

function noop() {}

function markSession(payload, status) {
  const sid = payload.sessionId || payload._id || '';
  if (!sid) return;
  try {
    db.prepare('UPDATE kashier_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE kashier_order_key = ?')
      .run(status, sid);
  } catch { /* table may not exist in some contexts */ }
}

function findOrderId(payload) {
  if (payload.orderId && Number(payload.orderId)) return Number(payload.orderId);
  const ref = payload.merchantOrderId || '';
  if (/^\d+$/.test(ref)) return Number(ref);
  const row = db.prepare('SELECT order_id FROM kashier_orders WHERE kashier_order_key = ?').get(payload.sessionId || '');
  return row ? row.order_id : null;
}

function parseItems(order) {
  try {
    const arr = JSON.parse(order.items || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

/**
 * Route a verified webhook payload to its handler.
 * Returns the handler name that ran (for logging/tests).
 */
function routeEvent(eventType, payload) {
  const handler = HANDLERS[eventType];
  if (!handler) throw new Error(`Unhandled Kashier event type: ${eventType}`);
  handler(payload);
  return eventType;
}

module.exports = {
  computeSignature,
  verifySignature,
  eventKey,
  isDuplicate,
  recordEvent,
  routeEvent,
  HANDLERS,
};
