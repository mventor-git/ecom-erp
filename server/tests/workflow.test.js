/**
 * Tests for the order workflow + quadruple confirmation engine (mventor-ticket-045).
 */
const db = require('../db');
const workflow = require('../services/orderWorkflowService');
const settingsService = require('../services/settingsService');

let orderId = null;
let productId = null;

beforeAll(async () => {
  await db.initPromise;
  settingsService.set('order_flow_enabled', false, 'jest'); // deterministic: legacy mode first
  // Self-sufficient fixtures: own customer + own stocked product (fresh stores have none)
  const cust = db.prepare('SELECT id FROM customers WHERE email = ?').get('jest.workflow@test.com');
  let custId = cust ? cust.id : null;
  if (!custId) {
    custId = db.prepare('INSERT INTO customers (email, name, google_id) VALUES (?, ?, ?)')
      .run('jest.workflow@test.com', 'Jest Workflow', 'jest_workflow').lastInsertRowid;
  }
  const wh = db.prepare('SELECT id FROM warehouses ORDER BY id LIMIT 1').get();
  let cat = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get();
  const catId = cat ? cat.id : db.prepare("INSERT INTO categories (name, slug) VALUES ('Jest Cat', 'jest-cat')").run().lastInsertRowid;
  productId = db.prepare("INSERT INTO products (name, price, category_id, active, stock) VALUES ('jest-wf-product', 5000, ?, 1, 0)").run(catId).lastInsertRowid;
  db.prepare(`
    INSERT INTO inventory_movements (product_id, warehouse_id, location_id, type, qty_change, qty_before, qty_after, unit_cost, note)
    VALUES (?, ?, NULL, 'receipt', 100, 0, 100, 2000, 'jest:wf-seed')
  `).run(productId, wh.id);
  db.prepare(`
    INSERT INTO inventory (product_id, warehouse_id, location_id, qty_on_hand, qty_reserved)
    VALUES (?, ?, NULL, 100, 0)
  `).run(productId, wh.id);

  const res = db.prepare(`
    INSERT INTO orders (customer_id, total, status, items)
    VALUES (?, 10000, 'pending', ?)
  `).run(custId, JSON.stringify([{ id: productId, name: 'Test', price: 5000, qty: 2 }]));
  orderId = res.lastInsertRowid;
});

afterAll(() => {
  // children-first (FK ON): the order lifecycle creates picking/packing tasks,
  // shipments, issue_orders and order_items that all reference orders.id.
  db.prepare('DELETE FROM packing_tasks WHERE order_id = ?').run(orderId);
  db.prepare('DELETE FROM picking_tasks WHERE order_id = ?').run(orderId);
  db.prepare('DELETE FROM shipments WHERE order_id = ?').run(orderId);
  db.prepare('DELETE FROM issue_orders WHERE order_id = ?').run(orderId);
  db.prepare('DELETE FROM order_items WHERE order_id = ?').run(orderId);
  db.prepare("DELETE FROM events WHERE entity_type = 'order' AND entity_id = ?").run(orderId);
  db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
  if (productId) {
    // All children first (FK ON) — the lifecycle may create movements/order-items
    // referencing the product with non-'jest:' notes.
    db.prepare('DELETE FROM issue_order_items WHERE product_id = ?').run(productId);
    db.prepare('DELETE FROM order_items WHERE product_id = ?').run(productId);
    db.prepare('DELETE FROM product_images WHERE product_id = ?').run(productId);
    db.prepare('DELETE FROM product_variants WHERE product_id = ?').run(productId);
    db.prepare('DELETE FROM product_suppliers WHERE product_id = ?').run(productId);
    db.prepare('DELETE FROM inventory WHERE product_id = ?').run(productId);
    db.prepare('DELETE FROM inventory_movements WHERE product_id = ?').run(productId);
    db.prepare('DELETE FROM inventory_cost_layers WHERE product_id = ?').run(productId);
    db.prepare('DELETE FROM products WHERE id = ?').run(productId);
  }
  db.saveDb();
});

describe('Order Workflow (legacy mode â€” flow disabled)', () => {
  test('legacy transitions still work', () => {
    expect(workflow.canTransition('pending', 'paid')).toBe(true);
    expect(workflow.canTransition('paid', 'shipped')).toBe(true);
    expect(workflow.canTransition('pending', 'shipped')).toBe(false);
    expect(workflow.canTransition('pending', 'cancelled')).toBe(true);
    expect(workflow.canTransition('cancelled', 'paid')).toBe(false);
  });

  test('transitionOrder updates status and emits an event', () => {
    const updated = workflow.transitionOrder(orderId, 'paid', { userId: 'jest-admin' });
    expect(updated.status).toBe('paid');
    const events = db.prepare(`
      SELECT * FROM events WHERE entity_type = 'order' AND entity_id = ? AND event_type = 'order_paid'
    `).all(orderId);
    expect(events.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Order Workflow (full flow enabled)', () => {
  beforeAll(() => {
    settingsService.set('order_flow_enabled', true, 'jest');
  });

  afterAll(() => {
    settingsService.set('order_flow_enabled', false, 'jest');
  });

  test('status list is configurable and complete', () => {
    const statuses = workflow.validStatuses();
    expect(statuses).toContain('draft');
    expect(statuses).toContain('payment_pending');
    expect(statuses).toContain('payment_verified');
    expect(statuses).toContain('admin_review');
    expect(statuses).toContain('confirmed');
    expect(statuses).toContain('picking');
    expect(statuses).toContain('packing');
    expect(statuses).toContain('ready_for_shipping');
    expect(statuses).toContain('shipped');
    expect(statuses).toContain('delivered');
    expect(statuses).toContain('completed');
    expect(statuses).toContain('cancelled');
  });

  test('valid transitions follow the lifecycle', () => {
    expect(workflow.canTransition('draft', 'payment_pending')).toBe(true);
    expect(workflow.canTransition('payment_pending', 'payment_verified')).toBe(true);
    expect(workflow.canTransition('payment_verified', 'admin_review')).toBe(true);
    expect(workflow.canTransition('admin_review', 'confirmed')).toBe(true);
    expect(workflow.canTransition('confirmed', 'picking')).toBe(true);
    expect(workflow.canTransition('picking', 'packing')).toBe(true);
    expect(workflow.canTransition('packing', 'ready_for_shipping')).toBe(true);
    expect(workflow.canTransition('ready_for_shipping', 'shipped')).toBe(true);
    expect(workflow.canTransition('shipped', 'delivered')).toBe(true);
    expect(workflow.canTransition('delivered', 'completed')).toBe(true);
    // no skipping
    expect(workflow.canTransition('draft', 'confirmed')).toBe(false);
    expect(workflow.canTransition('pending', 'shipped')).toBe(false);
    // cancellation from active states
    expect(workflow.canTransition('packing', 'cancelled')).toBe(true);
    expect(workflow.canTransition('completed', 'cancelled')).toBe(false);
  });

  test('invalid transition throws', () => {
    db.prepare("UPDATE orders SET status = 'payment_pending' WHERE id = ?").run(orderId);
    expect(() => workflow.transitionOrder(orderId, 'shipped', { userId: 'jest' })).toThrow(/Invalid transition/);
  });

  test('confirmation checks: manual approval gate', () => {
    // reset to payment_verified â†’ admin_review (stamps review time); mark payment verified
    db.prepare("UPDATE orders SET status = 'payment_verified', admin_review_at = NULL, payment_status = 'paid' WHERE id = ?").run(orderId);
    workflow.transitionOrder(orderId, 'admin_review', { userId: 'jest' });

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    expect(order.admin_review_at).toBeTruthy();

    // with manual approval required and no timeout elapsed â†’ cannot confirm yet
    const checks = workflow.runConfirmationChecks(order);
    expect(checks.paymentVerified).toBe(true);
    expect(checks.manualApproval).toBe(false);
    expect(checks.allPassed).toBe(false);

    // manual approval â†’ confirmed
    const confirmed = workflow.transitionOrder(orderId, 'confirmed', { userId: 'jest-admin' });
    expect(confirmed.status).toBe('confirmed');
    const ev = db.prepare(`
      SELECT * FROM events WHERE entity_type = 'order' AND entity_id = ? AND event_type = 'order_confirmed'
    `).all(orderId);
    expect(ev.length).toBeGreaterThanOrEqual(1);
  });

  test('auto-approval sweep approves timed-out admin_review orders', () => {
    // disable manual requirement timing: set timeout 1 hour, backdate review start
    settingsService.set('confirm_auto_timeout_hours', 1, 'jest');
    db.prepare("UPDATE orders SET status = 'admin_review', admin_review_at = datetime('now', '-2 hours'), payment_status = 'paid' WHERE id = ?").run(orderId);

    const result = workflow.checkAutoApprovals();
    expect(result.approved).toBeGreaterThanOrEqual(1);

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    expect(order.status).toBe('confirmed');

    const ev = db.prepare(`
      SELECT * FROM events WHERE entity_type = 'order' AND entity_id = ? AND event_type = 'order_auto_approved'
    `).all(orderId);
    expect(ev.length).toBeGreaterThanOrEqual(1);
  });

  test('full lifecycle can complete', () => {
    const seq = ['picking', 'packing', 'ready_for_shipping', 'shipped', 'delivered', 'completed'];
    let current = 'confirmed';
    seq.forEach(next => {
      db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(current, orderId);
      const updated = workflow.transitionOrder(orderId, next, { userId: 'jest' });
      expect(updated.status).toBe(next);
      current = next;
    });
    expect(current).toBe('completed');
  });
});
