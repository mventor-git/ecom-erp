/**
 * Sales Settlement Service — the business authority behind every way an
 * order becomes financially settled or refunded (mventor-ticket-091).
 *
 * Routes/UI/worker handlers contain NO accounting rules: they call these
 * functions. Each settlement/refund runs as ONE transaction:
 *   payment evidence stamp + order state + canonical journal + audit event,
 * so a "paid" order can never exist without its journal and a posted sale
 * can never be "unpaid" without its reversal (journal failure rolls the
 * whole mutation back; financial-period controls fail CLOSED inside
 * journalService.postEntry).
 *
 * Manual settlement policy (owner brief §ADMIN MANUAL PAID → option B):
 * an explicit manual settlement SOURCE — actor + method + reference +
 * reason — collected server-side, journaled, audited. The status slider
 * may no longer fabricate 'paid'.
 *
 * Refunds are FULL by accounting: the domain has no partial-refund truth
 * (refund_amount is informational; reports count full-total refunds), so a
 * refund reverses the entire posted cash/revenue legs. Physical goods
 * returns are NOT implied and are NOT journaled here (separate return/RMA
 * slice later); posted originals are never edited or unposted.
 */

const db = require('../db');
const eventService = require('./eventService');
const journalService = require('./journalService');
const salesPosting = require('./salesPosting');
const workflow = require('./orderWorkflowService');

/** Manual settlement methods the operator may attest. */
const SETTLEMENT_METHODS = ['cash', 'card', 'bank_transfer', 'wallet', 'other'];
/** Methods that are untraceable without a reference — reference mandatory. */
const REFERENCE_REQUIRED_METHODS = ['card', 'bank_transfer', 'wallet', 'other'];
const REASON_MAX_CHARS = 300;
const REFERENCE_MAX_CHARS = 200;
const SETTLED_PAYMENT_STATUSES = ['paid', 'verified'];

function assertOrderSettleable(order, action) {
  if (!order) throw new Error('Order not found');
  if (['cancelled', 'refunded'].includes(order.status)) {
    throw new Error(`Cannot ${action} a ${order.status} order — a cancelled/refunded order books no settlement`);
  }
}

function validateEvidence({ method, reference, reason }) {
  const m = String(method || '').trim().toLowerCase();
  if (!SETTLEMENT_METHODS.includes(m)) {
    throw new Error(`Settlement method must be one of: ${SETTLEMENT_METHODS.join(', ')}`);
  }
  const cleanReason = String(reason == null ? '' : reason).trim();
  if (!cleanReason) throw new Error('Settlement requires a non-empty reason (server-side rule)');
  if (cleanReason.length > REASON_MAX_CHARS) throw new Error(`Settlement reason exceeds ${REASON_MAX_CHARS} characters`);
  const cleanRef = String(reference == null ? '' : reference).trim();
  if (cleanRef.length > REFERENCE_MAX_CHARS) throw new Error(`Settlement reference exceeds ${REFERENCE_MAX_CHARS} characters`);
  if (REFERENCE_REQUIRED_METHODS.includes(m) && !cleanRef) {
    throw new Error(`Settlement by "${m}" requires a reference (document/transaction number) — cash is the only reference-free attestation`);
  }
  return { method: m, reference: cleanRef, reason: cleanReason };
}

function evidenceNote({ actor, method, reference }) {
  return [`settled by ${actor || 'unknown'}`, `method:${method}`, reference ? `ref:${reference}` : '']
    .filter(Boolean).join(' | ');
}

/**
 * Evidence-backed manual settlement (policy B). Stamps payment evidence,
 * takes the workflow transition when one exists toward 'paid', and posts
 * the canonical sale journal — all in ONE transaction.
 *
 * Healing: an operationally already-settled order WITHOUT its journal
 * (legacy slider-fabricated 'paid', or an old best-effort posting that
 * failed) may be booked by the same call — no state re-stamp, journal only.
 * Throws code ALREADY_SETTLED when settled AND booked (nothing to do).
 */
function settleOrder(orderId, { actor = '', method = '', reference = '', reason = '' } = {}) {
  const oid = parseInt(orderId, 10) || 0;
  if (!oid) throw new Error('settleOrder requires an order id');
  const ev = validateEvidence({ actor, method, reference, reason });
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(oid);
  assertOrderSettleable(order, 'settle');

  const alreadySettled = SETTLED_PAYMENT_STATUSES.includes(order.payment_status) || order.status === 'paid';
  const booked = salesPosting.findOrderJournal(oid)?.status === 'posted';
  if (alreadySettled && booked) {
    const err = new Error(`Order #${oid} is already settled and booked — nothing to do`);
    err.code = 'ALREADY_SETTLED';
    throw err;
  }

  let journal = null;
  db.transaction(() => {
    if (!alreadySettled) {
      if (workflow.canTransition(order.status, 'paid')) {
        workflow.transitionOrder(oid, 'paid', { userId: actor || 'admin', reason: `manual settle: ${ev.reason}` });
      }
      // Beyond 'paid' in the lifecycle (confirmed/shipped/...) or not
      // transitionable there — record the MONEY, never fake a status.
      db.prepare(`
        UPDATE orders SET payment_status = 'paid',
          paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(oid);
    }
    journal = salesPosting.postOrderSale(oid, {
      userId: actor || 'manual-settlement',
      evidence: alreadySettled
        ? `settlement booked by ${actor || 'unknown'} | method:${ev.method}${ev.reference ? ` | ref:${ev.reference}` : ''} | reason:${ev.reason}`
        : evidenceNote({ ...ev, actor }),
    });
    const fresh = db.prepare('SELECT total FROM orders WHERE id = ?').get(oid);
    // Settlement-trace event (actor + evidence); lifecycle order_paid (when
    // any) is emitted by the workflow transition itself.
    eventService.emit('order_settlement_recorded', eventService.ENTITY_TYPES.ORDER, oid, {
      userId: actor || 'admin',
      payload: {
        settlement: 'manual',
        method: ev.method,
        reference: ev.reference || null,
        reason: ev.reason,
        booked_only: alreadySettled,
        amount_cents: fresh.total,
      },
    });
  });

  return { settled: true, bookedOnly: alreadySettled, replayed: !journal.posted, entry: journal.entry };
}

/**
 * COD collected at delivery (worker attestation): stamp the payment evidence
 * and post the canonical journal IN ONE transaction. Idempotent — an order
 * already settled AND booked returns settled:false without a second journal.
 * COGS derives from the cost snapshots written when the goods were issued.
 */
function settleCodOnDelivery(orderId, { actor = '', reference = '', reason = '' } = {}) {
  const oid = parseInt(orderId, 10) || 0;
  if (!oid) throw new Error('settleCodOnDelivery requires an order id');
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(oid);
  assertOrderSettleable(order, 'settle (COD)');
  if (String(order.payment_method || '').toLowerCase() !== 'cod') {
    // Not a COD order — delivery never collects money here.
    return { settled: false, reason: 'not a COD order' };
  }
  if (SETTLED_PAYMENT_STATUSES.includes(order.payment_status)) {
    const booked = salesPosting.findOrderJournal(oid)?.status === 'posted';
    if (booked) return { settled: false, reason: 'already settled and booked' };
    // stranded evidence stamp without books → continue and book (heal)
  }

  // A zero-total COD order collects zero money — the delivery is still a
  // real delivery; a 0-cent journal is meaningless (a balanced entry must
  // total > 0), so the stamp completes without a posting. Not a gap: there
  // is simply no economic event to book.
  const zeroTotal = !(journalService.assertIntegerCents(order.total, `Order #${oid} total`) > 0);

  const cleanReason = String(reason || 'COD cash collected at delivery').trim().slice(0, REASON_MAX_CHARS);
  let journal = null;
  db.transaction(() => {
    db.prepare(`
      UPDATE orders SET payment_status = 'paid',
        paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(oid);
    if (!zeroTotal) {
      journal = salesPosting.postOrderSale(oid, {
        userId: actor || 'worker',
        evidence: `COD collected by ${actor || 'worker'}${reference ? ` | proof:${reference}` : ''} | ${cleanReason}`,
      });
    }
    eventService.emit('order_settlement_recorded', eventService.ENTITY_TYPES.ORDER, oid, {
      userId: actor || 'worker',
      payload: {
        settlement: 'cod_delivery',
        reference: reference || null,
        reason: cleanReason,
        amount_cents: order.total,
        zero_total_no_journal: zeroTotal,
      },
    });
  });

  if (zeroTotal) return { settled: false, reason: 'zero total — collected nothing, journaling nothing' };
  return { settled: journal.posted, replayed: !journal.posted, entry: journal.entry };
}

/**
 * Full refund of an order: status transition (release reservations — NOT a
 * goods return) + immutable reversal journal of the posted cash/revenue legs
 * + refund evidence — ONE transaction. No posted sale → pure status refund
 * (nothing was ever booked; honest, no invented reversal). Idempotent:
 * already-refunded orders never reverse twice (source-uniqueness backstop).
 */
function refundOrder(orderId, { actor = '', reason = '' } = {}) {
  const oid = parseInt(orderId, 10) || 0;
  if (!oid) throw new Error('refundOrder requires an order id');
  const cleanReason = String(reason == null ? '' : reason).trim();
  if (!cleanReason) throw new Error('Refund requires a non-empty reason (server-side rule)');
  if (cleanReason.length > REASON_MAX_CHARS) throw new Error(`Refund reason exceeds ${REASON_MAX_CHARS} characters`);

  let reversal = { reversed: false, reason: 'no posted sale journal' };
  db.transaction(() => {
    let order = db.prepare('SELECT * FROM orders WHERE id = ?').get(oid);
    if (!order) throw new Error('Order not found');
    if (order.status === 'refunded') {
      // idempotent path: ensure a booked sale got its reversal (replay-safe)
      reversal = salesPosting.reverseOrderSale(oid, { userId: actor || 'refund', reason: cleanReason });
      return;
    }
    if (!workflow.canTransition(order.status, 'refunded')) {
      const err = new Error(`Order cannot be refunded from status "${order.status}"`);
      err.code = 'INVALID_TRANSITION';
      throw err;
    }
    workflow.transitionOrder(oid, 'refunded', { userId: actor || 'admin', reason: `refund: ${cleanReason}` });
    reversal = salesPosting.reverseOrderSale(oid, { userId: actor || 'refund', reason: cleanReason });
    const fresh = db.prepare('SELECT total FROM orders WHERE id = ?').get(oid);
    db.prepare(`
      UPDATE orders SET refund_amount = ?, refunded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(journalService.assertIntegerCents(fresh.total, `Order #${oid} total`), oid);
  });

  return { refunded: true, reversal };
}

/**
 * Revenue settlement reconciliation (read-only control): operationally
 * settled amounts vs POSTED journal revenue nets, per order. Never forces
 * equality — the differences ARE the output, traceable by order id +
 * journal source event.
 */
function revenueReconciliation({ limit = 200 } = {}) {
  const cap = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 1000);
  const cash = salesPosting.resolveAccount('1000');
  const revenue = salesPosting.resolveAccount('4000');

  const bookedRows = db.prepare(`
    SELECT j.source_id AS order_id, j.source_event, l.account_id, l.debit, l.credit
    FROM journal_entries j
    JOIN journal_lines l ON l.entry_id = j.id
    WHERE j.status = 'posted' AND j.source_type = 'order'
      AND l.account_id IN (?, ?)
  `).all(cash.id, revenue.id);

  // orderId -> revenue-normalized posted/reversed totals + provenance
  const booked = new Map();
  for (const r of bookedRows) {
    let b = booked.get(r.order_id);
    if (!b) { b = { posted: 0, reversed: 0, events: [] }; booked.set(r.order_id, b); }
    // revenue-normal = credit positive; cash legs mirror it (same amount)
    const signed = r.account_id === revenue.id ? (r.credit - r.debit) : (r.debit - r.credit);
    if (r.source_event === salesPosting.REVERSAL_EVENT) b.reversed += signed;
    else if (salesPosting.SALE_EVENTS.includes(r.source_event)) {
      b.posted += signed;
      if (!b.events.includes(r.source_event)) b.events.push(r.source_event);
    }
  }

  const opRows = db.prepare(`
    SELECT id, order_number, total, status, payment_status, payment_method
    FROM orders
    WHERE payment_status IN ('paid', 'verified') OR status = 'paid' OR status = 'refunded'
  `).all();
  const opById = new Map(opRows.map(o => [o.id, o]));

  const totals = {
    operational_settled_cents: 0, // settled, not refunded
    posted_revenue_net_cents: 0,  // posted minus reversals
    difference_cents: 0,
  };
  const issues = {};
  const addIssue = (kind, row) => { (issues[kind] = issues[kind] || []).push(row); };

  const allIds = [...new Set([...opById.keys(), ...booked.keys()])].sort((a, b) => a - b);
  for (const oid of allIds) {
    const o = opById.get(oid);
    const b = booked.get(oid) || { posted: 0, reversed: 0, events: [] };
    const net = b.posted + b.reversed;
    totals.posted_revenue_net_cents += net;

    if (!o) {
      if (net !== 0) addIssue('booked_unsettled', { order_id: oid, net_posted_revenue_cents: net, source_events: b.events });
      continue;
    }
    const total = journalService.assertIntegerCents(o.total, `Order #${oid} total`);
    const settled = SETTLED_PAYMENT_STATUSES.includes(o.payment_status || '') || o.status === 'paid';
    const refunded = o.status === 'refunded';
    if (settled && !refunded) totals.operational_settled_cents += total;

    const base = {
      order_id: oid, order_number: o.order_number || null, order_status: o.status,
      payment_status: o.payment_status, payment_method: o.payment_method,
      order_total_cents: total, net_posted_revenue_cents: net,
      source_events: b.events, ...(b.reversed !== 0 ? { has_reversal: true } : {}),
    };
    if (refunded) {
      if (net !== 0) addIssue('refunded_unreversed', base); // or partial reversal pending
    } else if (settled) {
      // zero-total settled orders legitimately book nothing
      if (total > 0 && net === 0) addIssue('settled_unbooked', base);
      else if (net !== total) addIssue('amount_mismatch', base);
    } else if (net !== 0) {
      addIssue(b.reversed !== 0 ? 'reversed_not_refunded' : 'booked_unsettled', base);
    }
  }
  totals.difference_cents = totals.operational_settled_cents - totals.posted_revenue_net_cents;

  const flagged = Object.values(issues).reduce((n, arr) => n + arr.length, 0);
  return {
    basis: 'operational settlement stamps (payment_status/paid/refunded) vs POSTED sale-settlement + refund-reversal journal nets on Cash 1000 / Revenue 4000',
    truth_note: 'orders.status is NOT accounting truth — every order where the two views disagree is listed below by id + journal source',
    totals,
    difference_classes: Object.fromEntries(
      Object.entries(issues).map(([k, arr]) => [k, { count: arr.length, orders: arr.slice(0, cap), truncated: arr.length > cap }])
    ),
  };
}

module.exports = {
  SETTLEMENT_METHODS,
  settleOrder,
  settleCodOnDelivery,
  refundOrder,
  revenueReconciliation,
};
