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

/**
 * 091 recovery: a handler that failed ROLLED BACK its whole mutation, so the
 * event must not stay recorded — delete the claim and let the provider
 * redeliver. (This is the durable claim/delete pattern proven in N1.)
 */
function clearEvent(eventKeyStr) {
  try {
    db.prepare('DELETE FROM kashier_webhook_events WHERE event_key = ?').run(eventKeyStr);
  } catch (err) {
    console.error('[kashier-webhook] failed to clear event claim:', err.message);
  }
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

  // ATOMIC (P0 + 091): release + issue + verified-payment state + canonical
  // sales journal are ONE transaction — if ANY step fails (including the
  // period-gated posting) the whole sequence ROLLS BACK and the route clears
  // the event claim, so the provider redelivers and settlement is retried.
  // Since 091 "paid" can no longer exist without its books: the best-effort
  // post-commit posting of 086 (which could strand a paid order unjournaled
  // with no re-post seam) is replaced by this all-or-nothing boundary.
  // Payment evidence semantics unchanged: "paid" only ever comes from a
  // SIGNED amount/currency match against the authoritative order total.
  db.transaction(() => {
    const bridge = require('./salesInventoryBridge');
    const orderLines = require('./orderLines');
    const salesPosting = require('./salesPosting');
    const items = parseItems(order);
    bridge.releaseForOrder(orderId, items, 'kashier-webhook');
    const issued = bridge.issueForOrder(orderId, items, 'kashier-webhook');
    const issuedCosts = (issued && issued.costs) || [];
    db.prepare(`
      UPDATE orders SET status = 'paid', payment_status = 'verified', payment_method = 'kashier',
        paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(orderId);
    orderLines.applyLineCosts(orderId, issuedCosts);
    salesPosting.postOrderSale(orderId, {
      costs: issuedCosts,
      userId: 'kashier-webhook',
      evidence: `kashier verified session:${payload.sessionId || payload._id || '-'}`,
    });
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
      // 091: the provider refund is a FINANCIAL event — it goes through the
      // canonical refund seam (status + immutable reversal journal, one
      // transaction). A closed period makes postEntry throw → this handler
      // fails → the route clears the event claim → redelivery retries until
      // the period reopens. No silent unbooked refund, no bypass.
      const settlement = require('./salesSettlementService');
      try {
        settlement.refundOrder(orderId, {
          actor: 'kashier-webhook',
          reason: `provider refund session:${payload.sessionId || payload._id || '-'}`,
        });
      } catch (err) {
        if (err && err.code === 'INVALID_TRANSITION') {
          // Provider refunded an order our lifecycle can't model as refunded
          // (e.g. already cancelled before capture settled) — nothing was
          // booked, nothing to reverse. Ack + surface; never fabricate state.
          console.warn(`[kashier-webhook] provider refund not modeled for order ${orderId} (${order.status}): ${err.message}`);
        } else {
          throw err; // period gate & integrity failures → claim cleared → redelivery
        }
      }
    }
  }
  markSession(payload, 'REFUNDED');
}

function handleTransactionVoid(payload) {
  const orderId = findOrderId(payload);
  if (orderId) {
    const order = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId);
    if (order && !['delivered', 'completed'].includes(order.status)) {
      // Gate post-091: a void on an order whose sale is BOOKED is not a
      // pre-capture void anymore — the money fact lives in the ledger. We
      // never silently cancel booked revenue: the provider session is still
      // marked VOIDED, the order keeps its paid truth, and the anomaly is
      // surfaced loudly for admin handling via the refund seam.
      if (require('./salesPosting').hasPostedSale(orderId)) {
        console.warn(`[kashier-webhook] trans-void on BOOKED order ${orderId} — not cancelling posted revenue; handle as refund through the admin seam`);
      } else {
        db.prepare("UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(orderId);
      }
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
  clearEvent,
  routeEvent,
  HANDLERS,
};
