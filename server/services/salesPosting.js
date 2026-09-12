/**
 * Sales Posting Bridge — first operational→accounting seam (mventor-ticket-086).
 *
 * Posts verified Kashier payments as balanced, posted entries:
 *   Dr Cash (order total, amount-matched) / Cr Revenue (order total)
 *   Dr COGS (bridge unit costs) / Cr Inventory (same)
 * Accounts auto-provision from a neutral skeleton on first use (owner
 * decision: visible, editable, guarded — never hardcoded IDs). Amounts come
 * ONLY from verified sources (matched order total + bridge costs).
 * Idempotent: check-first on (source_type, source_id, source_event) plus
 * UNIQUE backstop in schema. Safe to call post-commit and on replays.
 */

const db = require('../db');
const journalService = require('./journalService');
const { SKELETON, resolveAccount } = require('./accountChart');

const SOURCE_EVENT = 'kashier-paid';

/**
 * Journal created for this order's payment posting (ANY status — named
 * honestly). Only status='posted' means posted (stabilization P0#1/#10).
 */
function findOrderJournal(orderId) {
  return db.prepare(`
    SELECT * FROM journal_entries
    WHERE source_type = 'order' AND source_id = ? AND source_event = ?
    LIMIT 1
  `).get(orderId, SOURCE_EVENT) || null;
}

/**
 * Post a verified-paid order. Returns { posted, entry } — posted:false with
 * the existing POSTED entry on replay (never double-posts), posted:true on a
 * fresh post OR recovery of a stranded draft (retry-safe). A draft is never
 * returned as if it were posted. Throws loudly for real problems (missing
 * order, non-integer money, bad amounts, dead chart, closed-period refusal).
 */
function postOrderSale(orderId, { costs = [], userId = '' } = {}) {
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
    return { posted: true, entry: journalService.postEntry(existing.id, userId || 'kashier-webhook') };
  }

  const cash = resolveAccount('1000');
  const revenue = resolveAccount('4000');
  const cogs = resolveAccount('5000');
  const inventory = resolveAccount('1300');

  let cogsTotal = 0;
  for (const c of (costs || [])) {
    const unit = c.unitCost == null ? 0 : journalService.assertIntegerCents(c.unitCost, `COGS unit cost (product ${c.productId ?? c.product_id})`);
    const qty = (c.qty ?? c.quantity) == null ? 0 : journalService.assertIntegerCents(c.qty ?? c.quantity, `COGS qty (product ${c.productId ?? c.product_id})`);
    if (unit > 0 && qty > 0) cogsTotal += unit * qty;
  }

  const lines = [
    { account_id: cash.id, debit: total, credit: 0, description: `Order #${oid} cash received` },
    { account_id: revenue.id, debit: 0, credit: total, description: `Order #${oid} revenue` },
  ];
  if (cogsTotal > 0) {
    lines.push({ account_id: cogs.id, debit: cogsTotal, credit: 0, description: `Order #${oid} COGS` });
    lines.push({ account_id: inventory.id, debit: 0, credit: cogsTotal, description: `Order #${oid} inventory relief` });
  }

  const draft = journalService.createEntry({
    description: `Order #${oid} Kashier verified payment`,
    lines,
    source: { type: 'order', id: oid, event: SOURCE_EVENT },
  });
  const entry = journalService.postEntry(draft.id, userId || 'kashier-webhook');
  return { posted: true, entry };
}

module.exports = { SKELETON, SOURCE_EVENT, resolveAccount, findOrderJournal, postOrderSale };
