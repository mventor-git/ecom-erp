/**
 * Checkout price_list_code snapshot — mventor-ticket-066.
 * Locks: validated storefront code default/fallback, column existence on
 * orders + order_items (legacy column set), fixture roundtrip with cleanup.
 * Never touches real rows; route handlers are NOT invoked here (they would
 * emit audit events + move stock on the live DB — see ticket).
 */
const db = require('../db');
const priceListService = require('../services/priceListService');
const settingsService = require('../services/settingsService');

beforeAll(async () => { await db.initPromise; });
afterAll(() => { db.saveDb(); });

describe('checkout list snapshot (066)', () => {
  test('storefront code defaults to retail and falls back for unknown lists', () => {
    const prev = settingsService.get('storefront_price_list', 'retail');
    try {
      settingsService.set('storefront_price_list', 'retail', 'jest');
      expect(priceListService.storefrontListCode()).toBe('retail');
      settingsService.set('storefront_price_list', 'does_not_exist', 'jest');
      expect(priceListService.storefrontListCode()).toBe('retail');
    } finally {
      settingsService.set('storefront_price_list', prev || 'retail', 'jest');
    }
  });
  test('snapshot columns exist on orders + order_items', () => {
    const orderCols = db.prepare('PRAGMA table_info(orders)').all().map(c => c.name);
    const itemCols = db.prepare('PRAGMA table_info(order_items)').all().map(c => c.name);
    expect(orderCols).toContain('price_list_code');
    expect(itemCols).toContain('price_list_code');
  });
  test('fixture order + line roundtrip the snapshot code', () => {
    const gid = 'guest_jest066_' + Date.now().toString(36);
    const cust = db.prepare('INSERT INTO customers (email, name, google_id) VALUES (?, ?, ?)')
      .run('jest066@example.com', 'jest066', gid);
    const cid = cust.lastInsertRowid;
    const code = priceListService.storefrontListCode();
    try {
      const o = db.prepare(
        'INSERT INTO orders (customer_id, total, status, items, price_list_code) VALUES (?, ?, ?, ?, ?)'
      ).run(cid, 1000, 'pending', '[]', code);
      const oid = o.lastInsertRowid;
      const prod = db.prepare('SELECT id FROM products ORDER BY id LIMIT 1').get();
      try {
        db.prepare(
          'INSERT INTO order_items (order_id, product_id, product_name, quantity, price, price_list_code) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(oid, prod ? prod.id : 0, 'jest066-line', 1, 1000, code);
        expect(db.prepare('SELECT price_list_code FROM orders WHERE id = ?').get(oid).price_list_code).toBe(code);
        expect(db.prepare('SELECT price_list_code FROM order_items WHERE order_id = ?').get(oid).price_list_code).toBe(code);
      } finally {
        db.prepare('DELETE FROM order_items WHERE order_id = ?').run(oid);
        db.prepare('DELETE FROM orders WHERE id = ?').run(oid);
      }
    } finally {
      db.prepare('DELETE FROM customers WHERE id = ?').run(cid);
    }
  });
});
