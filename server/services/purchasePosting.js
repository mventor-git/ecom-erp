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

/**
 * Journal created for this receipt movement (ANY status) — named honestly.
 * Callers must check `.status` explicitly: only 'posted' means posted.
 */
function findReceiptJournal(movementId) {
  return db.prepare(`
    SELECT * FROM journal_entries
    WHERE source_type = 'inventory_movement' AND source_id = ? AND source_event = ?
    LIMIT 1
  `).get(movementId, SOURCE_EVENT) || null;
}

/**
 * Post one receipt movement. Returns:
 *   { posted:true, entry }                — fresh post OR recovery of a draft
 *                                           stranded by a previously failed
 *                                           attempt (stabilization P0#1:
 *                                           a draft is NEVER reported as
 *                                           already-posted).
 *   { posted:false, entry }               — replay: journal already 'posted'.
 *   { posted:false, reason }              — zero-value receipt.
 * Throws loudly for non-receipts, missing movements, bad money, dead chart,
 * unavailable period control.
 */
function postReceiptMovement(movementId, { userId = '' } = {}) {
  const mid = parseInt(movementId, 10) || 0;
  if (!mid) throw new Error('postReceiptMovement requires a movement id');

  const actor = userId || 'purchase-receive';
  const existing = findReceiptJournal(mid);
  if (existing && existing.status === 'posted') {
    return { posted: false, entry: journalService.getEntry(existing.id) };
  }

  const m = db.prepare('SELECT * FROM inventory_movements WHERE id = ?').get(mid);
  if (!m) throw new Error(`Movement #${mid} not found — cannot post a missing receipt`);
  if (m.type !== 'receipt' || m.reference_type !== 'purchase_order') {
    throw new Error(`Movement #${mid} is not a purchase receipt — refusing to post`);
  }

  // Stranded DRAFT (a previous attempt created the entry but failed to post):
  // recover by posting it — retry must succeed, never return the draft as
  // "already posted" (stabilization P0#1).
  if (existing) {
    return { posted: true, entry: journalService.postEntry(existing.id, actor) };
  }

  // Money integrity at the canonical boundary: stored movement values MUST be
  // integer cents; never silently round what the ledger will carry.
  const qty = journalService.assertIntegerCents(m.qty_change, `Movement #${mid} qty_change`);
  const unit = m.unit_cost == null ? 0 : journalService.assertIntegerCents(m.unit_cost, `Movement #${mid} unit_cost`);
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
  const entry = journalService.postEntry(draft.id, actor);
  return { posted: true, entry };
}

module.exports = { SOURCE_EVENT, findReceiptJournal, postReceiptMovement };
