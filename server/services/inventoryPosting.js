/**
 * Inventory Posting Bridge — stock value ↔ GL (mventor-ticket-093).
 *
 * Rule: EVERY movement that changes inventory VALUE and is not already owned
 * by another bridge must reach the ledger, or be VISIBLE as unposted in the
 * reconciliation control. Ownership is exclusive per movement type:
 *
 *   receipt   → purchasePosting (087) posts Dr1300/Cr2100        (skipped here)
 *   issue     → sales settlement posts COGS via salesPosting (091) (skipped here)
 *   transfer / reservation / release → quantity promises / internal
 *               relocation (single entity) — GL-inert, never posted.
 *   opening_balance → Dr 1300 / Cr 3000 Owner's Equity           (POSTED here)
 *   adjustment / damage / count →
 *       out (net negative): Dr 5100 Inventory Adjustments / Cr 1300 (shrinkage)
 *       in  (net positive): Dr 1300 / Cr 5100 (gain reduces the account)
 *   correction / return referencing a BOOKED sale order →
 *       Dr 1300 / Cr 5000 COGS      (the physical goods-return event 091
 *                                     deliberately kept out of refunds)
 *   correction / return without a booked sale → skipped, honest reason
 *   return referencing a purchase_order (vendor return) →
 *       Dr 2100 AP / Cr 1300
 *
 * Value = |qty_change| × movement unit_cost; when the movement carries no
 * cost, products.cost_price is the documented stopgap valuation (line
 * description + journal payload say so explicitly — no silent fabrication);
 * if cost is unknown too, the movement is skipped with reason and the
 * reconciliation lists it until a real cost exists. Zero-value postings are
 * never faked. Money stays INTEGER cents; posting is period-gated
 * (journalService.postEntry) and one journal per movement via
 * ux_journal_source — replay returns the posted entry, a stranded draft is
 * recovered, a posted journal is immutable (sourced) like every other bridge.
 */

const db = require('../db');
const journalService = require('./journalService');
const salesPosting = require('./salesPosting');
const { resolveAccount } = require('./accountChart');

// All events this bridge owns share the stock_ prefix (single source query).
const EVENT_PREFIX = 'stock_'; // stock_opening | stock_adjustment | stock_return_cost | stock_vendor_return

function classify(m) {
  const t = String(m.type || '').toLowerCase();
  if (t === 'receipt') {
    if (m.reference_type === 'purchase_order') return { skip: 'posted by the purchase bridge (087)', owner: 'purchase' };
    return { skip: 'manual stock-in without a purchase order — record receipts through receiving, or correct via adjustment/count', owner: 'unowned' };
  }
  if (t === 'issue') return { skip: 'issue value is posted by sales settlement (091)' };
  if (t === 'transfer' || t === 'reservation' || t === 'release') return { skip: 'quantity-only movement — GL-inert (single entity)' };
  if (t === 'opening_balance') return { event: 'stock_opening', direction: 'in', offset: 'equity' };
  if (t === 'adjustment' || t === 'damage' || t === 'count') {
    const q = parseInt(m.qty_change, 10) || 0;
    if (q === 0) return { skip: 'zero-qty movement' };
    return { event: 'stock_adjustment', direction: q > 0 ? 'in' : 'out', offset: 'adjustment' };
  }
  if (t === 'correction' || t === 'return') {
    if (m.reference_type === 'order' && salesPosting.hasPostedSale(m.reference_id)) {
      return { event: 'stock_return_cost', direction: 'in', offset: 'cogs' };
    }
    if (m.reference_type === 'purchase_order') {
      return { event: 'stock_vendor_return', direction: 'out', offset: 'payable' };
    }
    return { skip: 'goods return without a booked sale in the ledger — nothing to reverse' };
  }
  return { skip: `movement type '${t}' is not ledger-owned here` };
}

/** Movement value in cents; fallback valuation is EXPLICIT, never silent. */
function valuedTotal(m) {
  const qty = Math.abs(parseInt(m.qty_change, 10) || 0);
  if (!(qty > 0)) return { total: 0, note: null };
  let unit = null; let note = null;
  if (m.unit_cost != null && Number.isFinite(Number(m.unit_cost)) && Number.isInteger(Number(m.unit_cost))) {
    unit = journalService.assertIntegerCents(m.unit_cost, `Movement #${m.id} unit_cost`);
  }
  if (!unit || unit <= 0) {
    const prod = db.prepare('SELECT cost_price FROM products WHERE id = ?').get(m.product_id);
    const pc = prod ? journalService.assertIntegerCents(prod.cost_price, `Product ${m.product_id} cost_price`) : 0;
    if (pc > 0) { unit = pc; note = 'valued at current product cost (movement carried no unit cost)'; }
    else return { total: 0, note: null, unknown_cost: true };
  }
  return { total: qty * unit, unit, note };
}

function findMovementJournal(movementId) {
  return db.prepare(`
    SELECT * FROM journal_entries
    WHERE source_type = 'inventory_movement' AND source_id = ? AND source_event LIKE 'stock_%'
    LIMIT 1
  `).get(movementId) || null;
}

/**
 * Post the GL effect of one movement. Returns { posted, entry } (posted:false
 * for skips/replays with a reason) — throws for real integrity failures.
 */
function postMovement(movementId, { userId = '' } = {}) {
  const mid = parseInt(movementId, 10) || 0;
  const actor = userId || 'inventory-posting';
  const existing = findMovementJournal(mid);
  if (existing && existing.status === 'posted') {
    return { posted: false, replay: true, entry: journalService.getEntry(existing.id) };
  }
  const m = db.prepare('SELECT * FROM inventory_movements WHERE id = ?').get(mid);
  if (!m) throw new Error(`Movement #${mid} not found — cannot post a missing movement`);
  const cls = classify(m);
  if (cls.skip) return { posted: false, reason: cls.skip };
  if (existing) {
    return { posted: true, entry: journalService.postEntry(existing.id, actor) };
  }

  const v = valuedTotal(m);
  if (!(v.total > 0)) {
    return { posted: false, reason: v.unknown_cost ? 'no unit cost on the movement and no product cost — value unknown' : 'zero value movement' };
  }
  const qty = Math.abs(parseInt(m.qty_change, 10) || 0);

  const inventory = resolveAccount('1300');
  let offsetAcct; let debit; let credit;
  const dirNote = cls.direction === 'in' ? 'stock in' : 'stock out';
  if (cls.offset === 'equity') { offsetAcct = resolveAccount('3000'); }
  else if (cls.offset === 'adjustment') { offsetAcct = resolveAccount('5100'); }
  else if (cls.offset === 'cogs') { offsetAcct = resolveAccount('5000'); }
  else { offsetAcct = resolveAccount('2100'); }
  if (cls.direction === 'in') {
    debit = inventory; credit = offsetAcct;
  } else {
    debit = offsetAcct; credit = inventory;
  }
  const valNote = v.note ? ` — ${v.note}` : '';
  const draft = journalService.createEntry({
    description: `Stock ${cls.event.replace('stock_', '')}: #${mid} ${dirNote} ${qty} units of product ${m.product_id} @ ${v.unit}${valNote}`,
    lines: [
      { account_id: debit.id, debit: v.total, credit: 0, description: `${debit.code} ${dirNote}` },
      { account_id: credit.id, debit: 0, credit: v.total, description: `${credit.code} contra (${cls.event})` },
    ],
    source: { type: 'inventory_movement', id: mid, event: cls.event },
  });
  const entry = journalService.postEntry(draft.id, actor);
  return { posted: true, entry };
}

/** Never let posting failures break the operational movement (same philosophy
 *  as 087/086 call sites): failure = logged + visible in reconciliation. */
function safePost(movementId, userId = '') {
  try { return postMovement(movementId, { userId }); }
  catch (err) {
    console.error(`[inventory-posting] movement ${movementId} not posted: ${err.message}`);
    return { posted: false, error: err.message };
  }
}

/* ───────────── ledger-vs-inventory reconciliation (control, never forces) */

function reconcile({ limit = 200 } = {}) {
  const ledgerRow = db.prepare(`
    SELECT COALESCE(SUM(l.debit), 0) - COALESCE(SUM(l.credit), 0) AS net
    FROM journal_lines l
    JOIN journal_entries e ON e.id = l.entry_id AND e.status = 'posted'
    JOIN accounts a ON a.id = l.account_id AND a.code = '1300'
  `).get();
  const bookRow = db.prepare(`
    SELECT COALESCE(SUM(l.remaining_quantity * l.unit_cost), 0) AS v,
           COUNT(*) AS c
    FROM inventory_cost_layers l WHERE l.remaining_quantity > 0
  `).get();

  // every movement whose type is ledger-owned here with NO journal yet
  const unposted = [];
  const rows = db.prepare(`
    SELECT m.id, m.type, m.reason, m.qty_change, m.unit_cost, m.reference_type, m.reference_id,
           m.product_id, m.created_at, p.cost_price
    FROM inventory_movements m
    LEFT JOIN products p ON p.id = m.product_id
    WHERE m.id NOT IN (
      SELECT j.source_id FROM journal_entries j
      WHERE j.source_type = 'inventory_movement' AND j.source_event LIKE 'stock_%'
        AND j.status = 'posted'
    )
    ORDER BY m.id DESC LIMIT 800
  `).all();
  let unpostedEligible = 0;
  for (const m of rows) {
    const cls = classify(m);
    if (cls.skip) continue;
    const v = valuedTotal(m);
    unpostedEligible += 1;
    if (unposted.length < limit) {
      unposted.push({
        movement_id: m.id, type: m.type, qty_change: m.qty_change,
        reference: m.reference_type ? `${m.reference_type}/${m.reference_id}` : 'manual',
        value_cents: v.total || null, valuation: v.note || (m.unit_cost ? 'movement cost' : null),
        can_post_now: v.total > 0,
        created_at: m.created_at,
      });
    }
  }

  // issues whose order never settled (informational: value left with no COGS).
  // Uses salesPosting.hasPostedSale — the ONE settlement-journal predicate.
  const issueRows = db.prepare(`
    SELECT m.id AS movement_id, m.reference_id AS order_id, m.qty_change, m.unit_cost, m.created_at
    FROM inventory_movements m
    WHERE m.type = 'issue' AND m.reference_type = 'order'
    ORDER BY m.id DESC LIMIT 300
  `).all();
  const unsettledIssues = [];
  for (const r of issueRows) {
    try {
      if (!salesPosting.hasPostedSale(r.order_id) && unsettledIssues.length < 100) unsettledIssues.push(r);
    } catch { /* unknown order reference — informational listing, never fatal */ }
  }

  // manual receipts created outside the purchase bridge: NO bridge owns them
  // (PO-less). Listed for honesty — they need real cost + PO context before
  // they carry GL effect; the bridge refuses to invent either.
  const orphansReceipts = db.prepare(`
    SELECT m.id AS movement_id, m.product_id, m.qty_change, m.unit_cost, m.reference_type, m.reference_id, m.created_at
    FROM inventory_movements m
    WHERE m.type = 'receipt' AND (m.reference_type IS NULL OR m.reference_type != 'purchase_order')
    ORDER BY m.id DESC LIMIT 50
  `).all();

  const ledger = ledgerRow.net;
  const book = bookRow.v;
  return {
    basis: 'ledger 1300 net (posted journals) vs cost-layer book value; differences listed, NEVER auto-repaired',
    ledger_inventory_cents: ledger,
    layer_book_value_cents: book,
    drift_cents: book - ledger,
    unposted_value_movements: { count: unpostedEligible, detail: unposted, truncated: unpostedEligible > unposted.length },
    issues_without_settlement: { count: unsettledIssues.length, detail: unsettledIssues },
    purchase_unowned_receipts: { count: orphansReceipts.length, detail: orphansReceipts },
  };
}

module.exports = {
  EVENT_PREFIX,
  classify, valuedTotal, findMovementJournal,
  postMovement, safePost, reconcile,
};
