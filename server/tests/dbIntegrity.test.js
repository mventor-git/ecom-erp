/**
 * Phase 3 — Database integrity: proves that declared FOREIGN KEY and UNIQUE
 * constraints are ACTUALLY enforced (PRAGMA foreign_keys = ON at db.js:27),
 * i.e. orphan records and duplicate provider/product links are rejected.
 */
const db = require('../db');

let catId = null;
beforeAll(async () => {
  await db.initPromise;
  catId = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get().id;
});

afterEach(() => {
  try { db.prepare('DELETE FROM product_suppliers WHERE product_id = 123456789').run(); } catch {}
  db.saveDb();
});

describe('DB integrity — constraints are enforced', () => {
  test('FOREIGN KEY rejects an orphan supplier link (orphan prevention)', () => {
    // insert a product and reference a NON-existent supplier id → must throw
    const prod = db.prepare("INSERT INTO products (name, price, cost_price, category_id, active, stock) VALUES (? ,0,0,?,1,0)").run('jest-fk-product', catId);
    expect(() => db.prepare(
      'INSERT INTO product_suppliers (product_id, supplier_id, unit_cost) VALUES (?, 987654321, 1000)'
    ).run(prod.lastInsertRowid)).toThrow(/FOREIGN KEY|constraint/i);
    db.prepare('DELETE FROM products WHERE id = ?').run(prod.lastInsertRowid);
  });

  test('UNIQUE rejects a duplicate product↔supplier link', () => {
    const prod = db.prepare("INSERT INTO products (name, price, cost_price, category_id, active, stock) VALUES (? ,0,0,?,1,0)").run('jest-uniq-product', catId);
    const sup = db.prepare("INSERT INTO suppliers (name) VALUES ('jest-uniq-supplier')").run();
    db.prepare('INSERT INTO product_suppliers (product_id, supplier_id, unit_cost) VALUES (?, ?, 1000)').run(prod.lastInsertRowid, sup.lastInsertRowid);
    // second row for the SAME (product, supplier) must violate UNIQUE
    expect(() => db.prepare('INSERT INTO product_suppliers (product_id, supplier_id, unit_cost) VALUES (?, ?, 2000)')
      .run(prod.lastInsertRowid, sup.lastInsertRowid)).toThrow(/UNIQUE|constraint/i);
    db.prepare('DELETE FROM product_suppliers WHERE product_id = ?').run(prod.lastInsertRowid);
    db.prepare('DELETE FROM products WHERE id = ?').run(prod.lastInsertRowid);
    db.prepare('DELETE FROM suppliers WHERE id = ?').run(sup.lastInsertRowid);
  });

});

