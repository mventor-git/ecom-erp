/**
 * Supplier Payment Service — AP relief (mventor-ticket-088).
 *
 * A supplier payment is a real financial transaction: persisted (PAY-YYYY-NNNN),
 * applied explicitly to purchase orders (the only payable grain that exists —
 * 087 recognizes AP per receipt movement), and posted
 *   Dr Accounts Payable 2100 / Cr Cash 1000
 * onto the canonical 086/087 journal seam. Full or partial; one payment may
 * cover multiple POs; sum(applications) MUST equal the payment amount.
 *
 * Immutability: posted payments are never edited/deleted — corrections go
 * through reversePayment() which posts the opposite entry and flips status to
 * 'reversed' (original + reversal both remain visible).
 *
 * Replay-safety: optional caller idempotency_key (UNIQUE) returns the existing
 * payment; the journal ux_journal_source UNIQUE(str_type,id,event) is the
 * posting backstop.
 *
 * Outstanding AP per PO is DERIVED from posted journals (ADR-014: posted
 * journals are the accounting truth) — never from a mutable operational counter.
 *   receipt AP (087 credits to 2100 for the PO's receipt movements)
 *   − applications on recorded (non-reversed) payments
 */

const db = require('../db');
const journalService = require('./journalService');
const documentNumberService = require('./documentNumberService');
const eventService = require('./eventService');
const { resolveAccount } = require('./accountChart');

const SOURCE_TYPE = 'supplier_payment';
const EVENT_RECORDED = 'payment-recorded';
const EVENT_REVERSED = 'payment-reversed';

// Method → cash-side account code. Extensible: add 'bank'/'transfer' later.
const METHOD_ACCOUNTS = { cash: '1000' };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function assertDate(v) {
  const s = String(v || '').trim() || todayISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`Invalid paid_at "${v}" — expected YYYY-MM-DD`);
  }
  return s;
}

/**
 * Posted AP credits for one PO (sum of 087 receipt postings, cents).
 * Joins journal_entries(source inventory_movement) to the movement's PO ref.
 */
function receiptPayableForPo(poId) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(jl.credit), 0) AS cents
    FROM journal_entries je
    JOIN journal_lines jl ON jl.entry_id = je.id
    JOIN accounts a ON a.id = jl.account_id
    JOIN inventory_movements m ON m.id = je.source_id
    WHERE je.status = 'posted'
      AND je.source_type = 'inventory_movement'
      AND je.source_event = 'po-receipt'
      AND a.code = '2100'
      AND m.reference_type = 'purchase_order'
      AND m.reference_id = ?
  `).get(poId);
  return Math.round(Number(row?.cents) || 0);
}

/** Applications on recorded (non-reversed) payments for one PO (cents). */
function appliedToPo(poId) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(a.amount), 0) AS cents
    FROM supplier_payment_applications a
    JOIN supplier_payments p ON p.id = a.payment_id
    WHERE a.purchase_order_id = ? AND p.status = 'recorded'
  `).get(poId);
  return Math.round(Number(row?.cents) || 0);
}

/** Remaining payable on one PO (receipt AP − recorded applications). */
function outstandingForPo(poId) {
  return Math.max(0, receiptPayableForPo(poId) - appliedToPo(poId));
}

function findByIdempotencyKey(key) {
  if (!key) return null;
  return db.prepare('SELECT * FROM supplier_payments WHERE idempotency_key = ?').get(String(key)) || null;
}

function getPayment(id) {
  const payment = db.prepare('SELECT * FROM supplier_payments WHERE id = ?').get(id);
  if (!payment) return null;
  payment.applications = db.prepare(`
    SELECT a.*, po.po_number, po.status AS po_status
    FROM supplier_payment_applications a
    JOIN purchase_orders po ON po.id = a.purchase_order_id
    WHERE a.payment_id = ? ORDER BY a.id
  `).all(id);
  return payment;
}

function findPostedJournal(paymentId, event) {
  return db.prepare(`
    SELECT * FROM journal_entries
    WHERE source_type = ? AND source_id = ? AND source_event = ?
    LIMIT 1
  `).get(SOURCE_TYPE, paymentId, event) || null;
}

/**
 * Record + apply + post a supplier payment. Atomic: payment row, applications,
 * journal entry/lines and the audit event all succeed or all roll back.
 *
 * @param {object} args
 * @param {number} args.supplierId
 * @param {number} args.amount        cents, > 0
 * @param {Array}  args.applications  [{ purchaseOrderId, amount }] cents
 * @param {string} [args.method]      'cash' (default)
 * @param {string} [args.paidAt]      YYYY-MM-DD
 * @param {string} [args.notes]
 * @param {string} [args.idempotencyKey]
 * @param {string} [args.userId]
 * @returns {{ paid: boolean, payment: object, entry: object|null, reason?: string }}
 */
function recordPayment({
  supplierId,
  amount,
  applications,
  method = 'cash',
  paidAt,
  notes = '',
  idempotencyKey = '',
  userId = '',
} = {}) {
  const sid = parseInt(supplierId, 10) || 0;
  if (!sid) throw new Error('Supplier payment requires a supplier id');
  const supplier = db.prepare('SELECT id, name, is_active FROM suppliers WHERE id = ?').get(sid);
  if (!supplier) throw new Error(`Supplier #${sid} not found`);
  if (!supplier.is_active) throw new Error(`Supplier "${supplier.name}" is inactive`);

  const total = Math.round(Number(amount) || 0);
  if (!(total > 0)) throw new Error('Supplier payment amount must be a positive amount (cents)');

  const cashCode = METHOD_ACCOUNTS[String(method).toLowerCase()];
  if (!cashCode) throw new Error(`Unsupported payment method "${method}"`);

  if (!Array.isArray(applications) || applications.length === 0) {
    throw new Error('Supplier payment requires at least one application');
  }

  // Replay: caller-supplied key returns the existing payment, never a dupe.
  const replay = findByIdempotencyKey(idempotencyKey);
  if (replay) {
    return { paid: false, payment: getPayment(replay.id), entry: null, reason: 'duplicate idempotency key — returned existing payment' };
  }

  const date = assertDate(paidAt);

  // Normalize + validate applications against live outstanding (pre-check).
  const seenPo = new Set();
  const apps = [];
  let appliedTotal = 0;
  for (const raw of applications) {
    const poId = parseInt(raw.purchaseOrderId ?? raw.purchase_order_id, 10) || 0;
    if (!poId) throw new Error('Each application requires a purchaseOrderId');
    if (seenPo.has(poId)) throw new Error(`Duplicate application for purchase order #${poId}`);
    seenPo.add(poId);
    const amt = Math.round(Number(raw.amount) || 0);
    if (!(amt > 0)) throw new Error(`Application for PO #${poId} must be a positive amount`);
    const po = db.prepare('SELECT id, supplier_id, po_number FROM purchase_orders WHERE id = ?').get(poId);
    if (!po) throw new Error(`Purchase order #${poId} not found`);
    if (po.supplier_id !== sid) {
      throw new Error(`Purchase order ${po.po_number} does not belong to supplier "${supplier.name}"`);
    }
    const remaining = outstandingForPo(poId);
    if (amt > remaining) {
      throw new Error(`Overpayment on ${po.po_number}: applying ${amt} but only ${remaining} outstanding`);
    }
    apps.push({ poId, amount: amt });
    appliedTotal += amt;
  }
  if (appliedTotal !== total) {
    throw new Error(`Applications (${appliedTotal}) must equal payment amount (${total}) — over/under-application rejected`);
  }

  const payable = resolveAccount('2100');
  const cash = resolveAccount(cashCode);

  let paymentId = null;
  let entry = null;
  db.transaction(() => {
    const { document_number } = documentNumberService.generate('PAY');
    const res = db.prepare(`
      INSERT INTO supplier_payments
        (payment_no, supplier_id, method, amount, status, paid_at, notes, idempotency_key, created_by)
      VALUES (?, ?, ?, ?, 'recorded', ?, ?, ?, ?)
    `).run(document_number, sid, String(method).toLowerCase(), total, date,
      String(notes || ''), idempotencyKey ? String(idempotencyKey) : null, String(userId || ''));
    paymentId = res.lastInsertRowid;

    const insApp = db.prepare(`
      INSERT INTO supplier_payment_applications (payment_id, purchase_order_id, amount)
      VALUES (?, ?, ?)
    `);
    for (const a of apps) insApp.run(paymentId, a.poId, a.amount);

    const draft = journalService.createEntry({
      entry_date: date,
      description: `Supplier payment ${document_number} to ${supplier.name}`,
      lines: [
        { account_id: payable.id, debit: total, credit: 0, description: `${document_number} payable relief` },
        { account_id: cash.id, debit: 0, credit: total, description: `${document_number} cash paid` },
      ],
      source: { type: SOURCE_TYPE, id: paymentId, event: EVENT_RECORDED },
    });
    entry = journalService.postEntry(draft.id, userId || 'supplier-payment');

    eventService.emit(eventService.EVENT_TYPES.SUPPLIER_PAYMENT_RECORDED, eventService.ENTITY_TYPES.SUPPLIER_PAYMENT, paymentId, {
      userId: userId || '',
      payload: {
        payment_no: document_number,
        supplier_id: sid,
        amount: total,
        applications: apps,
      },
    });
  });

  return { paid: true, payment: getPayment(paymentId), entry };
}

/**
 * Reverse a posted payment: posts the opposite entry (Dr Cash / Cr AP) and
 * flips status to 'reversed'. The original payment + its applications remain as
 * immutable history; reversal is its own audited event. Idempotent — reversing
 * an already-reversed payment returns the existing state without re-posting.
 */
function reversePayment(paymentId, { reason = '', userId = '' } = {}) {
  const pid = parseInt(paymentId, 10) || 0;
  const payment = db.prepare('SELECT * FROM supplier_payments WHERE id = ?').get(pid);
  if (!payment) throw new Error(`Supplier payment #${pid} not found`);
  if (payment.status === 'reversed') {
    return { reversed: false, payment: getPayment(pid), entry: null, reason: 'already reversed' };
  }
  if (payment.status !== 'recorded') {
    throw new Error(`Supplier payment cannot be reversed from status "${payment.status}"`);
  }

  const payable = resolveAccount('2100');
  const cashCode = METHOD_ACCOUNTS[payment.method] || '1000';
  const cash = resolveAccount(cashCode);
  const total = Math.round(Number(payment.amount) || 0);

  let entry = null;
  db.transaction(() => {
    const draft = journalService.createEntry({
      entry_date: todayISO(),
      description: `Reversal of supplier payment ${payment.payment_no}`,
      lines: [
        { account_id: cash.id, debit: total, credit: 0, description: `${payment.payment_no} cash refund` },
        { account_id: payable.id, debit: 0, credit: total, description: `${payment.payment_no} payable restored` },
      ],
      source: { type: SOURCE_TYPE, id: pid, event: EVENT_REVERSED },
    });
    entry = journalService.postEntry(draft.id, userId || 'supplier-payment-reversal');

    db.prepare(`
      UPDATE supplier_payments
      SET status = 'reversed', reversed_by = ?, reversed_at = CURRENT_TIMESTAMP,
          reversal_reason = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(String(userId || ''), String(reason || ''), pid);

    eventService.emit(eventService.EVENT_TYPES.SUPPLIER_PAYMENT_REVERSED, eventService.ENTITY_TYPES.SUPPLIER_PAYMENT, pid, {
      userId: userId || '',
      payload: { payment_no: payment.payment_no, amount: total, reason: String(reason || '') },
    });
  });

  return { reversed: true, payment: getPayment(pid), entry };
}

function listPayments({ supplierId = null, limit = 100 } = {}) {
  const n = Math.min(Math.max(parseInt(limit) || 100, 1), 500);
  if (supplierId) {
    return db.prepare(`
      SELECT p.*, s.name AS supplier_name FROM supplier_payments p
      JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.supplier_id = ? ORDER BY p.id DESC LIMIT ?
    `).all(parseInt(supplierId, 10) || 0, n);
  }
  return db.prepare(`
    SELECT p.*, s.name AS supplier_name FROM supplier_payments p
    JOIN suppliers s ON s.id = p.supplier_id
    ORDER BY p.id DESC LIMIT ?
  `).all(n);
}

module.exports = {
  SOURCE_TYPE,
  EVENT_RECORDED,
  EVENT_REVERSED,
  METHOD_ACCOUNTS,
  receiptPayableForPo,
  appliedToPo,
  outstandingForPo,
  getPayment,
  findPostedJournal,
  recordPayment,
  reversePayment,
  listPayments,
};
