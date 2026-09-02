/**
 * Tests for customer profiles/stats/recommendation (mventor-ticket-053)
 * and category icon seeding.
 */
const db = require('../db');
const customerService = require('../services/customerService');

let custId = null;
let productIds = [];
let catId = null;

beforeAll(async () => {
  await db.initPromise;
  const testEmail = `jest.customer-${Math.random().toString(36).slice(2, 10)}@test.com`;
  // children-first: a leftover customer from a prior run has orders/reviews/
  // wishlist rows that block DELETE under FK ON.
  const leftover = db.prepare("SELECT id FROM customers WHERE email = ?").get(testEmail);
  if (leftover) {
    db.prepare('DELETE FROM reviews WHERE customer_id = ?').run(leftover.id);
    db.prepare('DELETE FROM wishlist WHERE customer_id = ?').run(leftover.id);
    db.prepare('DELETE FROM orders WHERE customer_id = ?').run(leftover.id);
    db.prepare('DELETE FROM customers WHERE id = ?').run(leftover.id);
  }
  custId = db.prepare('INSERT INTO customers (email, name, google_id, phone, is_verified) VALUES (?, ?, ?, ?, 1)')
    .run(testEmail, 'Jest Customer', 'jest_customer_' + Math.random().toString(36).slice(2, 8), '+201000000000').lastInsertRowid;

  // place the products in a REAL category (ids 1-4 no longer exist — fetch a live one)
  catId = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get().id;
  productIds = [];
  const p1 = db.prepare("INSERT INTO products (name, description, price, cost_price, stock, category_id, is_new) VALUES ('Jest Rec A', 'test', 10000, 5000, 10, ?, 1)").run(catId);
  const p2 = db.prepare("INSERT INTO products (name, description, price, cost_price, stock, category_id, is_new) VALUES ('Jest Rec B', 'test', 20000, 6000, 5, ?, 0)").run(catId);
  productIds = [p1.lastInsertRowid, p2.lastInsertRowid];

  // orders: two paid (one large) + one review + one wishlist
  db.prepare("INSERT INTO orders (customer_id, total, status, items, price_list_code) VALUES (?, 15000, 'paid', ?, 'retail')")
    .run(custId, JSON.stringify([{ id: productIds[0], name: 'Jest Rec A', price: 10000, qty: 1 }]));
  db.prepare("INSERT INTO orders (customer_id, total, status, items, price_list_code) VALUES (?, 40000, 'delivered', ?, 'retail')")
    .run(custId, JSON.stringify([{ id: productIds[0], name: 'Jest Rec A', price: 10000, qty: 4 }]));
  db.prepare("INSERT INTO orders (customer_id, total, status, items) VALUES (?, 5000, 'pending', ?)")
    .run(custId, JSON.stringify([{ id: productIds[1], name: 'Jest Rec B', price: 20000, qty: 1 }]));
  db.prepare('INSERT INTO reviews (product_id, customer_id, rating, comment) VALUES (?, ?, 5, ?)')
    .run(productIds[0], custId, 'Great product!');
  db.prepare('INSERT INTO wishlist (customer_id, product_id) VALUES (?, ?)').run(custId, productIds[1]);
});

afterAll(() => {
  db.prepare("DELETE FROM orders WHERE customer_id = ?").run(custId);
  db.prepare("DELETE FROM reviews WHERE customer_id = ?").run(custId);
  db.prepare("DELETE FROM wishlist WHERE customer_id = ?").run(custId);
  db.prepare("DELETE FROM customers WHERE id = ?").run(custId);
  db.prepare("DELETE FROM products WHERE id IN (?, ?)").run(productIds[0], productIds[1]);
  db.prepare("DELETE FROM events WHERE entity_type = 'order'").run();
  db.saveDb();
});

describe('Category icons', () => {
  test('categories have seeded icon defaults', () => {
    const cats = db.prepare('SELECT name, icon FROM categories').all();
    expect(cats.length).toBeGreaterThan(0);
    cats.forEach(c => {
      expect(c.icon).toBeTruthy();
    });
  });
});

describe('Customer service', () => {
  test('customersWithStats aggregates orders/revenue/reviews/wishlist', () => {
    const customers = customerService.customersWithStats();
    const rows = customers.items || customers; // service returns {items, pagination}
    const c = rows.find(x => x.id === custId);
    expect(c).toBeTruthy();
    expect(c.orders_count).toBe(3);
    expect(c.paid_orders_count).toBe(2);
    expect(c.total_revenue).toBe(55000);
    expect(c.reviews_count).toBe(1);
    expect(c.wishlist_count).toBe(1);
  });

  test('getCustomerProfile includes stats, orders, reviews, wishlist, google + phone', () => {
    const profile = customerService.getCustomerProfile(custId);
    expect(profile).toBeTruthy();
    expect(profile.phone).toBe('+201000000000');
    expect(profile.is_verified).toBe(true);
    expect(profile.stats.total_revenue).toBe(55000);
    expect(profile.stats.avg_order).toBe(27500);
    expect(profile.stats.largest_order_amount).toBe(40000);
    expect(profile.orders.length).toBe(3);
    expect(profile.reviews.length).toBe(1);
    expect(profile.reviews[0].rating).toBe(5);
    expect(profile.wishlist.length).toBe(1);
  });

  test('recommendation returns a product from the customer top category', () => {
    const rec = customerService.recommendForCustomer(custId);
    expect(rec).toBeTruthy();
    // top category is category 1 (all spend there) â†’ recommends one of the two test products
    expect([productIds[0], productIds[1]]).toContain(rec.id);
  });

  test('customerActionRows + toCsv produce a valid CSV', () => {
    const rows = customerService.customerActionRows(custId);
    expect(rows.length).toBe(5); // 3 orders + 1 review + 1 wishlist
    const csv = customerService.toCsv(rows);
    expect(csv.split('\n')[0]).toBe('action,order_id,status,total,date');
    expect(csv).toContain('order');
    expect(csv).toContain('review');
    expect(csv).toContain('wishlist_add');
  });
});
