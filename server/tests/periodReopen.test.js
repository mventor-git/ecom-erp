/**
 * Period reopen companion — mventor-ticket-085.
 * Proves the 084 lock is two-way: close → movements blocked → reopen →
 * movements allowed → reclose works. Fixture periods cleaned.
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
  ).run('jest-085-reopen', catId, whId).lastInsertRowid;
});

afterEach(() => {
  for (const id of periodIds.splice(0)) {
    db.prepare('DELETE FROM financial_periods WHERE id = ?').run(id);
  }
  db.prepare("DELETE FROM events WHERE user_id = 'jest085'").run();
});

afterAll(() => {
  if (pid) {
    db.prepare('DELETE FROM inventory WHERE product_id = ?').run(pid);
    db.prepare('DELETE FROM inventory_movements WHERE product_id = ?').run(pid);
    db.prepare('DELETE FROM products WHERE id = ?').run(pid);
    pid = null;
  }
  db.prepare("DELETE FROM financial_periods WHERE name LIKE 'jest085%'").run();
  db.prepare("DELETE FROM events WHERE user_id = 'jest085'").run();
  db.saveDb();
});

function move(qty) {
  return inventoryService.createMovement({ productId: pid, warehouseId: whId, type: 'receipt', qtyChange: qty, note: 'jest085', userId: 'jest085' });
}

describe('period reopen companion (085)', () => {
  test('reopen works; reopen-open and missing refuse; reclose works', () => {
    const p = wos.createFinancialPeriod({ name: 'jest085-cycle', months: 1 });
    periodIds.push(p.id);
    const shut = wos.closeFinancialPeriod(p.id);
    expect(shut.status).toBe('CLOSED');
    expect(shut.closed_at).toBeTruthy();
    const back = wos.reopenFinancialPeriod(p.id);
    expect(back.status).toBe('OPEN');
    expect(back.closed_at).toBeNull();
    expect(() => wos.reopenFinancialPeriod(p.id)).toThrow(/Only closed/);
    expect(wos.closeFinancialPeriod(p.id).status).toBe('CLOSED');
    expect(() => wos.reopenFinancialPeriod(999999999)).toThrow(/not found/);
  });
  test('full loop: blocked under closed, allowed after reopen', () => {
    const p = wos.createFinancialPeriod({ name: 'jest085-loop', months: 1 });
    periodIds.push(p.id);
    wos.closeFinancialPeriod(p.id);
    expect(() => move(1)).toThrow(/closed financial period/);
    wos.reopenFinancialPeriod(p.id);
    expect(move(1).qty_after).toBeGreaterThanOrEqual(1);
  });
});
