// Phase 6 — FIFO cost-layer consumption (mventor-ticket-083 repair).
// Was: broken sql.js loading (`new SQL.Database` on the factory) + assertions
// on live ambient rows (stale "Phase 5" assumptions). Now: self-contained
// fixtures proving the consumeFifo path adminSale keeps. Full cleanup.
const db = require('../db');
const valuationService = require('../services/valuationService');
const { consumeFifo } = require('../services/inventoryCostLayers');

let catId = null;
let whId = null;
let pid = null;

beforeAll(async () => {
  await db.initPromise;
  catId = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get().id;
  whId = db.prepare('SELECT id FROM warehouses ORDER BY id LIMIT 1').get().id;
  pid = db.prepare(
    'INSERT INTO products (name, price, cost_price, category_id, active, stock) VALUES (?, 1000, 1000, ?, 1, 0)'
  ).run('jest-phase6-fifo', catId).lastInsertRowid;
  valuationService.addLayer({ productId: pid, warehouseId: whId, qty: 3, unitCost: 5000 });
  valuationService.addLayer({ productId: pid, warehouseId: whId, qty: 2, unitCost: 6000 });
});

afterAll(() => {
  if (pid) {
    db.prepare('DELETE FROM inventory_cost_layers WHERE product_id = ?').run(pid);
    db.prepare('DELETE FROM products WHERE id = ?').run(pid);
    pid = null;
  }
  db.saveDb();
});

describe('Phase 6 FIFO Integration', () => {
  test('cost tables exist', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('cost_consumption','inventory_cost_layers')").all()
      .map(r => r.name);
    expect(tables).toContain('cost_consumption');
    expect(tables).toContain('inventory_cost_layers');
  });

  test('multi-layer FIFO consumption produces COGS 21000', () => {
    const r = consumeFifo(pid, 4, whId);
    expect(r.consumed).toEqual([
      expect.objectContaining({ qty: 3, unitCost: 5000 }),
      expect.objectContaining({ qty: 1, unitCost: 6000 }),
    ]);
    expect(r.costSnapshot).toBe(3 * 5000 + 1 * 6000);
    expect(r.remainingQty).toBe(0);
  });

  test('over-consume reports remainder honestly without throwing', () => {
    const r = consumeFifo(pid, 99, whId);
    expect(r.consumed.reduce((s, c) => s + c.qty, 0)).toBe(5);
    expect(r.costSnapshot).toBe(3 * 5000 + 2 * 6000);
    expect(r.remainingQty).toBe(94);
  });
});
