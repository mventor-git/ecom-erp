/**
 * Purchase Posting Bridge — goods-receipt postings (mventor-ticket-087).
 *
 * Owner decision: payable recognized AT RECEIPT (no supplier-invoice entity
 * exists). Each receipt movement posts exactly once:
 *   Dr Inventory (qty × unit cost) / Cr Payables (same)
 * Same seam rules as salesPosting: verified sources only (the movement row
 * itself), check-first idempotency + UNIQUE backstop, auto-provisioned
 * skeleton, post-commit best-effort at call sites. Zero-value receipts
 * (free goods) are honestly skipped, never zero-posted.
 */

const db = require('../db');
const journalService = require('./journalService');
const { resolveAccount } = require('./accountChart');

const SOURCE_EVENT = 'po-receipt';

function findPostedReceipt(movementId) {
  return db.prepare(`
    SELECT * FROM journal_entries
    WHERE source_type = 'inventory_movement' AND source_id = ? AND source_event = ?
    LIMIT 1
  `).get(movementId, SOURCE_EVENT) || null;
}

/**
 * Post one receipt movement. Returns { posted, entry } — posted:false with
 * the existing entry on replay, or { posted:false, reason } for zero-value
 * receipts. Throws loudly for non-receipts, missing movements, dead chart.
 */
function postReceiptMovement(movementId, { userId = '' } = {}) {
  const mid = parseInt(movementId, 10) || 0;
  if (!mid) throw new Error('postReceiptMovement requires a movement id');
  const existing = findPostedReceipt(mid);
  if (existing) return { posted: false, entry: journalService.getEntry(existing.id) };

  const m = db.prepare('SELECT * FROM inventory_movements WHERE id = ?').get(mid);
  if (!m) throw new Error(`Movement #${mid} not found — cannot post a missing receipt`);
  if (m.type !== 'receipt' || m.reference_type !== 'purchase_order') {
    throw new Error(`Movement #${mid} is not a purchase receipt — refusing to post`);
  }
  const qty = Math.round(Number(m.qty_change) || 0);
  const unit = Math.round(Number(m.unit_cost) || 0);
  const total = qty > 0 && unit > 0 ? qty * unit : 0;
  if (!(total > 0)) return { posted: false, reason: 'zero value receipt — nothing to post' };

  const inventory = resolveAccount('1300');
  const payable = resolveAccount('2100');

  const draft = journalService.createEntry({
    description: `PO receipt: ${qty} × product ${m.product_id} @ ${unit} (PO #${m.reference_id})`,
    lines: [
      { account_id: inventory.id, debit: total, credit: 0, description: `PO #${m.reference_id} inventory received` },
      { account_id: payable.id, debit: 0, credit: total, description: `PO #${m.reference_id} supplier payable` },
    ],
    source: { type: 'inventory_movement', id: mid, event: SOURCE_EVENT },
  });
  const entry = journalService.postEntry(draft.id, userId || 'purchase-receive');
  return { posted: true, entry };
}

module.exports = { SOURCE_EVENT, findPostedReceipt, postReceiptMovement };
