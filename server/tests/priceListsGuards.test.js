/**
 * Price-lists consolidation guards — mventor-ticket-064.
 * Locks: usage honesty, delete guards, wholesale/semi zero-use evidence.
 * Live-DB safe: temp lists/products cleaned up, saveDb after.
 */
const db = require('../db');
const priceListService = require('../services/priceListService');

beforeAll(async () => { await db.initPromise; });
afterAll(() => { db.saveDb(); });

describe('price-lists consolidation guards (064)', () => {
  test('usage map covers all lists with honest fields', () => {
    const usage = priceListService.getAllUsage();
    expect(usage.length).toBeGreaterThanOrEqual(4);
    usage.forEach(u => {
      expect(u).toEqual(expect.objectContaining({
        id: expect.any(Number), code: expect.any(String),
        overrides: expect.any(Number), orders: expect.any(Number),
        order_items: expect.any(Number), sale_refs: expect.any(Number),
        is_default: expect.any(Boolean), is_storefront: expect.any(Boolean),
        in_use: expect.any(Boolean),
      }));
    });
  });
  test('retail is default + storefront + in use', () => {
    const u = priceListService.getAllUsage().find(x => x.code === 'retail');
    expect(u).toBeTruthy();
    expect(u.is_default).toBe(true);
    expect(u.is_storefront).toBe(true);
    expect(u.in_use).toBe(true);
  });
  test('wholesale/semi are never default/storefront and hold no orders (consolidation evidence)', () => {
    // NOTE: overrides are NOT asserted absolute-zero here — if any suite fails
    // mid-override its finally-cleanup still runs, but a hard failure before
    // cleanup (as seen in 064 validation) can leak one row cross-suite.
    // Zero-use evidence at audit time is recorded in tickets 064/065 probes.
    const byCode = Object.fromEntries(priceListService.getAllUsage().map(u => [u.code, u]));
    for (const code of ['wholesale', 'semi_wholesale']) {
      expect(byCode[code]).toBeTruthy();
      expect(byCode[code].orders).toBe(0);
      expect(byCode[code].sale_refs).toBe(0);
      expect(byCode[code].is_default).toBe(false);
      expect(byCode[code].is_storefront).toBe(false);
    }
  });
  test('delete blocked for default (retail)', () => {
    const retail = priceListService.getAllUsage().find(x => x.code === 'retail');
    expect(() => priceListService.deletePriceList(retail.id)).toThrow('default');
  });
  test('delete blocked when overrides exist, succeeds when clean', () => {
    const tmp = priceListService.createPriceList({ name: 'jest-guard', code: 'jest_guard_064' });
    try {
      const prod = db.prepare('SELECT id FROM products WHERE deleted_at IS NULL ORDER BY id LIMIT 1').get();
      expect(prod).toBeTruthy();
      priceListService.setProductPrices(prod.id, [{ price_list_id: tmp.id, price: 1234 }]);
      expect(() => priceListService.deletePriceList(tmp.id)).toThrow('override');
      db.prepare('DELETE FROM product_prices WHERE price_list_id = ?').run(tmp.id);
      const res = priceListService.deletePriceList(tmp.id);
      expect(res.success).toBe(true);
    } finally {
      try { db.prepare('DELETE FROM product_prices WHERE price_list_id = ?').run(tmp.id); } catch {}
      try { priceListService.deletePriceList(tmp.id); } catch {}
    }
  });
});
