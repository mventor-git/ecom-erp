/**
 * JSON↔rows duality locks — mventor-ticket-071.
 * The single builder maps priced JSON items to line rows (mirrors equal,
 * variants preserved, invalid skipped); fixture roundtrip proves the full
 * writer row is accepted. Full cleanup, never touches real rows.
 */
const db = require('../db');
const { mapLineRow, buildLineRows, insertLineRows } = require('../services/orderLines');

beforeAll(async () => { await db.initPromise; });
afterAll(() => { db.saveDb(); });

describe('order lines builder (071)', () => {
  test('maps priced item with mirrors + variants', () => {
    const { rows, skipped } = buildLineRows(1,
      [{ product_id: 9, name: 'W', qty: 2, price: 5000, color: 'red', size: 'M' }], 'retail');
    expect(skipped).toEqual([]);
    expect(rows).toEqual([{
      order_id: 1, product_id: 9, product_name: 'W', quantity: 2, price: 5000,
      variant_color: 'red', variant_size: 'M', price_list_code: 'retail',
      qty: 2, base_price: 5000, final_price: 5000,
    }]);
  });
  test('accepts legacy id key + quantity key, nulls absent variants', () => {
    const { rows } = buildLineRows(1, [{ id: 7, quantity: 1, price: 100 }], 'offer');
    expect(rows[0]).toMatchObject({ product_id: 7, quantity: 1, qty: 1, variant_color: null, price_list_code: 'offer' });
  });
  test('skips invalid lines without throwing', () => {
    expect(mapLineRow(1, { quantity: 1, price: 5 }, 'retail').skipped.reason).toBe('missing_product');
    expect(mapLineRow(1, { product_id: 9, quantity: 0, price: 5 }, 'retail').skipped.reason).toBe('invalid_qty');
    expect(buildLineRows(1, null, 'retail')).toEqual({ rows: [], skipped: [] });
  });
  test('fixture roundtrip inserts + cleans up', () => {
    const gid = 'guest_jest071_' + Date.now().toString(36);
    const cid = db.prepare('INSERT INTO customers (email, name, google_id) VALUES (?, ?, ?)')
      .run('jest071@example.com', 'jest071', gid).lastInsertRowid;
    const prod = db.prepare('SELECT id FROM products ORDER BY id LIMIT 1').get();
    try {
      const oid = db.prepare(
        "INSERT INTO orders (customer_id, total, status, items, price_list_code) VALUES (?, 1000, 'pending', '[]', 'retail')"
      ).run(cid).lastInsertRowid;
      try {
        const n = insertLineRows(buildLineRows(oid,
          [{ product_id: prod.id, name: 'x', qty: 3, price: 1000 }], 'retail').rows);
        expect(n).toBe(1);
        const line = db.prepare('SELECT quantity, qty, price, base_price, final_price FROM order_items WHERE order_id = ?').get(oid);
        expect([line.quantity, line.qty]).toEqual([3, 3]);
        expect([line.price, line.base_price, line.final_price]).toEqual([1000, 1000, 1000]);
      } finally {
        db.prepare('DELETE FROM order_items WHERE order_id = ?').run(oid);
        db.prepare('DELETE FROM orders WHERE id = ?').run(oid);
      }
    } finally {
      db.prepare('DELETE FROM customers WHERE id = ?').run(cid);
    }
  });
});
