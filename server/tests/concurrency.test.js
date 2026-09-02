/**
 * Multi-user concurrency safety — the INVARIANTS that make concurrent
 * correctness hold. SQLite (sql.js) is single-writer, so these are
 * sequential-invariant tests that assert the same guard a concurrent write
 * would hit — e.g. two "users" both issuing the last unit must yield
 * exactly one success and one safe failure (never negative stock).
 *
 * TEST A  dual issue of last unit → one succeeds, the other fails safely
 * TEST C  duplicate receipt → layers preserved (orchestration guards dup)
 * TEST E  reservation can never exceed available stock
 * TEST B  webhook event idempotency → same event never processed twice
 */
const db = require('../db');
const valuation = require('../services/valuationService');
const inventoryService = require('../services/inventoryService');

let whId = null;
let catId = null;
const created = [];

function insertProduct(name) {
  const r = db.prepare("INSERT INTO products (name, price, cost_price, category_id, active, stock) VALUES (?, 0, 0, ?, 1, 0)").run(name, catId);
  created.push(r.lastInsertRowid);
  return r.lastInsertRowid;
}
function receive(productId, qty, unitCost) {
  inventoryService.createMovement({ productId, warehouseId: whId, type: 'receipt', reason: 'seed', qtyChange: qty, unitCost, note: 'jest-conc' });
}
function onHand(productId) {
  const inv = db.prepare('SELECT qty_on_hand FROM inventory WHERE product_id = ? AND warehouse_id = ? AND location_id IS NULL').get(productId, whId);
  return inv ? inv.qty_on_hand : 0;
}

beforeAll(async () => {
  await db.initPromise;
  whId = db.prepare('SELECT id FROM warehouses ORDER BY id LIMIT 1').get().id;
  catId = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get().id;
  valuation.ensureConfig();
  db.prepare("DELETE FROM kashier_webhook_events WHERE event_key LIKE '%jest-conc%'").run();
});

afterEach(() => {
  for (const id of created.splice(0)) {
    db.prepare('DELETE FROM inventory_cost_layers WHERE product_id = ?').run(id);
    db.prepare('DELETE FROM inventory_movements WHERE product_id = ?').run(id);
    db.prepare('DELETE FROM inventory WHERE product_id = ?').run(id);
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
  }
  db.prepare("DELETE FROM kashier_webhook_events WHERE event_key LIKE '%jest-conc%'").run();
  db.saveDb();
});

describe('Multi-user concurrency invariants', () => {
  test('TEST A — dual issue of the LAST unit: exactly one succeeds, the other fails safely', () => {
    const id = insertProduct('jest-conc-a'); // stock = 1 layer
    receive(id, 1, 5000);

    // User A issues the single unit: cost layer depleted + on-hand decremented
    const a = valuation.cogsForIssue(id, 1, 'FIFO', whId);
    expect(a.cost).toBe(5000);
    inventoryService.createMovement({ productId: id, warehouseId: whId, type: 'issue', reason: 'sale', qtyChange: -1, unitCost: a.unit_cost, note: 'jest-conc' });
    expect(onHand(id)).toBe(0);

    // User B tries to issue the same last unit → MUST fail safely, never negative
    expect(() => valuation.cogsForIssue(id, 1, 'FIFO', whId)).toThrow(/Insufficient|No inventory/);
    // The movement engine would also reject a second issue, keeping on-hand >= 0
    expect(() => inventoryService.createMovement({ productId: id, warehouseId: whId, type: 'issue', reason: 'sale', qtyChange: -1, unitCost: 5000, note: 'jest-conc' }))
      .toThrow(/Insufficient/);
    expect(onHand(id)).toBe(0);
  });

  test('TEST E — reservation can never exceed available stock', () => {
    const id = insertProduct('jest-conc-e');
    receive(id, 8, 5000);

    // Reserve 3 ok
    inventoryService.createMovement({ productId: id, warehouseId: whId, type: 'reservation', qtyChange: -3, note: 'jest-conc' });
    // Trying to reserve 6 more (available now 5) must fail
    expect(() => inventoryService.createMovement({ productId: id, warehouseId: whId, type: 'reservation', qtyChange: -6, note: 'jest-conc' }))
      .toThrow(/Insufficient/);
    // On-hand (physical) is unchanged by reservation
    expect(onHand(id)).toBe(8);
  });

  test('TEST C — receipts preserve distinct layers (duplicate receipt would not collapse history)', () => {
    const id = insertProduct('jest-conc-c');
    receive(id, 10, 5000);
    receive(id, 10, 5500);
    const layers = db.prepare('SELECT unit_cost, remaining_quantity FROM inventory_cost_layers WHERE product_id = ? ORDER BY created_at ASC, id ASC').all(id);
    expect(layers).toEqual([
      { unit_cost: 5000, remaining_quantity: 10 },
      { unit_cost: 5500, remaining_quantity: 10 },
    ]);
    expect(onHand(id)).toBe(20);
  });

  test('TEST B — webhook event idempotency: same event never processed twice', () => {
    const ws = require('../services/kashierWebhookService');
    const payload = { eventType: 'transaction-success', sessionId: 'jest-conc-s', merchantOrderId: '999', status: 'SUCCESS' };
    const key = ws.eventKey(payload);
    expect(ws.isDuplicate(key)).toBe(false);
    ws.recordEvent(key, payload.eventType, payload);
    expect(ws.isDuplicate(key)).toBe(true);
    // A second record attempt (INSERT OR IGNORE) must not create a duplicate row
    ws.recordEvent(key, payload.eventType, payload);
    const rows = db.prepare('SELECT COUNT(*) AS n FROM kashier_webhook_events WHERE event_key = ?').get(key);
    expect(rows.n).toBe(1);
  });
});
