/**
 * Picking & Packing Service â€” post-confirmation warehouse + packing workflow.
 * mventor-ticket-048
 *
 * Picking:  order confirmed â†’ picking task created â†’ warehouse picks â†’ picked
 * Packing:  order enters packing â†’ packing task created â†’ assigned packer
 *           (pending â†’ in_progress â†’ packed | problem) â†’ packed triggers the
 *           order to ready_for_shipping â†’ shipping workflow.
 *
 * Notifications go to the assigned user AND users with the
 * inventory.packing permission.
 */

const db = require('../db');
const eventService = require('./eventService');
const orderWorkflowService = require('./orderWorkflowService');

// â”€â”€ Helpers â”€â”€

function orderItems(order) {
  let items = [];
  try { items = JSON.parse(order.items || '[]'); } catch { items = []; }
  return items;
}

function usersWithPermission(permission) {
  return require('./permissionService').usersWithPermission(permission);
}

function notify(userIds, title, message, link = null) {
  const notificationService = require('./notificationService');
  new Set(userIds).forEach(uid => {
    notificationService.sendInApp(uid, title, message, link).catch(() => {});
  });
}

function logEvent(orderId, type, userId, payload = {}) {
  eventService.emit(type, eventService.ENTITY_TYPES.ORDER, orderId, {
    userId: userId || 'system',
    payload: { orderId, ...payload },
  });
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PICKING
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function startPicking(orderId, { assigneeId = null, userId = 'system' } = {}) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) throw new Error('Order not found');

  const existing = db.prepare('SELECT * FROM picking_tasks WHERE order_id = ?').get(orderId);
  if (existing) return existing;

  const result = db.prepare(`
    INSERT INTO picking_tasks (order_id, assignee_id, status, items)
    VALUES (?, ?, 'pending', ?)
  `).run(orderId, assigneeId || null, JSON.stringify(orderItems(order)));

  const task = db.prepare('SELECT * FROM picking_tasks WHERE id = ?').get(result.lastInsertRowid);
  logEvent(orderId, 'picking_task_created', userId, { taskId: task.id });
  notify(
    [...usersWithPermission('inventory.manage'), ...(assigneeId ? [assigneeId] : [])],
    'Picking Task Created',
    `Order #${orderId} is ready for warehouse picking`,
    '/erp/packing'
  );
  return task;
}

function listPickingTasks(filters = {}) {
  const { status, assigneeId, limit = 100, offset = 0, search = '', startDate, endDate } = filters;
  let sql = `
    SELECT pt.*, o.total, o.created_at as order_created_at, o.status as order_status,
           c.name as customer_name, c.email as customer_email
    FROM picking_tasks pt
    JOIN orders o ON o.id = pt.order_id
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE 1=1
  `;
  const params = [];
  if (status) { sql += ' AND pt.status = ?'; params.push(status); }
  if (assigneeId) { sql += ' AND (pt.assignee_id = ? OR pt.assignee_id IS NULL)'; params.push(assigneeId); }
  if (search) {
    sql += ` AND (pt.id LIKE ? OR o.total LIKE ? OR c.name LIKE ? OR c.email LIKE ?)`;
    const s = '%' + search + '%';
    params.push(s, s, s, s);
  }
  if (startDate) { sql += ' AND pt.created_at >= ?'; params.push(startDate); }
  if (endDate) { sql += ' AND pt.created_at < ?'; params.push(endDate); }
  sql += ' ORDER BY pt.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  const rows = db.prepare(sql).all(...params);
  const totalSql = sql.replace('SELECT pt.*, o.total, o.created_at as order_created_at, o.status as order_status, c.name as customer_name, c.email as customer_email', 'SELECT COUNT(*) as total').replace(/LIMIT \? OFFSET \?/, '').replace(/ORDER BY pt\.created_at DESC/, '');
  const totalRow = db.prepare(totalSql).get(...params.slice(0, params.length - 2));
  return {
    items: rows.map(t => ({ ...t, items: JSON.parse(t.items || '[]') })),
    pagination: { page: Math.floor(offset / limit) + 1, limit, total: totalRow ? totalRow.total : 0, totalPages: Math.ceil((totalRow ? totalRow.total : 0) / limit) || 1 }
  };
}

function updatePickingStatus(taskId, status, { userId = 'system', notes = '' } = {}) {
  const valid = ['pending', 'in_progress', 'picked'];
  if (!valid.includes(status)) throw new Error(`Invalid picking status: ${status}`);

  // PICK-C07: ordered transition guard (minimal, safe)
  const task = db.prepare('SELECT * FROM picking_tasks WHERE id = ?').get(taskId);
  if (!task) throw new Error('Picking task not found');
  const ordered = { pending: ['in_progress'], in_progress: ['picked', 'in_progress'], picked: ['picked'] };
  const current = task.status || 'pending';
  if (!ordered[current] || !ordered[current].includes(status)) {
    throw new Error(`Invalid transition: ${current} → ${status}`);
  }
  if (!task) throw new Error('Picking task not found');

  const sets = ['status = ?', 'notes = ?'];
  const params = [status, notes];
  if (status === 'in_progress') { sets.push('started_at = COALESCE(started_at, CURRENT_TIMESTAMP)'); }
  // PICK-D01/02: completion metadata (picked_by, picked_at) is owned by the
  // FIRST transition into 'picked'. Retries (picked → picked) must NOT
  // overwrite who completed the task or when. True idempotency.
  const firstCompletion = status === 'picked' && current !== 'picked';
  if (firstCompletion) { sets.push('picked_at = CURRENT_TIMESTAMP', 'picked_by = ?'); params.push(userId); }
  params.push(taskId);
  db.prepare(`UPDATE picking_tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  // PICK-D10: a completion event is one-time. Retries (picked → picked) do
  // NOT create a duplicate 'picking_status_changed' audit event.
  const isCompletion = status === 'picked' && current !== 'picked';
  const isStart = status === 'in_progress' && current !== 'in_progress';
  if (isCompletion || isStart) {
    logEvent(task.order_id, 'picking_status_changed', userId, { taskId, status });
  }

  // picked â†’ move the order into packing (creates the packing task) — one-time
  if (isCompletion) {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(task.order_id);
    if (order && ['confirmed', 'picking'].includes(order.status)) {
      orderWorkflowService.transitionOrder(task.order_id, 'packing', { userId, reason: 'picking completed' });
    }
  }
  return db.prepare('SELECT * FROM picking_tasks WHERE id = ?').get(taskId);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PACKING
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function createPackingTask(orderId, { assigneeId = null, userId = 'system' } = {}) {
  const existing = db.prepare('SELECT * FROM packing_tasks WHERE order_id = ?').get(orderId);
  if (existing) return existing;

  const result = db.prepare(`
    INSERT INTO packing_tasks (order_id, assignee_id, status)
    VALUES (?, ?, 'pending')
  `).run(orderId, assigneeId || null);

  const task = db.prepare('SELECT * FROM packing_tasks WHERE id = ?').get(result.lastInsertRowid);
  logEvent(orderId, 'packing_task_created', userId, { taskId: task.id });
  notify(
    [...usersWithPermission('inventory.packing'), ...(assigneeId ? [assigneeId] : [])],
    'Packing Task Created',
    `Order #${orderId} is ready for packing`,
    '/erp/packing'
  );
  return task;
}

function listPackingTasks(filters = {}) {
  const { status, assigneeId, mine = false, limit = 100 } = filters;
  let sql = `
    SELECT pt.*, o.total, o.created_at as order_created_at, o.status as order_status,
           c.name as customer_name, c.email as customer_email,
           o.shipping_name, o.shipping_address, o.shipping_city, o.shipping_phone
    FROM packing_tasks pt
    JOIN orders o ON o.id = pt.order_id
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE 1=1
  `;
  const params = [];
  if (status) { sql += ' AND pt.status = ?'; params.push(status); }
  if (assigneeId) { sql += ' AND (pt.assignee_id = ? OR pt.assignee_id IS NULL)'; params.push(assigneeId); }
  if (mine) { sql += ' AND pt.assignee_id = ?'; params.push(mine); }
  sql += ' ORDER BY pt.created_at DESC LIMIT ?';
  params.push(limit);
  return db.prepare(sql).all(...params);
}

function assignPackingTask(taskId, assigneeId, { userId = 'system' } = {}) {
  const task = db.prepare('SELECT * FROM packing_tasks WHERE id = ?').get(taskId);
  if (!task) throw new Error('Packing task not found');
  db.prepare('UPDATE packing_tasks SET assignee_id = ? WHERE id = ?').run(assigneeId || null, taskId);
  const updated = db.prepare('SELECT * FROM packing_tasks WHERE id = ?').get(taskId);
  if (assigneeId) {
    notify([assigneeId], 'You have a packing task', `Order #${task.order_id} assigned to you`, '/erp/packing');
  }
  logEvent(task.order_id, 'packing_task_assigned', userId, { taskId, assigneeId });
  return updated;
}

function updatePackingStatus(taskId, status, { userId = 'system', notes = '' } = {}) {
  const valid = ['pending', 'in_progress', 'packed', 'problem', 'completed'];
  if (!valid.includes(status)) throw new Error(`Invalid packing status: ${status}`);

  const task = db.prepare('SELECT * FROM packing_tasks WHERE id = ?').get(taskId);
  if (!task) throw new Error('Packing task not found');

  // Ordered transition guard (mirrors picking): only valid business transitions.
  const ordered = {
    pending: ['in_progress'],
    in_progress: ['packed', 'problem', 'in_progress'],
    problem: ['packed', 'in_progress', 'problem'],
    packed: ['completed', 'problem', 'packed'],
    completed: ['completed'],
  };
  const current = task.status || 'pending';
  if (!ordered[current] || !ordered[current].includes(status)) {
    throw new Error(`Invalid transition: ${current} -> ${status}`);
  }

  const sets = ['status = ?', 'notes = ?'];
  const params = [status, notes];
  if (status === 'in_progress') { sets.push('started_at = COALESCE(started_at, CURRENT_TIMESTAMP)'); }
  // Completion metadata is owned by the FIRST transition into that state.
  // Retries must NOT overwrite who/when (true idempotency, mirrors picking).
  const firstPacked = status === 'packed' && current !== 'packed';
  const firstCompleted = status === 'completed' && current !== 'completed';
  if (firstPacked) { sets.push('packed_at = CURRENT_TIMESTAMP', 'packed_by = ?'); params.push(userId); }
  if (firstCompleted) { sets.push('completed_at = CURRENT_TIMESTAMP'); }
  params.push(taskId);
  db.prepare(`UPDATE packing_tasks SET ${sets.join(', ')} WHERE id = ?`).run(...params);

  // One-time audit event on state-changing transitions (no duplicates on retry).
  const isTransition = status !== current;
  if (isTransition) {
    logEvent(task.order_id, 'packing_status_changed', userId, { taskId, status, notes });
  }

  // packed â†’ order is ready for shipping (triggers the shipping workflow)
  if (firstPacked) {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(task.order_id);
    if (order && ['confirmed', 'picking', 'packing'].includes(order.status)) {
      orderWorkflowService.transitionOrder(task.order_id, 'ready_for_shipping', { userId, reason: 'packing completed' });
    }
  }

  return db.prepare('SELECT * FROM packing_tasks WHERE id = ?').get(taskId);
}

module.exports = {
  startPicking,
  listPickingTasks,
  updatePickingStatus,
  createPackingTask,
  listPackingTasks,
  assignPackingTask,
  updatePackingStatus,
};
