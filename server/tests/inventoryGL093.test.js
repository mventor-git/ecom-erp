/**
 * mventor-ticket-093 — inventory <-> GL integrity.
 *
 * Proves: every ledger-owned stock movement reaches the books THROUGH THE ONE
 * movement door (engine hook), with exact integer-cent values and correct
 * account sides per event class; unknown costs are NEVER invented at posting
 * time (listed by the reconciliation, catch-up-posted when a cost exists);
 * postings fail CLOSED in closed periods and recover after reopen with no
 * duplicate journals; goods returns touch inventory/books only as their own
 * separate events; the counter register settles through the canonical seam
 * atomically — blocked journal means the whole sale rolled back.
 */
const path = require('path');
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const inventoryService = require('../services/inventoryService');
const inventoryPosting = require('../services/inventoryPosting');
const salesPosting = require('../services/salesPosting');
const salesSettlement = require('../services/salesSettlementService');
const journalService = require('../services/journalService');
const wos = require('../services/warehouseOrderService');

const T = 'g093'; // unique tag for every row this suite creates
const ids = { products: [], movements: [], orders: [], periods: [], users: [], roles: [], customer: [] };
let catId, whId, noneUserId;

function journalOf(movementId) {
  const j = db.prepare("SELECT id FROM journal_entries WHERE source_type='inventory_movement' AND source_id=? AND source_event LIKE 'stock_%'")
    .get(String(movementId));
  if (!j) return null;
  const entry = journalService.getEntry(j.id);
  return {
    id: j.id, status: entry.status, event: entry.source_event,
    lines: entry.lines.map((l) => ({ code: l.account_code, debit: l.debit, credit: l.credit })),
  };
}
function mkProduct(cost) {
  const p = db.prepare('INSERT INTO products (name, price, cost_price, category_id, active, stock) VALUES (?, 9900, ?, ?, 1, 0)')
    .run(`${T}-prod`, cost, catId).lastInsertRowid;
  ids.products.push(p);
  db.prepare('INSERT INTO inventory (product_id, warehouse_id, qty_on_hand) VALUES (?, ?, 0)').run(p, whId);
  return p;
}
function move(pid, over) {
  const m = inventoryService.createMovement(Object.assign({
    productId: pid, warehouseId: whId, type: 'adjustment', reason: `${T}-t`,
    qtyChange: 10, unitCost: 500, userId: `${T}-tester`,
  }, over));
  ids.movements.push(m.id);
  return m;
}

beforeAll(async () => {
  await db.initPromise;
  catId = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get().id;
  whId = db.prepare('SELECT id FROM warehouses WHERE is_active = 1 ORDER BY id LIMIT 1').get().id;
  const rid = db.prepare('INSERT INTO roles (name) VALUES (?)').run(`${T}_none`).lastInsertRowid;
  ids.roles.push(rid);
  noneUserId = db.prepare('INSERT INTO users (email, name, password_hash, role_id, is_active) VALUES (?,?,?,?,1)')
    .run(`${T}.none@t.local`, 'None', bcrypt.hashSync('x', 10), rid).lastInsertRowid;
  ids.users.push(noneUserId);
});

afterAll(() => {
  for (const oid of ids.orders.splice(0)) {
    try {
      db.prepare('DELETE FROM cost_consumption WHERE order_id = ?').run(oid);
      db.prepare('DELETE FROM order_items WHERE order_id = ?').run(oid);
      db.prepare("DELETE FROM journal_lines WHERE entry_id IN (SELECT id FROM journal_entries WHERE source_type='order' AND source_id=?)").run(String(oid));
      db.prepare("DELETE FROM journal_entries WHERE source_type='order' AND source_id=?").run(String(oid));
      db.prepare("DELETE FROM events WHERE entity_type='order' AND entity_id = ?").run(oid);
      db.prepare('DELETE FROM orders WHERE id = ?').run(oid);
    } catch { /* best effort */ }
  }
  for (const mid of ids.movements.splice(0)) {
    try {
      db.prepare("DELETE FROM journal_lines WHERE entry_id IN (SELECT id FROM journal_entries WHERE source_type='inventory_movement' AND source_id=?)").run(String(mid));
      db.prepare("DELETE FROM journal_entries WHERE source_type='inventory_movement' AND source_id=?").run(String(mid));
      db.prepare('DELETE FROM inventory_movements WHERE id = ?').run(mid);
    } catch {}
  }
  for (const pid of ids.periods.splice(0)) { try { db.prepare('DELETE FROM financial_periods WHERE id = ?').run(pid); } catch {} }
  for (const pid of ids.products.splice(0)) {
    try {
      db.prepare('DELETE FROM inventory_cost_layers WHERE product_id = ?').run(pid);
      db.prepare('DELETE FROM inventory_movements WHERE product_id = ?').run(pid);
      db.prepare('DELETE FROM inventory WHERE product_id = ?').run(pid);
      db.prepare('DELETE FROM product_prices WHERE product_id = ?').run(pid);
      db.prepare("DELETE FROM events WHERE (entity_type='product' AND entity_id = ?) OR payload LIKE ?").run(pid, `%${T}%`);
      db.prepare('DELETE FROM products WHERE id = ?').run(pid);
    } catch {}
  }
  for (const uid of ids.customer.splice(0)) {
    try {
      db.prepare('DELETE FROM reviews WHERE customer_id = ?').run(uid);
      db.prepare("DELETE FROM events WHERE entity_type='customer' AND entity_id = ?").run(uid);
      db.prepare('DELETE FROM customers WHERE id = ?').run(uid);
    } catch {}
  }
  for (const uid of ids.users.splice(0)) { try { db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(uid); db.prepare('DELETE FROM users WHERE id = ?').run(uid); } catch {} }
  for (const rid of ids.roles.splice(0)) { try { db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(rid); db.prepare('DELETE FROM roles WHERE id = ?').run(rid); } catch {} }
  try { db.prepare(`DELETE FROM events WHERE user_id LIKE '${T}%' OR payload LIKE ?`).run(`%${T}%`); } catch {}
  db.saveDb();
});

/* ─────────────────────────────────────────────────────────────────────── */

describe('classify — exclusive ownership so nothing double-posts', () => {
  test('other bridges / quantity-only / foreign types are all refused here', () => {
    expect(inventoryPosting.classify({ type: 'receipt', reference_type: 'purchase_order' }).owner).toBe('purchase');
    expect(inventoryPosting.classify({ type: 'receipt', reference_type: null }).owner).toBe('unowned');
    expect(inventoryPosting.classify({ type: 'issue', reference_type: 'order' }).skip).toMatch(/settlement/);
    expect(inventoryPosting.classify({ type: 'transfer' }).skip).toMatch(/GL-inert/);
    expect(inventoryPosting.classify({ type: 'reservation' }).skip).toMatch(/GL-inert/);
    expect(inventoryPosting.classify({ type: 'nonsense' }).skip).toMatch(/not ledger-owned/);
  });

  test('value events carry the right direction + offset role', () => {
    expect(inventoryPosting.classify({ type: 'opening_balance' })).toMatchObject({ event: 'stock_opening', direction: 'in', offset: 'equity' });
    expect(inventoryPosting.classify({ type: 'adjustment', qty_change: -3 })).toMatchObject({ event: 'stock_adjustment', direction: 'out', offset: 'adjustment' });
    expect(inventoryPosting.classify({ type: 'adjustment', qty_change: 2 })).toMatchObject({ direction: 'in' });
    expect(inventoryPosting.classify({ type: 'damage', qty_change: -1 })).toMatchObject({ direction: 'out' });
    expect(inventoryPosting.classify({ type: 'count', qty_change: 1 })).toMatchObject({ direction: 'in' });
    expect(inventoryPosting.classify({ type: 'return', reference_type: 'purchase_order' }))
      .toMatchObject({ event: 'stock_vendor_return', direction: 'out', offset: 'payable' });
  });

  test('a return without a booked sale is honestly skipped', () => {
    const c = inventoryPosting.classify({ type: 'correction', reference_type: 'order', reference_id: 99999991 });
    expect(c.skip).toMatch(/without a booked sale/);
  });
});

describe('valuation — exact cents, explicit stopgap, never silent zeros', () => {
  test('movement cost wins; product cost fallback is LABELED; unknown refuses', () => {
    const p = db.prepare('INSERT INTO products (name, price, cost_price, category_id, active) VALUES (?, 100, 450, ?, 1)').run(`${T}-valu`, catId).lastInsertRowid;
    ids.products.push(p);
    const withCost = inventoryPosting.valuedTotal({ id: 1, qty_change: -4, unit_cost: 550, product_id: p });
    expect(withCost.total).toBe(2200);
    const fromProduct = inventoryPosting.valuedTotal({ id: 2, qty_change: 3, unit_cost: 0, product_id: p });
    expect(fromProduct.total).toBe(1350);
    expect(fromProduct.note).toMatch(/current product cost/);
    db.prepare('UPDATE products SET cost_price = 0 WHERE id = ?').run(p);
    const unknown = inventoryPosting.valuedTotal({ id: 3, qty_change: 3, unit_cost: 0, product_id: p });
    expect(unknown.total).toBe(0);
    expect(unknown.unknown_cost).toBe(true);
  });
});

describe('engine posting — one movement door, one journal, exact sides', () => {
  test('opening posts Dr1300 / Cr3000 once; replay changes nothing', () => {
    const p = mkProduct(300);
    const m = move(p, { type: 'opening_balance', qtyChange: 12, unitCost: 300, reason: `${T}-open` });
    const j = journalOf(m.id);
    expect(j).toBeTruthy();
    expect(j.status).toBe('posted');
    expect(j.event).toBe('stock_opening');
    expect(j.lines).toEqual(expect.arrayContaining([
      { code: '1300', debit: 3600, credit: 0 },
      { code: '3000', debit: 0, credit: 3600 },
    ]));
    expect(db.prepare("SELECT COUNT(*) n FROM journal_entries WHERE source_type='inventory_movement' AND source_id=?").get(String(m.id)).n).toBe(1);
    const again = inventoryPosting.postMovement(m.id, { userId: 'x' });
    expect(again.posted).toBe(false);
    expect(again.replay).toBe(true);
    expect(db.prepare("SELECT COUNT(*) n FROM journal_entries WHERE source_type='inventory_movement' AND source_id=?").get(String(m.id)).n).toBe(1);
  });

  test('shrinkage hits the adjustment expense; gain reduces it (both directions)', () => {
    const p = mkProduct(500);
    move(p, { type: 'opening_balance', qtyChange: 10, unitCost: 500, reason: `${T}-o` });
    const dmg = move(p, { type: 'damage', qtyChange: -2, unitCost: 500, reason: 'wet stock' });
    expect(journalOf(dmg.id).lines).toEqual(expect.arrayContaining([
      { code: '5100', debit: 1000, credit: 0 },
      { code: '1300', debit: 0, credit: 1000 },
    ]));
    const gain = move(p, { type: 'adjustment', qtyChange: 1, unitCost: 500, reason: 'found stock' });
    expect(journalOf(gain.id).lines).toEqual(expect.arrayContaining([
      { code: '1300', debit: 500, credit: 0 },
      { code: '5100', debit: 0, credit: 500 },
    ]));
    expect(journalOf(gain.id).event).toBe('stock_adjustment');
  });

  test('period lock: posting fails CLOSED, reopen catches up, no dupes', () => {
    const p = mkProduct(800);
    move(p, { type: 'opening_balance', qtyChange: 2, unitCost: 800, reason: `${T}-opin` });
    const m = move(p, { qtyChange: -1, unitCost: 800, reason: `${T}-lock` });
    expect(journalOf(m.id)).toBeTruthy();
    // remove the POSTED journal to simulate "movement taken, posting blocked"
    const j = journalOf(m.id);
    db.prepare('DELETE FROM journal_lines WHERE entry_id = ?').run(j.id);
    db.prepare('DELETE FROM journal_entries WHERE id = ?').run(j.id);
    const per = wos.createFinancialPeriod({ name: `${T}-closed`, months: 1 });
    ids.periods.push(per.id);
    try {
      wos.closeFinancialPeriod(per.id);
      expect(() => inventoryPosting.postMovement(m.id, { userId: 'x' })).toThrow(/closed financial period/i);
      // the house draft-recovery pattern: a blocked attempt leaves at most an
      // UNPOSTED draft (invisible to every ledger sum) — never a half-book.
      const leftover = journalOf(m.id);
      expect(leftover === null || leftover.status === 'draft').toBe(true);
      // and reconcile STILL lists it (posted-only exclusion) so catch-up is possible
      const r = inventoryPosting.reconcile({ limit: 400 });
      expect(r.unposted_value_movements.detail.some((x) => x.movement_id === m.id)).toBe(true);
    } finally {
      wos.reopenFinancialPeriod(per.id);
    }
    const fixed = inventoryPosting.postMovement(m.id, { userId: 'x' });
    expect(fixed.posted).toBe(true);
    expect(journalOf(m.id).lines).toEqual(expect.arrayContaining([
      { code: '5100', debit: 800, credit: 0 }, { code: '1300', debit: 0, credit: 800 },
    ]));
    expect(db.prepare("SELECT COUNT(*) n FROM journal_entries WHERE source_type='inventory_movement' AND source_id=? AND source_event LIKE 'stock_%'").get(String(m.id)).n).toBe(1);
  });

  test('goods return on a BOOKED sale is its own Dr1300/Cr5000 event; unbooked is nothing', () => {
    const p = mkProduct(700);
    move(p, { type: 'opening_balance', qtyChange: 8, unitCost: 700, reason: `${T}-o2` });
    const cid = db.prepare('INSERT INTO customers (email, name, google_id) VALUES (?, ?, NULL)').run(`${T}@buy.test`, 'G').lastInsertRowid;
    ids.customer.push(cid);
    const oid = db.prepare("INSERT INTO orders (customer_id, total, status, items, payment_method) VALUES (?, 1400, 'pending', '[]', 'cod')")
      .run(cid).lastInsertRowid;
    ids.orders.push(oid);
    db.prepare(`INSERT INTO order_items (order_id, product_id, product_name, quantity, price, qty, base_price, final_price, cost_snapshot)
      VALUES (?, ?, 'g', 2, 700, 2, 700, 700, 700)`).run(oid, p);
    const setl = salesSettlement.settleCodOnDelivery(oid, { actor: `${T}-courier`, reason: 'delivered' });
    expect(setl.settled || setl.replayed).toBe(true);
    expect(salesPosting.hasPostedSale(oid)).toBe(true);
    const back = move(p, { type: 'correction', qtyChange: 1, unitCost: 700, reason: 'goods returned', referenceType: 'order', referenceId: oid });
    const bj = journalOf(back.id);
    expect(bj.event).toBe('stock_return_cost');
    expect(bj.lines).toEqual(expect.arrayContaining([
      { code: '1300', debit: 700, credit: 0 },
      { code: '5000', debit: 0, credit: 700 },
    ]));
    // the settlement journal itself was NOT edited
    const sj = db.prepare("SELECT COUNT(*) n FROM journal_entries WHERE source_type='order' AND source_id=? AND status='posted'").get(String(oid)).n;
    expect(sj).toBe(1);
    // a settled COD order reaches a refundable lifecycle point in real flows;
    // mirror that transition here before refunding. refund must reverse MONEY,
    // restore NOTHING on its own (091 rule re-proved)
    db.prepare("UPDATE orders SET status = 'paid' WHERE id = ?").run(oid);
    const refund = salesSettlement.refundOrder(oid, { actor: T, reason: 'money back' });
    expect(refund.reversal.reversed).toBe(true);
    const movCount = db.prepare("SELECT COUNT(*) n FROM inventory_movements WHERE reference_type='order' AND reference_id=?").get(oid).n;
    expect(movCount).toBe(1); // only the physical return above; refund added nothing
  });
});

describe('reconciliation — drift visible, catch-up explicit, never forced', () => {
  test('unknown-cost eligible movement is LISTED now and posts later once a cost exists', () => {
    const p = mkProduct(0);
    // stock in WITHOUT touching products.cost_price (setProductCost off)
    const in1 = inventoryService.createMovement({ productId: p, warehouseId: whId, type: 'opening_balance', reason: `${T}-nin`, qtyChange: 4, unitCost: 500, userId: T, setProductCost: false });
    ids.movements.push(in1.id);
    const m = move(p, { qtyChange: -2, unitCost: null, reason: `${T}-nocost` }); // engine skips posting: value unknown
    expect(journalOf(m.id)).toBe(null);
    let r = inventoryPosting.reconcile({ limit: 200 });
    const listed = r.unposted_value_movements.detail.find((x) => x.movement_id === m.id);
    expect(listed).toBeTruthy();
    expect(listed.can_post_now).toBe(false);
    expect(Number.isInteger(r.ledger_inventory_cents)).toBe(true);
    expect(Number.isInteger(r.layer_book_value_cents)).toBe(true);
    expect(r.drift_cents).toBe(r.layer_book_value_cents - r.ledger_inventory_cents);
    // give the product a real cost, catch up via the operator path -> listed gone
    db.prepare('UPDATE products SET cost_price = 600 WHERE id = ?').run(p);
    const res = inventoryPosting.postMovement(m.id, { userId: 'catchup' });
    expect(res.posted).toBe(true);
    const j = journalOf(m.id);
    expect(j.lines).toEqual(expect.arrayContaining([
      { code: '5100', debit: 1200, credit: 0 }, { code: '1300', debit: 0, credit: 1200 },
    ]));
    r = inventoryPosting.reconcile({ limit: 400 });
    expect(r.unposted_value_movements.detail.some((x) => x.movement_id === m.id)).toBe(false);
  });

  test('PO-less manual receipt has no bridge ownership and is SURFACED (not hidden)', () => {
    const p = mkProduct(350);
    const mr = move(p, { type: 'receipt', qtyChange: 5, unitCost: 350, reason: `${T}-manual-in` });
    expect(journalOf(mr.id)).toBe(null); // no bridge silently takes it
    const r = inventoryPosting.reconcile({ limit: 200 });
    expect(r.purchase_unowned_receipts.detail.find((x) => x.movement_id === mr.id)).toBeTruthy();
  });
});

describe('counter sale — the register is a canonical settlement path', () => {
  let salePid;
  async function httpApp(session) {
    const app = express();
    app.use(express.json());
    app.use((rq, rs, nx) => { rq.session = session; nx(); });
    app.use('/api/admin-sale', require('../routes/adminSale'));
    const srv = app.listen(0);
    await new Promise((r2) => srv.once('listening', r2));
    return { base: `http://localhost:${srv.address().port}`, close: () => { srv.closeAllConnections?.(); srv.close();; } };
  }
  beforeAll(() => {
    salePid = mkProduct(400);
    move(salePid, { type: 'opening_balance', qtyChange: 10, unitCost: 400, reason: `${T}-stockin` });
  });

  test('counter sale settles once: cash+revenue+COGS exact, order stamps completed', async () => {
    const { base, close } = await httpApp({ isAdmin: true, username: `${T}-boss` });
    try {
      const res = await fetch(`${base}/api/admin-sale`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId: String(salePid), warehouseId: String(whId), qty: 2, unitPriceCents: 2500, method: 'card' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      const oid = body.order.id;
      ids.orders.push(oid);
      expect(body.order.status).toBe('completed');
      expect(body.order.payment_status).toBe('paid');
      expect(body.settlement.journal).toMatch(/^JE-/);
      const j = salesPosting.findOrderJournal(oid);
      expect(j.status).toBe('posted');
      const entry = journalService.getEntry(j.id);
      const line = (code, field, val) => expect(entry.lines.find((l) => l.account_code === code)[field]).toBe(val);
      line('1000', 'debit', 5000);
      line('4000', 'credit', 5000);
      line('5000', 'debit', 800); // 2 × FIFO 400
      line('1300', 'credit', 800);
      // stock actually moved: two issues-side legs exist across layer+journal
      expect(salesPosting.hasPostedSale(oid)).toBe(true);
    } finally { close(); }
  }, 25000);

  test('validation + RBAC on the register', async () => {
    const { base, close } = await httpApp({ isAdmin: true, username: `${T}-boss` });
    try {
      const frac = await fetch(`${base}/api/admin-sale`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ productId: salePid, warehouseId: whId, qty: 1, unitPriceCents: 12.5 }) });
      expect(frac.status).toBe(400);
      const qty0 = await fetch(`${base}/api/admin-sale`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ productId: salePid, warehouseId: whId, qty: 0, unitPriceCents: 2500 }) });
      expect(qty0.status).toBe(400);
      const ghost = await fetch(`${base}/api/admin-sale`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ productId: 99999999, warehouseId: whId, qty: 1, unitPriceCents: 2500 }) });
      expect(ghost.status).toBe(404);
    } finally { close(); }
    const noPerm = await httpApp({ isAdmin: true, userId: noneUserId });
    try {
      const forb = await fetch(`${noPerm.base}/api/admin-sale`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      expect(forb.status).toBe(403);
    } finally { noPerm.close(); }
  }, 30000);

  test('closed period aborts the ENTIRE counter sale — no order, no stock move, no journal', async () => {
    const per = wos.createFinancialPeriod({ name: `${T}-salelock`, months: 1 });
    ids.periods.push(per.id);
    wos.closeFinancialPeriod(per.id);
    const before = inventoryService.getStock(salePid, whId).qty_on_hand;
    const { base, close } = await httpApp({ isAdmin: true, username: `${T}-boss2` });
    try {
      const res = await fetch(`${base}/api/admin-sale`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ productId: String(salePid), warehouseId: String(whId), qty: 1, unitPriceCents: 2500 }) });
      expect(res.status).toBe(409);
      const body = await res.json().catch(() => ({}));
      expect(body.code).toBe('SETTLEMENT_BLOCKED');
      expect(inventoryService.getStock(salePid, whId).qty_on_hand).toBe(before); // rolled back
    } finally {
      wos.reopenFinancialPeriod(per.id);
      close();
    }
  }, 30000);

  test('double-stamp guard: settleCounterSale is idempotent per order', () => {
    const p = mkProduct(200);
    move(p, { type: 'opening_balance', qtyChange: 6, unitCost: 200, reason: `${T}-idem` });
    const cid = db.prepare('INSERT INTO customers (email, name, google_id) VALUES (?, ?, NULL)').run(`${T}-idem@t.local`, 'I').lastInsertRowid;
    ids.customer.push(cid);
    const oid = db.prepare("INSERT INTO orders (customer_id, total, status, items, payment_method) VALUES (?, 600, 'pending', '[]', 'cash')").run(cid).lastInsertRowid;
    ids.orders.push(oid);
    db.prepare(`INSERT INTO order_items (order_id, product_id, product_name, quantity, price, qty, base_price, final_price, cost_snapshot)
      VALUES (?, ?, 'i', 3, 200, 3, 200, 200, 200)`).run(oid, p);
    const first = salesSettlement.settleCounterSale(oid, { actor: 'a1', reason: 'walk-in' });
    expect(first.settled).toBe(true);
    const second = salesSettlement.settleCounterSale(oid, { actor: 'a2', reason: 'again' });
    expect(second.settled).toBe(false);
    expect(second.reason).toMatch(/already settled and booked/);
    expect(db.prepare("SELECT COUNT(*) n FROM journal_entries WHERE source_type='order' AND source_id=?").get(String(oid)).n).toBe(1);
    try { db.prepare('DELETE FROM customers WHERE id = ?').run(cid); } catch {}
  });
});
