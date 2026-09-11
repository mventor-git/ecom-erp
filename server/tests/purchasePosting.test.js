/**
 * Purchase receipt postings — mventor-ticket-087.
 * Receipt movements post Dr Inventory / Cr Payables at unit cost; replays
 * dedupe; non-receipts and zero-value receipts never post. Full cleanup.
 */
const db = require('../db');
const inventoryService = require('../services/inventoryService');
const purchasePosting = require('../services/purchasePosting');

let catId = null;
let whId = null;
let pid = null;
const entryIds = [];

beforeAll(async () => {
  await db.initPromise;
  catId = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get().id;
  whId = db.prepare('SELECT id FROM warehouses ORDER BY id LIMIT 1').get().id;
  pid = db.prepare(
    'INSERT INTO products (name, price, cost_price, category_id, active, stock, default_warehouse_id) VALUES (?, 2000, 900, ?, 1, 0, ?)'
  ).run('jest-087-receipt', catId, whId).lastInsertRowid;
});

function receipt(qty, unitCost) {
  return inventoryService.createMovement({
    productId: pid, warehouseId: whId, type: 'receipt',
    reason: 'jest087', referenceType: 'purchase_order', referenceId: 424242,
    qtyChange: qty, unitCost, note: 'jest087', userId: 'jest087',
  });
}

afterEach(() => {
  for (const eid of entryIds.splice(0)) {
    db.prepare('DELETE FROM journal_lines WHERE entry_id = ?').run(eid);
    db.prepare('DELETE FROM journal_entries WHERE id = ?').run(eid);
  }
  db.prepare("DELETE FROM events WHERE user_id = 'jest087'").run();
});

afterAll(() => {
  db.prepare('DELETE FROM inventory WHERE product_id = ?').run(pid);
  db.prepare('DELETE FROM inventory_movements WHERE product_id = ?').run(pid);
  db.prepare('DELETE FROM inventory_cost_layers WHERE product_id = ?').run(pid);
  db.prepare('DELETE FROM products WHERE id = ?').run(pid);
  db.prepare("DELETE FROM events WHERE user_id = 'jest087'").run();
  db.saveDb();
});

function linesOf(eid) {
  return db.prepare('SELECT a.code, l.debit, l.credit FROM journal_lines l JOIN accounts a ON a.id = l.account_id WHERE l.entry_id = ? ORDER BY l.id').all(eid);
}

describe('purchase receipt postings (087)', () => {
  test('receipt posts Dr Inventory / Cr Payables at unit cost', () => {
    const m = receipt(5, 1000);
    const r = purchasePosting.postReceiptMovement(m.id, { userId: 'jest087' });
    expect(r.posted).toBe(true);
    entryIds.push(r.entry.id);
    expect(r.entry.status).toBe('posted');
    expect(linesOf(r.entry.id)).toEqual([
      { code: '1300', debit: 5000, credit: 0 },
      { code: '2100', debit: 0, credit: 5000 },
    ]);
  });
  test('replay returns existing without double-posting', () => {
    const m = receipt(2, 1000);
    const first = purchasePosting.postReceiptMovement(m.id, { userId: 'jest087' });
    entryIds.push(first.entry.id);
    const second = purchasePosting.postReceiptMovement(m.id, { userId: 'jest087' });
    expect(second.posted).toBe(false);
    expect(second.entry.id).toBe(first.entry.id);
    expect(db.prepare("SELECT COUNT(*) AS n FROM journal_entries WHERE source_type = 'inventory_movement' AND source_id = ?").get(m.id).n).toBe(1);
  });
  test('zero-value receipt skips honestly; non-receipt and missing throw', () => {
    const free = receipt(3, 0);
    expect(purchasePosting.postReceiptMovement(free.id, {})).toEqual({ posted: false, reason: expect.any(String) });
    const issue = inventoryService.createMovement({
      productId: pid, warehouseId: whId, type: 'issue', reason: 'jest087',
      referenceType: 'order', referenceId: 424243, qtyChange: -1, unitCost: 900, note: 'jest087', userId: 'jest087',
    });
    expect(() => purchasePosting.postReceiptMovement(issue.id, {})).toThrow(/not a purchase receipt/);
    expect(() => purchasePosting.postReceiptMovement(999999999, {})).toThrow(/not found/);
  });
});
