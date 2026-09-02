/**
 * Valuation Service — Configurable Inventory Costing + Configurable Retail Pricing.
 * Proves the THREE costing methods, the RETAIL engine, and (critically) that
 * pricing and costing are INDEPENDENT. Uses the real DB; artifacts are tagged
 * 'jest-valuation' and cleaned up.
 */
const db = require('../db');
const valuation = require('../services/valuationService');

let whId = null;
let catId = null;
const created = [];

function insertProduct(name) {
  // products.price / cost_price are NOT NULL — provide explicit 0.
  const r = db.prepare("INSERT INTO products (name, price, cost_price, category_id, active, stock) VALUES (?, 0, 0, ?, 1, 0)").run(name, catId);
  const id = r.lastInsertRowid;
  created.push(id);
  return id;
}

function setSetting(key, value) {
  db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(value), key);
}

function setCosting(method) { setSetting('inventory_costing_method', method); }
function setRetail(basis, markup) { setSetting('retail_cost_basis', basis); setSetting('retail_markup_percent', String(markup)); }

/** Create a product with layers: oldest→newest = [5000, 5500, 4800] each qty `q`. */
function productWithLayers(name, q = 10) {
  const id = insertProduct(name);
  valuation.addLayer({ productId: id, warehouseId: whId, qty: q, unitCost: 5000, sourceMovementId: null }); // oldest
  valuation.addLayer({ productId: id, warehouseId: whId, qty: q, unitCost: 5500 });
  valuation.addLayer({ productId: id, warehouseId: whId, qty: q, unitCost: 4800 });                          // newest
  return id;
}

beforeAll(async () => {
  await db.initPromise;
  whId = db.prepare('SELECT id FROM warehouses ORDER BY id LIMIT 1').get().id;
  catId = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get().id;
  valuation.ensureConfig();
});

afterEach(() => {
  for (const id of created.splice(0)) {
    db.prepare('DELETE FROM inventory_cost_layers WHERE product_id = ?').run(id);
    db.prepare('DELETE FROM inventory_movements WHERE product_id = ?').run(id);
    db.prepare('DELETE FROM inventory WHERE product_id = ?').run(id);
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
  }
  db.saveDb();
});

describe('Valuation — costing methods (5000 / 5500 / 4800)', () => {
  test('FIFO consumes the OLDEST layer first', () => {
    const id = productWithLayers('jest-val-fifo', 10);
    setCosting('FIFO');
    const c = valuation.cogsForIssue(id, 1, 'FIFO', whId);
    expect(c.method).toBe('FIFO');
    expect(c.cost).toBe(5000);

    // Issue 5 more → the rest of the 5000 layer (9 left) then one 5500
    const c2 = valuation.cogsForIssue(id, 5, 'FIFO', whId);
    expect(c2.cost).toBe(5 * 5000);
  });

  test('FIFO crosses exact layer boundary correctly', () => {
    const id = productWithLayers('jest-val-fifobound', 10);
    const c = valuation.cogsForIssue(id, 12, 'FIFO', whId); // 10 @ 5000 + 2 @ 5500
    expect(c.cost).toBe(10 * 5000 + 2 * 5500);
    expect(c.lines).toHaveLength(2);
  });

  test('LATEST uses the newest purchase cost', () => {
    const id = productWithLayers('jest-val-latest', 10);
    const c = valuation.cogsForIssue(id, 1, 'LATEST', whId);
    expect(c.method).toBe('LATEST');
    expect(c.unit_cost).toBe(4800);
    expect(c.cost).toBe(4800);
  });

  test('HIGHEST uses the highest purchase cost', () => {
    const id = productWithLayers('jest-val-highest', 10);
    const c = valuation.cogsForIssue(id, 1, 'HIGHEST', whId);
    expect(c.method).toBe('HIGHEST');
    expect(c.unit_cost).toBe(5500);
    expect(c.cost).toBe(5500);
  });

  test('rejects insufficient stock (no partial)', () => {
    const id = productWithLayers('jest-val-insuff', 1);
    expect(() => valuation.cogsForIssue(id, 99, 'FIFO', whId)).toThrow(/Insufficient/);
  });

  test('zero quantity costs nothing; negative rejected; invalid method rejected', () => {
    const id = productWithLayers('jest-val-edge', 10);
    expect(valuation.cogsForIssue(id, 0, 'FIFO', whId).cost).toBe(0);
    expect(() => valuation.cogsForIssue(id, -1, 'FIFO', whId)).toThrow(/negative/);
    expect(() => valuation.cogsForIssue(id, 1, 'AVERAGE', whId)).toThrow(/Invalid costing/);
  });

  test('equal costs across layers are handled', () => {
    const id = insertProduct('jest-val-equal');
    valuation.addLayer({ productId: id, warehouseId: whId, qty: 5, unitCost: 5000 });
    valuation.addLayer({ productId: id, warehouseId: whId, qty: 5, unitCost: 5000 });
    expect(valuation.cogsForIssue(id, 7, 'FIFO', whId).cost).toBe(7 * 5000);
    expect(valuation.cogsForIssue(id, 1, 'HIGHEST', whId).unit_cost).toBe(5000);
  });
});

describe('Valuation — retail pricing (independent engine)', () => {
  test('HIGHEST cost basis × 25% = 6875', () => {
    const id = productWithLayers('jest-val-ret-hi', 10);
    setRetail('HIGHEST_PURCHASE_COST', 25);
    expect(valuation.retailPrice(id, whId)).toBe(Math.round(5500 * 1.25)); // 6875
  });

  test('LATEST cost basis × 25% = 6000', () => {
    const id = productWithLayers('jest-val-ret-lat', 10);
    setRetail('LATEST_PURCHASE_COST', 25);
    expect(valuation.retailPrice(id, whId)).toBe(Math.round(4800 * 1.25)); // 6000
  });

  test('costBasis exposes the selected basis', () => {
    const id = productWithLayers('jest-val-basis', 10);
    expect(valuation.costBasis(id, 'HIGHEST_PURCHASE_COST', whId)).toBe(5500);
    expect(valuation.costBasis(id, 'LATEST_PURCHASE_COST', whId)).toBe(4800);
    expect(valuation.costBasis(id, 'FIFO_COST', whId)).toBe(5000);
  });

  test('invalid retail basis is rejected', () => {
    const id = productWithLayers('jest-val-basis-bad', 10);
    expect(() => valuation.costBasis(id, 'SCREAMING_VALUE')).toThrow(/Invalid retail cost basis/);
  });
});

describe('Valuation — COSTING and RETAIL are INDEPENDENT (the hard rule)', () => {
  test('FIFO costing + HIGHEST retail → COGS 5000, price 6875', () => {
    const id = productWithLayers('jest-val-ind1', 10);
    setCosting('FIFO');
    setRetail('HIGHEST_PURCHASE_COST', 25);
    const cogs = valuation.cogsForIssue(id, 1, 'FIFO', whId);
    const retail = valuation.retailPrice(id, whId);
    expect(cogs.cost).toBe(5000);        // FIFO picks oldest
    expect(retail).toBe(Math.round(5500 * 1.25)); // HIGHEST × markup — NOT 5000×1.25
    expect(retail).not.toBe(Math.round(5000 * 1.25));
  });

  test('HIGHEST costing + LATEST retail → COGS 5500, price 6000', () => {
    const id = productWithLayers('jest-val-ind2', 10);
    setCosting('HIGHEST');
    setRetail('LATEST_PURCHASE_COST', 25);
    const cogs = valuation.cogsForIssue(id, 1, 'HIGHEST', whId);
    const retail = valuation.retailPrice(id, whId);
    expect(cogs.cost).toBe(5500);                  // HIGHEST pick
    expect(retail).toBe(Math.round(4800 * 1.25));  // LATEST × markup
    expect(retail).not.toBe(Math.round(5500 * 1.25)); // independent
  });
});

describe('Valuation — supplier wholesale-price history (multiple costs preserved)', () => {
  test('preserves a supplier/product cost history without overwriting', () => {
    const history = valuation.supplierCostHistory([
      { unit_cost: 5000, date: '2026-01-01', reference: 'SUP-2026-0001' },
      { unit_cost: 5200, date: '2026-02-01', reference: 'SUP-2026-0002' },
      { unit_cost: 5500, date: '2026-03-01', reference: 'SUP-2026-0003' },
    ]);
    expect(history).toHaveLength(3);
    expect(history[0].unit_cost).toBe(5000);
    expect(history[history.length - 1].unit_cost).toBe(5500);
    // distinct costs are all retained (same supplier, multiple wholesale rates)
    expect(new Set(history.map(h => h.unit_cost)).size).toBe(3);
  });
});
