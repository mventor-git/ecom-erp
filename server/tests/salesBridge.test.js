/**
 * Unit tests for the Sales ↔ Inventory Bridge (mventor-ticket-048).
 * Uses the real (seeded) database; every artifact is tagged 'jest-bridge'
 * and cleaned up afterwards.
 */
const db = require('../db');
const bridge = require('../services/salesInventoryBridge');
const inventoryService = require('../services/inventoryService');

let whId = null;
let catId = null;
const createdIds = [];
const createdOrders = [];
const createdCustomers = [];

function insertProduct(name, { stock = 0 } = {}) {
  const result = db.prepare(`
    INSERT INTO products (name, price, category_id, active, stock, default_warehouse_id)
    VALUES (?, 1000, ?, 1, ?, ?)
  `).run(name, catId, stock, whId);
  const id = result.lastInsertRowid;
  createdIds.push(id);
  return id;
}

/** Create a REAL relational order (customer → order) so the bridge's
 *  auto-issue-order can reference a valid `order_id` under FK enforcement. */
function createRealOrder() {
  const email = 'jest-bridge-' + Math.random().toString(36).slice(2, 10) + '@test.com';
  const cust = db.prepare('INSERT INTO customers (email, name, google_id) VALUES (?, ?, NULL)').run(email, 'Jest Bridge');
  createdCustomers.push(cust.lastInsertRowid);
  const ord = db.prepare("INSERT INTO orders (customer_id, total, status, items) VALUES (?, 10000, 'paid', '[]')").run(cust.lastInsertRowid);
  createdOrders.push(ord.lastInsertRowid);
  return ord.lastInsertRowid;
}

function onHand(productId) {
  const inv = db.prepare(
    'SELECT qty_on_hand FROM inventory WHERE product_id = ? AND warehouse_id = ? AND location_id IS NULL'
  ).get(productId, whId);
  return inv ? inv.qty_on_hand : 0;
}

function reservedQty(productId) {
  const inv = db.prepare(
    'SELECT qty_reserved FROM inventory WHERE product_id = ? AND warehouse_id = ? AND location_id IS NULL'
  ).get(productId, whId);
  return inv ? inv.qty_reserved : 0;
}

beforeAll(async () => {
  await db.initPromise;
  whId = db.prepare('SELECT id FROM warehouses ORDER BY id LIMIT 1').get().id;
  const cat = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get();
  catId = cat.id;
});

afterEach(() => {
  // CHILDREN FIRST (FK ON): order children → orders → customers → products
  for (const oid of createdOrders.splice(0)) {
    db.prepare('DELETE FROM issue_order_items WHERE issue_order_id IN (SELECT id FROM issue_orders WHERE order_id = ?)').run(oid);
    db.prepare('DELETE FROM issue_orders WHERE order_id = ?').run(oid);
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(oid);
    db.prepare('DELETE FROM orders WHERE id = ?').run(oid);
  }
  for (const cid of createdCustomers.splice(0)) {
    db.prepare('DELETE FROM customers WHERE id = ?').run(cid);
  }
  for (const id of createdIds.splice(0)) {
    db.prepare('DELETE FROM inventory WHERE product_id = ?').run(id);
    db.prepare('DELETE FROM inventory_movements WHERE product_id = ?').run(id); // receipt AND issue movements (notes differ)
    db.prepare('DELETE FROM inventory_cost_layers WHERE product_id = ?').run(id); // children before parent (FK ON)
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
  }
  db.prepare("DELETE FROM events WHERE payload LIKE '%jest-bridge%'").run();
  db.saveDb();
});

describe('Sales Inventory Bridge', () => {
  test('issueForOrder creates ISSUE movements and reduces on-hand', () => {
    const id = insertProduct('jest-bridge-issue', { stock: 10 });
    inventoryService.createMovement({ productId: id, warehouseId: whId, type: 'receipt', qtyChange: 10, note: 'jest-bridge seed' });

    const oid1 = createRealOrder();
    const res = bridge.issueForOrder(oid1, [{ id, quantity: 4 }], 'jest');
    expect(res.issued).toBe(1);
    expect(onHand(id)).toBe(6);

    // Idempotent: a second call must not double-issue
    const again = bridge.issueForOrder(oid1, [{ id, quantity: 4 }], 'jest');
    expect(again.skipped).toBe(true);
    expect(onHand(id)).toBe(6);
  });

  test('reserve → release cycle holds then frees stock without touching on-hand', () => {
    const id = insertProduct('jest-bridge-reserve', { stock: 8 });
    inventoryService.createMovement({ productId: id, warehouseId: whId, type: 'receipt', qtyChange: 8, note: 'jest-bridge seed' });

    const oid2 = createRealOrder();
    const r1 = bridge.reserveForOrder(oid2, [{ id, quantity: 3 }], 'jest');
    expect(r1.reserved).toBe(1);
    expect(onHand(id)).toBe(8);      // shelf unchanged
    expect(reservedQty(id)).toBe(3); // promise recorded

    // shipping frees the promise and takes the goods
    bridge.releaseForOrder(oid2, [{ id, quantity: 3 }], 'jest');
    bridge.issueForOrder(oid2, [{ id, quantity: 3 }], 'jest');
    expect(reservedQty(id)).toBe(0);
    expect(onHand(id)).toBe(5);
  });

  test('releaseForOrder is safe when nothing was reserved', () => {
    const id = insertProduct('jest-bridge-release-safe', { stock: 5 });
    const res = bridge.releaseForOrder(createRealOrder(), [{ id, quantity: 2 }], 'jest');
    expect(res.released).toBeGreaterThanOrEqual(0);
    expect(onHand(id)).toBe(0); // no inventory row existed — nothing changed
  });

  test('insufficient stock never throws — it reports failed items', () => {
    const id = insertProduct('jest-bridge-fail', { stock: 0 });
    const res = bridge.issueForOrder(createRealOrder(), [{ id, quantity: 99 }], 'jest');
    expect(res.issued).toBe(0);
    expect(res.failed.length).toBe(1);
    expect(res.failed[0].reason).toMatch(/Insufficient/);
  });
});
