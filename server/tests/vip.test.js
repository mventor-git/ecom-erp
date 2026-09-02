/**
 * Tests for the VIP program (mventor-ticket-060):
 * invite lifecycle, Google sign-in claim, and the staff-managed VIP cart.
 */
const db = require('../db');
const vipService = require('../services/vipService');

let catId = null;
const createdCustomerIds = [];
const createdProductIds = [];

beforeAll(async () => {
  await db.initPromise;
  let cat = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get();
  catId = cat ? cat.id : db.prepare("INSERT INTO categories (name, slug) VALUES ('jest-vip-cat', 'jest-vip-cat')").run().lastInsertRowid;
});

afterEach(() => {
  for (const id of createdCustomerIds.splice(0)) {
    db.prepare('DELETE FROM vip_cart WHERE customer_id = ?').run(id);
    db.prepare('DELETE FROM customers WHERE id = ?').run(id);
  }
  for (const id of createdProductIds.splice(0)) {
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
  }
  db.prepare("DELETE FROM vip_invites WHERE invite_name LIKE 'jest-vip%'").run();
  db.prepare("DELETE FROM events WHERE payload LIKE '%jest-vip%'").run();
  db.saveDb();
});

function makeCustomer(email) {
  const rid = db.prepare("INSERT INTO customers (email, name, google_id) VALUES (?, ?, ?)")
    .run(email, 'Jest VIP', `gid-${email}`).lastInsertRowid;
  createdCustomerIds.push(rid);
  return rid;
}

function makeProduct(name) {
  const rid = db.prepare("INSERT INTO products (name, price, category_id, active) VALUES (?, 1000, ?, 1)")
    .run(name, catId).lastInsertRowid;
  createdProductIds.push(rid);
  return rid;
}

describe('VIP Program', () => {
  test('createInvite generates a unique code and stores the name', () => {
    const inv1 = vipService.createInvite('jest-vip Ahmed');
    const inv2 = vipService.createInvite('jest-vip Mona');
    expect(inv1.code).toMatch(/^VIP-/);
    expect(inv2.code).not.toBe(inv1.code);
    expect(inv1.invite_name).toBe('jest-vip Ahmed');
    expect(inv1.used_by).toBeFalsy();
  });

  test('createInvite rejects empty names', () => {
    expect(() => vipService.createInvite('   ')).toThrow(/name is required/);
  });

  test('claimInvite flags the customer VIP with the invitation name (single-use)', () => {
    const inv = vipService.createInvite('jest-vip claim');
    const custId = makeCustomer('jest-vip-claim@test.com');

    vipService.claimInvite(inv.code, custId);

    const c = db.prepare('SELECT vip, invite_name FROM customers WHERE id = ?').get(custId);
    expect(c.vip).toBe(1);
    expect(c.invite_name).toBe('jest-vip claim');

    // Invite is consumed — another customer cannot reuse it
    const other = makeCustomer('jest-vip-other@test.com');
    expect(() => vipService.claimInvite(inv.code, other)).toThrow(/already been used/);

    // Same customer re-logging in is fine (idempotent)
    expect(() => vipService.claimInvite(inv.code, custId)).not.toThrow();
  });

  test('claimInvite rejects unknown codes', () => {
    expect(() => vipService.claimInvite('VIP-NOPE', null)).toThrow(/Invalid invitation/);
  });

  test('VIP cart: staff adds, merges quantities, removes, clears', () => {
    const custId = makeCustomer('jest-vip-cart@test.com');
    db.prepare('UPDATE customers SET vip = 1 WHERE id = ?').run(custId);
    const p1 = makeProduct('jest-vip-cart-p1');
    const p2 = makeProduct('jest-vip-cart-p2');

    vipService.addToVipCart(custId, p1, 2, 'admin');
    vipService.addToVipCart(custId, p1, 1, 'admin'); // merge → qty 3
    vipService.addToVipCart(custId, p2, 1, 'admin');

    let cart = vipService.getVipCart(custId);
    expect(cart.length).toBe(2);
    expect(cart.find(i => i.product_id === p1).qty).toBe(3);

    vipService.removeVipCartItem(custId, cart.find(i => i.product_id === p1).id);
    cart = vipService.getVipCart(custId);
    expect(cart.length).toBe(1);

    vipService.clearVipCart(custId);
    expect(vipService.getVipCart(custId).length).toBe(0);
  });

  test('addToVipCart refuses non-VIP customers', () => {
    const custId = makeCustomer('jest-vip-notvip@test.com'); // vip stays 0
    const p = makeProduct('jest-vip-notvip-p');
    expect(() => vipService.addToVipCart(custId, p, 1, 'admin')).toThrow(/not marked as VIP/);
  });
});
