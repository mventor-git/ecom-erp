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
 * PO are allocated FIFO by (entry_date, journal id) across that PO's
 * recognition lines — deterministic and reconcilable:
 *   SUM(item remaining) == recognized(X) − applied(X)  (per PO)
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
 * Set-based payment-application totals active as of `asOf`, AGGREGATED per PO
 * (one row per PO — never an unbounded application-row load):
 * amount is credited to AP only through posted payment-recorded journals and
 * is restored by posted payment-reversed journals — journal existence is the
 * validity requirement (a payment without its posted journal NEVER counts).
 */
function appliedPerPoAsOf(asOf, supplierId) {
  const sql = `
    SELECT
      t.po_id                                  AS po_id,
      SUM(t.amount)                            AS applied_cents,
      COUNT(DISTINCT t.payment_id)             AS payments_count,
      GROUP_CONCAT(DISTINCT t.payment_no)      AS payment_refs
    FROM (
      SELECT DISTINCT
        a.purchase_order_id AS po_id,
        p.id                AS payment_id,
        p.payment_no        AS payment_no,
        a.amount            AS amount
      FROM supplier_payment_applications a
      JOIN supplier_payments p ON p.id = a.payment_id
      JOIN purchase_orders po ON po.id = a.purchase_order_id
      WHERE (? OR po.supplier_id = ?)
        AND EXISTS (
          SELECT 1 FROM journal_entries pj
          WHERE pj.source_type = 'supplier_payment' AND pj.source_id = p.id
            AND pj.source_event = 'payment-recorded' AND pj.status = 'posted'
            AND date(pj.entry_date) <= date(?)
        )
        AND NOT EXISTS (
          SELECT 1 FROM journal_entries rj
          WHERE rj.source_type = 'supplier_payment' AND rj.source_id = p.id
            AND rj.source_event = 'payment-reversed' AND rj.status = 'posted'
            AND date(rj.entry_date) <= date(?)
        )
    ) t
    GROUP BY t.po_id
  `;
  return db.prepare(sql).all(supplierId ? 0 : 1, supplierId || 0, asOf, asOf);
}

function asIntCents(v, label) {
  const n = Number(v);
  if (!Number.isInteger(n)) throw new Error(`AP aging: ${label} must be an integer number of cents (got ${v})`);
  return n;
}

/**
 * Pure, deterministic FIFO allocation of an aggregated applied total across
 * one PO's recognition lines (already ordered by entry_date, journal id).
 */
function allocateFifo(lines, appliedCentsTotal) {
  let remainingApplied = asIntCents(appliedCentsTotal, 'applied total');
  return lines.map((l) => {
    const appliedHere = Math.min(remainingApplied, asIntCents(l.recognized_cents, 'recognized line'));
    remainingApplied -= appliedHere;
    const rem = asIntCents(l.recognized_cents, 'recognized line') - appliedHere;
    return { ...l, allocated_applied_cents: appliedHere, remaining_cents: rem };
  });
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
  const appliedByPo = new Map(appliedPerPoAsOf(date, sup).map(r0 => [r0.po_id, r0]));

  // Group lines by PO, allocate applied FIFO, build item rows.
  const byPo = new Map();
  for (const l of lines) {
    if (!byPo.has(l.po_id)) byPo.set(l.po_id, []);
    byPo.get(l.po_id).push(l);
  }

  const allItems = [];
  for (const [poId, poLines] of byPo) {
    const appRow = appliedByPo.get(poId);
    const appliedTotal = appRow ? asIntCents(appRow.applied_cents, 'applied total') : 0;
    const paid = allocateFifo(poLines, appliedTotal);
    for (const it of paid) {
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
        applied_to_po_cents: appliedTotal,
        payments_on_po: appRow ? Number(appRow.payments_count) : 0,
        payment_refs: appRow ? String(appRow.payment_refs || '').split(',').filter(Boolean) : [],
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

module.exports = { getAgingReport, bucketFor, allocateFifo, BUCKET_ORDER, AGING_BASIS };
