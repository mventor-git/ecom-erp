/**
 * Unit tests for the Product Trash service (mventor-ticket-044).
 * Uses the real (seeded) database and cleans up every artifact it creates.
 * All test products are tagged with 'jest-trash' in their name for cleanup.
 */
const db = require('../db');
const productTrashService = require('../services/productTrashService');
const inventoryService = require('../services/inventoryService');
const reportService = require('../services/reportService');

let whId = null;
let catId = null;
const createdIds = [];

function insertProduct(name, { active = 1, stock = 0 } = {}) {
  const result = db.prepare(`
    INSERT INTO products (name, price, category_id, active, stock)
    VALUES (?, 1000, ?, ?, ?)
  `).run(name, catId, active, stock);
  const id = result.lastInsertRowid;
  createdIds.push(id);
  return id;
}

function addMovement(productId, qtyChange) {
  // Go through the real service so the derived inventory snapshot is maintained
  return inventoryService.createMovement({
    productId,
    warehouseId: whId,
    type: 'receipt',
    reason: 'jest',
    qtyChange,
    note: 'jest-trash',
  });
}

function getProduct(id) {
  return db.prepare('SELECT * FROM products WHERE id = ?').get(id);
}

beforeAll(async () => {
  await db.initPromise;
  const wh = db.prepare('SELECT id FROM warehouses ORDER BY id LIMIT 1').get();
  whId = wh.id;
  let cat = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get();
  if (!cat) {
    const r = db.prepare("INSERT INTO categories (name, slug) VALUES ('jest-trash-cat', 'jest-trash-cat')").run();
    catId = r.lastInsertRowid;
  } else {
    catId = cat.id;
  }
});

afterEach(() => {
  // Remove all artifacts created by the tests (products first — FK references)
  for (const id of createdIds.splice(0)) {
    db.prepare('DELETE FROM inventory WHERE product_id = ?').run(id);
    db.prepare("DELETE FROM inventory_movements WHERE product_id = ? AND note = 'jest-trash'").run(id);
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
  }
  db.prepare("DELETE FROM events WHERE payload LIKE '%jest-trash%'").run();
  db.prepare("DELETE FROM categories WHERE slug = 'jest-trash-cat'").run();
  db.saveDb();
});

describe('Product Trash Service', () => {
  test('trashOne soft-deletes: stamps deleted_at, snapshots active, resets stock snapshot', () => {
    const id = insertProduct('jest-trash-alpha', { active: 1, stock: 5 });
    addMovement(id, 5);

    expect(productTrashService.trashOne(id)).toBe(true);

    const p = getProduct(id);
    expect(p.deleted_at).not.toBeNull();
    expect(p.active).toBe(0);
    expect(p.restore_active).toBe(1);
    // Warehouse reset: derived stock is gone and legacy field synced to 0
    const inv = db.prepare('SELECT * FROM inventory WHERE product_id = ?').all(id);
    expect(inv.length).toBe(0);
    expect(p.stock).toBe(0);
    // Movements are immutable — still present
    const movements = db.prepare('SELECT * FROM inventory_movements WHERE product_id = ?').all(id);
    expect(movements.length).toBe(1);
  });

  test('trashOne returns false for unknown or already-trashed product', () => {
    expect(productTrashService.trashOne(999999999)).toBe(false);
    const id = insertProduct('jest-trash-twice');
    expect(productTrashService.trashOne(id)).toBe(true);
    expect(productTrashService.trashOne(id)).toBe(false);
  });

  test('restoreAll restores trashed products AND keeps post-trash products (merge)', () => {
    const idA = insertProduct('jest-trash-merge-a', { active: 1 });
    addMovement(idA, 7);
    productTrashService.trashOne(idA);

    // Product created AFTER the trash action must survive restore untouched
    const idB = insertProduct('jest-trash-merge-b', { active: 1 });

    const { count } = productTrashService.restoreAll();
    expect(count).toBeGreaterThanOrEqual(1);

    const a = getProduct(idA);
    expect(a.deleted_at).toBeNull();
    expect(a.active).toBe(1); // restored from restore_active snapshot

    const b = getProduct(idB);
    expect(b.deleted_at).toBeNull();
    expect(b.restore_active).toBeNull();
  });

  test('restore rebuilds exact stock from movement replay', () => {
    const id = insertProduct('jest-trash-stock', { active: 1 });
    addMovement(id, 5);
    addMovement(id, -2);
    addMovement(id, 4); // net +7

    productTrashService.trashOne(id);
    expect(getProduct(id).stock).toBe(0);

    productTrashService.restoreOne(id);

    const p = getProduct(id);
    expect(p.stock).toBe(7);
    const inv = db.prepare(
      'SELECT qty_on_hand FROM inventory WHERE product_id = ? AND warehouse_id = ? AND location_id IS NULL'
    ).get(id, whId);
    expect(inv.qty_on_hand).toBe(7);
  });

  test('restore preserves pre-trash inactive state', () => {
    const id = insertProduct('jest-trash-inactive', { active: 0 });
    productTrashService.trashOne(id);
    expect(getProduct(id).restore_active).toBe(0);

    productTrashService.restoreOne(id);
    expect(getProduct(id).active).toBe(0); // stays deactivated, as before trash
  });

  test('listTrashed contains trashed products and clears after restore', () => {
    const id = insertProduct('jest-trash-listing');
    productTrashService.trashOne(id);

    const listed = productTrashService.listTrashed().find(p => p.id === id);
    expect(listed).toBeDefined();
    expect(listed.name).toBe('jest-trash-listing');

    productTrashService.restoreOne(id);
    expect(productTrashService.listTrashed().find(p => p.id === id)).toBeUndefined();
  });

  test('restoreOne returns false for unknown trashed product', () => {
    expect(productTrashService.restoreOne(999999999)).toBe(false);
  });

  // ── ERP guards (mventor-ticket-045) ──

  test('createMovement rejects trashed products and works again after restore', () => {
    const id = insertProduct('jest-trash-guard');
    addMovement(id, 3);

    productTrashService.trashOne(id);

    expect(() => inventoryService.createMovement({
      productId: id,
      warehouseId: whId,
      type: 'receipt',
      qtyChange: 5,
      note: 'jest-trash',
    })).toThrow(/in the trash/);

    productTrashService.restoreOne(id);

    const m = inventoryService.createMovement({
      productId: id,
      warehouseId: whId,
      type: 'receipt',
      qtyChange: 5,
      note: 'jest-trash',
    });
    expect(m.qty_after).toBe(8); // replayed 3 + new 5
  });

  test('low-stock report excludes trashed products and includes them again after restore', () => {
    db.prepare('UPDATE products SET reorder_point = 5 WHERE id = ?').run(
      insertProduct('jest-trash-lowstock')
    );
    const id = createdIds[createdIds.length - 1];
    addMovement(id, 2); // qty 2 <= reorder point 5 → low stock

    const beforeTrash = reportService.generate('low_stock', {}).find(r => r.product_id === id);
    expect(beforeTrash).toBeDefined();

    productTrashService.trashOne(id);
    expect(reportService.generate('low_stock', {}).find(r => r.product_id === id)).toBeUndefined();

    productTrashService.restoreOne(id);
    // After restore the inventory snapshot is rebuilt from movements (qty 2) → still low stock
    expect(reportService.generate('low_stock', {}).find(r => r.product_id === id)).toBeDefined();
  });
});
