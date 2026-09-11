/**
 * Web cost threading end-to-end — mventor-ticket-073.
 * COD handler (mock req/res) creates order + lines + snapshot; paid webhook
 * flips verified-paid and snapshots layer truth (777 ≠ cost_price proves it).
 * Full cleanup (children-first, jest073-tagged) — never touches real rows.
 */
const db = require('../db');
const inventoryService = require('../services/inventoryService');
const valuationService = require('../services/valuationService');
const orderLines = require('../services/orderLines');
const ws = require('../services/kashierWebhookService');

let whId = null;
let catId = null;
const pids = [];
const oids = [];
const emails = [];

function fixtureProduct(name, price, cost) {
  const pid = db.prepare(
    'INSERT INTO products (name, price, cost_price, category_id, active, stock, default_warehouse_id) VALUES (?, ?, ?, ?, 1, 10, ?)'
  ).run(name, price, cost, catId, whId).lastInsertRowid;
  pids.push(pid);
  inventoryService.createMovement({ productId: pid, warehouseId: whId, type: 'receipt', qtyChange: 10, note: 'jest073 seed' });
  valuationService.addLayer({ productId: pid, warehouseId: whId, qty: 10, unitCost: 777 });
  return pid;
}

function cleanup() {
  for (const oid of oids.splice(0)) {
    // 086 postings: the paid-webhook test writes real journals via the handler
    db.prepare(`DELETE FROM journal_lines WHERE entry_id IN (SELECT id FROM journal_entries WHERE source_type = 'order' AND source_id = ?)`).run(oid);
    db.prepare(`DELETE FROM journal_entries WHERE source_type = 'order' AND source_id = ?`).run(oid);
    db.prepare('DELETE FROM cost_consumption WHERE order_id = ?').run(oid);
    db.prepare('DELETE FROM issue_order_items WHERE issue_order_id IN (SELECT id FROM issue_orders WHERE order_id = ?)').run(oid);
    db.prepare('DELETE FROM issue_orders WHERE order_id = ?').run(oid);
    db.prepare('DELETE FROM order_items WHERE order_id = ?').run(oid);
    db.prepare('DELETE FROM orders WHERE id = ?').run(oid);
  }
  for (const em of emails.splice(0)) {
    db.prepare('DELETE FROM customers WHERE email = ?').run(em);
  }
  for (const pid of pids.splice(0)) {
    db.prepare('DELETE FROM inventory WHERE product_id = ?').run(pid);
    db.prepare('DELETE FROM inventory_movements WHERE product_id = ?').run(pid);
    db.prepare('DELETE FROM inventory_cost_layers WHERE product_id = ?').run(pid);
    db.prepare('DELETE FROM products WHERE id = ?').run(pid);
  }
  db.prepare("DELETE FROM events WHERE payload LIKE '%jest073%'").run();
  db.saveDb();
}

beforeAll(async () => {
  await db.initPromise;
  whId = db.prepare('SELECT id FROM warehouses ORDER BY id LIMIT 1').get().id;
  catId = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get().id;
});

afterEach(cleanup);

function mockRes() {
  return {
    statusCode: 0, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

describe('web cost threading (073)', () => {
  test('COD checkout creates lines with layer-cost snapshots', () => {
    const pid = fixtureProduct('jest073-cod', 2000, 1234);
    // eslint-disable-next-line global-require
    const ordersRouter = require('../routes/orders');
    const layer = ordersRouter.stack.find(l => l.route && l.route.path === '/' && l.route.methods.post);
    const handler = layer.route.stack[0].handle;
    const email = 'jest073-cod@test.com';
    emails.push(email);
    const req = {
      body: { customer_email: email, customer_name: 'jest', items: [{ product_id: pid, quantity: 2 }], payment_method: 'cod' },
      ip: '127.0.0.1',
      get: () => 'jest-agent',
    };
    const res = mockRes();
    handler(req, res);
    expect(res.statusCode).toBe(201);
    const oid = res.body.id;
    oids.push(oid);
    const line = db.prepare('SELECT quantity, qty, price, base_price, final_price, cost_snapshot FROM order_items WHERE order_id = ?').get(oid);
    expect(line.quantity).toBe(2);
    expect(line.cost_snapshot).toBe(777);
    expect(db.prepare('SELECT status FROM orders WHERE id = ?').get(oid).status).toBe('pending');
  });

  test('paid webhook verifies paid AND snapshots layer cost', () => {
    const pid = fixtureProduct('jest073-webhook', 5000, 1234);
    const email = 'jest073-wh@test.com';
    db.prepare('INSERT INTO customers (email, name, google_id) VALUES (?, ?, ?)')
      .run(email, 'jest', 'guest_jest073_wh');
    emails.push(email);
    const cid = db.prepare('SELECT id FROM customers WHERE email = ?').get(email).id;
    const oid = db.prepare(
      "INSERT INTO orders (customer_id, total, status, items, price_list_code) VALUES (?, 10000, 'pending', ?, 'retail')"
    ).run(cid, JSON.stringify([{ product_id: pid, name: 'x', qty: 2, price: 5000 }])).lastInsertRowid;
    oids.push(oid);
    orderLines.insertLineRows(orderLines.buildLineRows(oid,
      [{ product_id: pid, name: 'x', qty: 2, price: 5000 }], 'retail').rows);
    ws.routeEvent('transaction-success', {
      eventType: 'transaction-success',
      sessionId: 'jest073-s1',
      merchantOrderId: String(oid),
      amount: '100.00',
      currency: 'EGP',
      status: 'SUCCESS',
    });
    expect(db.prepare('SELECT status, payment_status FROM orders WHERE id = ?').get(oid)).toMatchObject({ status: 'paid', payment_status: 'verified' });
    expect(db.prepare('SELECT cost_snapshot FROM order_items WHERE order_id = ?').get(oid).cost_snapshot).toBe(777);
  });
});
