/**
 * AP Aging Report — mventor-ticket-090.
 *
 * DERIVED FROM POSTED ACCOUNTING TRUTH ONLY (ADR-014 / canonical model):
 *   payable recognition = posted 087 receipt journals crediting account 2100
 *     (source_type='inventory_movement', source_event='po-receipt',
 *      status='posted') — accounting date = journal_entries.entry_date.
 *   payment application = supplier_payment_applications, active as of date X
 *     iff the payment's POSTED payment-recorded journal has entry_date <= X
 *     AND NO posted payment-reversed journal for it has entry_date <= X.
 *     (recordPayment persists journal entry_date == paid_at; reversePayment
 *     posts the reversal with entry_date = its own business day — so the
 *     JOURNAL dates are the temporal contract; drafts never count.)
 *   NO mutable AP counter. NO PO-status shortcut. NO invoice pseudo-dates.
 *
 * AGING BASIS (documented, honest limitation): recognition-date aging.
 * The current architecture has no supplier-invoice/payment-terms entity, so
 * contractual due-date aging is NOT offered; an item's age = as_of date −
 * its posted recognition journal's entry_date (UTC calendar days).
 * po.expected_at is a commercial ETA field and is deliberately NOT used.
 *
 * OPEN PAYABLE ITEM = one posted AP recognition journal line. Payments on a
 * PO are allocated in causally-constrained FIFO order: a payment may reduce
 * ONLY lines whose entry_date <= the payment's own posted journal date,
 * processed by (payment date, application id); lines are consumed oldest
 * first. Amounts that a payment cannot apply to any pre-existing line are
 * carried as UNAPPLIED (pre-liability settlement — no advances/prepayments
 * entity exists, so nothing is invented and nothing is subtracted from a
 * future recognition line). Deterministic and reconcilable per PO:
 *   SUM(item remaining) == recognized(X) − applied-within-lines(X)
 *   raw applications(X)   = applied-within-lines(X) + unapplied_advance(X)
 *
 * BUCKETS (integer day arithmetic, no overlaps):
 *   0          -> current_zero   (recognized up to and including X)
 *   1..30      -> days_1_30
 *   31..60     -> days_31_60
 *   61..90     -> days_61_90
 *   91+        -> days_90_plus   (label "90+"; membership is > 90 days)
 *
 * Money: INTEGER cents end-to-end (no Math.round anywhere in this file).
 * Performance: fixed number of set-based queries (recognition items, applied
 * aggregates, plus one PO-metadata join) — allocation is pure JS over the
 * already-grouped, bounded lines; no N+1.
 */
const db = require('../db');
const journalService = require('./journalService'); // canonical validators + today rule

const AGING_BASIS = 'recognition-date (no supplier-invoice/payment-terms entity exists in this architecture; po.expected_at is a commercial field and is not used)';

const BUCKET_ORDER = ['current_zero', 'days_1_30', 'days_31_60', 'days_61_90', 'days_90_plus'];

function bucketFor(days) {
  if (!Number.isInteger(days) || days < 0) throw new Error(`AP aging: invalid days_aged ${days} (negative recognition is impossible as-of later dates)`);
  if (days === 0) return 'current_zero';
  if (days <= 30) return 'days_1_30';
  if (days <= 60) return 'days_31_60';
  if (days <= 90) return 'days_61_90';
  return 'days_90_plus';
}

function assertAsOf(raw) {
  const s = String(raw == null ? '' : raw).trim();
  if (!s) throw new Error('AP aging requires an explicit as_of date (YYYY-MM-DD)');
  if (!journalService.isValidCalendarDate(s)) {
    throw new Error(`Invalid as_of "${raw}" — expected real calendar date in YYYY-MM-DD`);
  }
  return s;
}

/**
 * Set-based recognition lines (open payable items) as of `asOf`, per PO:
 * each POSTED receipt-AP credit line with journal entry_date <= asOf.
 */
function recognitionItemsAsOf(asOf, supplierId) {
  const sql = `
    SELECT
      m.reference_id                    AS po_id,
      je.id                             AS journal_entry_id,
      je.entry_no                       AS journal_entry_no,
      je.entry_date                     AS recognized_at,
      jl.credit                         AS recognized_cents,
      po.po_number                      AS po_number,
      po.supplier_id                    AS supplier_id,
      po.status                         AS po_status,
      s.name                            AS supplier_name
    FROM journal_entries je
    JOIN journal_lines jl ON jl.entry_id = je.id
    JOIN accounts a ON a.id = jl.account_id AND a.code = '2100'
    JOIN inventory_movements m ON m.id = je.source_id
    JOIN purchase_orders po ON po.id = m.reference_id
    JOIN suppliers s ON s.id = po.supplier_id
    WHERE je.status = 'posted'
      AND je.source_type = 'inventory_movement'
      AND je.source_event = 'po-receipt'
      AND m.reference_type = 'purchase_order'
      AND date(je.entry_date) <= date(?)
      AND jl.credit > 0
      ${supplierId ? 'AND po.supplier_id = ?' : ''}
    ORDER BY m.reference_id ASC, je.entry_date ASC, je.id ASC
  `;
  return db.prepare(sql).all(...(supplierId ? [asOf, supplierId] : [asOf]));
}

/**
 * Per-PAYMENT application rows active as of `asOf` — one row per (PO, payment)
 * carrying the payment's posted journal date. Posted payment-recorded journal
 * existence is the validity requirement (a payment without its posted journal
 * NEVER counts); a posted payment-reversed journal up to asOf neutralizes the
 * payment (liability restored) per the canonical 088 model.
 */
function paymentsAsOf(asOf, supplierId) {
  const sql = `
    SELECT
      a.purchase_order_id                   AS po_id,
      p.id                                  AS payment_id,
      p.payment_no                          AS payment_no,
      pj.entry_date                         AS applied_at,
      MIN(a.id)                             AS first_application_id,
      SUM(a.amount)                         AS applied_cents
    FROM supplier_payment_applications a
    JOIN supplier_payments p ON p.id = a.payment_id
    JOIN purchase_orders po ON po.id = a.purchase_order_id
    JOIN journal_entries pj
      ON pj.source_type = 'supplier_payment' AND pj.source_id = p.id
     AND pj.source_event = 'payment-recorded' AND pj.status = 'posted'
     AND date(pj.entry_date) <= date(?)
    WHERE (? OR po.supplier_id = ?)
      AND NOT EXISTS (
        SELECT 1 FROM journal_entries rj
        WHERE rj.source_type = 'supplier_payment' AND rj.source_id = p.id
          AND rj.source_event = 'payment-reversed' AND rj.status = 'posted'
          AND date(rj.entry_date) <= date(?)
      )
    GROUP BY a.purchase_order_id, p.id
  `;
  return db.prepare(sql).all(asOf, supplierId ? 0 : 1, supplierId || 0, asOf);
}

function asIntCents(v, label) {
  const n = Number(v);
  if (!Number.isInteger(n)) throw new Error(`AP aging: ${label} must be an integer number of cents (got ${v})`);
  return n;
}

/**
 * HISTORICAL CAUSALITY INVARIANT (hardening follow-up to 090, ADR-016):
 * a payment application may only reduce recognition lines that EXISTED BY THE
 * PAYMENT'S OWN ACCOUNTING DATE. A back-dated payment (journal dated before
 * every open line of its PO — e.g. payment Jan 10 vs receipt Jan 20) could not
 * have settled a payable that did not yet exist: it is carried as UNAPPLIED
 * at every as-of date (the model has no advances/prepayments entity, so it is
 * neither subtracted from a future recognition line nor invented away), while
 * causally-valid payment sequences keep the exact FIFO allocation behavior.
 *
 * Deterministic order: payments applied by (applied_at, first_application_id);
 * each payment consumes still-open eligible lines (entry_date <= payment date)
 * oldest-first (entry_date, journal id).
 *
 * Pure arithmetic over already-fetched bounded rows — no queries here.
 */
function allocateCausalFifo(lines, poPayments) {
  const work = lines.map((l) => ({
    ...l,
    recognized_cents: asIntCents(l.recognized_cents, 'recognized line'),
    allocated_applied_cents: 0,
    remaining_cents: asIntCents(l.recognized_cents, 'recognized line'),
    applied_payment_nos: [],
  }));
  const payments = [...poPayments].sort((a, b) =>
    String(a.applied_at).localeCompare(String(b.applied_at)) ||
    (asIntCents(a.first_application_id, 'application id') - asIntCents(b.first_application_id, 'application id')));
  let unapplied = 0;
  for (const pay of payments) {
    let want = asIntCents(pay.applied_cents, 'payment applied cents');
    for (const line of work) { // input ordered by (entry_date, journal id)
      if (want <= 0) break;
      if (String(line.recognized_at) > String(pay.applied_at)) continue; // line created AFTER this payment's date
      const room = line.remaining_cents;
      if (room <= 0) continue;
      const take = Math.min(room, want);
      line.allocated_applied_cents += take;
      line.remaining_cents -= take;
      line.applied_payment_nos.push(pay.payment_no);
      want -= take;
    }
    if (want > 0) unapplied += want; // no payable existed by this payment's accounting date
  }
  for (const line of work) line.applied_payment_nos = line.applied_payment_nos.join(','); // per-line traceability only
  return { lines: work, unapplied_advance_cents: unapplied };
}

// (fromDate <= toDate guaranteed by the query cutoff; UTC whole-day math, no SQL)
function daysBetween(fromDate, toDate) {
  const d = Math.round((Date.parse(toDate + 'T00:00:00Z') - Date.parse(fromDate + 'T00:00:00Z')) / 86400000);
  if (!Number.isInteger(d)) throw new Error('AP aging: non-integer day difference');
  return d;
}

/**
 * Main report. Returns { as_of, basis, buckets, items, summary, control/trace }.
 * items = OPEN recognition lines (remaining>0), paginated (limit/offset).
 * summary + control totals ALWAYS computed over the FULL filtered set.
 */
function getAgingReport({ asOf, supplierId = null, limit = 200, offset = 0 } = {}) {
  const date = assertAsOf(asOf);
  const sup = supplierId ? parseInt(supplierId, 10) : null;
  if (supplierId && !sup) throw new Error(`Invalid supplier_id "${supplierId}"`);
  const lim = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500);
  const off = Math.max(parseInt(offset, 10) || 0, 0);

  const lines = recognitionItemsAsOf(date, sup);
  const paymentsByPo = new Map();
  for (const pay of paymentsAsOf(date, sup)) {
    if (!paymentsByPo.has(pay.po_id)) paymentsByPo.set(pay.po_id, []);
    paymentsByPo.get(pay.po_id).push(pay);
  }

  // Group lines by PO, apply payments causally, build item rows.
  const byPo = new Map();
  for (const l of lines) {
    if (!byPo.has(l.po_id)) byPo.set(l.po_id, []);
    byPo.get(l.po_id).push(l);
  }

  const allItems = [];
  for (const [poId, poLines] of byPo) {
    const poPayments = paymentsByPo.get(poId) || [];
    const { lines: allocated, unapplied_advance_cents: unapplied } = allocateCausalFifo(poLines, poPayments);
    const appliedPaymentNos = new Set();
    for (const l of allocated) String(l.applied_payment_nos || '').split(',').filter(Boolean).forEach((n0) => appliedPaymentNos.add(n0));
    for (const it of allocated) {
      if (it.remaining_cents <= 0) continue; // fully covered by as-of X
      const days = daysBetween(it.recognized_at, date);
      const bucket = bucketFor(days);
      allItems.push({
        journal_entry_no: it.journal_entry_no,
        source_reference: it.po_number,
        po_id: it.po_id,
        po_status: it.po_status,
        supplier_id: it.supplier_id,
        supplier_name: it.supplier_name,
        recognized_at: it.recognized_at,
        original_recognized_cents: asIntCents(it.recognized_cents, 'recognized'),
        applied_to_po_cents: poPayments.reduce((s, x) => s + asIntCents(x.applied_cents, 'applied'), 0),
        applied_within_lines_cents: allocated.reduce((s, x) => s + x.allocated_applied_cents, 0),
        unapplied_advance_cents: unapplied, // payments posted before any line existed (rule: never subtract from future lines)
        payments_on_po: poPayments.length,
        payment_refs: [...appliedPaymentNos].sort(),
        allocated_applied_cents: it.allocated_applied_cents,
        remaining_cents: it.remaining_cents,
        days_aged: days,
        bucket,
      });
    }
  }

  // Deterministic order
  allItems.sort((a, b) => a.supplier_name.localeCompare(b.supplier_name) || String(a.source_reference).localeCompare(String(b.source_reference)) || a.journal_entry_no.localeCompare(b.journal_entry_no) || a.recognized_at.localeCompare(b.recognized_at));

  const buckets = {};
  for (const b of BUCKET_ORDER) buckets[b] = 0;
  const summaryBySupplier = new Map();
  let totalOutstanding = 0;
  for (const it of allItems) {
    buckets[it.bucket] += it.remaining_cents;
    totalOutstanding += it.remaining_cents;
    let row = summaryBySupplier.get(it.supplier_id);
    if (!row) {
      row = { supplier_id: it.supplier_id, supplier_name: it.supplier_name, open_items: 0, oldest_recognized_at: it.recognized_at, ...Object.fromEntries(BUCKET_ORDER.map(k => [k, 0])) };
      summaryBySupplier.set(it.supplier_id, row);
    }
    row[it.bucket] += it.remaining_cents;
    row.total_outstanding_cents = (row.total_outstanding_cents || 0) + it.remaining_cents;
    row.open_items += 1;
    if (it.recognized_at < row.oldest_recognized_at) row.oldest_recognized_at = it.recognized_at;
  }
  const summary = [...summaryBySupplier.values()].sort((a, b) => a.supplier_name.localeCompare(b.supplier_name));

  const bucketSum = BUCKET_ORDER.reduce((s, k) => s + buckets[k], 0);
  const summarySum = summary.reduce((s, r) => s + (r.total_outstanding_cents || 0), 0);
  const reconciled = bucketSum === totalOutstanding && summarySum === totalOutstanding;

  return {
    as_of: date,
    aging_basis: AGING_BASIS,
    limit: lim, offset: off,
    items: allItems.slice(off, off + lim), // paginated view of OPEN items
    open_items_count: allItems.length,
    total_outstanding_cents: totalOutstanding, // ALWAYS full-scope control
    buckets,
    summary,
    reconciliation: {
      buckets_sum_cents: bucketSum,
      summary_sum_cents: summarySum,
      report_total_cents: totalOutstanding,
      buckets_minus_total: bucketSum - totalOutstanding,
      summary_minus_total: summarySum - totalOutstanding,
      reconciled,
    },
  };
}

module.exports = { getAgingReport, bucketFor, allocateCausalFifo, BUCKET_ORDER, AGING_BASIS };
