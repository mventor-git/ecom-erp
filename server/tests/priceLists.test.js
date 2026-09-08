/**
 * Tests for the price list service (mventor-ticket-046).
 */
const db = require('../db');
const priceListService = require('../services/priceListService');
const settingsService = require('../services/settingsService');

let pid = null;
let testListId = null;
let ownProductId = null;

beforeAll(async () => {
  await db.initPromise;
  // Self-sufficient: fresh stores have no products — create a fixture
  let prod = db.prepare('SELECT id, price FROM products ORDER BY id LIMIT 1').get();
  if (!prod) {
    let cat = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get();
    const catId = cat ? cat.id : db.prepare("INSERT INTO categories (name, slug) VALUES ('Jest Cat PL', 'jest-cat-pl')").run().lastInsertRowid;
    const rid = db.prepare("INSERT INTO products (name, price, category_id, active) VALUES ('jest-pl-fixture', 1000, ?, 1)").run(catId).lastInsertRowid;
    ownProductId = rid;
    prod = { id: rid, price: 1000 };
  }
  pid = prod.id;
});

afterAll(() => {
  // remove the test price list + any overrides for the test product
  if (testListId) {
    db.prepare('DELETE FROM product_prices WHERE price_list_id = ?').run(testListId);
    db.prepare('DELETE FROM price_lists WHERE id = ?').run(testListId);
  }
  if (ownProductId) {
    db.prepare('DELETE FROM product_prices WHERE product_id = ?').run(ownProductId);
    db.prepare('DELETE FROM products WHERE id = ?').run(ownProductId);
    db.prepare("DELETE FROM categories WHERE slug = 'jest-cat-pl'").run();
  }
  db.saveDb();
});

describe('Price Lists', () => {
  test('default lists are seeded (065: wholesale/semi legacy-inactive)', () => {
    const all = priceListService.listPriceLists(true);
    const allCodes = all.map(l => l.code);
    expect(allCodes).toEqual(expect.arrayContaining(['retail', 'wholesale', 'semi_wholesale', 'offer']));
    const activeCodes = priceListService.listPriceLists().map(l => l.code);
    expect(activeCodes).toEqual(expect.arrayContaining(['retail', 'offer']));
    expect(activeCodes).not.toContain('wholesale');
    expect(activeCodes).not.toContain('semi_wholesale');
  });

  test('create/update/delete price list', () => {
    // self-clean any leftover from previous runs
    const leftover = priceListService.getPriceList('jest_vip');
    if (leftover) {
      db.prepare('DELETE FROM product_prices WHERE price_list_id = ?').run(leftover.id);
      db.prepare('DELETE FROM price_lists WHERE id = ?').run(leftover.id);
    }

    const created = priceListService.createPriceList({ name: 'Jest VIP', code: 'jest_vip', discountPercent: 10 });
    testListId = created.id;
    expect(created.code).toBe('jest_vip');
    expect(created.discount_percent).toBe(10);

    const updated = priceListService.updatePriceList(created.id, { discountPercent: 12 });
    expect(updated.discount_percent).toBe(12);

    // duplicate code rejected
    expect(() => priceListService.createPriceList({ name: 'Dup', code: 'jest_vip' })).toThrow(/already exists/);

    priceListService.deletePriceList(created.id);
    testListId = null;
    expect(priceListService.getPriceList('jest_vip')).toBeNull();
  });

  test('effective price: base when no discount and no override', () => {
    const product = db.prepare('SELECT id, price FROM products WHERE id = ?').get(pid);
    const eff = priceListService.getEffectivePrice(product, 'retail');
    expect(eff.price).toBe(product.price);
    expect(eff.price_list_code).toBe('retail');
  });

  test('effective price: discount applied', () => {
    const product = db.prepare('SELECT id, price FROM products WHERE id = ?').get(pid);
    const eff = priceListService.getEffectivePrice(product, 'offer');
    // offer seeded with 20% (065: wholesale is legacy-inactive)
    expect(eff.price).toBe(Math.round(product.price * 0.80));
    expect(eff.discount_percent).toBe(20);
    expect(eff.base_price).toBe(product.price);
  });

  test('effective price: per-product override wins over discount', () => {
    const offer = priceListService.getPriceList('offer');
    try {
      priceListService.setProductPrices(pid, [{ price_list_id: offer.id, price: 12345 }]);

      const product = db.prepare('SELECT id, price FROM products WHERE id = ?').get(pid);
      const eff = priceListService.getEffectivePrice(product, 'offer');
      expect(eff.price).toBe(12345);
      expect(eff.base_price).toBe(product.price);
    } finally {
      // cleanup even on failure — never leak overrides into other suites
      priceListService.setProductPrices(pid, []);
    }
  });

  test('applyPriceList attaches effective prices to arrays', () => {
    // Self-sufficient: build exactly 3 stand-in products for the array test
    let cat = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get();
    const catId = cat ? cat.id : db.prepare("INSERT INTO categories (name, slug) VALUES ('Jest Cat PL', 'jest-cat-pl')").run().lastInsertRowid;
    const ids = [];
    for (let i = 1; i <= 3; i++) {
      ids.push(db.prepare("INSERT INTO products (name, price, category_id, active) VALUES (?, 1000, ?, 1)").run(`jest-pl-arr-${i}`, catId).lastInsertRowid);
    }
    const products = db.prepare(`
      SELECT id, price FROM products
      WHERE id IN (${ids.map(() => '?').join(',')})
      ORDER BY id
    `).all(...ids);
    const result = priceListService.applyPriceList(products, 'retail');
    expect(result.length).toBe(3);
    result.forEach(p => {
      expect(p.price).toBeDefined();
      expect(p.base_price).toBeDefined();
      expect(p.price_list_code).toBe('retail');
    });
    ids.forEach(id => {
      db.prepare('DELETE FROM product_prices WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM products WHERE id = ?').run(id);
    });
  });

  test('storefrontListCode falls back to retail for unknown/inactive lists', () => {
    settingsService.set('storefront_price_list', 'retail', 'jest');
    expect(priceListService.storefrontListCode()).toBe('retail');
    settingsService.set('storefront_price_list', 'does_not_exist', 'jest');
    expect(priceListService.storefrontListCode()).toBe('retail');
    settingsService.set('storefront_price_list', 'retail', 'jest');
  });
});
