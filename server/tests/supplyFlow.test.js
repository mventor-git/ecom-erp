/**
 * End-to-end Supplier → Supply → Inventory Receipt → Cost Layer → Sale
 * (COGS independent of retail price). Mirrors the EXACT business scenario:
 *   Supply1 A 10×5000 → Supply2 B 10×5500 → FIFO cost / HIGHEST retail (25%)
 *   sell 1 → COGS 5000, price 6875, gross profit 1875
 *   → reconfig HIGHEST cost / LATEST retail + Supply3 C 10×4800
 *   → price 6000, COGS policy HIGHEST (independent).
 * Real DB; artifacts tagged 'jest-flow' and cleaned up.
 */
const db = require('../db');
const valuation = require('../services/valuationService');
const inventoryService = require('../services/inventoryService');

let whId = null;
let catId = null;
const clean = [];

function insertProduct(name) {
  const r = db.prepare("INSERT INTO products (name, price, cost_price, category_id, active, stock) VALUES (?, 0, 0, ?, 1, 0)").run(name, catId);
  const id = r.lastInsertRowid;
  clean.push(['product', id]);
  return id;
}
function insertSupplier(name) {
  const r = db.prepare("INSERT INTO suppliers (name) VALUES (?)").run(name);
  const id = r.lastInsertRowid;
  clean.push(['supplier', id]);
  return id;
}
function setSetting(key, value) { db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(String(value), key); }
function onHand(productId) {
  const inv = db.prepare('SELECT qty_on_hand FROM inventory WHERE product_id = ? AND warehouse_id = ? AND location_id IS NULL').get(productId, whId);
  return inv ? inv.qty_on_hand : 0;
}
function layerTotals(productId) {
  return db.prepare('SELECT unit_cost, remaining_quantity FROM inventory_cost_layers WHERE product_id = ? AND remaining_quantity > 0 ORDER BY created_at ASC, id ASC').all(productId);
}

beforeAll(async () => {
  await db.initPromise;
  whId = db.prepare('SELECT id FROM warehouses ORDER BY id LIMIT 1').get().id;
  catId = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get().id;
  valuation.ensureConfig();
});

afterEach(() => {
  for (const [kind, id] of clean.splice(0)) {
    if (kind === 'product') {
      db.prepare('DELETE FROM inventory_cost_layers WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM inventory_movements WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM inventory WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM products WHERE id = ?').run(id);
    } else {
      db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
    }
  }
  db.saveDb();
});

/** A confirmed supply: real receipt movement → inventory + cost layer. */
function receive(productId, qty, unitCost) {
  return inventoryService.createMovement({
    productId, warehouseId: whId, type: 'receipt', reason: 'supply', qtyChange: qty, unitCost, note: 'jest-flow supply',
  });
}

describe('E2E — Supplier → Supply → Inventory → Cost Layer → Sale (independent engines)', () => {
  test('supply history preserved + FIFO COGS + HIGHEST retail (6875) + gross profit 1875', () => {
    const prod = insertProduct('jest-flow-x');
    const supplierA = insertSupplier('jest-flow-A');
    const supplierB = insertSupplier('jest-flow-B');

    // Supply 1: A → 10 × 5000
    receive(prod, 10, 5000);
    expect(onHand(prod)).toBe(10);
    let layers = layerTotals(prod);
    expect(layers).toEqual([{ unit_cost: 5000, remaining_quantity: 10 }]);

    // Supply 2: B → 10 × 5500 (must NOT overwrite the 5000 layer)
    receive(prod, 10, 5500);
    expect(onHand(prod)).toBe(20);
    layers = layerTotals(prod);
    expect(layers).toEqual([
      { unit_cost: 5000, remaining_quantity: 10 },
      { unit_cost: 5500, remaining_quantity: 10 },
    ]);

    // Config: FIFO costing / HIGHEST retail / 25%
    setSetting('inventory_costing_method', 'FIFO');
    setSetting('retail_cost_basis', 'HIGHEST_PURCHASE_COST');
    setSetting('retail_markup_percent', '25');
    expect(valuation.retailPrice(prod, whId)).toBe(Math.round(5500 * 1.25)); // 6875

    // Sell 1 unit
    const cogs = valuation.cogsForIssue(prod, 1, 'FIFO', whId);
    expect(cogs.cost).toBe(5000);                 // FIFO consumes oldest layer
    const price = valuation.retailPrice(prod, whId);
    expect(price).toBe(Math.round(5500 * 1.25));  // HIGHEST × 25% — NOT 5000×1.25
    expect(price - cogs.cost).toBe(Math.round(5500 * 1.25) - 5000); // gross profit 1875
  });

  test('reconfig HIGHEST costing + LATEST retail + Supply3 4800 → price 6000, COGS HIGHEST (independent)', () => {
    const prod = insertProduct('jest-flow-y');
    insertSupplier('jest-flow-C');
    receive(prod, 10, 5000);
    receive(prod, 10, 5500);
    receive(prod, 10, 4800); // Supplier C

    expect(layerTotals(prod).map(l => l.unit_cost).sort((a, b) => a - b)).toEqual([4800, 5000, 5500]);

    setSetting('inventory_costing_method', 'HIGHEST');
    setSetting('retail_cost_basis', 'LATEST_PURCHASE_COST');
    setSetting('retail_markup_percent', '25');

    // Retail LATEST basis = newest layer = 4800 → 6000
    expect(valuation.retailPrice(prod, whId)).toBe(Math.round(4800 * 1.25)); // 6000

    // COGS HIGHEST policy = highest-cost layer = 5500 (independent of retail)
    const cogs = valuation.cogsForIssue(prod, 1, 'HIGHEST', whId);
    expect(cogs.cost).toBe(5500);
    expect(cogs.lines[0].unit_cost).toBe(5500);
  });

  test('cost_consumption persists the exact layers for a FIFO issue', () => {
    const prod = insertProduct('jest-flow-z');
    receive(prod, 10, 5000);
    receive(prod, 10, 5500);
    const cogs = valuation.cogsForIssue(prod, 12, 'FIFO', whId); // 10@5000 + 2@5500
    expect(cogs.cost).toBe(10 * 5000 + 2 * 5500);
    expect(cogs.lines).toHaveLength(2);
    const persisted = valuation.persistConsumption(999999, prod, cogs.method, cogs.lines);
    expect(persisted).toBe(2);
    const rows = db.prepare('SELECT qty_consumed, unit_cost FROM cost_consumption WHERE order_id = 999999 ORDER BY id ASC').all();
    expect(rows).toEqual([{ qty_consumed: 10, unit_cost: 5000 }, { qty_consumed: 2, unit_cost: 5500 }]);
    db.prepare('DELETE FROM cost_consumption WHERE order_id = 999999').run();
  });
});
