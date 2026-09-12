/**
 * N1 — durable idempotency for inventory mutations (owner remediation directive).
 * Proves claims bound to (actor, endpoint, key, request-fingerprint) are
 * DB-backed: replay / conflict / cross-actor independence / failed-op retry /
 * restart durability / exactly-once under concurrency.
 * Self-contained product + two users + claim rows; full cleanup.
 */
const db = require('../db');
const bcrypt = require('bcryptjs');

let app, server, base;
let userA = null, userB = null, productId = null, whId = null;
let sessionStore = null;
const KEYS = [];
const mkKey = (p) => { const k = `N1-${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`; KEYS.push(k); return k; };

function req(method, path, body, token, key) {
  return fetch(base + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { Cookie: token } : {}),
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => null) }));
}

beforeAll(async () => {
  await db.initPromise;
  const express = require('express');
  const adminAuth = require('../middleware/adminAuth');
  whId = db.prepare('SELECT id FROM warehouses ORDER BY id LIMIT 1').get().id;
  const cat = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get();
  productId = db.prepare('INSERT INTO products (name, price, cost_price, category_id, active, stock) VALUES (?, 10, 10, ?, 1, 0)').run('N1 idem product', cat.id).lastInsertRowid;
  const onHand = (pid, wid) => db.prepare('SELECT id, qty_on_hand FROM inventory WHERE product_id = ? AND warehouse_id = ?').get(pid, wid);
  const inv = onHand(productId, whId);
  if (inv) db.prepare('UPDATE inventory SET qty_on_hand = 100 WHERE id = ?').run(inv.id);
  else db.prepare('INSERT INTO inventory (product_id, warehouse_id, qty_on_hand) VALUES (?, ?, 100)').run(productId, whId);

  // the role that can adjust inventory on ANY boot state (live legacy 'admin'
  // or seeded fresh 'super_admin'), not a name assumption
  const role = db.prepare("SELECT rp.role_id AS id FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE p.name = 'inventory.adjust' LIMIT 1").get();
  userA = db.prepare('INSERT INTO users (email, username, name, password_hash, role_id, is_active) VALUES (?,?,?,?,?,1)')
    .run('n1.a@idem.test', 'n1-a', 'N1 A', bcrypt.hashSync('x', 10), role.id).lastInsertRowid;
  userB = db.prepare('INSERT INTO users (email, username, name, password_hash, role_id, is_active) VALUES (?,?,?,?,?,1)')
    .run('n1.b@idem.test', 'n1-b', 'N1 B', bcrypt.hashSync('x', 10), role.id).lastInsertRowid;

  sessionStore = new Map();
  app = express();
  app.use(express.json());
  // minimal session shim with same fields adminAuth/session consumers read
  app.use((r, res, next) => {
    const sid = (r.headers.cookie || '').split('=')[1];
    if (sid && sessionStore.has(sid)) r.session = sessionStore.get(sid);
    next();
  });
  app.post('/test-login', (rq, res) => {
    const actor = rq.headers['x-test-actor'];
    const sess = String(actor) === 'B' ? { isAdmin: true, userId: userB, username: 'n1-b' } : { isAdmin: true, userId: userA, username: 'n1-a' };
    const id = Math.random().toString(36);
    sessionStore.set(id, sess);
    res.json({ cookie: `n1sid=${id}` });
  });
  const invRoutes = require('../routes/inventory');
  app.use('/api/admin/inventory', invRoutes);
  server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  base = `http://localhost:${server.address().port}`;
});

async function login(actor) {
  const r = await (await fetch(base + '/test-login', { method: 'POST', headers: { 'x-test-actor': actor } })).json();
  return r.cookie;
}

const mv = (cookie, key, qty) => req('POST', '/api/admin/inventory/movements',
  { product_id: productId, warehouse_id: whId, type: qty < 0 ? 'issue' : 'receipt', qty_change: qty, note: 'n1-test' },
  cookie, key);

afterAll(() => {
  try { server && server.closeAllConnections?.(); server && server.close(); } catch {}
  try {
    // users' FK children first (a movement notification emitted during the run
    // can reference the test staff users and block DELETE users otherwise)
    for (const uid of [userA, userB]) {
      for (const [tbl, col] of [
        ['user_roles', 'user_id'], ['in_app_notifications', 'user_id'],
        ['notification_preferences', 'user_id'], ['device_tokens', 'user_id'],
      ]) { try { db.prepare(`DELETE FROM ${tbl} WHERE ${col} = ?`).run(uid); } catch {} }
    }
    db.prepare(`DELETE FROM idempotency_records WHERE idem_key IN (${KEYS.map(() => '?').join(',')})`).run(...KEYS);
    db.prepare('DELETE FROM inventory_movements WHERE product_id = ?').run(productId);
    db.prepare('DELETE FROM inventory WHERE product_id = ?').run(productId);
    db.prepare('DELETE FROM inventory_cost_layers WHERE product_id = ?').run(productId);
    db.prepare('DELETE FROM events WHERE user_id IN (\'n1-a\',\'n1-b\')').run();
    db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(userA, userB);
    db.prepare('DELETE FROM products WHERE id = ?').run(productId);
    db.saveDb();
  } catch (e) { console.error('n1 cleanup:', e.message); }
});

const movementCount = () => db.prepare('SELECT COUNT(*) n FROM inventory_movements WHERE product_id = ?').get(productId).n;
const claimRow = (key, actor) => db.prepare('SELECT state, request_fp FROM idempotency_records WHERE actor = ? AND idem_key = ?').get(actor, key);

describe('N1 durable idempotency (inventory movements)', () => {
  test('A: same actor + same key + same body => replay; exactly one movement', async () => {
    const cookie = await login('A');
    const key = mkKey('replay');
    const r1 = await mv(cookie, key, 5);
    expect(r1.status).toBe(201);
    const c1 = movementCount();
    const r2 = await mv(cookie, key, 5);
    expect([200, 201]).toContain(r2.status);
    expect(r2.body.id).toBe(r1.body.id);        // same movement echoed
    expect(movementCount()).toBe(c1);           // no second ledger entry
    expect(claimRow(key, 'n1.a@idem.test')).toBeTruthy(); // actor = db user email for requirePermission-resolved sessions
  });

  test('B: same actor + same key + DIFFERENT body => 409 conflict, no execution', async () => {
    const cookie = await login('A');
    const key = mkKey('conflict');
    await mv(cookie, key, 5);
    const first = movementCount();
    const r2 = await mv(cookie, key, 9);
    expect(r2.status).toBe(409);
    expect(String(r2.body.error)).toMatch(/idempotency-conflict/);
    expect(movementCount()).toBe(first);        // never executed, never returns first op
  });

  test('C: different actors same key => independent (no cross-user consumption)', async () => {
    const key = mkKey('cross-actor');
    const a = await mv(await login('A'), key, 2);
    const b = await mv(await login('B'), key, 2);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(b.body.id).not.toBe(a.body.id);      // each ran for its own claim
    expect(movementCount()).toBeGreaterThanOrEqual(2);
  });

  test('D: persisted claims survive app restart => duplicate prevented', async () => {
    const cookie = await login('A');
    const key = mkKey('restart');
    const first = await mv(cookie, key, 3);
    expect(first.status).toBe(201);
    const before = movementCount();
    // fresh express stack with BOTH the routes and the idempotency service
    // re-required from scratch — same process, fresh module memory ⇒ only the
    // DURABLE claims can prevent the duplicate.
    delete require.cache[require.resolve('../routes/inventory')];
    delete require.cache[require.resolve('../services/idempotencyService')];
    const store = sessionStore;
    const freshApp = require('express')();
    freshApp.use(require('express').json());
    freshApp.use((r, res, next) => { const sid = (r.headers.cookie || '').split('=')[1]; if (store.has(sid)) r.session = store.get(sid); next(); });
    freshApp.use('/api/admin/inventory', require('../routes/inventory'));
    const freshServer = freshApp.listen(0);
    await new Promise(r => freshServer.once('listening', r));
    const freshBase = `http://localhost:${freshServer.address().port}`;
    const rr = await (await fetch(freshBase + '/api/admin/inventory/movements', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Cookie: cookie, 'Idempotency-Key': key },
      body: JSON.stringify({ product_id: productId, warehouse_id: whId, type: 'receipt', qty_change: 3, note: 'n1-test' }),
    })).json();
    freshServer.closeAllConnections?.(); freshServer.close();
    expect(rr.id).toBe(first.body.id);          // replayed from DURABLE row
    expect(movementCount()).toBe(before);
  });

  test('E: failed mutation releases the claim => same-key retry executes', async () => {
    const cookie = await login('A');
    const key = mkKey('fail-retry');
    const bad = await mv(cookie, key, -999999); // insufficient ⇒ 409 from route error path
    expect(bad.status >= 400).toBe(true);
    const good = await mv(cookie, key, 1);      // claim was released ⇒ retry runs
    expect(good.status).toBe(201);
    expect(movementCount()).toBeGreaterThanOrEqual(1);
  });

  test('F: concurrent duplicate requests => exactly one movement', async () => {
    const cookie = await login('A');
    const key = mkKey('concurrent');
    const before = movementCount();
    const [r1, r2] = await Promise.all([mv(cookie, key, 2), mv(cookie, key, 2)]);
    expect([r1.status, r2.status].every(s => s === 201 || s === 200)).toBe(true);
    // single execution ⇒ same echoed movement id, one new ledger row
    expect(r1.body.id).toBe(r2.body.id);
    expect(movementCount()).toBe(before + 1);
  });

  test('G: headerless request untouched', async () => {
    const cookie = await login('A');
    const r = await mv(cookie, null, 1);
    expect(r.status).toBe(201);
  });

  test('H: in-flight claim blocks a second live execution', async () => {
    const cookie = await login('A');
    const key = mkKey('inflight');
    // plant a fresh in_flight claim directly (simulates racing claimant)
    db.prepare('INSERT INTO idempotency_records (actor, endpoint, idem_key, request_fp, state) VALUES (?, ?, ?, ?, \'in_flight\')')
      .run('n1.a@idem.test', 'POST /api/admin/inventory/movements :: ' + key, key, 'a'.repeat(64));
    const r = await mv(cookie, key, 1);
    expect(r.status).toBe(409);
    expect(String(r.body.error)).toMatch(/in-flight|in flight/i);
    db.prepare('DELETE FROM idempotency_records WHERE idem_key = ?').run(key);
  });
});
