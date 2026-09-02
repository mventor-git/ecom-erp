/**
 * Tests for profit reports (mventor-ticket-051) + allow_negative_stock setting.
 */
const db = require('../db');
const settingsService = require('../services/settingsService');
const inventoryService = require('../services/inventoryService');

let reportService;
let pid = null;
let custId = null;
let testProductId = null;
let catId = null;

beforeAll(async () => {
  await db.initPromise;
  reportService = require('../services/reportService');
  catId = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get().id; // ids 1-4 no longer exist
  // Self-sufficient: fresh stores may have zero products — create a stand-in
  const existing = db.prepare('SELECT id FROM products ORDER BY id LIMIT 1').get();
  pid = existing ? existing.id : db.prepare(`
    INSERT INTO products (name, price, category_id, active) VALUES ('Jest Profit StandIn', 1000, ?, 1)
  `).run(catId).lastInsertRowid;

  // dedicated test product so aggregation is isolated from real sales
  const p = db.prepare(`
    INSERT INTO products (name, description, price, cost_price, stock, category_id)
    VALUES ('Jest Profit Product', 'test', 10000, 8000, 0, ?)
  `).run(catId);
  testProductId = p.lastInsertRowid;

  const testEmail = `jest.profit-${Math.random().toString(36).slice(2, 10)}@test.com`;
  // children-first: leftover orders on a reused customer block DELETE under FK ON
  const leftover = db.prepare("SELECT id FROM customers WHERE email = ?").get(testEmail);
  if (leftover) {
    db.prepare('DELETE FROM orders WHERE customer_id = ?').run(leftover.id);
    db.prepare('DELETE FROM customers WHERE id = ?').run(leftover.id);
  }
  custId = db.prepare('INSERT INTO customers (email, name, google_id) VALUES (?, ?, ?)')
    .run(testEmail, 'Jest Profit', 'jest_profit_' + Math.random().toString(36).slice(2, 8)).lastInsertRowid;
});

afterAll(() => {
  db.prepare("DELETE FROM orders WHERE customer_id = ?").run(custId);
  db.prepare("DELETE FROM customers WHERE id = ?").run(custId);
  db.prepare('DELETE FROM inventory_cost_layers WHERE product_id = ?').run(testProductId); // children before parent (FK ON)
  db.prepare("DELETE FROM products WHERE id = ?").run(testProductId);
  db.prepare("DELETE FROM inventory_movements WHERE note LIKE 'jest:%'").run();
  db.saveDb();
});

function insertOrder(status, items, priceList = 'retail') {
  return db.prepare(`
    INSERT INTO orders (customer_id, total, status, items, price_list_code)
    VALUES (?, ?, ?, ?, ?)
  `).run(custId, items.reduce((s, i) => s + i.price * i.qty, 0), status, JSON.stringify(items), priceList).lastInsertRowid;
}

describe('Profit reports', () => {
  test('profit_report aggregates revenue, cost and gross profit (negative valid)', () => {
    const cost = 8000; // the test product's cost_price

    // sold BELOW cost (offer) â€” 2,500 vs cost 8,000 â†’ negative profit
    insertOrder('paid', [{ id: testProductId, name: 'Jest Profit Product', price: 2500, qty: 2 }], 'offer');
    // sold above cost â€” 12,000
    insertOrder('delivered', [{ id: testProductId, name: 'Jest Profit Product', price: 12000, qty: 1 }], 'retail');

    const rows = reportService.generateProfitReport({});
    const row = rows.find(r => r.product_id === testProductId);
    expect(row).toBeTruthy();
    expect(row.qty_sold).toBe(3);
    expect(row.revenue).toBe(2500 * 2 + 12000);
    expect(row.cost_total).toBe(cost * 3);
    // gross profit can be negative overall â€” the value must simply be correct
    expect(row.gross_profit).toBe(row.revenue - row.cost_total);
    // 5,000 - 24,000 = -19,000 (valid negative profit)
    expect(row.gross_profit).toBe(17000 - 24000);
  });

  test('offer_losses returns only lines sold below cost', () => {
    const losses = reportService.generateOfferLosses({});
    const testLoss = losses.find(l => l.product_id === testProductId);
    expect(testLoss).toBeTruthy();
    expect(testLoss.gross_profit).toBeLessThan(0);
    expect(testLoss.loss_amount).toBe(-testLoss.gross_profit);
    losses.forEach(l => {
      expect(l.gross_profit).toBeLessThan(0);
      expect(l.loss_amount).toBe(-l.gross_profit);
    });
  });

  test('net_profit totals revenue, cost, gross profit, offer losses and margin', () => {
    const net = reportService.generateNetProfit({});
    expect(net.length).toBe(1);
    const n = net[0];
    expect(n.revenue).toBeGreaterThan(0);
    expect(n.gross_profit).toBe(n.revenue - n.cost_total);
    expect(n.net_profit).toBe(n.gross_profit);
    expect(n.offer_losses).toBeGreaterThanOrEqual(0);
    expect(typeof n.margin_percent).toBe('number');
    expect(n.orders_count).toBeGreaterThanOrEqual(2);
  });

  test('filters by price list code', () => {
    const offer = reportService.generateProfitReport({ price_list_code: 'offer' });
    expect(offer.some(r => r.product_id === testProductId)).toBe(true);
    const retail = reportService.generateProfitReport({ price_list_code: 'retail' });
    expect(retail.some(r => r.product_id === testProductId)).toBe(true);
  });
});

describe('allow_negative_stock setting', () => {
  test('blocked by default, allowed when enabled', () => {
    const wh = db.prepare('SELECT id FROM warehouses ORDER BY id LIMIT 1').get();
    const before = inventoryService.getStock(pid, wh.id);
    const beforeQty = before ? before.qty_on_hand : 0;

    settingsService.set('allow_negative_stock', false, 'jest');
    expect(() => inventoryService.createMovement({
      productId: pid, warehouseId: wh.id, type: 'issue', qtyChange: -(beforeQty + 100), note: 'jest:neg-blocked',
    })).toThrow(/Insufficient stock/);

    settingsService.set('allow_negative_stock', true, 'jest');
    const movement = inventoryService.createMovement({
      productId: pid, warehouseId: wh.id, type: 'issue', qtyChange: -(beforeQty + 100), note: 'jest:neg-allowed',
    });
    expect(movement.qty_after).toBe(-100);

    // cleanup: restore via count + remove test movements
    inventoryService.createMovement({ productId: pid, warehouseId: wh.id, type: 'count', countedQty: beforeQty, note: 'jest:neg-restore' });
    db.prepare("DELETE FROM inventory_movements WHERE note LIKE 'jest:neg-%'").run();
    settingsService.set('allow_negative_stock', false, 'jest');
  });
});
