const db = require('./server/db');
const pp = require('./server/services/pickingPackingService');

(async () => {
  await new Promise(r => setTimeout(r, 1000));

  // Find order 4 (paid status, has items)
  const order = db.prepare("SELECT * FROM orders WHERE id = 4").get();
  console.log("Order 4: status=" + order.status + ", total=" + order.total + ", items_count=" + (JSON.parse(order.items || '[]').length));

  // Create picking task (simulating confirmed -> picking transition)
  const task = pp.startPicking(4, { assigneeId: 3, userId: 'warehouse_staff@comfort-sign.local' });
  console.log("CREATED picking task id=" + task.id + ", order_id=" + task.order_id + ", status=" + task.status + ", assignee_id=" + task.assignee_id);

  // Update to in_progress (start picking)
  const started = pp.updatePickingStatus(task.id, 'in_progress', { userId: 'warehouse_staff@comfort-sign.local' });
  console.log("STARTED: status=" + started.status + ", started_at=" + started.started_at);

  // Update to picked (complete picking)
  const completed = pp.updatePickingStatus(task.id, 'picked', { userId: 'warehouse_staff@comfort-sign.local', notes: 'E2E verified' });
  console.log("COMPLETED: status=" + completed.status + ", picked_at=" + completed.picked_at + ", picked_by=" + completed.picked_by);

  // Verify order moved to packing
  const updatedOrder = db.prepare("SELECT status FROM orders WHERE id = ?").get(4);
  console.log("Order 4 status after complete: " + updatedOrder.status);

  // Verify NO new inventory movements created by picking
  const movementsAfter = db.prepare("SELECT COUNT(*) as c FROM inventory_movements").get();
  console.log("Inventory movements after complete: " + movementsAfter.c + " (expected: 0 = no double deduction)");

  // List all picking tasks
  const allTasks = pp.listPickingTasks({});
  console.log("All picking tasks: " + allTasks.length);
  allTasks.forEach(t => console.log("  task id=" + t.id + " order_id=" + t.order_id + " status=" + t.status + " assignee=" + t.assignee_id));

  // Verify idempotent (try complete again)
  const again = pp.updatePickingStatus(task.id, 'picked', { userId: 'warehouse_staff@comfort-sign.local', notes: 'retry test' });
  console.log("RETRY COMPLETE (idempotent): status=" + again.status + " (should still be picked, no error)");

  // CLEAN UP
  db.prepare("DELETE FROM picking_tasks WHERE id = ?").run(task.id);
  db.prepare("UPDATE orders SET status = 'paid', updated_at = CURRENT_TIMESTAMP WHERE id = 4").run();
  console.log("CLEANUP DONE: task deleted, order 4 restored to paid");
  process.exit(0);
})().catch(e => { console.error("ERROR:", e.message); process.exit(1); });
