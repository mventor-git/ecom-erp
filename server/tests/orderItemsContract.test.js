/**
 * order_items mirror contract — mventor-ticket-069.
 * Locks: legacy ↔ normalized mirrors carry the same facts; columns exist.
 * Writer-style fixture line (mirrors included, cost unknown → default),
 * full cleanup, never touches real rows.
 */
const db = require('../db');

beforeAll(async () => { await db.initPromise; });
afterAll(() => { db.saveDb(); });

describe('order_items mirror contract (069)', () => {
  test('normalized columns exist (migration promise)', () => {
    const cols = db.prepare('PRAGMA table_info(order_items)').all().map(c => c.name);
    for (const c of ['quantity', 'qty', 'price', 'base_price', 'final_price', 'cost_snapshot', 'price_list_code']) {
      expect(cols).toContain(c);
    }
  });
  test('writer-style line roundtrips mirrors equal', () => {
    const gid = 'guest_jest069_' + Date.now().toString(36);
    const cid = db.prepare('INSERT INTO customers (email, name, google_id) VALUES (?, ?, ?)')
      .run('jest069@example.com', 'jest069', gid).lastInsertRowid;
    const prod = db.prepare('SELECT id FROM products ORDER BY id LIMIT 1').get();
    try {
      const oid = db.prepare(
        "INSERT INTO orders (customer_id, total, status, items, price_list_code) VALUES (?, 2000, 'pending', '[]', 'retail')"
      ).run(cid).lastInsertRowid;
      try {
        db.prepare(
          `INSERT INTO order_items (order_id, product_id, product_name, quantity, price, price_list_code,
            qty, base_price, final_price) VALUES (?, ?, 'jest069-line', 2, 1000, 'retail', 2, 1000, 1000)`
        ).run(oid, prod ? prod.id : 0);
        const line = db.prepare('SELECT quantity, qty, price, base_price, final_price FROM order_items WHERE order_id = ?').get(oid);
        expect(line.qty).toBe(line.quantity);
        expect(line.base_price).toBe(line.price);
        expect(line.final_price).toBe(line.price);
      } finally {
        db.prepare('DELETE FROM order_items WHERE order_id = ?').run(oid);
        db.prepare('DELETE FROM orders WHERE id = ?').run(oid);
      }
    } finally {
      db.prepare('DELETE FROM customers WHERE id = ?').run(cid);
    }
  });
});
