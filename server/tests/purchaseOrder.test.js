/**
 * Procurement domain (Phase 8): a Purchase Order is a COMMERCIAL document, not
 * inventory. Creating a PO (draft) and even marking it 'received' must NOT
 * increase stock. Only the actual receiving workflow (supply_order → issue)
 * moves inventory and creates cost layers.
 */
const express = require('express');
const http = require('http');
const db = require('../db');
const warehouseOrderService = require('../services/warehouseOrderService');

let server, base, catId, supplierId;

async function start() {
  await db.initPromise;
  catId = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get().id;
  supplierId = db.prepare("INSERT INTO suppliers (name, is_active) VALUES ('PO Test Supplier', 1)").run().lastInsertRowid;
  const app = express();
  app.use(express.json());
  // requirePermission's super-admin branch: isAdmin && !userId → permissions ['*']
  app.use((req, res, next) => { req.session = { isAdmin: true, username: 'admin' }; next(); });
  app.use('/api/admin/purchase-orders', require('../routes/purchaseOrders'));
  server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
}

afterAll(async () => {
  try { server && server.close(); } catch {}
  try {
    db.prepare('DELETE FROM purchase_order_items WHERE po_id IN (SELECT id FROM purchase_orders WHERE supplier_id = ?)').run(supplierId);
    db.prepare('DELETE FROM purchase_orders WHERE supplier_id = ?').run(supplierId);
    db.prepare('DELETE FROM suppliers WHERE id = ?').run(supplierId);
    db.prepare("DELETE FROM customers WHERE email LIKE 'po-%@example.com'").run();
    db.saveDb();
  } catch {}
});

function onHand(pid) {
  return db.prepare('SELECT qty_on_hand FROM inventory WHERE product_id = ? AND warehouse_id = 1').get(pid)?.qty_on_hand ?? 0;
}

function makeProduct(name, stock) {
  const r = db.prepare("INSERT INTO products (name, price, cost_price, category_id, active, stock) VALUES (?, 90000, 50000, ?, 1, 0)").run(name, catId);
  const pid = r.lastInsertRowid;
  db.prepare('INSERT INTO inventory (product_id, warehouse_id, qty_on_hand) VALUES (?, 1, 0)').run(pid);
  db.prepare("INSERT INTO inventory_movements (product_id, warehouse_id, type, qty_change, qty_before, qty_after, unit_cost, note) VALUES (?, 1, 'receipt', ?, 0, ?, 50000, 'po-test seed')").run(pid, stock, stock);
  return pid;
}

beforeAll(async () => { await start(); });

async function makePO() {
  const pid = makeProduct('po-item', 5);
  const poRes = await fetch(base + '/api/admin/purchase-orders', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ supplier_id: supplierId, items: [{ product_id: pid, qty_ordered: 10, unit_cost: 50000 }], notes: 'test' }),
  });
  return { pid, po: await poRes.json() };
}

async function setStatus(id, status, extra) {
  return fetch(base + `/api/admin/purchase-orders/${id}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, ...extra }) });
}

test('approve (confirmed) records the approving actor and does NOT move stock', async () => {
  const { pid, po } = await makePO();
  const stockBefore = onHand(pid);
  expect(await setStatus(po.id, 'sent').then(r => r.status)).toBe(200);
  const st = await setStatus(po.id, 'confirmed');
  expect(st.status).toBe(200);
  const row = db.prepare('SELECT status, approved_by, approved_at FROM purchase_orders WHERE id = ?').get(po.id);
  expect(row.status).toBe('confirmed');
  expect(row.approved_by).toBe('admin');
  expect(row.approved_at).toBeTruthy();
  expect(onHand(pid)).toBe(stockBefore); // approval never moves stock
});

test('rejection (sent → cancelled) requires a reason; stores reason + rejector', async () => {
  const { po } = await makePO();
  await setStatus(po.id, 'sent');
  // without a reason → 400
  const noReason = await setStatus(po.id, 'cancelled');
  expect(noReason.status).toBe(400);
  // with a reason → stored
  const withReason = await setStatus(po.id, 'cancelled', { reject_reason: 'Supplier no longer available' });
  expect(withReason.status).toBe(200);
  const row = db.prepare('SELECT status, reject_reason, rejected_by, rejected_at FROM purchase_orders WHERE id = ?').get(po.id);
  expect(row.status).toBe('cancelled');
  expect(row.reject_reason).toBe('Supplier no longer available');
  expect(row.rejected_by).toBe('admin');
  expect(row.rejected_at).toBeTruthy();
});

test('PO create + mark received does NOT increase stock; receiving (supply) does', async () => {
  const pid = makeProduct('po-item', 5);
  const stockBefore = onHand(pid);

  // 1) Create a PO (draft) — stock unchanged
  const poRes = await fetch(base + '/api/admin/purchase-orders', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ supplier_id: supplierId, items: [{ product_id: pid, qty_ordered: 10, unit_cost: 50000 }], notes: 'test' }),
  });
  expect(poRes.status).toBe(201);
  const po = await poRes.json();
  expect(onHand(pid)).toBe(stockBefore); // PO alone never moves stock

  // 2) Advance PO to 'received' (draft→sent→confirmed→received) — STILL no stock change
  for (const status of ['sent', 'confirmed', 'received']) {
    const st = await fetch(base + `/api/admin/purchase-orders/${po.id}/status`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    expect(st.status).toBe(200);
  }
  expect(onHand(pid)).toBe(stockBefore);

  // 3) Actual receiving via the supply workflow increases stock + adds a cost layer
  const sup = warehouseOrderService.createSupplyOrder({ supplierName: 'PO Test Supplier', warehouseId: 1, items: [{ product_id: pid, qty: 10, unit_cost: 50000 }] });
  await warehouseOrderService.issueSupplyOrder(sup.id, 'test');
  expect(onHand(pid)).toBe(stockBefore + 10);
  const layers = db.prepare('SELECT unit_cost, remaining_quantity FROM inventory_cost_layers WHERE product_id = ? AND remaining_quantity > 0').all(pid);
  expect(layers.some(l => l.unit_cost === 50000 && l.remaining_quantity === 10)).toBe(true);
});
