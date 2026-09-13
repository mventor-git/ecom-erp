/**
 * Sales Posting Bridge — the canonical operational→accounting seam for sales
 * (mventor-ticket-086; made channel-complete in mventor-ticket-091).
 *
 * Every real settlement of an order (provider-verified payment, COD collected
 * at delivery, evidence-backed manual settlement) posts EXACTLY ONE entry:
 *   Dr Cash (order total) / Cr Revenue (order total)
 *   Dr COGS / Cr Inventory (same amount) — when costed lines exist
 *
 * 091 rules:
 *   · ONE posted sale journal per order across ALL channels — the source
 *     event is the immutable channel stamp (evidence text rides in the
 *     descriptions); a second channel may never create a second journal.
 *   · COGS may be derived from order_items cost snapshots when the caller
 *     has no fresh issue costs (a skipped/idempotent issue must not
 *     silently drop the COGS legs).
 *   · Refunds reverse through a NEW immutable journal (Dr Revenue / Cr Cash)
 *     mirroring the ORIGINAL posted amounts. Expense (COGS) and inventory
 *     legs are NEVER mirrored: a financial refund is not a physical goods
 *     return. One reversal per order, enforced by ux_journal_source.
 *
 * Accounts auto-provision from the neutral chart (accountChart); amounts
 * come only from verified sources (order total + bridge/snapshot costs).
 * Money is integer cents; corrections never edit or unpost — source of
 * truth stays the posted journal.
 */

const db = require('../db');
const journalService = require('./journalService');
const { SKELETON, resolveAccount } = require('./accountChart');

/** Canonical settlement source event for every channel since 091. */
const SOURCE_EVENT = 'sale-settled';
/** 086-era posted journals (live DBs hold these) — same economic event. */
const LEGACY_SALE_EVENTS = ['kashier-paid'];
const SALE_EVENTS = [SOURCE_EVENT, ...LEGACY_SALE_EVENTS];
/** Refund reversal event — one per order (ux_journal_source). */
const REVERSAL_EVENT = 'sale-reversed';

/** Journal created for this order's sale settlement (ANY status). */
function findOrderJournal(orderId) {
  return db.prepare(`
    SELECT * FROM journal_entries
    WHERE source_type = 'order' AND source_id = ? AND source_event = ?
    LIMIT 1
  `).get(orderId, SOURCE_EVENT)
    || db.prepare(`
      SELECT * FROM journal_entries
      WHERE source_type = 'order' AND source_id = ? AND source_event IN (${LEGACY_SALE_EVENTS.map(() => '?').join(',')})
      LIMIT 1
    `).get(orderId, ...LEGACY_SALE_EVENTS)
    || null;
}

function findReversalJournal(orderId) {
  return db.prepare(`
    SELECT * FROM journal_entries
    WHERE source_type = 'order' AND source_id = ? AND source_event = ?
    LIMIT 1
  `).get(orderId, REVERSAL_EVENT) || null;
}

/** Does this order have its sale BOOKED in the ledger? (gate: booked orders
 *  can only be corrected through the refund/reversal seam, never by a
 *  status change to cancelled.) */
function hasPostedSale(orderId) {
  const j = findOrderJournal(orderId);
  return !!(j && j.status === 'posted');
}

/**
 * Cost lines from order_items snapshots written when stock was actually
 * issued (072/073). cost_snapshot is the UNIT cost; per-line COGS is
 * unit × quantity. Lines without a snapshot (never costed/issued) are
 * honestly skipped — no invented numbers.
 */
function costsFromSnapshots(orderId) {
  return db.prepare(`
    SELECT product_id, quantity, cost_snapshot FROM order_items
    WHERE order_id = ? AND cost_snapshot IS NOT NULL AND cost_snapshot > 0
  `).all(orderId).map(r => ({
    productId: r.product_id,
    qty: r.quantity,
    unitCost: r.cost_snapshot,
  }));
}

/**
 * Post the canonical sale settlement for an order (idempotent, channel-safe).
 * Returns { posted, entry } — posted:false with the existing POSTED entry on
 * replay (never double-posts, whatever channel made it), posted:true on a
 * fresh post OR recovery of a stranded draft (retry-safe; a draft is never
 * returned as if posted). Throws loudly for real problems (missing order,
 * non-integer money, dead chart, closed-period refusal).
 *
 * evidence — optional short string (actor/method/reference) recorded in the
 * journal descriptions for operator traceability. It NEVER affects amounts.
 */
function postOrderSale(orderId, { costs = [], userId = '', evidence = '' } = {}) {
  const oid = parseInt(orderId, 10) || 0;
  if (!oid) throw new Error('postOrderSale requires an order id');
  const existing = findOrderJournal(oid);
  if (existing && existing.status === 'posted') {
    return { posted: false, entry: journalService.getEntry(existing.id) };
  }

  const order = db.prepare('SELECT id, total FROM orders WHERE id = ?').get(oid);
  if (!order) throw new Error(`Order #${oid} not found — cannot post a missing order`);
  const total = journalService.assertIntegerCents(order.total, `Order #${oid} total`);
  if (!(total > 0)) throw new Error(`Order #${oid} has no positive total — refusing to post`);

  // Stranded draft from a previously failed attempt: recover by posting
  // (stabilization P0#1 — never return a draft as replayed truth).
  if (existing) {
    return { posted: true, entry: journalService.postEntry(existing.id, userId || 'sales-settlement') };
  }

  // 091: callers without fresh issue costs (issue already happened, e.g.
  // COD issued at creation) derive COGS from the line cost snapshots.
  let costLines = costs;
  if (!Array.isArray(costLines) || costLines.length === 0) {
    costLines = costsFromSnapshots(oid);
  }

  const cash = resolveAccount('1000');
  const revenue = resolveAccount('4000');
  const cogs = resolveAccount('5000');
  const inventory = resolveAccount('1300');

  let cogsTotal = 0;
  for (const c of costLines) {
    const unit = c.unitCost == null ? 0 : journalService.assertIntegerCents(c.unitCost, `COGS unit cost (product ${c.productId ?? c.product_id})`);
    const qty = (c.qty ?? c.quantity) == null ? 0 : journalService.assertIntegerCents(c.qty ?? c.quantity, `COGS qty (product ${c.productId ?? c.product_id})`);
    if (unit > 0 && qty > 0) cogsTotal += unit * qty;
  }

  const ev = evidence ? ` — ${evidence}` : '';
  const lines = [
    { account_id: cash.id, debit: total, credit: 0, description: `Order #${oid} cash received${ev}` },
    { account_id: revenue.id, debit: 0, credit: total, description: `Order #${oid} revenue${ev}` },
  ];
  if (cogsTotal > 0) {
    lines.push({ account_id: cogs.id, debit: cogsTotal, credit: 0, description: `Order #${oid} COGS${ev}` });
    lines.push({ account_id: inventory.id, debit: 0, credit: cogsTotal, description: `Order #${oid} inventory relief${ev}` });
  }

  const draft = journalService.createEntry({
    description: `Order #${oid} sale settlement${ev}`,
    lines,
    source: { type: 'order', id: oid, event: SOURCE_EVENT },
  });
  const entry = journalService.postEntry(draft.id, userId || 'sales-settlement');
  return { posted: true, entry };
}

/**
 * Refund reversal (091): posts a NEW journal mirroring the cash/revenue legs
 * of the ORIGINAL posted sale — Dr Revenue / Cr Cash — never editing the
 * original. COGS/inventory legs deliberately stay: refunding money is not
 * receiving goods back (physical returns are a separate, operational fact).
 *
 * Returns { reversed:false, reason:'no posted sale journal' } when the order
 * was never booked (nothing to reverse — honest no-op, e.g. unpaid
 * cancellation refunds), and { reversed:false, already:true, entry } on
 * replay. Throws for forged/broken originals and closed-period refusals.
 */
function reverseOrderSale(orderId, { userId = '', reason = '' } = {}) {
  const oid = parseInt(orderId, 10) || 0;
  if (!oid) throw new Error('reverseOrderSale requires an order id');

  const existingRev = findReversalJournal(oid);
  if (existingRev && existingRev.status === 'posted') {
    return { reversed: false, already: true, entry: journalService.getEntry(existingRev.id) };
  }
  if (existingRev) {
    // stranded draft — recover by posting
    return { reversed: true, entry: journalService.postEntry(existingRev.id, userId || 'sales-reversal') };
  }

  const sale = findOrderJournal(oid);
  if (!sale) return { reversed: false, reason: 'no posted sale journal' };
  if (sale.status !== 'posted') {
    throw new Error(`Order #${oid} sale journal is not posted — reverse nothing; resolve the original posting first`);
  }

  const entry = journalService.getEntry(sale.id);
  // Mirror only the settlement legs: cash-side (asset DEBIT lines) and
  // revenue-side (revenue CREDIT lines). Expense lines and asset CREDIT
  // lines (inventory relief) are the goods story — untouched by a refund.
  const cleanReason = String(reason == null ? '' : reason).trim();
  const ev = cleanReason ? ` — reason: ${cleanReason}` : '';
  const lines = [];
  for (const l of (entry.lines || [])) {
    if (l.account_type === 'revenue' && l.credit > 0) {
      lines.push({ account_id: l.account_id, debit: l.credit, credit: 0, description: `Order #${oid} revenue reversed${ev}` });
    } else if (l.account_type === 'asset' && l.debit > 0 && l.account_code !== '1300') {
      lines.push({ account_id: l.account_id, debit: 0, credit: l.debit, description: `Order #${oid} cash refunded${ev}` });
    }
  }
  if (lines.length < 2) {
    throw new Error(`Order #${oid} posted sale has no cash/revenue legs to reverse — refusing an empty reversal`);
  }

  const draft = journalService.createEntry({
    description: `Refund of Order #${oid} sale${ev}`,
    lines,
    source: { type: 'order', id: oid, event: REVERSAL_EVENT },
  });
  return { reversed: true, entry: journalService.postEntry(draft.id, userId || 'sales-reversal') };
}

module.exports = {
  SKELETON,
  SOURCE_EVENT,
  SALE_EVENTS,
  REVERSAL_EVENT,
  resolveAccount,
  findOrderJournal,
  findReversalJournal,
  hasPostedSale,
  costsFromSnapshots,
  postOrderSale,
  reverseOrderSale,
};
