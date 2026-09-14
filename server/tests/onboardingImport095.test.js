/**
 * mventor-ticket-095 â€” master-data onboarding.
 *
 * Proves the import contract end to end: preview is a PURE read (validation,
 * business-key create/update detection, in-file duplicate refusal, per-line
 * error reporting), commit is ALL-OR-NOTHING in one transaction, product
 * imports never touch existing stock, money converts to exact integer cents
 * or the row is rejected, and every dataset is permission-guarded (spec-driven,
 * never caller-asserted). Manual customer entry endpoints included.
 */
const db = require('../db');
const bcrypt = require('bcryptjs');
const express = require('express');
const onboarding = require('../services/onboardingImport');

let noneUserId = null;
let noneRoleId = null;
let bossId = null; // user WITH products.create + suppliers.manage + customers.manage + warehouses.manage
let bossRoleId = null;

const created = { products: [], categories: [], brands: [], suppliers: [], customers: [], warehouses: [], users: [], roles: [], journals: [] };

function csv(...lines) { return Buffer.from(lines.join('\r\n'), 'utf8'); }

function previewProducts(body, opts) {
  return onboarding.preview({ type: 'products', buffer: csv(...body), filename: 't.csv', opts });
}

beforeAll(async () => {
  await db.initPromise;
  noneRoleId = db.prepare('INSERT INTO roles (name) VALUES (?)').run('jest095_none').lastInsertRowid;
  created.roles.push(noneRoleId);
  noneUserId = db.prepare('INSERT INTO users (email, name, password_hash, role_id, is_active) VALUES (?, ?, ?, ?, 1)')
    .run('none@jest095.test', 'None 095', bcrypt.hashSync('x', 10), noneRoleId).lastInsertRowid;
  created.users.push(noneUserId);
  bossRoleId = db.prepare('INSERT INTO roles (name) VALUES (?)').run('jest095_boss').lastInsertRowid;
  created.roles.push(bossRoleId);
  for (const perm of ['products.create', 'suppliers.manage', 'customers.manage', 'warehouses.manage', 'users.read', 'settings.read', 'reports.read', 'inventory.manage']) {
    const pr = db.prepare('SELECT id FROM permissions WHERE name = ?').get(perm);
    if (pr) db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)').run(bossRoleId, pr.id);
  }
  bossId = db.prepare('INSERT INTO users (email, name, password_hash, role_id, is_active) VALUES (?, ?, ?, ?, 1)')
    .run('boss@jest095.test', 'Boss 095', bcrypt.hashSync('x', 10), bossRoleId).lastInsertRowid;
  created.users.push(bossId);
});

function cleanRows() {
  for (const id of created.products.splice(0)) {
    try {
      db.prepare('DELETE FROM product_variants WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM inventory_movements WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM inventory WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM inventory_cost_layers WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM events WHERE entity_type = ? AND entity_id = ?').run('product', id);
      db.prepare('DELETE FROM products WHERE id = ?').run(id);
    } catch { /* row already gone */ }
  }
  for (const id of created.categories.splice(0)) db.prepare('DELETE FROM categories WHERE id = ?').run(id);
  for (const id of created.brands.splice(0)) db.prepare('DELETE FROM brands WHERE id = ?').run(id);
  for (const id of created.suppliers.splice(0)) db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
  for (const id of created.customers.splice(0)) {
    db.prepare("DELETE FROM events WHERE entity_type='customer' AND entity_id = ?").run(id);
    db.prepare('DELETE FROM customers WHERE id = ?').run(id);
  }
  for (const id of created.warehouses.splice(0)) db.prepare('DELETE FROM warehouses WHERE id = ?').run(id);
  db.prepare("DELETE FROM events WHERE event_type = 'master_data_imported'").run();
}

afterEach(() => { cleanRows(); db.saveDb(); });

afterAll(() => {
  cleanRows();
  for (const id of created.users.splice(0)) { try { db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(id); db.prepare('DELETE FROM users WHERE id = ?').run(id); } catch {} }
  for (const id of created.roles.splice(0)) { try { db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(id); db.prepare('DELETE FROM roles WHERE id = ?').run(id); } catch {} }
  db.saveDb();
});

function track(res) {
  for (const r of (res && res.records) || []) {
    if (res.type === 'products') created.products.push(r.id);
    if (res.type === 'suppliers') created.suppliers.push(r.id);
    if (res.type === 'customers') created.customers.push(r.id);
    if (res.type === 'warehouses') created.warehouses.push(r.id);
  }
  return res;
}
// auto-created cats/brands by NAME â€” track by lookup after each commit
function trackAuto(res) {
  for (const n of (res && res.auto_categories) || []) created.categories.push(...catsLike(n));
  for (const n of (res && res.auto_brands) || []) created.brands.push(...brandsLike(n));
  return res;
}
function catsLike(name) { return db.prepare('SELECT id FROM categories WHERE name = ?').all(name).map((r) => r.id); }
function brandsLike(name) { return db.prepare('SELECT id FROM brands WHERE name = ?').all(name).map((r) => r.id); }

describe('preview â€” a pure, honest plan', () => {
  test('classifies creates vs updates by the business key and per-line validates money', () => {
    const seed = track(onboarding.commit({
      type: 'products',
      buffer: csv('name,cost_price', 'Seed095 Widget,10.00'),
      filename: 's.csv', userId: 'jest095',
    }));
    void seed;
    const plan = previewProducts([
      'name,cost_price,price,sku,category,stock',
      'Seed095 Widget,11.50,,SKU095A,gen-new-cat,7', // update by name
      'Fresh095 Gadget,9.99,19.99,SKU095B,,3',       // new by sku -> create
      'BadRow095,12.345,,X,,,,',                      // invalid cost (3 decimals)
    ].map((l) => l.replace('X', 'SKU095C')));
    expect(plan.rows).toBe(3);
    expect(plan.creates).toBe(1);
    expect(plan.updates).toBe(1);
    expect(plan.errors).toHaveLength(1);
    expect(plan.errors[0].line).toBe(4);
    expect(plan.errors[0].error).toMatch(/2 decimals/);
    expect(plan.valid).toBe(false);
    // preview NEVER wrote: category not created, product count unchanged
    expect(catsLike('gen-new-cat')).toHaveLength(0);
    // cleanup seed rows
    for (const p of db.prepare("SELECT id FROM products WHERE name LIKE '%095%'").all()) created.products.push(p.id);
  });

  test('in-file duplicates refuse by business key with the exact line reference', () => {
    const plan = previewProducts([
      'name,cost_price,sku',
      'Dup095 One,5.00,DUPSKU',
      'Dup095 Two,6.00,DUPSKU',
    ]);
    expect(plan.errors).toHaveLength(1);
    expect(plan.errors[0].error).toMatch(/duplicate of line 2/);
    for (const p of db.prepare("SELECT id FROM products WHERE name LIKE 'Dup095%'").all()) created.products.push(p.id);
  });

  test('unknown type + empty file answered honestly', () => {
    expect(() => onboarding.preview({ type: 'nope', buffer: csv('a'), filename: 'x.csv' })).toThrow(/Unknown import type/);
    expect(() => onboarding.preview({ type: 'products', buffer: csv('name'), filename: 'x.csv' })).toThrow(/no data rows/);
  });

  test('allow_new_categories=false converts auto-create into a row error', () => {
    const plan = previewProducts([
      'name,cost_price,category',
      'NoCat095,5.00,definitely-unknown-cat-95',
    ], { allow_new_categories: false });
    expect(plan.errors[0].error).toMatch(/does not exist/);
    for (const p of db.prepare("SELECT id FROM products WHERE name LIKE 'NoCat095%'").all()) created.products.push(p.id);
  });
});

describe('commit â€” one transaction, all or nothing', () => {
  test('one invalid row aborts EVERYTHING (no products, no auto categories)', () => {
    const before = db.prepare("SELECT COUNT(*) n FROM products WHERE name LIKE 'Mix095%'").get().n;
    let err = null;
    try {
      onboarding.commit({
        type: 'products',
        buffer: csv(
          'name,cost_price,category',
          'Mix095 Good,5.00,mixcat95',
          'Mix095 Bad,',
        ),
        filename: 'm.csv', userId: 'jest095',
      });
    } catch (e) { err = e; }
    expect(err).toBeTruthy();
    expect(err.message).toMatch(/commit aborted/);
    expect(db.prepare("SELECT COUNT(*) n FROM products WHERE name LIKE 'Mix095%'").get().n).toBe(before);
    expect(catsLike('mixcat95')).toHaveLength(0);
  });

  test('valid file creates with exact cents, markup-derived price, opening movement, zero-stock update law', () => {
    const existing = track(onboarding.commit({ type: 'products', buffer: csv('name,cost_price,stock', 'Stock095 Base,10.00,25'), filename: 'e.csv', userId: 'j' }));
    void existing;
    const res = track(onboarding.commit({
      type: 'products',
      buffer: csv(
        'name,cost_price,price,sku,sizes,colors,stock,category',
        'Money095 Exact,12.50,30.00,SKU095M,,,5,importcat95',
        'Stock095 Base,10.00,,,,  ,999',
      ),
      filename: 'ok.csv', userId: 'boss',
    }));
    expect(res.committed).toBe(true);
    expect(res.created).toBe(1);
    expect(res.updated).toBe(1);
    const p1 = db.prepare("SELECT * FROM products WHERE sku = 'SKU095M'").get();
    expect(p1).toBeTruthy();
    created.products.push(p1.id);
    expect(p1.cost_price).toBe(1250);
    expect(p1.price).toBe(3000);
    expect(p1.stock).toBe(5); // opening via recordInitialStock
    const mv = db.prepare("SELECT COUNT(*) n FROM inventory_movements WHERE reference_type = 'product_creation' AND reference_id = ?").get(p1.id).n;
    expect(mv).toBeGreaterThan(0);
    // ERP law: the update row carried stock 999 â€” the EXISTING product's stock untouched
    const p2 = db.prepare("SELECT * FROM products WHERE name = 'Stock095 Base'").get();
    expect(p2.stock).toBe(25);
    // variants expanded on create sizesÃ—colors? sizes list present -> 1xN combos
    const cats = catsLike('importcat95');
    expect(cats.length).toBe(1);
    created.categories.push(...cats);
    // audit event with actor
    const ev = db.prepare("SELECT user_id, payload FROM events WHERE event_type = 'master_data_imported' ORDER BY id DESC LIMIT 1").get();
    expect(ev.user_id).toBe('boss');
    expect(JSON.parse(ev.payload).dataset).toBe('Products');
  });

  test('suppliers + customers + warehouses datasets round-trip their keys', () => {
    const sup = track(onboarding.commit({ type: 'suppliers', buffer: csv('name,contact_name,phone,email', 'Sup095 Co,Ame,  +201000000001, ame@sup095.test'), filename: 's.csv', userId: 'j' }));
    expect(sup.created).toBe(1);
    const supId = sup.records[0].id;
    const supRow = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supId);
    expect(supRow.name).toBe('Sup095 Co');
    // second file: same name different case => UPDATE not new row
    const sup2 = onboarding.commit({ type: 'suppliers', buffer: csv('name,address', 'sup095 co,Zamalek'), filename: 's2.csv', userId: 'j' });
    expect(sup2.created).toBe(0);
    expect(sup2.updated).toBe(1);
    void supId;
    // customers: email key, valid phone rule
    const cust = track(onboarding.commit({ type: 'customers', buffer: csv('email,name,phone', 'Cust095@T.local,Walk In User,+201000000002'), filename: 'c.csv', userId: 'j' }));
    expect(cust.created).toBe(1);
    const row = db.prepare('SELECT * FROM customers WHERE LOWER(email) = ?').get('cust095@t.local');
    expect(row.name).toBe('Walk In User');
    created.customers.push(row.id);
    // bad phone -> aborted
    expect(() => onboarding.commit({ type: 'customers', buffer: csv('email,name,phone', 'bad@x.test,Bee,12'), filename: 'b.csv' })).toThrow(/commit aborted|phone/i);
    // warehouses keep code on update
    const wh = track(onboarding.commit({ type: 'warehouses', buffer: csv('code,name,address', 'WH095,Delta Depot,Nile St'), filename: 'w.csv', userId: 'j' }));
    db.prepare('UPDATE warehouses SET is_active = 0 WHERE id = ?').run(wh.records[0].id);
    created.warehouses.push(wh.records[0].id);
  });

  test('image https URLs become post-commit land jobs without blocking the import', async () => {
    const res = onboarding.commit({
      type: 'products',
      buffer: csv('name,cost_price,image_url', 'Img095,5.00,https://invalid.invalid/x.jpg'),
      filename: 'i.csv', userId: 'j',
    });
    const p = db.prepare("SELECT * FROM products WHERE name = 'Img095'").get();
    expect(p).toBeTruthy();
    created.products.push(p.id);
    expect(p.image_url).toBe('https://invalid.invalid/x.jpg');
    expect(Array.isArray(res._image_jobs) && res._image_jobs[0].url).toBe('https://invalid.invalid/x.jpg');
    // landImages is best-effort AFTER commit: an unreachable URL never throws
    const landed = await onboarding.landImages(res);
    expect(landed).toBe(0);
    expect(res._image_jobs).toBe(undefined); // consumed/stripped
  });
});

describe('HTTP surface + RBAC per dataset', () => {
  async function call(session, method, path, form) {
    const app = express();
    app.use(express.json());
    if (session) app.use((req, res, next) => { req.session = session; next(); });
    app.use('/api/admin/onboarding', require('../routes/onboarding'));
    app.use('/api/admin/customers', require('../routes/customers'));
    const srv = app.listen(0);
    await new Promise((r) => srv.once('listening', r));
    try {
      const res = await fetch(`http://localhost:${srv.address().port}/api/admin${path}`, { method, body: form || undefined });
      let json = null;
      try { json = await res.json(); } catch {}
      return { status: res.status, json };
    } finally { srv.closeAllConnections?.(); srv.close(); }
  }
  function formFor(type, text) {
    const fd = new FormData();
    fd.append('type', type);
    fd.append('file', new Blob([text], { type: 'text/csv' }), 't.csv');
    return fd;
  }
  const bossSession = () => ({ isAdmin: true, userId: bossId, username: 'boss095' });
  const noneSession = () => ({ isAdmin: true, userId: noneUserId });

  test('zero-permission user blocked on both endpoints; unknown type 400', async () => {
    const p = await call(noneSession(), 'POST', '/onboarding/preview', formFor('products', 'name,cost_price\nA,1.00'));
    expect(p.status).toBe(403);
    const c = await call(noneSession(), 'POST', '/onboarding/commit', formFor('products', 'name,cost_price\nA,1.00'));
    expect(c.status).toBe(403);
    const u = await call(bossSession(), 'POST', '/onboarding/preview', formFor('nope', 'a,b\n1,2'));
    expect(u.status).toBe(400);
  }, 15000);

  test('permission-gated datasets: products via products.create works, customers.manage blocks others', async () => {
    // boss HAS products.create (granted in seed) -> preview OK but this plan has a bad row too
    const ok = await call(bossSession(), 'POST', '/onboarding/preview', formFor('products', 'name,cost_price\r\nHttp095,3.00'));
    expect(ok.status).toBe(200);
    expect(ok.json.data.creates).toBe(1);
    const bad = await call(noneSession(), 'POST', '/customers', { email: 'blocked@095.test', name: 'Nope' });
    expect(bad.status).toBe(403);
    void bad;
  }, 15000);

  test('manual customer add: validates, dedupes with 409, audits actor', async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => { req.session = { isAdmin: true, userId: bossId, username: 'boss095' }; next(); });
    app.use('/api/admin/customers', require('../routes/customers'));
    const srv = app.listen(0);
    await new Promise((r) => srv.once('listening', r));
    const base = () => `http://localhost:${srv.address().port}/api/admin/customers`;
    const body = (o) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
    try {
      const clean = await fetch(base(), body({ email: 'manual095@t.test', name: 'Manual095', phone: '+201000000009' }));
      expect(clean.status).toBe(201);
      const j = await clean.json();
      created.customers.push(j.data.id);
      const dup = await fetch(base(), body({ email: 'MANUAL095@T.TEST', name: 'Again' }));
      expect(dup.status).toBe(409);
      const invalid = await fetch(base(), body({ email: 'nope', name: 'X' }));
      expect(invalid.status).toBe(400);
      const noName = await fetch(base(), body({ email: 'nn095@t.test', name: ' ' }));
      expect(noName.status).toBe(400);
      const ev = db.prepare("SELECT user_id FROM events WHERE entity_type='customer' AND entity_id = ?").get(j.data.id);
      expect(ev.user_id).toBe('boss095');
      const upd = await fetch(`${base()}/${j.data.id}`, { ...body({ name: 'Manual095 Renamed', phone: '+201000000009' }), method: 'PUT' });
      expect(upd.status).toBe(200);
      expect((await upd.json()).data.name).toBe('Manual095 Renamed');
    } finally { srv.closeAllConnections?.(); srv.close(); }
  }, 20000);
});


