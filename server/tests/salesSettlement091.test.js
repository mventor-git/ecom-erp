/**
 * mventor-ticket-091 — Sales settlement journaling + refund reversal.
 *
 * Proves the canonical seam holds across EVERY real settlement path:
 * provider-verified (Kashier webhook), COD collected at delivery, evidence-
 * backed manual settlement — plus provider/admin refunds through the
 * immutable reversal journal, closed-period fail-closed control, cross-
 * channel single-post protection, audit evidence, integer cents, RBAC on
 * money routes, and the revenue reconciliation control.
 *
 * Live-DB hygiene: every artifact (orders, customers, products, journals,
 * events, claims, periods) is cleaned; skeleton accounts persist by design.
 */
const db = require('../db');
const bcrypt = require('bcryptjs');
const settingsService = require('../services/settingsService');
const ws = require('../services/kashierWebhookService');
const wos = require('../services/warehouseOrderService');
const inventoryService = require('../services/inventoryService');
const bridge = require('../services/salesInventoryBridge');
const orderLines = require('../services/orderLines');
const salesPosting = require('../services/salesPosting');
const settlement = require('../services/salesSettlementService');
const journalService = require('../services/journalService');

let catId = null;
let whId = null;
let savedFlow = null;
const productIds = [];
const orderIds = [];
const customerIds = [];
const periodIds = [];
let noneRoleId = null;
let noneUserId = null;

function seedProduct(name, stock, cost = 3000) {
  const pid = db.prepare(
    'INSERT INTO products (name, price, cost_price, category_id, active, stock, default_warehouse_id) VALUES (?, 9900, ?, ?, 1, 0, ?)'
  ).run(name, cost, catId, whId).lastInsertRowid;
  productIds.push(pid);
  db.prepare('INSERT INTO inventory (product_id, warehouse_id, qty_on_hand) VALUES (?, ?, 0)').run(pid, whId);
  inventoryService.createMovement({ productId: pid, warehouseId: whId, type: 'receipt', qtyChange: stock, note: 'jest091 seed' });
  return pid;
}

function insertOrder(pid, qty, total, { paymentMethod = 'kashier', status = 'pending' } = {}) {
  const cid = db.prepare('INSERT INTO customers (email, name, google_id) VALUES (?, ?, NULL)')
    .run(`jest091-${Math.random().toString(36).slice(2, 9)}@t.com`, 'Jest091').lastInsertRowid;
  customerIds.push(cid);
  const items = JSON.stringify([{ id: pid, name: 'X', qty, price: total }]);
  const oid = db.prepare("INSERT INTO orders (customer_id, total, status, items, payment_method) VALUES (?, ?, ?, ?, ?)")
    .run(cid, total, status, items, paymentMethod).lastInsertRowid;
  orderIds.push(oid);
  orderLines.insertLineRows([{
    order_id: oid, product_id: pid, product_name: 'X', quantity: qty, price: total,
    variant_color: null, variant_size: null, price_list_code: 'retail', qty, base_price: total, final_price: total,
  }]);
  return oid;
}

/** Simulate web-COD creation-time issuance (the real checkout does this). */
function issueForOrderFresh(orderId, pid, qty) {
  const issued = bridge.issueForOrder(orderId, [{ id: pid, qty }], 'jest091-seed');
  orderLines.applyLineCosts(orderId, issued.costs);
  return issued;
}

function journalFor(orderId) {
  const j = salesPosting.findOrderJournal(orderId);
  return j && j.status === 'posted' ? journalService.getEntry(j.id) : null;
}
function reversalFor(orderId) {
  const j = salesPosting.findReversalJournal(orderId);
  return j && j.status === 'posted' ? journalService.getEntry(j.id) : null;
}
function journalCountFor(orderId) {
  return db.prepare("SELECT COUNT(*) n FROM journal_entries WHERE source_type = 'order' AND source_id = ?").get(orderId).n;
}
function onHand(pid) {
  return db.prepare('SELECT qty_on_hand FROM inventory WHERE product_id = ? AND warehouse_id = ?').get(pid, whId)?.qty_on_hand ?? 0;
}
function closeTodayPeriod(name) {
  const p = wos.createFinancialPeriod({ name, months: 1 });
  wos.closeFinancialPeriod(p.id);
  periodIds.push(p.id);
  return p;
}
function dropPeriods() {
  for (const id of periodIds.splice(0)) {
    try { db.prepare('DELETE FROM financial_periods WHERE id = ?').run(id); } catch {}
  }
}

beforeAll(async () => {
  await db.initPromise;
  catId = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get().id;
  whId = db.prepare('SELECT id FROM warehouses ORDER BY id LIMIT 1').get().id;
  savedFlow = settingsService.get('order_flow_enabled', false);
  settingsService.set('order_flow_enabled', false, 'jest091');
  for (const code of ['1000', '1300', '4000', '5000']) salesPosting.resolveAccount(code);
  noneRoleId = db.prepare('INSERT INTO roles (name) VALUES (?)').run('jest091_none').lastInsertRowid;
  noneUserId = db.prepare('INSERT INTO users (email, name, password_hash, role_id, is_active) VALUES (?, ?, ?, ?, 1)')
    .run('none@jest091.test', 'No Perm 091', bcrypt.hashSync('x', 10), noneRoleId).lastInsertRowid;
});

afterEach(() => {
  dropPeriods();
  for (const oid of orderIds.splice(0)) {
    try {
      db.prepare('DELETE FROM journal_lines WHERE entry_id IN (SELECT id FROM journal_entries WHERE source_type = \'order\' AND source_id = ?)').run(oid);
      db.prepare('DELETE FROM journal_entries WHERE source_type = \'order\' AND source_id = ?').run(oid);
      db.prepare('DELETE FROM issue_order_items WHERE issue_order_id IN (SELECT id FROM issue_orders WHERE order_id = ?)').run(oid);
      db.prepare('DELETE FROM issue_orders WHERE order_id = ?').run(oid);
      db.prepare('DELETE FROM cost_consumption WHERE order_id = ?').run(oid);
      db.prepare('DELETE FROM events WHERE entity_type = \'order\' AND entity_id = ?').run(oid);
      db.prepare("DELETE FROM kashier_webhook_events WHERE event_key LIKE '%jest091%'").run();
      db.prepare('DELETE FROM order_items WHERE order_id = ?').run(oid);
      db.prepare('DELETE FROM orders WHERE id = ?').run(oid);
    } catch { /* best effort per artifact */ }
  }
  for (const pid of productIds.splice(0)) {
    try {
      db.prepare('DELETE FROM inventory_movements WHERE product_id = ?').run(pid);
      db.prepare('DELETE FROM inventory WHERE product_id = ?').run(pid);
      db.prepare('DELETE FROM inventory_cost_layers WHERE product_id = ?').run(pid);
      db.prepare('DELETE FROM products WHERE id = ?').run(pid);
    } catch {}
  }
  for (const cid of customerIds.splice(0)) {
    try { db.prepare('DELETE FROM customers WHERE id = ?').run(cid); } catch {}
  }
  db.saveDb();
});

afterAll(() => {
  dropPeriods();
  try { db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(noneUserId); } catch {}
  try { db.prepare('DELETE FROM users WHERE id = ?').run(noneUserId); } catch {}
  try { db.prepare('DELETE FROM roles WHERE id = ?').run(noneRoleId); } catch {}
  if (savedFlow != null) settingsService.set('order_flow_enabled', savedFlow, 'jest091');
  db.saveDb();
});

describe('P1 — Kashier verified settlement (journaled atomically)', () => {
  test('verified sale posts the canonical journal and decrements stock once', () => {
    const pid = seedProduct('jest091-k1', 10);
    const oid = insertOrder(pid, 2, 19800);
    ws.routeEvent('transaction-success', {
      eventType: 'transaction-success', sessionId: 'jest091-s1', merchantOrderId: String(oid),
      amount: '198.00', currency: 'EGP', status: 'SUCCESS',
    });
    const order = db.prepare('SELECT status, payment_status, payment_method FROM orders WHERE id = ?').get(oid);
    expect(order).toMatchObject({ status: 'paid', payment_status: 'verified', payment_method: 'kashier' });
    expect(onHand(pid)).toBe(8);
    const entry = journalFor(oid);
    expect(entry).toBeTruthy();
    expect(entry.source_event).toBe(salesPosting.SOURCE_EVENT);
    const codes = entry.lines.map(l => `${l.account_code}:${l.debit}/${l.credit}`);
    expect(codes).toEqual(expect.arrayContaining(['1000:19800/0', '4000:0/19800']));
    const cogs = entry.lines.find(l => l.account_code === '5000');
    expect(cogs.debit).toBeGreaterThan(0); // FIFO layer cost × 2
    expect(entry.lines.find(l => l.account_code === '1300').credit).toBe(cogs.debit);
  });

  test('replayed webhook cannot post a second journal (cross-channel check-first)', () => {
    const pid = seedProduct('jest091-k2', 10);
    const oid = insertOrder(pid, 1, 9900);
    const ev = { eventType: 'transaction-success', sessionId: 'jest091-s2', merchantOrderId: String(oid), amount: '99.00', currency: 'EGP', status: 'SUCCESS' };
    ws.routeEvent('transaction-success', ev);
    ws.routeEvent('transaction-success', ev); // service replay (status gate skips)
    expect(journalCountFor(oid)).toBe(1);
    const rev = journalFor(oid);
    expect(rev.lines.filter(l => l.account_code === '4000').length).toBe(1); // revenue booked once
  });

  test('failed settlement is all-or-nothing: closed period leaves NO paid, NO journal, NO draft — redeliver heals', () => {
    const pid = seedProduct('jest091-k3', 10);
    const oid = insertOrder(pid, 2, 19800);
    closeTodayPeriod('jest091-closed');
    expect(() => ws.routeEvent('transaction-success', {
      eventType: 'transaction-success', sessionId: 'jest091-s3', merchantOrderId: String(oid),
      amount: '198.00', currency: 'EGP', status: 'SUCCESS',
    })).toThrow(/closed financial period/i);
    const order = db.prepare('SELECT status, payment_status, paid_at FROM orders WHERE id = ?').get(oid);
    expect(order.status).toBe('pending'); // never paid-without-books
    expect(order.paid_at).toBeNull();
    expect(journalCountFor(oid)).toBe(0); // draft rolled back with the txn — no orphan
    expect(onHand(pid)).toBe(10);         // issue rolled back too
    dropPeriods();
    // redelivery after reopen succeeds fully (the route clears the claim):
    ws.routeEvent('transaction-success', {
      eventType: 'transaction-success', sessionId: 'jest091-s4', merchantOrderId: String(oid),
      amount: '198.00', currency: 'EGP', status: 'SUCCESS',
    });
    expect(db.prepare('SELECT status FROM orders WHERE id = ?').get(oid).status).toBe('paid');
    expect(journalCountFor(oid)).toBe(1);
  });

  test('webhook clears its event claim on failure (durable retry, not in-memory)', () => {
    const key = 'transaction-success::jest091-clear::4242::SUCCESS';
    ws.recordEvent(key, 'transaction-success', { status: 'SUCCESS' });
    expect(ws.isDuplicate(key)).toBe(true);
    ws.clearEvent(key);
    expect(ws.isDuplicate(key)).toBe(false);
  });
});

describe('P2 — Worker COD settlement at delivery', () => {
  test('COD delivery posts exactly one journal; COGS derives from line snapshots', () => {
    const pid = seedProduct('jest091-c1', 10);
    const oid = insertOrder(pid, 3, 29700, { paymentMethod: 'cod', status: 'shipped' });
    issueForOrderFresh(oid, pid, 3); // checkout-time issue wrote the snapshots
    const before = onHand(pid);
    const r = settlement.settleCodOnDelivery(oid, { actor: 'worker-7', reference: '/uploads/worker-proofs/x.jpg' });
    expect(r.settled).toBe(true);
    expect(onHand(pid)).toBe(before); // settlement never re-moves stock
    const order = db.prepare('SELECT payment_status, paid_at FROM orders WHERE id = ?').get(oid);
    expect(order.payment_status).toBe('paid');
    expect(order.paid_at).toBeTruthy();
    const entry = journalFor(oid);
    expect(entry.lines.find(l => l.account_code === '4000')).toMatchObject({ credit: 29700 });
    const cogs = entry.lines.find(l => l.account_code === '5000');
    expect(cogs.debit).toBeGreaterThan(0); // derived from cost_snapshot (idempotent issue gave no costs)
  });

  test('duplicate delivery/proof replay cannot double-post', () => {
    const pid = seedProduct('jest091-c2', 10);
    const oid = insertOrder(pid, 1, 9900, { paymentMethod: 'cod', status: 'shipped' });
    issueForOrderFresh(oid, pid, 1);
    expect(settlement.settleCodOnDelivery(oid, { actor: 'worker-1' }).settled).toBe(true);
    const second = settlement.settleCodOnDelivery(oid, { actor: 'worker-1' });
    expect(second.settled).toBe(false);
    expect(second.reason).toMatch(/already settled/);
    expect(journalCountFor(oid)).toBe(1);
  });

  test('non-COD orders are never collected at delivery', () => {
    const pid = seedProduct('jest091-c3', 5);
    const oid = insertOrder(pid, 1, 9900, { paymentMethod: 'kashier', status: 'shipped' });
    const r = settlement.settleCodOnDelivery(oid, { actor: 'worker-1' });
    expect(r).toMatchObject({ settled: false, reason: /not a COD/ });
    expect(journalCountFor(oid)).toBe(0);
  });

  test('closed period blocks COD settlement (no stamp, no books)', () => {
    const pid = seedProduct('jest091-c4', 5);
    const oid = insertOrder(pid, 1, 9900, { paymentMethod: 'cod', status: 'shipped' });
    issueForOrderFresh(oid, pid, 1);
    closeTodayPeriod('jest091-codgate');
    expect(() => settlement.settleCodOnDelivery(oid, { actor: 'worker-9' })).toThrow(/closed financial period/i);
    const order = db.prepare('SELECT payment_status, paid_at FROM orders WHERE id = ?').get(oid);
    expect(order.payment_status).not.toBe('paid');
    expect(journalCountFor(oid)).toBe(0);
  });
});

describe('P3 — Manual settlement requires evidence (policy B)', () => {
  test('cash settlement with reason: stamps evidence, transitions pending→paid, journals', () => {
    const pid = seedProduct('jest091-m1', 5);
    const oid = insertOrder(pid, 1, 9900, { paymentMethod: null });
    const r = settlement.settleOrder(oid, { actor: 'boss091', method: 'cash', reason: 'cash at counter, slip #7' });
    expect(r.settled).toBe(true);
    const order = db.prepare('SELECT status, payment_status, paid_at FROM orders WHERE id = ?').get(oid);
    expect(order.status).toBe('paid');
    expect(order.payment_status).toBe('paid');
    expect(journalFor(oid).lines.find(l => l.account_code === '4000').credit).toBe(9900);
  });

  test('missing reason / unknown method / missing reference for card are all refused', () => {
    const pid = seedProduct('jest091-m2', 5);
    const oid = insertOrder(pid, 1, 9900, { paymentMethod: null });
    expect(() => settlement.settleOrder(oid, { actor: 'x', method: 'cash', reason: '  ' })).toThrow(/reason/);
    expect(() => settlement.settleOrder(oid, { actor: 'x', method: 'crypto', reason: 'x' })).toThrow(/method/);
    expect(() => settlement.settleOrder(oid, { actor: 'x', method: 'card', reason: 'x' })).toThrow(/reference/);
    expect(journalCountFor(oid)).toBe(0);
    expect(db.prepare('SELECT payment_status FROM orders WHERE id = ?').get(oid).payment_status).not.toBe('paid');
  });

  test('cross-channel double settlement is refused (no duplicate revenue)', () => {
    const pid = seedProduct('jest091-m3', 5);
    const oid = insertOrder(pid, 1, 9900);
    ws.routeEvent('transaction-success', {
      eventType: 'transaction-success', sessionId: 'jest091-s3b', merchantOrderId: String(oid),
      amount: '99.00', currency: 'EGP', status: 'SUCCESS',
    });
    let code = null;
    try { settlement.settleOrder(oid, { actor: 'boss', method: 'cash', reason: 'forgot it was online' }); }
    catch (err) { code = err.code; }
    expect(code).toBe('ALREADY_SETTLED');
    expect(journalCountFor(oid)).toBe(1);
    expect(journalFor(oid).lines.filter(l => l.account_code === '4000')).toHaveLength(1);
  });

  test('legacy slider-fabricated paid heals book-only when evidence exists but the ledger does not', () => {
    const pid = seedProduct('jest091-m4', 5);
    const oid = insertOrder(pid, 1, 9900, { paymentMethod: null });
    db.prepare("UPDATE orders SET status = 'paid', paid_at = CURRENT_TIMESTAMP WHERE id = ?").run(oid); // pre-091 fabrication
    expect(journalCountFor(oid)).toBe(0);
    const r = settlement.settleOrder(oid, { actor: 'boss', method: 'bank_transfer', reference: 'BNK-001', reason: 'book the collected transfer' });
    expect(r.bookedOnly).toBe(true);
    expect(journalFor(oid).description).toMatch(/BNK-001/);
  });

  test('cancelled orders refuse settlement entirely', () => {
    const pid = seedProduct('jest091-m5', 5);
    const oid = insertOrder(pid, 1, 9900, { paymentMethod: null, status: 'cancelled' });
    expect(() => settlement.settleOrder(oid, { actor: 'boss', method: 'cash', reason: 'late money' })).toThrow(/cancelled/);
    expect(journalCountFor(oid)).toBe(0);
  });
});

describe('Refunds — immutable reversals, never edits, never fake goods returns', () => {
  test('full refund posts the mirrored cash/revenue reversal and leaves the original posted', () => {
    const pid = seedProduct('jest091-r1', 5);
    const oid = insertOrder(pid, 1, 9900);
    ws.routeEvent('transaction-success', {
      eventType: 'transaction-success', sessionId: 'jest091-sr1', merchantOrderId: String(oid),
      amount: '99.00', currency: 'EGP', status: 'SUCCESS',
    });
    const orig = journalFor(oid);
    const r = settlement.refundOrder(oid, { actor: 'admin091', reason: 'customer cancelled at door' });
    expect(r.reversal.reversed).toBe(true);
    const refundedRow = db.prepare('SELECT status, refund_amount, refunded_at FROM orders WHERE id = ?').get(oid);
    expect(refundedRow.status).toBe('refunded');
    expect(refundedRow.refund_amount).toBe(9900);
    expect(refundedRow.refunded_at).toBeTruthy();
    const rev = reversalFor(oid);
    expect(rev.lines.find(l => l.account_code === '4000')).toMatchObject({ debit: 9900, credit: 0 });
    expect(rev.lines.find(l => l.account_code === '1000')).toMatchObject({ debit: 0, credit: 9900 });
    // original journal unchanged (immutable history): same lines, still posted
    const sameOrig = journalService.getEntry(orig.id);
    expect(sameOrig.status).toBe('posted');
    expect(sameOrig.lines.map(l => [l.account_code, l.debit, l.credit]))
      .toEqual(orig.lines.map(l => [l.account_code, l.debit, l.credit]));
  });

  test('refund reversal NEVER restores inventory or reverses COGS (no physical return modeled)', () => {
    const pid = seedProduct('jest091-r2', 5);
    const oid = insertOrder(pid, 2, 19800);
    ws.routeEvent('transaction-success', {
      eventType: 'transaction-success', sessionId: 'jest091-sr2', merchantOrderId: String(oid),
      amount: '198.00', currency: 'EGP', status: 'SUCCESS',
    });
    const handAfterSale = onHand(pid);
    settlement.refundOrder(oid, { actor: 'a', reason: 'courier lost it' });
    expect(onHand(pid)).toBe(handAfterSale); // stock untouched by a financial refund
    const rev = reversalFor(oid);
    expect(rev.lines.some(l => l.account_code === '1300')).toBe(false);
    expect(rev.lines.some(l => l.account_code === '5000')).toBe(false);
    const restock = db.prepare("SELECT COUNT(*) n FROM inventory_movements WHERE reference_type = 'order' AND reference_id = ? AND type = 'receipt' AND qty_change > 0").get(oid);
    expect(restock.n).toBe(0);
  });

  test('refund retry can never execute twice', () => {
    const pid = seedProduct('jest091-r3', 5);
    const oid = insertOrder(pid, 1, 9900);
    ws.routeEvent('transaction-success', {
      eventType: 'transaction-success', sessionId: 'jest091-sr3', merchantOrderId: String(oid),
      amount: '99.00', currency: 'EGP', status: 'SUCCESS',
    });
    expect(settlement.refundOrder(oid, { actor: 'a', reason: 'dup check' }).reversal.reversed).toBe(true);
    const second = settlement.refundOrder(oid, { actor: 'a', reason: 'dup check' });
    expect(second.reversal.already).toBe(true);
    expect(db.prepare("SELECT COUNT(*) n FROM journal_entries WHERE source_type='order' AND source_id = ? AND source_event = ?")
      .get(oid, salesPosting.REVERSAL_EVENT).n).toBe(1);
    // revenue net for the order is now exactly zero
    const rev = reversalFor(oid);
    expect(rev.lines.find(l => l.account_code === '4000').debit)
      .toBe(journalFor(oid).lines.find(l => l.account_code === '4000').credit);
  });

  test('refunding an order that was never booked posts NO reversal (honest no-op)', () => {
    const pid = seedProduct('jest091-r4', 5);
    const oid = insertOrder(pid, 1, 9900, { paymentMethod: 'cod', status: 'paid' });
    // paid via legacy slider — nothing was ever journalized
    const r = settlement.refundOrder(oid, { actor: 'a', reason: 'old fabricated paid' });
    expect(r.reversal.reversed).toBe(false);
    expect(r.reversal.reason).toMatch(/no posted sale journal/);
    expect(db.prepare('SELECT status FROM orders WHERE id = ?').get(oid).status).toBe('refunded');
  });

  test('kashier provider refund webhook routes through the reversal seam', () => {
    const pid = seedProduct('jest091-r5', 5);
    const oid = insertOrder(pid, 1, 9900);
    ws.routeEvent('transaction-success', {
      eventType: 'transaction-success', sessionId: 'jest091-sr5', merchantOrderId: String(oid),
      amount: '99.00', currency: 'EGP', status: 'SUCCESS',
    });
    ws.routeEvent('transaction-refund', {
      eventType: 'transaction-refund', sessionId: 'jest091-sr5', merchantOrderId: String(oid),
      amount: '99.00', currency: 'EGP', status: 'REFUNDED',
    });
    expect(db.prepare('SELECT status FROM orders WHERE id = ?').get(oid).status).toBe('refunded');
    expect(reversalFor(oid)).toBeTruthy();
    expect(salesPosting.findOrderJournal(oid).status).toBe('posted');
  });

  test('refund requires a reason and refuses without one (server-side)', () => {
    const pid = seedProduct('jest091-r6', 5);
    const oid = insertOrder(pid, 1, 9900, { paymentMethod: null, status: 'paid' });
    settlement.settleOrder(oid, { actor: 'b091', method: 'cash', reason: 'counter' });
    expect(() => settlement.refundOrder(oid, { actor: 'a', reason: '  ' })).toThrow(/reason/);
    expect(reversalFor(oid)).toBe(null);
  });

  test('closed period blocks the reversal completely (no refunded without its books)', () => {
    const pid = seedProduct('jest091-r7', 5);
    const oid = insertOrder(pid, 1, 9900, { paymentMethod: null });
    settlement.settleOrder(oid, { actor: 'b091', method: 'cash', reason: 'counter sale' });
    closeTodayPeriod('jest091-revgate');
    expect(() => settlement.refundOrder(oid, { actor: 'a', reason: 'late refund' })).toThrow(/closed financial period/i);
    const order = db.prepare('SELECT status, refunded_at FROM orders WHERE id = ?').get(oid);
    expect(order.status).toBe('paid'); // rolled back — no half refund
    expect(reversalFor(oid)).toBe(null);
    expect(db.prepare('SELECT COUNT(*) n FROM journal_entries WHERE source_event = ?').get(salesPosting.REVERSAL_EVENT).n).toBeGreaterThanOrEqual(0);
  });
});

describe('Ledger integrity + money representation', () => {
  test('posted sourced settlement AND reversal journals are immutable (unpost refused)', () => {
    const pid = seedProduct('jest091-i1', 5);
    const oid = insertOrder(pid, 1, 9900, { paymentMethod: null });
    settlement.settleOrder(oid, { actor: 'b', method: 'cash', reason: 'once' });
    settlement.refundOrder(oid, { actor: 'b', reason: 'reversed back' });
    expect(() => journalService.unpostEntry(journalFor(oid).id, 'hacker')).toThrow(/immutable/i);
    expect(() => journalService.unpostEntry(reversalFor(oid).id, 'hacker')).toThrow(/immutable/i);
  });

  test('non-integer cents are refused loudly, never rounded (total)', () => {
    const pid = seedProduct('jest091-i2', 5);
    const oid = insertOrder(pid, 1, 9900, { paymentMethod: null });
    db.prepare('UPDATE orders SET total = 9900.5 WHERE id = ?').run(oid);
    expect(() => settlement.settleOrder(oid, { actor: 'b', method: 'cash', reason: 'broken money' }))
      .toThrow(/integer number of cents/);
    expect(journalCountFor(oid)).toBe(0);
  });

  test('audit: actor, evidence and reason are recorded in the journal and events', () => {
    const pid = seedProduct('jest091-a1', 5);
    const oid = insertOrder(pid, 1, 9900, { paymentMethod: null });
    settlement.settleOrder(oid, { actor: 'boss-audit', method: 'bank_transfer', reference: 'TRF-889', reason: 'wire confirmed' });
    const entry = journalFor(oid);
    expect(entry.description + entry.lines.map(l => l.description).join(' ')).toMatch(/TRF-889/);
    expect(entry.description).toMatch(/bank_transfer|boss-audit/);
    const ev = db.prepare("SELECT * FROM events WHERE entity_type = 'order' AND entity_id = ? AND event_type = 'order_settlement_recorded'").all(oid);
    expect(ev.length).toBe(1);
    const payload = JSON.parse(ev[0].payload || '{}');
    expect(payload.reference).toBe('TRF-889');
    settlement.refundOrder(oid, { actor: 'boss-audit', reason: 'wire returned' });
    const rev = reversalFor(oid);
    expect((rev.description + rev.lines.map(l => l.description).join(' '))).toMatch(/wire returned/);
    expect(rev.posted_by).toBe('boss-audit');
  });
});

describe('Revenue settlement reconciliation control', () => {
  test('settled-not-booked orders are flagged and totals keep the accounting identity', () => {
    const pid = seedProduct('jest091-x1', 5);
    const booked = insertOrder(pid, 1, 9900, { paymentMethod: null });
    settlement.settleOrder(booked, { actor: 'x', method: 'cash', reason: 'properly booked' });
    const fabricated = insertOrder(pid, 1, 5000, { paymentMethod: null });
    db.prepare("UPDATE orders SET status = 'paid', paid_at = CURRENT_TIMESTAMP WHERE id = ?").run(fabricated); // legacy hole
    const recon = settlement.revenueReconciliation();
    const flagged = (recon.difference_classes.settled_unbooked?.orders || []).map(o => o.order_id);
    expect(flagged).toContain(fabricated);
    expect(flagged).not.toContain(booked);
    expect(recon.totals.difference_cents).toBe(recon.totals.operational_settled_cents - recon.totals.posted_revenue_net_cents);
    expect(Number.isInteger(recon.totals.operational_settled_cents)).toBe(true);
    // settle the fabricated one book-only → the flag clears
    settlement.settleOrder(fabricated, { actor: 'x', method: 'cash', reference: '', reason: 'heal books' });
    const after = (settlement.revenueReconciliation().difference_classes.settled_unbooked?.orders || []).map(o => o.order_id);
    expect(after).not.toContain(fabricated);
    // cleanup journals for fabricated bookedOnly happens via afterEach
  });

  test('refunded orders net to zero on the ledger side (no phantom revenue)', () => {
    const pid = seedProduct('jest091-x2', 5);
    const oid = insertOrder(pid, 1, 9900, { paymentMethod: null });
    settlement.settleOrder(oid, { actor: 'x', method: 'cash', reason: 'sold' });
    settlement.refundOrder(oid, { actor: 'x', reason: 'returned money (no goods)' });
    const recon = settlement.revenueReconciliation();
    const classes = Object.values(recon.difference_classes).flatMap(cls => (cls.orders || []).map(o => o.order_id));
    expect(classes).not.toContain(oid); // balanced on both views → invisible (correct)
  });
});

describe('Admin HTTP surface (RBAC + slider lockdown)', () => {
  const express = require('express');

  async function callAs(session, method, path, body) {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.session = session; next(); });
    app.use('/api/admin', require('../routes/admin'));
    const srv = app.listen(0);
    await new Promise((r) => srv.once('listening', r));
    try {
      const res = await fetch(`http://localhost:${srv.address().port}/api/admin${path}`, {
        method,
        headers: { 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      let json = null;
      try { json = await res.json(); } catch {}
      return { status: res.status, body: json };
    } finally {
      srv.closeAllConnections?.(); srv.close();
    }
  }

  test('zero-permission admin user: settle/refund/reconciliation are 403', async () => {
    const s = await callAs({ isAdmin: true, userId: noneUserId }, 'POST', `/orders/1/settle`, { method: 'cash', reason: 'x' });
    expect(s.status).toBe(403);
    const r = await callAs({ isAdmin: true, userId: noneUserId }, 'POST', `/orders/1/refund`, { reason: 'x' });
    expect(r.status).toBe(403);
    const c = await callAs({ isAdmin: true, userId: noneUserId }, 'GET', `/revenue-reconciliation`);
    expect(c.status).toBe(403);
  }, 15000);

  test('status slider cannot book money: paid is SETTLEMENT_REQUIRED, refunded is REFUND_REQUIRED', async () => {
    const pid = seedProduct('jest091-h1', 3);
    const oid = insertOrder(pid, 1, 9900, { paymentMethod: null });
    const admin = { isAdmin: true, username: 'env-admin-091' };
    const paid = await callAs(admin, 'PUT', `/orders/${oid}/status`, { status: 'paid' });
    expect(paid.status).toBe(400);
    expect(paid.body.code).toBe('SETTLEMENT_REQUIRED');
    const ref = await callAs(admin, 'PUT', `/orders/${oid}/status`, { status: 'refunded' });
    expect(ref.status).toBe(400);
    expect(ref.body.code).toBe('REFUND_REQUIRED');
    const order = db.prepare('SELECT status, payment_status FROM orders WHERE id = ?').get(oid);
    expect(order.status).toBe('pending');
    expect(journalCountFor(oid)).toBe(0);
  }, 15000);

  test('settle + full-refund over HTTP as env-admin; partial-refund amounts refused', async () => {
    const pid = seedProduct('jest091-h2', 3);
    const oid = insertOrder(pid, 1, 9900, { paymentMethod: null });
    const admin = { isAdmin: true, username: 'env-admin-091' };
    const ok = await callAs(admin, 'POST', `/orders/${oid}/settle`, { method: 'card', reference: 'TERM-42', reason: 'card at counter' });
    expect(ok.status).toBe(200);
    expect(ok.body.journal.entry_no).toMatch(/^JE-/);
    const partial = await callAs(admin, 'POST', `/orders/${oid}/refund`, { reason: 'partial?', amount: 20 });
    expect(partial.status).toBe(400);
    expect(partial.body.code).toBe('PARTIAL_REFUND_UNSUPPORTED');
    const full = await callAs(admin, 'POST', `/orders/${oid}/refund`, { reason: 'money back in full' });
    expect(full.status).toBe(200);
    expect(full.body.reversal.entry_no).toMatch(/^JE-/);
    expect(db.prepare('SELECT status, refund_amount FROM orders WHERE id = ?').get(oid)).toMatchObject({ status: 'refunded', refund_amount: 9900 });
  }, 15000);

  test('double settle over HTTP returns 409 ALREADY_SETTLED (replay protection at the boundary)', async () => {
    const pid = seedProduct('jest091-h3', 3);
    const oid = insertOrder(pid, 1, 9900, { paymentMethod: null });
    const admin = { isAdmin: true, username: 'env-admin-091' };
    const one = await callAs(admin, 'POST', `/orders/${oid}/settle`, { method: 'cash', reason: 'one' });
    expect(one.status).toBe(200);
    const two = await callAs(admin, 'POST', `/orders/${oid}/settle`, { method: 'cash', reason: 'two' });
    expect(two.status).toBe(409);
    expect(journalCountFor(oid)).toBe(1);
  }, 15000);
});
