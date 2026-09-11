/**
 * Financial Periods (honest, per handoff §14): this is lightweight PERIOD
 * MANAGEMENT. An opening balance posts a REAL `opening_balance` inventory
 * movement (the canonical ledger) and reconciles on-hand to the counted value.
 * It is NOT a GL/journal entry — no fake accounting. Closing a period is a
 * status flip that blocks further opening balances. These tests prove the
 * honest behavior with real ledger + FK ON.
 */
const db = require('../db');
const warehouseOrderService = require('../services/warehouseOrderService');
const inventoryService = require('../services/inventoryService');

let catId, whId;
let periodId = null;
const periodIds = []; // 082: EVERY created period tracked (single var used to overwrite)
const madeProducts = [];

function makeProduct(name) {
  const r = db.prepare("INSERT INTO products (name, price, cost_price, category_id, active, stock) VALUES (?, 90000, 50000, ?, 1, 0)").run(name, catId);
  const pid = r.lastInsertRowid;
  db.prepare('INSERT INTO inventory (product_id, warehouse_id, qty_on_hand) VALUES (?, 1, 0)').run(pid);
  madeProducts.push(pid);
  return pid;
}

function onHand(pid, whid) {
  const row = db.prepare('SELECT qty_on_hand FROM inventory WHERE product_id = ? AND warehouse_id = ?').get(pid, whid);
  return row ? row.qty_on_hand : 0;
}

function openingMovements(pid) {
  return db.prepare("SELECT * FROM inventory_movements WHERE product_id = ? AND type = 'opening_balance' AND note LIKE 'Opening balance for%'").all(pid);
}

beforeAll(async () => {
  await db.initPromise;
  catId = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get().id;
  whId = db.prepare('SELECT id FROM warehouses ORDER BY id LIMIT 1').get().id;
});

afterAll(() => {
  madeProducts.forEach(pid => {
    db.prepare("DELETE FROM inventory_movements WHERE product_id = ? AND (type = 'opening_balance' OR note LIKE 'jest:fp-%')").run(pid);
    db.prepare('DELETE FROM inventory WHERE product_id = ?').run(pid);
    db.prepare('DELETE FROM products WHERE id = ?').run(pid);
  });
  if (periodId) {
    db.prepare('DELETE FROM financial_periods WHERE id = ? AND name LIKE ?').run(periodId, 'Jest FP %');
    periodId = null;
  }
  for (const pid of periodIds.splice(0)) {
    db.prepare('DELETE FROM financial_periods WHERE id = ? AND name LIKE ?').run(pid, 'Jest FP %');
  }
  db.saveDb();
});

test('createFinancialPeriod → OPEN with inclusive start/end', () => {
  const p = warehouseOrderService.createFinancialPeriod({ name: 'Jest FP ' + Date.now(), months: 12 });
  periodId = p.id;
  periodIds.push(p.id);
  expect(p.status).toBe('OPEN');
  expect(p.start_date).toBeTruthy();
  expect(p.end_date).toBeTruthy();
  expect(p.months).toBe(12);
});

test('setOpeningBalance posts a REAL opening_balance movement and reconciles on-hand', () => {
  const pid = makeProduct('jest-fp-product');
  const counted = 8;
  const period = warehouseOrderService.listFinancialPeriods().find(x => x.id === periodId) || (() => {
    const fallback = warehouseOrderService.createFinancialPeriod({ name: 'Jest FP OB', months: 6 });
    periodIds.push(fallback.id);
    return fallback;
  })();

  const res = warehouseOrderService.setOpeningBalance(period.id, whId, [{ product_id: pid, qty: counted }], 'jest');

  expect(res.opening_balance_set).toBe(1);
  expect(onHand(pid, whId)).toBe(counted); // canonical inventory reconciled to the count

  const movs = openingMovements(pid);
  expect(movs.length).toBe(1);
  expect(movs[0].type).toBe('opening_balance');
  expect(movs[0].qty_after).toBe(counted);
  expect(movs[0].reason).toContain('financial_period');
});

test('closeFinancialPeriod → CLOSED + closed_at; OB on closed throws', () => {
  const pid = makeProduct('jest-fp-close');
  const period = warehouseOrderService.createFinancialPeriod({ name: 'Jest FP Close ' + Date.now(), months: 3 });
  periodIds.push(period.id);

  const closed = warehouseOrderService.closeFinancialPeriod(period.id);
  expect(closed.status).toBe('CLOSED');
  expect(closed.closed_at).toBeTruthy();

  expect(() => warehouseOrderService.setOpeningBalance(period.id, whId, [{ product_id: pid, qty: 1 }], 'jest'))
    .toThrow(/Only open periods/);
  // closing does NOT move stock
  expect(onHand(pid, whId)).toBe(0);
  expect(openingMovements(pid).length).toBe(0);
});

test('setOpeningBalance with no items throws', () => {
  const period = warehouseOrderService.createFinancialPeriod({ name: 'Jest FP Empty ' + Date.now(), months: 1 });
  periodIds.push(period.id);
  expect(() => warehouseOrderService.setOpeningBalance(period.id, whId, [], 'jest')).toThrow(/No opening balance items/);
});
