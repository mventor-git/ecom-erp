/**
 * Order-time address snapshot integrity (Phase 11).
 *
 * A customer may change their default/account address later; historical orders
 * MUST preserve the address used at checkout. Proves the real `POST /api/orders`
 * route snapshots shipping into the order, and that a later customer-address
 * change does NOT rewrite an existing order's snapshot.
 */
const express = require('express');
const http = require('http');
const db = require('../db');

let server;
let base;
let catId = null;
let productId = null;

async function start() {
  await db.initPromise;
  catId = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get().id;
  const p = db.prepare("INSERT INTO products (name, price, cost_price, category_id, active, stock, sku) VALUES ('snap-prod', 10000, 5000, ?, 1, 100, 'SNAP-1')").run(catId);
  productId = p.lastInsertRowid;
  const app = express();
  app.use(express.json());
  app.use('/api/orders', require('../routes/orders'));
  server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
}

function post(body) {
  return fetch(base + '/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async r => ({ status: r.status, data: await r.json() }));
}

afterAll(async () => {
  try { server && server.close(); } catch {}
  try {
    db.prepare('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE items LIKE \'%snap-prod%\')').run();
    db.prepare('DELETE FROM orders WHERE items LIKE \'%snap-prod%\'').run();
    db.prepare("DELETE FROM customers WHERE email LIKE 'snap-%@test.com' OR email LIKE 'snap-%@example.com'").run();
    db.prepare('DELETE FROM inventory_movements WHERE product_id = ?').run(productId);
    db.prepare('DELETE FROM inventory WHERE product_id = ?').run(productId);
    db.prepare('DELETE FROM products WHERE id = ?').run(productId);
    db.saveDb();
  } catch {}
});

beforeAll(async () => { await start(); });

test('order snapshots address A; later customer-default change to B keeps A; new order snapshots B', async () => {
  const email = 'snap-a@example.com';
  // ensure a clean customer with default address A = 1 Cairo St
  const existing = db.prepare('SELECT id FROM customers WHERE email = ?').get(email);
  const custId = existing ? existing.id : db.prepare('INSERT INTO customers (email, name, phone, address, city, governorate, google_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(email, 'Snap A', '+201', '1 Cairo St', 'Cairo', 'Cairo', 'snap_a_' + Date.now()).lastInsertRowid;

  // Order 1: client sends shipping address A explicitly.
  const o1 = await post({ customer_email: email, customer_name: 'Snap A', items: [{ id: productId, qty: 1 }], payment_method: 'cod', shipping_name: 'Snap A', shipping_phone: '+201111', shipping_address: '1 Cairo St', shipping_city: 'Cairo', shipping_governorate: 'Cairo', shipping_postal_code: '11111' });
  expect(o1.status).toBe(201);
  const id1 = o1.data.id;

  // Customer changes default address to B.
  db.prepare("UPDATE customers SET address = '99 Giza Ave', city = 'Giza', governorate = 'Giza' WHERE id = ?").run(custId);

  // Order 1 must STILL hold A. Order 2 (no client shipping) falls back to the NEW default B.
  const row1 = db.prepare('SELECT shipping_name, shipping_address, shipping_city, shipping_governorate FROM orders WHERE id = ?').get(id1);
  expect(row1.shipping_address).toBe('1 Cairo St');
  expect(row1.shipping_city).toBe('Cairo');

  const o2 = await post({ customer_email: email, customer_name: 'Snap A', items: [{ id: productId, qty: 1 }], payment_method: 'cod' });
  expect(o2.status).toBe(201);
  const row2 = db.prepare('SELECT shipping_address, shipping_city FROM orders WHERE id = ?').get(o2.data.id);
  expect(row2.shipping_address).toBe('99 Giza Ave');
  expect(row2.shipping_city).toBe('Giza');

  // The two orders carry different, order-stable snapshots.
  expect(row1.shipping_address).not.toBe(row2.shipping_address);
});
