/**
 * Unit/integration tests for the inventory service.
 * Uses the real (seeded) database and restores state after each test.
 * Self-sufficient: creates its own product fixture on fresh/empty stores.
 */
const db = require('../db');
const inventoryService = require('../services/inventoryService');

let whId = null;
let pid = null;
let initialStock = 0;
let ownProductId = null;

beforeAll(async () => {
  await db.initPromise;
  const wh = db.prepare('SELECT id FROM warehouses ORDER BY id LIMIT 1').get();
  whId = wh ? wh.id : db.prepare("INSERT INTO warehouses (name, code) VALUES ('Jest WH', 'JEST-WH')").run().lastInsertRowid;

  // Fresh stores may have zero products — create a fixture instead of assuming seeds
  let prod = db.prepare('SELECT id, stock FROM products ORDER BY id LIMIT 1').get();
  if (!prod) {
    let cat = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get();
    const catId = cat ? cat.id : db.prepare("INSERT INTO categories (name, slug) VALUES ('Jest Cat', 'jest-cat')").run().lastInsertRowid;
    const rid = db.prepare("INSERT INTO products (name, price, category_id, active, stock) VALUES ('jest-inv-fixture', 1000, ?, 1, 0)").run(catId).lastInsertRowid;
    ownProductId = rid;
    prod = { id: rid, stock: 0 };
  }
  pid = prod.id;

  // GUARANTEE a baseline inventory row (50 units) for the chosen product,
  // whether it was seeded, auto-created, or our fixture.
  const hasInv = db.prepare(`
    SELECT id FROM inventory
    WHERE product_id = ? AND warehouse_id = ? AND location_id IS NULL
  `).get(pid, whId);
  if (!hasInv) {
    db.prepare(`
      INSERT INTO inventory_movements (product_id, warehouse_id, location_id, type, reason, qty_change, qty_before, qty_after, note)
      VALUES (?, ?, NULL, 'receipt', 'jest', 50, 0, 50, 'jest:seed-keep')
    `).run(pid, whId);
    db.prepare(`
      INSERT INTO inventory (product_id, warehouse_id, location_id, qty_on_hand, qty_reserved)
      VALUES (?, ?, NULL, 50, 0)
    `).run(pid, whId);
  } else {
    // Existing row: normalize to a known 50 so relative assertions hold
    db.prepare('UPDATE inventory SET qty_on_hand = 50, qty_reserved = 0 WHERE id = ?').run(hasInv.id);
    db.prepare(`
      INSERT INTO inventory_movements (product_id, warehouse_id, location_id, type, reason, qty_change, qty_before, qty_after, note)
      VALUES (?, ?, NULL, 'count', 'jest', 50, 0, 50, 'jest:seed-keep')
    `).run(pid, whId);
  }
  initialStock = 50;
});

afterAll(() => {
  if (ownProductId) {
    db.prepare('DELETE FROM inventory WHERE product_id = ?').run(ownProductId);
    db.prepare("DELETE FROM inventory_movements WHERE product_id = ? AND (note LIKE 'jest:%' OR note = 'jest:seed-keep')").run(ownProductId);
    db.prepare('DELETE FROM products WHERE id = ?').run(ownProductId);
  }
  db.saveDb();
});

/** Rebuild stock for a (product, warehouse) pair from remaining movements */
function rebuildStock(productId, warehouseId) {
  const sum = db.prepare(`
    SELECT COALESCE(SUM(qty_change), 0) as s FROM inventory_movements
    WHERE product_id = ? AND warehouse_id = ? AND location_id IS NULL
  `).get(productId, warehouseId);
  const inv = db.prepare(`
    SELECT id FROM inventory WHERE product_id = ? AND warehouse_id = ? AND location_id IS NULL
  `).get(productId, warehouseId);
  if (sum.s === 0) {
    if (inv) db.prepare('DELETE FROM inventory WHERE id = ?').run(inv.id);
  } else if (inv) {
    db.prepare('UPDATE inventory SET qty_on_hand = ?, qty_reserved = 0 WHERE id = ?').run(sum.s, inv.id);
  } else {
    db.prepare(`
      INSERT INTO inventory (product_id, warehouse_id, location_id, qty_on_hand, qty_reserved)
      VALUES (?, ?, NULL, ?, 0)
    `).run(productId, warehouseId, sum.s);
  }
  inventoryService.syncProductStock(productId);
}

afterEach(() => {
  db.prepare("DELETE FROM inventory_movements WHERE note LIKE 'jest:%' AND note <> 'jest:seed-keep'").run();
  rebuildStock(pid, whId);
});

describe('Inventory Service', () => {
  test('receipt increases stock and syncs products.stock', () => {
    const before = inventoryService.getStock(pid, whId);
    const beforeQty = before ? before.qty_on_hand : 0;
    const movement = inventoryService.createMovement({
      productId: pid,
      warehouseId: whId,
      type: 'receipt',
      qtyChange: 10,
      note: 'jest:receipt',
    });
    expect(movement.qty_change).toBe(10);
    expect(movement.qty_before).toBe(beforeQty);
    expect(movement.qty_after).toBe(beforeQty + 10);
    const after = inventoryService.getStock(pid, whId);
    expect(after.qty_on_hand).toBe(beforeQty + 10);
    const product = db.prepare('SELECT stock FROM products WHERE id = ?').get(pid);
    expect(product.stock).toBe(inventoryService.getTotalStock(pid));
  });

  test('issue decreases stock', () => {
    const before = inventoryService.getStock(pid, whId).qty_on_hand;
    const movement = inventoryService.createMovement({
      productId: pid,
      warehouseId: whId,
      type: 'issue',
      qtyChange: -3,
      note: 'jest:issue',
    });
    expect(movement.qty_after).toBe(before - 3);
    expect(inventoryService.getStock(pid, whId).qty_on_hand).toBe(before - 3);
  });

  test('issue below zero throws insufficient stock', () => {
    const before = inventoryService.getStock(pid, whId).qty_on_hand;
    expect(() => inventoryService.createMovement({
      productId: pid,
      warehouseId: whId,
      type: 'issue',
      qtyChange: -(before + 100),
      note: 'jest:issue-over',
    })).toThrow(/Insufficient stock/);
  });

  test('adjustment can go below zero', () => {
    const before = inventoryService.getStock(pid, whId).qty_on_hand;
    const movement = inventoryService.createMovement({
      productId: pid,
      warehouseId: whId,
      type: 'adjustment',
      qtyChange: -(before + 5),
      note: 'jest:adjustment',
    });
    expect(movement.qty_after).toBe(-5);
    expect(inventoryService.getStock(pid, whId).qty_on_hand).toBe(-5);
  });

  test('count with countedQty sets exact stock', () => {
    inventoryService.createMovement({
      productId: pid,
      warehouseId: whId,
      type: 'receipt',
      qtyChange: 50,
      note: 'jest:count-prep',
    });
    const movement = inventoryService.createMovement({
      productId: pid,
      warehouseId: whId,
      type: 'count',
      countedQty: 25,
      note: 'jest:count',
    });
    expect(movement.qty_after).toBe(25);
    expect(inventoryService.getStock(pid, whId).qty_on_hand).toBe(25);
  });

  test('count without countedQty throws', () => {
    expect(() => inventoryService.createMovement({
      productId: pid,
      warehouseId: whId,
      type: 'count',
      note: 'jest:count-bad',
    })).toThrow(/countedQty is required/);
  });

  test('reservation respects available stock (on hand - reserved)', () => {
    inventoryService.createMovement({
      productId: pid,
      warehouseId: whId,
      type: 'count',
      countedQty: 10,
      note: 'jest:res-baseline',
    });
    inventoryService.createMovement({
      productId: pid,
      warehouseId: whId,
      type: 'reservation',
      qtyChange: -4,
      note: 'jest:res-1',
    });
    expect(() => inventoryService.createMovement({
      productId: pid,
      warehouseId: whId,
      type: 'reservation',
      qtyChange: -7,
      note: 'jest:res-2',
    })).toThrow(/Insufficient available stock/);

    const stock = inventoryService.getStock(pid, whId);
    expect(stock.qty_reserved).toBe(4);
    expect(stock.qty_on_hand).toBe(10);

    inventoryService.createMovement({
      productId: pid,
      warehouseId: whId,
      type: 'release',
      qtyChange: 4,
      note: 'jest:res-release',
    });
    const released = inventoryService.getStock(pid, whId);
    expect(released.qty_reserved).toBe(0);
    expect(released.qty_on_hand).toBe(10);
  });

  test('replayMovements is consistent after a sequence', () => {
    inventoryService.createMovement({ productId: pid, warehouseId: whId, type: 'receipt', qtyChange: 20, note: 'jest:replay-1' });
    inventoryService.createMovement({ productId: pid, warehouseId: whId, type: 'issue', qtyChange: -7, note: 'jest:replay-2' });
    inventoryService.createMovement({ productId: pid, warehouseId: whId, type: 'receipt', qtyChange: 5, note: 'jest:replay-3' });
    const replay = inventoryService.replayMovements(pid, whId);
    expect(replay.consistent).toBe(true);
    expect(replay.computedStock).toBe(replay.currentStock);
    expect(replay.movements.length).toBeGreaterThanOrEqual(3);
  });

  test('invalid movement type is rejected', () => {
    expect(() => inventoryService.createMovement({
      productId: pid,
      warehouseId: whId,
      type: 'teleport',
      qtyChange: 1,
      note: 'jest:bad-type',
    })).toThrow(/Invalid movement type/);
  });

  test('getMovements filters by type', () => {
    inventoryService.createMovement({ productId: pid, warehouseId: whId, type: 'receipt', qtyChange: 5, note: 'jest:filter' });
    const issues = inventoryService.getMovements({ type: 'receipt', limit: 100 });
    expect(Array.isArray(issues)).toBe(true);
    expect(issues.every(m => m.type === 'receipt')).toBe(true);
  });
});
