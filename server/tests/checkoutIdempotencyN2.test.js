/**
 * N2 — guest order idempotency + cross-customer isolation (P0 security).
 *
 * Old behavior (confirmed leak): `SELECT * FROM orders WHERE idempotency_key=?`
 * returned ANY matching order to ANY caller — one customer's full order row
 * (shipping PII, totals) exposed to a stranger reusing the key, and a global
 * key collision silently discarded the second order.
 *
 * New invariant: key namespace is the OWNER (customer row). Another
 * customer presenting the same key gets their OWN order — never the other's.
 * Same owner + same canonical request ⇒ replay; ⇒ different request ⇒ 409.
 *
 * In-process express (same pattern as addressSnapshot.test); fixtures cleaned.
 */
const express = require('express');
const http = require('http');
const db = require('../db');

let server, base, catId, productId;
const emails = [];
const orderIds = [];
const mk = (p) => `${p}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}@n2-idem.test`;

async function post(body) {
  const r = await fetch(base + '/api/orders', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}
function cart(email, name, key, qty = 2) {
  return { customer_email: email, customer_name: name, items: [{ id: productId, qty }], payment_method: 'cod', idempotency_key: key,
    shipping_name: name, shipping_phone: '01000000001', shipping_address: 'N2 street 1', shipping_city: 'Cairo' };
}

beforeAll(async () => {
  await db.initPromise;
  catId = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get().id;
  productId = db.prepare('INSERT INTO products (name, price, cost_price, category_id, active, stock) VALUES (?, 1000, 500, ?, 1, 100) ON CONFLICT DO NOTHING').run('N2 product', catId).lastInsertRowid;
  const whId = db.prepare('SELECT id FROM warehouses ORDER BY id LIMIT 1').get().id;
  db.prepare('INSERT INTO inventory (product_id, warehouse_id, qty_on_hand) VALUES (?, ?, 100)').run(productId, whId);
  const app = express();
  app.use(express.json());
  app.use('/api/orders', require('../routes/orders'));
  server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});

// COD checkout routes stock through the bridge: orders acquire issue_orders
// (+ items/movements) children, so teardown must be child-first or FK aborts it.
function purgeOrderTree(oid) {
  try {
    const iss = db.prepare('SELECT id FROM issue_orders WHERE order_id = ?').all(oid).map(r0 => r0.id);
    for (const iid of iss) {
      try { db.prepare("DELETE FROM inventory_movements WHERE reference_type = 'issue_order' AND reference_id = ?").run(iid); } catch {}
      try { db.prepare('DELETE FROM issue_order_items WHERE issue_order_id = ?').run(iid); } catch {}
    }
    try { db.prepare('DELETE FROM issue_orders WHERE order_id = ?').run(oid); } catch {}
    for (const t of ['picking_tasks', 'packing_tasks', 'shipments', 'cost_consumption', 'order_items']) {
      try { db.prepare(`DELETE FROM ${t} WHERE order_id = ?`).run(oid); } catch {}
    }
    try { db.prepare("DELETE FROM inventory_movements WHERE reference_type = 'order' AND reference_id = ?").run(oid); } catch {}
    db.prepare("DELETE FROM events WHERE entity_type = 'order' AND entity_id = ?").run(oid);
    db.prepare('DELETE FROM orders WHERE id = ?').run(oid);
  } catch (e) { console.error('n2 tree purge skipped order', oid, e.message); }
}

afterAll(() => {
  try { server && server.closeAllConnections?.(); server && server.close(); } catch {}
  try {
    const cids = new Set(emails.map(e => db.prepare('SELECT id FROM customers WHERE email = ?').get(e)?.id).filter(Boolean));
    for (const oid of orderIds.splice(0)) purgeOrderTree(oid);
    // sweep any order left by an aborted path whose owner is an n2 guest
    for (const o of db.prepare("SELECT o.id FROM orders o JOIN customers c ON c.id = o.customer_id WHERE c.email LIKE '%@n2-idem.test'").all()) purgeOrderTree(o.id);
    for (const cid of cids) {
      for (const t of ['wishlist', 'vip_cart', 'customer_verifications', 'customer_invitation_links', 'vip_customer_policies', 'reviews']) {
        try { db.prepare(`DELETE FROM ${t} WHERE customer_id = ?`).run(cid); } catch {}
      }
      try { db.prepare('UPDATE vip_invites SET used_by = NULL WHERE used_by = ?').run(cid); } catch {}
      try { db.prepare('DELETE FROM customers WHERE id = ?').run(cid); } catch {}
    }
    for (const e of emails.splice(0)) { try { db.prepare('DELETE FROM customers WHERE email = ?').run(e); } catch {} }
    try { db.prepare('DELETE FROM customers WHERE email LIKE ?').run('%@n2-idem.test'); } catch {}
    db.prepare('DELETE FROM inventory WHERE product_id = ?').run(productId);
    db.prepare('DELETE FROM inventory_cost_layers WHERE product_id = ?').run(productId);
    db.prepare('DELETE FROM inventory_movements WHERE product_id = ?').run(productId);
    try { db.prepare('DELETE FROM reviews WHERE product_id = ?').run(productId); } catch {}
    db.prepare('DELETE FROM products WHERE id = ?').run(productId);
    db.saveDb();
  } catch (e) { console.error('n2 cleanup:', e.message); }
});

const grab = (id) => { orderIds.push(id); return id; };
const orderRow = (id) => db.prepare('SELECT * FROM orders WHERE id = ?').get(id);

describe('N2 guest-order idempotency & cross-customer isolation', () => {
  test('A/B/C: key replay is OWNER-scoped — customer B never sees A order', async () => {
    const key = 'shared-key-' + Date.now();
    const emailA = mk('a'), emailB = mk('b');
    emails.push(emailA, emailB);
    const a = await post(cart(emailA, 'Alice A', key));
    expect([200, 201]).toContain(a.status);
    grab(a.body.id);
    // B presents the SAME key: must NOT receive A's order
    const b = await post(cart(emailB, 'Bob B', key));
    expect([200, 201]).toContain(b.status);
    grab(b.body.id);
    expect(b.body.id).not.toBe(a.body.id);           // own order, not A's
    expect(b.body.shipping_name).toBe('Bob B');      // A's PII absent
    const rowA = orderRow(a.body.id), rowB = orderRow(b.body.id);
    expect(rowA.customer_id).not.toBe(rowB.customer_id);
  });

  test('E: same owner + same canonical request => replay of the SAME order, no row added', async () => {
    const email = mk('re'); emails.push(email);
    const key = 'replay-' + Date.now();
    const first = await post(cart(email, 'Rep', key, 1));
    grab(first.body.id);
    const again = await post(cart(email, 'Rep', key, 1));
    expect(again.status).toBe(200);                  // replay, not re-created
    expect(again.body.id).toBe(first.body.id);
    expect(db.prepare('SELECT COUNT(*) n FROM orders WHERE idempotency_key = ?').get(key).n).toBe(1);    // order_items mirrored once for that order
    expect(db.prepare('SELECT COUNT(*) n FROM order_items WHERE order_id = ?').get(first.body.id).n).toBe(1);
  });

  test('F: same owner + same key + different material request => 409, nothing executed', async () => {
    const email = mk('cf'); emails.push(email);
    const key = 'conflict-' + Date.now();
    await post(cart(email, 'Con', key, 2));
    const dupes = db.prepare('SELECT COUNT(*) n FROM orders WHERE idempotency_key = ?').get(key).n;
    const bad = await post(cart(email, 'Con', key, 99));
    expect(bad.status).toBe(409);
    expect(String(bad.body.error)).toMatch(/idempotency-conflict|different order/);
    expect(db.prepare('SELECT COUNT(*) n FROM orders WHERE idempotency_key = ?').get(key).n).toBe(dupes);
  });

  test('G: concurrent same-owner same-key => exactly ONE order', async () => {
    const email = mk('conc'); emails.push(email);
    const key = 'race-' + Date.now();
    const bodies = [cart(email, 'Race', key, 4), { ...cart(email, 'Race', key, 4) }]; // identical canonical request
    const rs = await Promise.all(bodies.map(b => post(b)));
    const ids = new Set(rs.map(r => r.body && r.body.id).filter(Boolean));
    expect(ids.size).toBe(1);
    for (const id of ids) grab(id);
    expect(db.prepare('SELECT COUNT(*) n FROM orders WHERE idempotency_key = ?').get(key).n).toBe(1);
  });

  test('DB invariant: same (customer,key) cannot exist twice even via direct insert', () => {
    const email = mk('idx'); emails.push(email);
    const email2 = mk('ix2'); emails.push(email2);
    const key = 'dupe-' + Date.now().toString(36); // run-unique: never inherits prior rows
    const cid = db.prepare('INSERT INTO customers (email, name, google_id) VALUES (?,?,?)').run(email, 'Idx', 'g_' + Date.now().toString(36)).lastInsertRowid;
    const mkOrder = () => db.prepare("INSERT INTO orders (customer_id, total, status, items, payment_method, price_list_code, idempotency_key) VALUES (?, 10, 'pending', '[]', 'cod', 'retail', ?)").run(cid, key);
    mkOrder();
    for (const r of db.prepare('SELECT id FROM orders WHERE idempotency_key = ?').all(key)) grab(r.id);
    expect(() => mkOrder()).toThrow(/UNIQUE/);
    // other customer with same key remains legal
    const cid2 = db.prepare('INSERT INTO customers (email, name, google_id) VALUES (?,?,?)').run(email2, 'Idx2', 'g2_' + Date.now().toString(36)).lastInsertRowid;
    db.prepare("INSERT INTO orders (customer_id, total, status, items, payment_method, price_list_code, idempotency_key) VALUES (?, 10, 'pending', '[]', 'cod', 'retail', ?)").run(cid2, key);
    expect(db.prepare('SELECT COUNT(*) n FROM orders WHERE idempotency_key = ?').get(key).n).toBe(2);
  });

  test('H: legacy key row without fingerprint replays (backward-compat, not conflict)', async () => {
    const email = mk('lgcy'); emails.push(email);
    const lkey = 'legacy-' + Date.now().toString(36);
    const cid = db.prepare('INSERT INTO customers (email, name, google_id) VALUES (?,?,?)').run(email, 'Lgcy', 'lg_' + Date.now().toString(36)).lastInsertRowid;
    const oid = db.prepare("INSERT INTO orders (customer_id, total, status, items, payment_method, price_list_code, idempotency_key) VALUES (?, 20, 'pending', '[]', 'cod', 'retail', ?)").run(cid, lkey).lastInsertRowid;
    grab(oid);
    const r = await post(cart(email, 'Lgcy', lkey, 2));
    expect(r.status).toBe(200);
    expect(r.body.id).toBe(oid);                     // replay of the owner's own legacy row
  });
});
