/**
 * Tests for mventor-ticket-043/044: supply orders, issue orders, financial periods,
 * markdown documents (QR + barcode) and the PDF writer.
 */
const db = require('../db');
const warehouseOrderService = require('../services/warehouseOrderService');
const inventoryService = require('../services/inventoryService');
const documentService = require('../services/documentService');
const { PdfWriter } = require('../utils/pdfWriter');

let whId = null;
let pid = null;
let pid2 = null;

beforeAll(async () => {
  await db.initPromise;
  const wh = db.prepare('SELECT id FROM warehouses ORDER BY id LIMIT 1').get();
  whId = wh.id;
  // Self-sufficient fixtures: fresh stores have no products — create two
  let cat = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get();
  const catId = cat ? cat.id : db.prepare("INSERT INTO categories (name, slug) VALUES ('Jest Cat', 'jest-cat-wo')").run().lastInsertRowid;
  const products = db.prepare('SELECT id FROM products ORDER BY id LIMIT 2').all();
  if (products.length >= 2) {
    pid = products[0].id;
    pid2 = products[1].id;
  } else {
    pid = db.prepare("INSERT INTO products (name, price, category_id, active, stock) VALUES ('Jest WO Product A', 1000, ?, 1, 0)").run(catId).lastInsertRowid;
    pid2 = db.prepare("INSERT INTO products (name, price, category_id, active, stock) VALUES ('Jest WO Product B', 2000, ?, 1, 0)").run(catId).lastInsertRowid;
  }
});

afterAll(() => {
  // remove test data
  db.prepare("DELETE FROM inventory_movements WHERE note LIKE 'jest:%'").run();
  db.prepare("DELETE FROM supply_orders WHERE supplier_name = 'JEST SUPPLIER'").run();
  db.prepare("DELETE FROM issue_orders WHERE customer_name = 'JEST CUSTOMER'").run();
  db.prepare("DELETE FROM financial_periods WHERE name LIKE 'JEST-%'").run();
  // remove fixture products created by this suite
  db.prepare("DELETE FROM inventory WHERE product_id IN (SELECT id FROM products WHERE name LIKE 'Jest WO Product%')").run();
  db.prepare("DELETE FROM products WHERE name LIKE 'Jest WO Product%'").run();
  db.prepare("DELETE FROM categories WHERE slug = 'jest-cat-wo'").run();
  // rebuild stock for the test products
  [pid, pid2].forEach(pid2 => {
    const sum = db.prepare(`
      SELECT COALESCE(SUM(qty_change), 0) as s FROM inventory_movements
      WHERE product_id = ? AND warehouse_id = ? AND location_id IS NULL
    `).get(pid, whId);
    const inv = db.prepare('SELECT id FROM inventory WHERE product_id = ? AND warehouse_id = ? AND location_id IS NULL').get(pid, whId);
    if (sum.s === 0) {
      if (inv) db.prepare('DELETE FROM inventory WHERE id = ?').run(inv.id);
    } else if (inv) {
      db.prepare('UPDATE inventory SET qty_on_hand = ?, qty_reserved = 0 WHERE id = ?').run(sum.s, inv.id);
    } else {
      db.prepare('INSERT INTO inventory (product_id, warehouse_id, location_id, qty_on_hand, qty_reserved) VALUES (?, ?, NULL, ?, 0)').run(pid, whId, sum.s);
    }
    inventoryService.syncProductStock(pid);
  });
  db.saveDb();
});

describe('Supply Orders', () => {
  test('create draft with items, issue stocks in and generates a document', async () => {
    const before = inventoryService.getStock(pid, whId);
    const beforeQty = before ? before.qty_on_hand : 0;

    const order = warehouseOrderService.createSupplyOrder({
      supplierName: 'JEST SUPPLIER',
      warehouseId: whId,
      note: 'jest:supply',
      items: [{ product_id: pid, qty: 10, unit_cost: 5000 }],
    });
    expect(order.status).toBe('draft');
    expect(order.order_number).toMatch(/^SUP-/);
    expect(order.items.length).toBe(1);

    // add another item to the draft
    warehouseOrderService.addSupplyItem(order.id, pid2, 5, 3000);
    const withItems = warehouseOrderService.getSupplyOrder(order.id);
    expect(withItems.items.length).toBe(2);

    const result = await warehouseOrderService.issueSupplyOrder(order.id, 'jest-user');
    expect(result.status).toBe('issued');

    // stock increased
    const after = inventoryService.getStock(pid, whId);
    expect(after.qty_on_hand).toBe(beforeQty + 10);

    // movement recorded with reference
    const movement = db.prepare(`
      SELECT * FROM inventory_movements
      WHERE reference_type = 'supply_order' AND reference_id = ? AND product_id = ?
    `).get(order.id, pid);
    expect(movement).toBeTruthy();
    expect(movement.qty_change).toBe(10);

    // document generated (.md with QR + barcode)
    expect(result.document).toBeTruthy();
    expect(result.document.filename).toBe(`${order.order_number}.md`);
    const content = result.document.content;
    expect(content).toContain('data:image/png;base64'); // QR
    expect(content).toContain('data:image/svg+xml;base64'); // barcode
    expect(content).toContain(order.order_number);
  });

  test('issued supply order cannot be edited or re-issued', async () => {
    const order = warehouseOrderService.createSupplyOrder({
      supplierName: 'JEST SUPPLIER',
      warehouseId: whId,
      items: [{ product_id: pid, qty: 1 }],
    });
    await warehouseOrderService.issueSupplyOrder(order.id, 'jest-user');
    expect(() => warehouseOrderService.addSupplyItem(order.id, pid2, 1)).toThrow(/draft/);
    await expect(warehouseOrderService.issueSupplyOrder(order.id, 'jest-user')).rejects.toThrow(/draft/);
  });
});

describe('Issue Orders', () => {
  test('create draft, add items, issue deducts stock and notifies packing', async () => {
    // ensure enough stock first
    inventoryService.createMovement({ productId: pid, warehouseId: whId, type: 'receipt', qtyChange: 20, note: 'jest:issue-prep' });

    const before = inventoryService.getStock(pid, whId).qty_on_hand;

    const order = warehouseOrderService.createIssueOrder({
      customerName: 'JEST CUSTOMER',
      note: 'jest:issue',
      items: [{ product_id: pid, qty: 6, unit_cost: 4000 }],
    });
    warehouseOrderService.addIssueItem(order.id, pid2, 2, 2000);

    const result = await warehouseOrderService.issueIssueOrder(order.id, whId, 'jest-packer');
    expect(result.status).toBe('issued');

    const after = inventoryService.getStock(pid, whId);
    expect(after.qty_on_hand).toBe(before - 6);

    const movement = db.prepare(`
      SELECT * FROM inventory_movements
      WHERE reference_type = 'issue_order' AND reference_id = ? AND product_id = ?
    `).get(order.id, pid);
    expect(movement).toBeTruthy();
    expect(movement.qty_change).toBe(-6);

    // document
    expect(result.document.content).toContain('data:image/png;base64');
    expect(result.document.content).toContain(order.order_number);
  });

  test('issue beyond available stock throws and rolls back', async () => {
    const order = warehouseOrderService.createIssueOrder({
      customerName: 'JEST CUSTOMER',
      items: [{ product_id: pid, qty: 99999 }],
    });
    await expect(warehouseOrderService.issueIssueOrder(order.id, whId, 'jest-user')).rejects.toThrow(/Insufficient/);

    // no leftover movements from the failed issue (rollback correction applied)
    const leftovers = db.prepare(`
      SELECT COUNT(*) as c FROM inventory_movements
      WHERE reference_type = 'issue_order' AND reference_id = ? AND type = 'issue'
    `).get(order.id);
    expect(leftovers.c).toBe(0);
  });
});

describe('Financial Periods', () => {
  test('create period validates months 1-60', () => {
    const p = warehouseOrderService.createFinancialPeriod({ name: 'JEST-Period-1', months: 6 });
    expect(p.status).toBe('OPEN');
    expect(p.months).toBe(6);

    expect(() => warehouseOrderService.createFinancialPeriod({ name: 'JEST-Period-2', months: 0 })).toThrow(/between 1 and 60/);
    expect(() => warehouseOrderService.createFinancialPeriod({ name: 'JEST-Period-3', months: 61 })).toThrow(/between 1 and 60/);
  });

  test('set opening balance sets stock to the counted value', async () => {
    const period = warehouseOrderService.createFinancialPeriod({ name: 'JEST-Period-4', months: 3 });

    // make sure current stock is not 42
    const current = inventoryService.getStock(pid, whId);
    const currentQty = current ? current.qty_on_hand : 0;

    warehouseOrderService.setOpeningBalance(period.id, whId, [{ product_id: pid, qty: 42 }], 'jest-user');

    const after = inventoryService.getStock(pid, whId);
    expect(after.qty_on_hand).toBe(42);

    const updated = db.prepare('SELECT * FROM financial_periods WHERE id = ?').get(period.id);
    expect(updated.opening_balance_set).toBe(1);

    // movement tagged to the period
    const movement = db.prepare(`
      SELECT * FROM inventory_movements
      WHERE reference_type = 'financial_period' AND reference_id = ?
    `).get(period.id);
    expect(movement).toBeTruthy();
    expect(movement.type).toBe('opening_balance');
    expect(movement.qty_after).toBe(42);

    // restore stock for later tests
    warehouseOrderService.setOpeningBalance(period.id, whId, [{ product_id: pid, qty: currentQty }], 'jest-user');
  });

  test('closed period rejects opening balance', async () => {
    const period = warehouseOrderService.createFinancialPeriod({ name: 'JEST-Period-5', months: 1 });
    warehouseOrderService.closeFinancialPeriod(period.id);
    expect(() => warehouseOrderService.setOpeningBalance(period.id, whId, [{ product_id: pid, qty: 5 }], 'jest-user')).toThrow(/open periods/);
  });
});

describe('Markdown Documents', () => {
  test('buildMarkdownDocument includes QR, barcode and totals', async () => {
    const doc = await documentService.buildMarkdownDocument({
      type: 'TEST',
      title: 'Test Document',
      number: 'TEST-2026-0001',
      meta: [['Customer', 'JEST']],
      items: [{ name: 'Item A', qty: 2, price: 5000, amount: 10000 }],
      totals: [['Total', '100.00 EGP']],
      qrData: 'TEST:123',
      barcode: 'TEST-0001',
    });
    expect(doc.content).toContain('data:image/png;base64');
    expect(doc.content).toContain('data:image/svg+xml;base64');
    expect(doc.content).toContain('| 1 | Item A | 2 |');
    expect(doc.content).toContain('**Total**');
    expect(doc.filename).toBe('TEST-2026-0001.md');
    expect(doc.path).toContain('documents');
  });
});

describe('PDF Writer', () => {
  test('produces a valid PDF buffer', () => {
    const pdf = new PdfWriter();
    pdf.title('Ecom-ERP');
    pdf.text('Report line');
    pdf.table(['A', 'B'], [['1', '2'], ['3', '4']]);
    pdf.setFooter('footer');
    const buf = pdf.render();
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buf.toString('latin1')).toContain('startxref');
    expect(buf.toString('latin1')).toContain('%%EOF');
  });
});
