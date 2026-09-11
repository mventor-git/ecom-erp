/**
 * Choke-point period gate — mventor-ticket-084.
 * Proves `createMovement` refuses every type when today is covered by a
 * CLOSED period (naming it), and works otherwise. Fixture periods cleaned;
 * products/movements cleaned. Never touches real rows.
 */
const db = require('../db');
const inventoryService = require('../services/inventoryService');
const wos = require('../services/warehouseOrderService');

let catId = null;
let whId = null;
let pid = null;
const periodIds = [];

beforeAll(async () => {
  await db.initPromise;
  catId = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get().id;
  whId = db.prepare('SELECT id FROM warehouses ORDER BY id LIMIT 1').get().id;
  pid = db.prepare(
    'INSERT INTO products (name, price, cost_price, category_id, active, stock, default_warehouse_id) VALUES (?, 1000, 800, ?, 1, 0, ?)'
  ).run('jest-084-gate', catId, whId).lastInsertRowid;
});

afterEach(() => {
  for (const id of periodIds.splice(0)) {
    db.prepare('DELETE FROM financial_periods WHERE id = ?').run(id);
  }
  db.prepare("DELETE FROM events WHERE user_id = 'jest084'").run();
});

afterAll(() => {
  if (pid) {
    db.prepare('DELETE FROM inventory WHERE product_id = ?').run(pid);
    db.prepare('DELETE FROM inventory_movements WHERE product_id = ?').run(pid);
    db.prepare('DELETE FROM products WHERE id = ?').run(pid);
    pid = null;
  }
  db.prepare("DELETE FROM financial_periods WHERE name LIKE 'jest084%'").run();
  db.prepare("DELETE FROM events WHERE user_id = 'jest084'").run();
  db.saveDb();
});

function closeToday() {
  const p = wos.createFinancialPeriod({ name: 'jest084-closed', months: 1 });
  periodIds.push(p.id);
  wos.closeFinancialPeriod(p.id);
  return p;
}

describe('choke-point period gate (084)', () => {
  test('no covering closed period: receipt works', () => {
    const m = inventoryService.createMovement({ productId: pid, warehouseId: whId, type: 'receipt', qtyChange: 5, note: 'jest084', userId: 'jest084' });
    expect(m.qty_after).toBe(5);
  });
  test('closed today: receipt, issue, and adjustment all refuse naming the period', () => {
    closeToday();
    for (const args of [
      { type: 'receipt', qtyChange: 1 },
      { type: 'issue', qtyChange: -1 },
      { type: 'adjustment', qtyChange: 1 },
    ]) {
      expect(() => inventoryService.createMovement({ productId: pid, warehouseId: whId, note: 'jest084', ...args }))
        .toThrow(/closed financial period "jest084-closed"/);
    }
  });
  test('deleting the closed period re-allows movements', () => {
    closeToday();
    expect(() => inventoryService.createMovement({ productId: pid, warehouseId: whId, type: 'receipt', qtyChange: 1, note: 'jest084' }))
      .toThrow(/closed financial period/);
    db.prepare('DELETE FROM financial_periods WHERE id = ?').run(periodIds.pop());
    const m = inventoryService.createMovement({ productId: pid, warehouseId: whId, type: 'receipt', qtyChange: 1, note: 'jest084', userId: 'jest084' });
    expect(m.qty_after).toBeGreaterThanOrEqual(1);
  });
});
