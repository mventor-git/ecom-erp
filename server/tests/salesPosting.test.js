/**
 * First posting bridge — mventor-ticket-086.
 * Verified-payment money writes balanced posted entries from verified
 * sources only; skeleton auto-provisions; replays never double-post.
 * Full cleanup (posted rows deleted directly in teardown only).
 */
const db = require('../db');
const salesPosting = require('../services/salesPosting');

const CODES = ['1000', '1200', '1300', '2100', '4000', '5000'];
let catId = null;
let pid = null;
const entryIds = [];
const orderIds = [];
const customerIds = [];

beforeAll(async () => {
  await db.initPromise;
  catId = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get().id;
  pid = db.prepare(
    'INSERT INTO products (name, price, cost_price, category_id, active, stock) VALUES (?, 5000, 1234, ?, 1, 0)'
  ).run('jest-086-post', catId).lastInsertRowid;
  // Provision the full skeleton up front (idempotent): postings must never
  // depend on whichever subset a previous test happened to create.
  for (const code of CODES) salesPosting.resolveAccount(code);
});

function fixtureOrder(total = 10000) {
  const cid = db.prepare('INSERT INTO customers (email, name, google_id) VALUES (?, ?, ?)')
    .run('jest086-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + '@test.com', 'jest086', 'guest_jest086_' + Date.now().toString(36)).lastInsertRowid;
  customerIds.push(cid);
  const oid = db.prepare(
    "INSERT INTO orders (customer_id, total, status, items, price_list_code) VALUES (?, ?, 'pending', ?, 'retail')"
  ).run(cid, total, JSON.stringify([{ product_id: pid, name: 'x', qty: 2, price: 5000 }])).lastInsertRowid;
  orderIds.push(oid);
  return oid;
}

afterEach(() => {
  db.prepare("DELETE FROM events WHERE entity_type = 'journal' AND entity_id NOT IN (SELECT id FROM journal_entries)").run();
});

afterAll(() => {
  for (const eid of entryIds.splice(0)) {
    db.prepare('DELETE FROM journal_lines WHERE entry_id = ?').run(eid);
    db.prepare('DELETE FROM journal_entries WHERE id = ?').run(eid);
  }
  for (const oid of orderIds.splice(0)) {
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(oid);
    db.prepare('DELETE FROM orders WHERE id = ?').run(oid);
  }
  for (const cid of customerIds.splice(0)) {
    try { db.prepare('DELETE FROM customers WHERE id = ?').run(cid); } catch {}
  }
  // Skeleton accounts intentionally PERSIST (provision-once master data —
  // deleting shared codes caused cross-suite FK collisions; see ticket).
  db.prepare('DELETE FROM products WHERE id = ?').run(pid);
  db.prepare("DELETE FROM events WHERE entity_type = 'journal' AND entity_id NOT IN (SELECT id FROM journal_entries)").run();
  db.saveDb();
});

function linesOf(eid) {
  return db.prepare('SELECT a.code, l.debit, l.credit FROM journal_lines l JOIN accounts a ON a.id = l.account_id WHERE l.entry_id = ? ORDER BY l.id').all(eid);
}

describe('first posting bridge (086)', () => {
  test('verified payment posts balanced 4-line entry + provisions skeleton', () => {
    const oid = fixtureOrder();
    const r = salesPosting.postOrderSale(oid, { costs: [{ productId: pid, qty: 2, unitCost: 777 }], userId: 'jest086' });
    expect(r.posted).toBe(true);
    entryIds.push(r.entry.id);
    expect(r.entry.status).toBe('posted');
    expect(r.entry.source_type).toBe('order');
    expect(r.entry.source_id).toBe(oid);
    expect(linesOf(r.entry.id)).toEqual([
      { code: '1000', debit: 10000, credit: 0 },
      { code: '4000', debit: 0, credit: 10000 },
      { code: '5000', debit: 1554, credit: 0 },
      { code: '1300', debit: 0, credit: 1554 },
    ]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM accounts WHERE code IN ('1000','1200','1300','2100','4000','5000')").get().n).toBe(6);
  });
  test('replay returns existing without double-posting', () => {
    const oid = fixtureOrder();
    const first = salesPosting.postOrderSale(oid, { costs: [], userId: 'jest086' });
    entryIds.push(first.entry.id);
    expect(first.posted).toBe(true);
    expect(linesOf(first.entry.id).length).toBe(2); // no costs → cash/revenue only
    const second = salesPosting.postOrderSale(oid, { costs: [], userId: 'jest086' });
    expect(second.posted).toBe(false);
    expect(second.entry.id).toBe(first.entry.id);
    expect(db.prepare('SELECT COUNT(*) AS n FROM journal_entries WHERE source_type = ? AND source_id = ?').get('order', oid).n).toBe(1);
  });
  test('missing order and zero total throw loudly', () => {
    expect(() => salesPosting.postOrderSale(999999999, {})).toThrow(/not found/);
    const oid = fixtureOrder(0);
    expect(() => salesPosting.postOrderSale(oid, {})).toThrow(/no positive total/);
  });
  test('inactive skeleton account refuses loudly', () => {
    salesPosting.resolveAccount('1000');
    db.prepare("UPDATE accounts SET is_active = 0 WHERE code = '1000'").run();
    try {
      const oid = fixtureOrder();
      expect(() => salesPosting.postOrderSale(oid, {})).toThrow(/inactive/);
    } finally {
      db.prepare("UPDATE accounts SET is_active = 1 WHERE code = '1000'").run();
    }
  });
});
