/**
 * Canonical PricingEngine characterization — mventor-ticket-057.
 * Pure unit (no DB): locks the single server-authoritative preview
 * (pricingService.computeRetailPreview) that routes/pricingManager.js now drives.
 */
const pricingService = require('../services/pricingService');
const pricingManager = require('../routes/pricingManager');

describe('pricing canonical engine (057)', () => {
  test('markup 20% over cost, no rounding', () => {
    expect(pricingService.computeRetailPreview({ costCents: 5000, mode: 'markup', value: 20, rounding: 'none' })).toBe(6000);
  });
  test('markup 20% + 99 charm', () => {
    expect(pricingService.computeRetailPreview({ costCents: 5000, mode: 'markup', value: 20, rounding: '99' })).toBe(6099);
  });
  test('margin 50% over cost 5000 → 10000', () => {
    expect(pricingService.computeRetailPreview({ costCents: 5000, mode: 'margin', value: 50, rounding: 'none' })).toBe(10000);
  });
  test('match keeps current, re-rounds only', () => {
    expect(pricingService.computeRetailPreview({ costCents: 5000, currentCents: 6234, mode: 'match', rounding: '99' })).toBe(6299);
  });
  test('offer 10% off current retail', () => {
    expect(pricingService.computeRetailPreview({ costCents: 5000, currentCents: 6000, mode: 'offer', value: 10, rounding: 'none' })).toBe(5400);
  });
  test('missing cost never returns 0 (floor 5, legacy guard)', () => {
    expect(pricingService.computeRetailPreview({ costCents: 0, mode: 'markup', value: 20 })).toBe(5);
  });
  test('route delegates rounding to the single engine', () => {
    expect(pricingManager.roundPrice(6000, '99')).toBe(pricingService.roundPrice(6000, '99'));
    expect(pricingManager.roundPrice(6000, 'none')).toBe(6000);
  });
  test('dead tierDiscount removed, not reinvented', () => {
    expect(pricingService.tierDiscount).toBeUndefined();
  });
  test('VIP 10% off retail (display only, never stored)', () => {
    expect(pricingService.vipPriceFromRetail(6000, 10)).toBe(5400);
    expect(pricingService.vipPriceFromRetail(6099, 0)).toBe(6099);
    expect(pricingService.vipPriceFromRetail(6000, 90)).toBe(600);
    expect(pricingService.vipPriceFromRetail(6000, 999)).toBe(600); // clamped
  });
  test('computeRows exposes honest Cost→Retail→VIP fields with cost_price fallback', () => {
    const db = require('../db');
    return db.initPromise.then(() => {
      const prod = db.prepare('SELECT id FROM products WHERE deleted_at IS NULL AND cost_price > 0 ORDER BY id LIMIT 1').get();
      expect(prod).toBeTruthy();
      const { rows } = pricingManager.computeRows(
        { query: { scope: 'product', product_id: prod.id } },
        { mode: 'markup', value: 20, rounding: '99', vip_pct: 10 },
      );
      expect(rows.length).toBe(1);
      const r = rows[0];
      expect(r.cost_basis).toBeGreaterThan(0);
      expect(['cost_price', 'layer:FIFO_COST', 'layer:LATEST_PURCHASE_COST', 'layer:HIGHEST_PURCHASE_COST']).toContain(r.cost_source);
      expect(r.proposed_price).toBeGreaterThan(0);
      expect(r.vip_pct).toBe(10);
      expect(r.vip_price).toBe(pricingService.vipPriceFromRetail(r.proposed_price, 10));
    });
  });
});
