/**
 * Bridge line-cost threading — mventor-ticket-072.
 * Fixture product carries cost_price 1234 but a real 777 cost layer, so the
 * asserted snapshot proves LAYER truth (not the wholesale fallback).
 * Full cleanup (children-first, jest-072 tagged) — never touches real rows.
 */
const db = require('../db');
const bridge = require('../services/salesInventoryBridge');
const inventoryService = require('../services/inventoryService');
const valuationService = require('../services/valuationService');
const orderLines = require('../services/orderLines');

let whId = null;
let catId = null;
let pid = null;
let cid = null;
let oid = null;

beforeAll(async () => {
  await db.initPromise;
  whId = db.prepare('SELECT id FROM warehouses ORDER BY id LIMIT 1').get().id;
  catId = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get().id;
});

function fixtureProduct() {
  pid = db.prepare(
    'INSERT INTO products (name, price, cost_price, category_id, active, stock, default_warehouse_id) VALUES (?, 2000, 1234, ?, 1, 10, ?)'
  ).run('jest-072-cost', catId, whId).lastInsertRowid;
  inventoryService.createMovement({ productId: pid, warehouseId: whId, type: 'receipt', qtyChange: 10, note: 'jest-072 seed' });
  valuationService.addLayer({ productId: pid, warehouseId: whId, qty: 10, unitCost: 777 });
}

function fixtureOrder() {
  cid = db.prepare('INSERT INTO customers (email, name, google_id) VALUES (?, ?, ?)')
    .run('jest072-' + Date.now().toString(36) + '@test.com', 'jest072', 'guest_jest072_' + Date.now().toString(36)).lastInsertRowid;
  oid = db.prepare("INSERT INTO orders (customer_id, total, status, items, price_list_code) VALUES (?, 4000, 'pending', '[]', 'retail')")
    .run(cid).lastInsertRowid;
}

afterEach(() => {
  if (oid) {
    db.prepare('DELETE FROM cost_consumption WHERE order_id = ?').run(oid);
    db.prepare('DELETE FROM issue_order_items WHERE issue_order_id IN (SELECT id FROM issue_orders WHERE order_id = ?)').run(oid);
    db.prepare('DELETE FROM issue_orders WHERE order_id = ?').run(oid);
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(oid);
    db.prepare('DELETE FROM orders WHERE id = ?').run(oid);
    oid = null;
  }
  if (cid) { db.prepare('DELETE FROM customers WHERE id = ?').run(cid); cid = null; }
  if (pid) {
    db.prepare('DELETE FROM inventory WHERE product_id = ?').run(pid);
    db.prepare('DELETE FROM inventory_movements WHERE product_id = ?').run(pid);
    db.prepare('DELETE FROM inventory_cost_layers WHERE product_id = ?').run(pid);
    db.prepare('DELETE FROM products WHERE id = ?').run(pid);
    pid = null;
  }
  db.prepare("DELETE FROM events WHERE payload LIKE '%jest-072%'").run();
  db.saveDb();
});

describe('bridge line-cost threading (072)', () => {
  test('issue returns layer unit cost and applyLineCosts snapshots it', () => {
    fixtureProduct();
    fixtureOrder();
    orderLines.insertLineRows(orderLines.buildLineRows(oid,
      [{ product_id: pid, name: 'jest-072-cost', qty: 2, price: 2000 }], 'retail').rows);
    const res = bridge.issueForOrder(oid, [{ product_id: pid, quantity: 2 }], 'jest-072');
    expect(res.issued).toBe(1);
    expect(res.costs).toEqual([{ productId: pid, qty: 2, unitCost: 777 }]);
    expect(orderLines.applyLineCosts(oid, res.costs)).toBe(1);
    const line = db.prepare('SELECT cost_snapshot FROM order_items WHERE order_id = ?').get(oid);
    expect(line.cost_snapshot).toBe(777);
  });
  test('repeat issue returns empty costs and never clobbers snapshots', () => {
    fixtureProduct();
    fixtureOrder();
    orderLines.insertLineRows(orderLines.buildLineRows(oid,
      [{ product_id: pid, name: 'jest-072-cost', qty: 2, price: 2000 }], 'retail').rows);
    db.prepare('UPDATE order_items SET cost_snapshot = 555 WHERE order_id = ?').run(oid);
    const again = bridge.issueForOrder(oid, [{ product_id: pid, quantity: 2 }], 'jest-072');
    expect(orderLines.applyLineCosts(oid, again.costs || [])).toBe(0);
    const line = db.prepare('SELECT cost_snapshot FROM order_items WHERE order_id = ?').get(oid);
    expect(line.cost_snapshot).toBe(555);
  });
  test('applyLineCosts ignores zero costs and unknown products', () => {
    fixtureProduct();
    fixtureOrder();
    orderLines.insertLineRows(orderLines.buildLineRows(oid,
      [{ product_id: pid, name: 'jest-072-cost', qty: 1, price: 2000 }], 'retail').rows);
    expect(orderLines.applyLineCosts(oid, [{ productId: pid, qty: 1, unitCost: 0 }])).toBe(0);
    expect(orderLines.applyLineCosts(oid, [{ productId: 999999999, qty: 1, unitCost: 777 }])).toBe(0);
    expect(orderLines.applyLineCosts(oid, [])).toBe(0);
  });
});
