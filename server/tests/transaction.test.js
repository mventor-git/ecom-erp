/**
 * P0 failure-injection: proves db.transaction() provides an atomic boundary —
 * a write followed by a thrown error is ROLLED BACK (no partial mutation),
 * which is the primitive the supply-receipt / online-payment multi-step flows
 * must use. Mirrors CASE C/D (movement written, then failure before
 * cost-layer persistence → whole sequence rolls back).
 */
const db = require('../db');

let catId = null;
const created = [];

function insertProduct(name) {
  const r = db.prepare("INSERT INTO products (name, price, cost_price, category_id, active, stock) VALUES (?, 0, 0, ?, 1, 0)").run(name, catId);
  created.push(r.lastInsertRowid);
  return r.lastInsertRowid;
}

function countMovements(productId) {
  return db.prepare('SELECT COUNT(*) AS n FROM inventory_movements WHERE product_id = ?').get(productId).n;
}

beforeAll(async () => {
  await db.initPromise;
  catId = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get().id;
});

afterEach(() => {
  for (const id of created.splice(0)) {
    db.prepare('DELETE FROM inventory_movements WHERE product_id = ?').run(id);
    db.prepare('DELETE FROM inventory_cost_layers WHERE product_id = ?').run(id);
    db.prepare('DELETE FROM inventory WHERE product_id = ?').run(id);
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
  }
  db.saveDb();
});

describe('db.transaction — atomic boundary (failure injection)', () => {
  test('a write followed by a throw ROLLS BACK (no partial mutation)', () => {
    const id = insertProduct('jest-txn-rollback');
    expect(countMovements(id)).toBe(0);

    expect(() => db.transaction(() => {
      // simulate: inventory movement written...
      db.prepare(`INSERT INTO inventory_movements (product_id, warehouse_id, type, qty_change, qty_before, qty_after)
                  VALUES (?, 1, 'receipt', 10, 0, 10)`).run(id);
      expect(countMovements(id)).toBe(1); // visible inside the txn
      // ...then a cost-layer (or anything) FAILS → the whole txn must roll back
      throw new Error('simulated crash before cost layer');
    })).toThrow(/simulated crash/);

    // The movement must NOT persist — whole sequence rolled back.
    expect(countMovements(id)).toBe(0);
  });

  test('a successful transaction COMMITS', () => {
    const id = insertProduct('jest-txn-commit');
    db.transaction(() => {
      db.prepare(`INSERT INTO inventory_movements (product_id, warehouse_id, type, qty_change, qty_before, qty_after)
                  VALUES (?, 1, 'receipt', 5, 0, 5)`).run(id);
    });
    expect(countMovements(id)).toBe(1);
  });

  test('rollback does not poison subsequent writes', () => {
    const id = insertProduct('jest-txn-recover');
    try { db.transaction(() => { db.prepare('UPDATE products SET price = 1 WHERE id = ?').run(id); throw new Error('boom'); }); } catch {}
    // A clean transaction still works after a rollback
    db.transaction(() => { db.prepare('UPDATE products SET price = 2 WHERE id = ?').run(id); });
    expect(db.prepare('SELECT price FROM products WHERE id = ?').get(id).price).toBe(2);
  });
});
