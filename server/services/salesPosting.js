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

function findPostedEntry(orderId) {
  return db.prepare(`
    SELECT * FROM journal_entries
    WHERE source_type = 'order' AND source_id = ? AND source_event = ?
    LIMIT 1
  `).get(orderId, SOURCE_EVENT) || null;
}

/**
 * Post a verified-paid order. Returns { posted, entry } — posted:false with
 * the existing entry on replay (never double-posts, never throws for dupes).
 * Throws loudly for real problems (missing order, bad amounts, dead chart).
 */
function postOrderSale(orderId, { costs = [], userId = '' } = {}) {
  const oid = parseInt(orderId, 10) || 0;
  if (!oid) throw new Error('postOrderSale requires an order id');
  const existing = findPostedEntry(oid);
  if (existing) return { posted: false, entry: journalService.getEntry(existing.id) };

  const order = db.prepare('SELECT id, total FROM orders WHERE id = ?').get(oid);
  if (!order) throw new Error(`Order #${oid} not found — cannot post a missing order`);
  const total = Math.round(Number(order.total) || 0);
  if (!(total > 0)) throw new Error(`Order #${oid} has no positive total — refusing to post`);

  const cash = resolveAccount('1000');
  const revenue = resolveAccount('4000');
  const cogs = resolveAccount('5000');
  const inventory = resolveAccount('1300');

  let cogsTotal = 0;
  for (const c of (costs || [])) {
    const unit = Math.round(Number(c.unitCost) || 0);
    const qty = Math.round(Number(c.qty ?? c.quantity) || 0);
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

module.exports = { SKELETON, SOURCE_EVENT, resolveAccount, findPostedEntry, postOrderSale };
