/**
 * Mobile checkout authoritative pricing — mventor-ticket-067.
 * Locks: cart-shaped lines resolve through the override path (the exact
 * bypass being fixed), unknown/inactive/bad-qty lines rejected.
 * Fixtures fully cleaned up; never touches real rows.
 */
const db = require('../db');
const { resolveItem } = require('../services/orderPricing');
const priceListService = require('../services/priceListService');

let catId = null;
let pid = null;
let inactivePid = null;

beforeAll(async () => {
  await db.initPromise;
  catId = db.prepare("INSERT INTO categories (name, slug) VALUES ('Jest 067', 'jest-cat-067')").run().lastInsertRowid;
  pid = db.prepare('INSERT INTO products (name, price, category_id, active) VALUES (?, ?, ?, 1)')
    .run('jest067-active', 1000, catId).lastInsertRowid;
  inactivePid = db.prepare('INSERT INTO products (name, price, category_id, active) VALUES (?, ?, ?, 0)')
    .run('jest067-inactive', 1000, catId).lastInsertRowid;
});

afterAll(() => {
  if (pid) {
    db.prepare('DELETE FROM product_prices WHERE product_id = ?').run(pid);
    db.prepare('DELETE FROM products WHERE id = ?').run(pid);
  }
  if (inactivePid) db.prepare('DELETE FROM products WHERE id = ?').run(inactivePid);
  if (catId) db.prepare("DELETE FROM categories WHERE id = ?").run(catId);
  db.saveDb();
});

describe('mobile checkout pricing (067)', () => {
  test('cart-shaped line resolves base price with no override', () => {
    const r = resolveItem({ product_id: pid, quantity: 2, variant_color: 'red', variant_size: 'M' });
    expect(r.ok).toBe(true);
    expect(r.unitPrice).toBe(1000);
  });
  test('retail override wins (the bypass being fixed)', () => {
    const retail = priceListService.getPriceList('retail');
    priceListService.setProductPrices(pid, [{ price_list_id: retail.id, price: 777 }]);
    try {
      const r = resolveItem({ product_id: pid, quantity: 1 });
      expect(r.ok).toBe(true);
      expect(r.unitPrice).toBe(777);
    } finally {
      priceListService.setProductPrices(pid, []);
    }
  });
  test('unknown product rejected', () => {
    expect(resolveItem({ product_id: 999999999, quantity: 1 }).ok).toBe(false);
  });
  test('inactive product rejected', () => {
    const r = resolveItem({ product_id: inactivePid, quantity: 1 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('inactive_product');
  });
  test('bad quantity rejected', () => {
    expect(resolveItem({ product_id: pid, quantity: 0 }).ok).toBe(false);
  });
});
