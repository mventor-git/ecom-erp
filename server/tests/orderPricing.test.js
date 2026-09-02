/**
 * P0.4 — Server-side checkout total verification.
 * Proves the storefront's client-sent price/total is NEVER trusted: the
 * authoritative total is recomputed from DB prices (same pipeline the storefront
 * listing uses), and tampered inputs are rejected or ignored.
 */
const db = require('../db');
const { computeAuthoritativeOrder } = require('../services/orderPricing');

let catId = null;
const createdIds = [];

function insertProduct(name, { price = 100000, active = 1 } = {}) {
  const r = db.prepare('INSERT INTO products (name, price, category_id, active, stock) VALUES (?, ?, ?, ?, 0)')
    .run(name, price, catId, active);
  const id = r.lastInsertRowid;
  createdIds.push(id);
  return id;
}

beforeAll(async () => {
  await db.initPromise;
  catId = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get().id;
});

afterEach(() => {
  for (const id of createdIds.splice(0)) {
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
  }
  db.saveDb();
});

describe('computeAuthoritativeOrder (P0.4)', () => {
  test('computes total from DB price, ignoring the client-sent price', () => {
    const id = insertProduct('jest-pricing', { price: 100000 }); // 1000.00 EGP
    // Client tries to under-price the item at 250 EGP — server must ignore it.
    const res = computeAuthoritativeOrder([{ id, qty: 1, price: 250 }]);
    expect(res.ok).toBe(true);
    expect(res.total).toBe(100000);          // 1000.00 EGP in cents
    expect(res.items[0].price).toBe(100000);
    expect(res.items[0].price).not.toBe(250); // tampered price discarded
  });

  test('multiplies quantity and sums lines correctly', () => {
    const a = insertProduct('jest-pricing-a', { price: 25000 });   // 250.00
    const b = insertProduct('jest-pricing-b', { price: 500 });     // 5.00
    const res = computeAuthoritativeOrder([{ id: a, qty: 2 }, { id: b, qty: 3 }]);
    expect(res.ok).toBe(true);
    expect(res.total).toBe(2 * 25000 + 3 * 500); // 51500
  });

  test('rejects an empty cart', () => {
    const res = computeAuthoritativeOrder([]);
    expect(res.ok).toBe(false);
    expect(res.errors[0].reason).toBe('empty_cart');
  });

  test('rejects an unknown product id', () => {
    const res = computeAuthoritativeOrder([{ id: 999999999, qty: 1 }]);
    expect(res.ok).toBe(false);
    expect(res.errors[0].reason).toBe('unknown_product');
  });

  test('rejects an inactive product', () => {
    const id = insertProduct('jest-pricing-inactive', { active: 0 });
    const res = computeAuthoritativeOrder([{ id, qty: 1 }]);
    expect(res.ok).toBe(false);
    expect(res.errors[0].reason).toBe('inactive_product');
  });

  test('rejects zero, negative, and non-numeric quantities', () => {
    const id = insertProduct('jest-pricing-qty', { price: 1000 });
    expect(computeAuthoritativeOrder([{ id, qty: 0 }]).errors[0].reason).toBe('invalid_qty');
    expect(computeAuthoritativeOrder([{ id, qty: -3 }]).errors[0].reason).toBe('invalid_qty');
    expect(computeAuthoritativeOrder([{ id, qty: 'abc' }]).errors[0].reason).toBe('invalid_qty');
  });

  test('rejects when an item has no product id', () => {
    const res = computeAuthoritativeOrder([{ qty: 1, price: 100 }]);
    expect(res.ok).toBe(false);
    expect(res.errors[0].reason).toBe('missing_product');
  });
});
