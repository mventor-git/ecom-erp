/**
 * Tests for the picking & packing workflow (mventor-ticket-048).
 */
const db = require('../db');
const workflow = require('../services/orderWorkflowService');
const pickingPacking = require('../services/pickingPackingService');
const settingsService = require('../services/settingsService');

let orderId = null;
let custId = null;

// listPickingTasks returns {items, pagination}; listPackingTasks returns an array.
function pickTask() { return (pickingPacking.listPickingTasks().items || []).find(t => t.order_id === orderId); }
function packTask() { return (pickingPacking.listPackingTasks()).find(t => t.order_id === orderId); }

beforeAll(async () => {
  await db.initPromise;
  settingsService.set('order_flow_enabled', true, 'jest');
  // deterministic + FK-safe: unique email so a prior run's leftover never collides
  const testEmail = `jest.packing-${Math.random().toString(36).slice(2, 10)}@test.com`;
  custId = db.prepare('INSERT INTO customers (email, name, google_id) VALUES (?, ?, ?)')
    .run(testEmail, 'Jest Packing', 'jest_packing_' + Math.random().toString(36).slice(2, 8)).lastInsertRowid;
  const res = db.prepare(`
    INSERT INTO orders (customer_id, total, status, items, payment_status)
    VALUES (?, 10000, 'confirmed', ?, 'paid')
  `).run(custId, JSON.stringify([{ id: 1, name: 'Test', price: 5000, qty: 2 }]));
  orderId = res.lastInsertRowid;
});

afterAll(() => {
  settingsService.set('order_flow_enabled', false, 'jest');
  // children-first (FK ON): picking/packing tasks + events reference the order
  db.prepare('DELETE FROM packing_tasks WHERE order_id = ?').run(orderId);
  db.prepare('DELETE FROM picking_tasks WHERE order_id = ?').run(orderId);
  db.prepare("DELETE FROM events WHERE entity_type = 'order' AND entity_id = ?").run(orderId);
  db.prepare('DELETE FROM orders WHERE id = ?').run(orderId);
  db.prepare('DELETE FROM customers WHERE id = ?').run(custId);
  db.saveDb();
});

describe('Picking workflow', () => {
  test('entering picking creates a picking task with the order items', () => {
    // transition confirmed â†’ picking (hooks startPicking)
    const updated = workflow.transitionOrder(orderId, 'picking', { userId: 'jest-warehouse' });
    expect(updated.status).toBe('picking');

    const tasks = pickingPacking.listPickingTasks({ status: 'pending' });
    const task = (tasks.items || []).find(t => t.order_id === orderId);
    expect(task).toBeTruthy();
    expect(task.items.length).toBe(1);
    expect(task.items[0].name).toBe('Test');
  });

  test('picking task status flow: pending â†’ in_progress â†’ picked (moves order to packing)', () => {
    const task = pickTask();

    const started = pickingPacking.updatePickingStatus(task.id, 'in_progress', { userId: 'jest-warehouse' });
    expect(started.status).toBe('in_progress');

    const picked = pickingPacking.updatePickingStatus(task.id, 'picked', { userId: 'jest-warehouse' });
    expect(picked.status).toBe('picked');

    // order automatically moved to packing + packing task created
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    expect(order.status).toBe('packing');
    const packingTasks = pickingPacking.listPackingTasks();
    expect(packingTasks.some(t => t.order_id === orderId)).toBe(true);
  });

  test('invalid picking status rejected', () => {
    const task = pickTask();
    expect(() => pickingPacking.updatePickingStatus(task.id, 'exploded', { userId: 'jest' })).toThrow(/Invalid picking status/);
  });
});

describe('Packing workflow', () => {
  test('packing task starts and packed moves order to ready_for_shipping', () => {
    const task = packTask();

    const started = pickingPacking.updatePackingStatus(task.id, 'in_progress', { userId: 'jest-packer' });
    expect(started.status).toBe('in_progress');

    const packed = pickingPacking.updatePackingStatus(task.id, 'packed', { userId: 'jest-packer', notes: 'all good' });
    expect(packed.status).toBe('packed');
    expect(packed.notes).toBe('all good');

    // order â†’ ready_for_shipping
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    expect(order.status).toBe('ready_for_shipping');
  });

  test('problem status does not advance the order', () => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    expect(order.status).toBe('ready_for_shipping');

    const task = packTask();
    const problem = pickingPacking.updatePackingStatus(task.id, 'problem', { userId: 'jest-packer', notes: 'missing item' });
    expect(problem.status).toBe('problem');
    // order stays ready_for_shipping
    expect(db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId).status).toBe('ready_for_shipping');

    // back to packed â†’ complete
    pickingPacking.updatePackingStatus(task.id, 'packed', { userId: 'jest-packer' });
    pickingPacking.updatePackingStatus(task.id, 'completed', { userId: 'jest-packer' });
  });

  test('assignment notifies and persists assignee', () => {
    const task = packTask();
    const assigned = pickingPacking.assignPackingTask(task.id, 1, { userId: 'jest-admin' });
    expect(assigned.assignee_id).toBe(1);

    const mine = pickingPacking.listPackingTasks({ mine: 1 });
    expect(mine.some(t => t.order_id === orderId)).toBe(true);
  });
});
