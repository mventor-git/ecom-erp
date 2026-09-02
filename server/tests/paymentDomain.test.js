/**
 * Payment-domain anti-fraud tests (Phase 3/4/5).
 *
 * Proves that a "paid" order state is only concluded from a VERIFIED provider
 * confirmation whose SIGNED amount matches the order's authoritative total —
 * never from a client/slider mutation, and never with a mismatched amount.
 *
 * Uses the real seeded DB; every artifact is FK-cleaned afterwards.
 */
const db = require('../db');
const ws = require('../services/kashierWebhookService');
const inventoryService = require('../services/inventoryService');

let catId = null;
const created = [];

function insertProduct(name, stock) {
  const r = db.prepare("INSERT INTO products (name, price, cost_price, category_id, active, stock) VALUES (?, 10000, 5000, ?, 1, 0)").run(name, catId);
  created.push(r.lastInsertRowid);
  const pid = r.lastInsertRowid;
  db.prepare('INSERT INTO inventory (product_id, warehouse_id, qty_on_hand) VALUES (?, 1, 0)').run(pid);
  inventoryService.createMovement({ productId: pid, warehouseId: 1, type: 'receipt', qtyChange: stock, note: 'jet:paydomain seed' });
  return pid;
}

function insertOrder(productId, qty, total) {
  const c = db.prepare('INSERT INTO customers (email, name, google_id) VALUES (?, ?, NULL)').run(`paydomain-${Math.random().toString(36).slice(2,8)}@t.com`, 'Pay');
  created.push(c.lastInsertRowid);
  const items = JSON.stringify([{ id: productId, name: 'X', qty, price: total }]);
  const r = db.prepare("INSERT INTO orders (customer_id, total, status, items) VALUES (?, ?, 'pending', ?)").run(c.lastInsertRowid, total, items);
  created.push(r.lastInsertRowid);
  return r.lastInsertRowid;
}

function onHand(pid) {
  return db.prepare('SELECT qty_on_hand FROM inventory WHERE product_id = ? AND warehouse_id = 1').get(pid)?.qty_on_hand ?? 0;
}

beforeAll(async () => {
  await db.initPromise;
  catId = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get().id;
});

afterEach(() => {
  // FK order: order children → orders → products → customers
  for (const oid of created.splice(0)) {
    try {
      db.prepare('DELETE FROM issue_order_items WHERE issue_order_id IN (SELECT id FROM issue_orders WHERE order_id = ?)').run(oid);
      db.prepare('DELETE FROM issue_orders WHERE order_id = ?').run(oid);
      db.prepare('DELETE FROM order_items WHERE order_id = ?').run(oid);
      db.prepare('DELETE FROM orders WHERE id = ?').run(oid);
    } catch { /* the id may be a product or customer */ }
  }
  for (const id of created.splice(0)) {
    try {
      db.prepare('DELETE FROM inventory_movements WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM inventory WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM inventory_cost_layers WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM products WHERE id = ?').run(id);
    } catch { /* customer id */ }
  }
  db.saveDb();
});

describe('Payment domain — verified paid transition (anti-fraud)', () => {
  test('matching amount → order becomes paid with verified evidence + stock decremented', () => {
    const pid = insertProduct('jet:paydomain-prod', 10);
    const oid = insertOrder(pid, 2, 10000); // total = 10000 cents = 100.00 EGP
    const before = onHand(pid);

    ws.routeEvent('transaction-success', {
      eventType: 'transaction-success',
      sessionId: 'paydomain-s1',
      merchantOrderId: String(oid),
      amount: '100.00', // major units → 10000 cents
      currency: 'EGP',
      status: 'SUCCESS',
    });

    const order = db.prepare('SELECT status, payment_status, payment_method, paid_at FROM orders WHERE id = ?').get(oid);
    expect(order.status).toBe('paid');
    expect(order.payment_status).toBe('verified');   // NOT fabricable from a bare status slider
    expect(order.payment_method).toBe('kashier');
    expect(order.paid_at).toBeTruthy();
    expect(onHand(pid)).toBe(before - 2); // exactly one issue, on-hand decremented
  });

  test('mismatched amount → order stays pending, no stock change, no paid evidence', () => {
    const pid = insertProduct('jet:paydomain-prod2', 10);
    const oid = insertOrder(pid, 2, 10000);
    const before = onHand(pid);

    ws.routeEvent('transaction-success', {
      eventType: 'transaction-success',
      sessionId: 'paydomain-s2',
      merchantOrderId: String(oid),
      amount: '50.00', // 5000 cents ≠ 10000 → must not conclude payment
      currency: 'EGP',
      status: 'SUCCESS',
    });

    const order = db.prepare('SELECT status, payment_status, paid_at FROM orders WHERE id = ?').get(oid);
    expect(order.status).toBe('pending');           // not forced to paid
    expect(order.paid_at).toBeNull();
    expect(onHand(pid)).toBe(before);               // no issue
  });

  test('currency mismatch → order stays pending', () => {
    const pid = insertProduct('jet:paydomain-prod3', 10);
    const oid = insertOrder(pid, 1, 5000);

    ws.routeEvent('transaction-success', {
      eventType: 'transaction-success',
      sessionId: 'paydomain-s3',
      merchantOrderId: String(oid),
      amount: '50.00',
      currency: 'USD', // wrong currency
      status: 'SUCCESS',
    });

    expect(db.prepare('SELECT status FROM orders WHERE id = ?').get(oid).status).toBe('pending');
  });
});
