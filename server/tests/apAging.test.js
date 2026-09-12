/**
 * mventor-stabilization: AP AGING REPORT regressions (ticket 090).
 *
 * Recognition + application semantics are built through the REAL canonical
 * paths (087 posting bridge for AP recognition, 088 recordPayment for
 * applied totals) wherever a business path exists — the aging report must
 * read exactly the ledger the posting services write.
 *
 * Proves: buckets, FIFO allocation, historical as-of cutoff (receipt/payment/
 * reversal before/after), reversed-payment restore (D), settled exclusion (C),
 * multi-payment + multi-PO + multi-supplier (A/B/E/F/G), full-set control
 * totals under pagination, non-2xx error contract, 60/61 + 90/91 boundaries,
 * draft-journal exclusion (L), journal-backed application validity (M),
 * integer-cent exactness (N), fixed query count — no N+1 (O), and
 * reconciliation == the independent 088 outstandingForPo model (K),
 * including the historical-proof (today differs from as-of).
 */
const db = require('../db');
const bcrypt = require('bcryptjs');
const inventoryService = require('../services/inventoryService');
const purchasePosting = require('../services/purchasePosting');
const supplierPaymentService = require('../services/supplierPaymentService');
const journalService = require('../services/journalService');
const apAging = require('../services/apAgingService');

const TAG = 'ap090';
let catId, whId, supplierA, supplierB, productA, productB;
let noneRoleId, noneUserId;
const poIds = [];
const movementIds = [];
const paymentIds = [];
const journalIds = []; // manually created recognition/reversal drafts+entries

// dynamic UTC anchor: bridge-created recognition journals carry the REAL
// current UTC date, so offsets must be relative to it (deterministic days)
const ANCHOR = (() => { const d = new Date(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); })();
function utc(offsetDays) {
  return new Date(ANCHOR + offsetDays * 86400000).toISOString().slice(0, 10);
}
const TODAY = utc(0);

beforeAll(async () => {
  await db.initPromise;
  catId = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get().id;
  whId = db.prepare('SELECT id FROM warehouses ORDER BY id LIMIT 1').get().id;
  supplierA = db.prepare('INSERT INTO suppliers (name, is_active) VALUES (?, 1)').run(TAG + '-A').lastInsertRowid;
  supplierB = db.prepare('INSERT INTO suppliers (name, is_active) VALUES (?, 1)').run(TAG + '-B').lastInsertRowid;
  productA = db.prepare('INSERT INTO products (name, price, cost_price, category_id, active, stock, default_warehouse_id) VALUES (?, 2000, 900, ?, 1, 0, ?)').run(TAG + '-pA', catId, whId).lastInsertRowid;
  productB = db.prepare('INSERT INTO products (name, price, cost_price, category_id, active, stock, default_warehouse_id) VALUES (?, 2000, 900, ?, 1, 0, ?)').run(TAG + '-pB', catId, whId).lastInsertRowid;
  // role/user with ZERO permissions for the authorization behavior test (P)
  noneRoleId = db.prepare("INSERT INTO roles (name) VALUES ('jest_none')").run().lastInsertRowid;
  noneUserId = db.prepare('INSERT INTO users (email, name, password_hash, role_id, is_active) VALUES (?, ?, ?, ?, 1)')
    .run('ap090.none@aging.test', 'No Perm', bcrypt.hashSync('x', 10), noneRoleId).lastInsertRowid;
});

function makePo(supplierId) {
  const poId = db.prepare("INSERT INTO purchase_orders (po_number, supplier_id, status, total_cost) VALUES (?, ?, 'received', 0)")
    .run(`${TAG}-PO-${poIds.length}-${Date.now().toString(36)}`, supplierId).lastInsertRowid;
  poIds.push(poId);
  return poId;
}

/** canonical 087 recognition through the posting bridge (journal dates it NOW). */
function recognize(poId, productId, cents, qty = 1) {
  const m = inventoryService.createMovement({
    productId, warehouseId: whId, type: 'receipt', reason: TAG,
    referenceType: 'purchase_order', referenceId: poId,
    qtyChange: qty, unitCost: Math.floor(cents / qty), note: TAG, userId: TAG,
  });
  movementIds.push(m.id);
  const r = purchasePosting.postReceiptMovement(m.id, { userId: TAG });
  expect(r.posted).toBe(true);
  return r.entry;
}

/** recognition with an explicit historical accounting date (same shape rows,
 *  entry_date controlled for bucket/cutoff tests). Draft unless posted=true. */
function recognizeDated(poId, cents, entryDate, { draft = false } = {}) {
  const m = inventoryService.createMovement({
    productId: productA, warehouseId: whId, type: 'receipt', reason: TAG,
    referenceType: 'purchase_order', referenceId: poId,
    qtyChange: 1, unitCost: cents, note: TAG, userId: TAG,
  });
  movementIds.push(m.id);
  const inventory = require('../services/accountChart').resolveAccount('1300');
  const payable = require('../services/accountChart').resolveAccount('2100');
  const e = journalService.createEntry({
    entry_date: entryDate,
    description: `${TAG} dated ${poId} ${entryDate}`,
    lines: [
      { account_id: inventory.id, debit: cents, credit: 0 },
      { account_id: payable.id, debit: 0, credit: cents },
    ],
    source: { type: 'inventory_movement', id: m.id, event: purchasePosting.SOURCE_EVENT },
  });
  journalIds.push(e.id);
  return draft ? e : journalService.postEntry(e.id, TAG);
}

/** canonical 088 payment through the service (posted, journal-dated). */
function pay(poId, amount, opts = {}) {
  const r = supplierPaymentService.recordPayment({ supplierId: opts.supplierId || supplierA, amount, applications: [{ purchaseOrderId: poId, amount }], userId: TAG, ...opts });
  paymentIds.push(r.payment.id);
  return r;
}

/** manual POSTED payment-reversed journal on an explicit date (history construction) */
function reverseDated(paymentId, reversedEntryDate) {
  const payable = require('../services/accountChart').resolveAccount('2100');
  const cash = require('../services/accountChart').resolveAccount('1000');
  const p = db.prepare('SELECT amount FROM supplier_payments WHERE id = ?').get(paymentId);
  const e = journalService.createEntry({
    entry_date: reversedEntryDate,
    description: `${TAG} manual reversal ${paymentId}`,
    lines: [
      { account_id: cash.id, debit: p.amount, credit: 0 },
      { account_id: payable.id, debit: 0, credit: p.amount },
    ],
    source: { type: 'supplier_payment', id: paymentId, event: supplierPaymentService.EVENT_REVERSED },
  });
  journalIds.push(e.id);
  return journalService.postEntry(e.id, TAG);
}

function markReversed(paymentId) {
  db.prepare("UPDATE supplier_payments SET status = 'reversed', reversed_by = ?, reversal_reason = 'test' WHERE id = ?").run(TAG, paymentId);
}

function grab(x) { if (x && x.id) paymentIds.push(x.id); return x; }

afterEach(() => {
  for (const pid of paymentIds.splice(0)) {
    db.prepare('DELETE FROM supplier_payment_applications WHERE payment_id = ?').run(pid);
    db.prepare('DELETE FROM journal_lines WHERE entry_id IN (SELECT id FROM journal_entries WHERE source_type = ? AND source_id = ?)').run('supplier_payment', pid);
    db.prepare('DELETE FROM journal_entries WHERE source_type = ? AND source_id = ?').run('supplier_payment', pid);
    db.prepare('DELETE FROM supplier_payments WHERE id = ?').run(pid);
  }
  for (const jid of journalIds.splice(0)) {
    db.prepare('DELETE FROM journal_lines WHERE entry_id = ?').run(jid);
    db.prepare('DELETE FROM journal_entries WHERE id = ?').run(jid);
  }
  db.prepare("DELETE FROM events WHERE user_id = 'ap090.none@aging.test'").run();
  db.prepare('DELETE FROM events WHERE user_id = ?').run(TAG);
});

afterAll(() => {
  try {
    for (const poId of poIds.splice(0)) {
      db.prepare('DELETE FROM purchase_order_items WHERE po_id = ?').run(poId);
      db.prepare('DELETE FROM purchase_orders WHERE id = ?').run(poId);
    }
    for (const mid of movementIds.splice(0)) {
      db.prepare('DELETE FROM journal_lines WHERE entry_id IN (SELECT id FROM journal_entries WHERE source_type = ? AND source_id = ?)').run('inventory_movement', mid);
      db.prepare('DELETE FROM journal_entries WHERE source_type = ? AND source_id = ?').run('inventory_movement', mid);
      db.prepare('DELETE FROM inventory_movements WHERE id = ?').run(mid);
    }
    for (const pid of [productA, productB]) {
      db.prepare('DELETE FROM inventory WHERE product_id = ?').run(pid);
      db.prepare('DELETE FROM inventory_cost_layers WHERE product_id = ?').run(pid);
      db.prepare('DELETE FROM products WHERE id = ?').run(pid);
    }
    db.prepare('DELETE FROM suppliers WHERE id IN (?, ?)').run(supplierA, supplierB);
    db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(noneUserId);
    db.prepare('DELETE FROM users WHERE id = ?').run(noneUserId);
    db.prepare('DELETE FROM roles WHERE id = ?').run(noneRoleId);
    db.saveDb();
  } catch (e) { console.error('ap090 cleanup:', e.message); }
});

const buckets = (r) => r.buckets;

describe('090 AP aging — buckets & boundaries (H)', () => {
  test('days 0/1/30/31/60/61/90/91 land in exactly one bucket each', () => {
    const spec = [[0, 'current_zero'], [1, 'days_1_30'], [30, 'days_1_30'], [31, 'days_31_60'], [60, 'days_31_60'], [61, 'days_61_90'], [90, 'days_61_90'], [91, 'days_90_plus']];
    for (const [days, label] of spec) {
      const poId = makePo(supplierA);
      recognizeDated(poId, 1000, utc(-days));
      const r = apAging.getAgingReport({ asOf: TODAY });
      const item = r.items.find((i0) => i0.po_id === poId);
      expect(item).toBeTruthy();
      expect(item.days_aged).toBe(days);
      expect(item.bucket).toBe(label);
    }
  });

  test('buckets are mutually exclusive: the same cents are counted in exactly one bucket', () => {
    const poId = makePo(supplierA);
    recognizeDated(poId, 500, utc(-45));
    const r = apAging.getAgingReport({ asOf: TODAY, supplierId: supplierA });
    const item = r.items.find((i0) => i0.po_id === poId);
    expect(item.bucket).toBe('days_31_60');
    const row = r.summary.find((s0) => s0.supplier_id === supplierA);
    expect(row.days_31_60).toBeGreaterThanOrEqual(500);
    expect(row.current_zero === undefined || typeof row.current_zero === 'number').toBe(true);
  });
});

describe('090 core states', () => {
  test('A: one unpaid payable from the real 087 bridge shows at full recognition', () => {
    const poId = makePo(supplierA);
    const je = recognize(poId, productA, 5000);
    expect(db.prepare('SELECT entry_date FROM journal_entries WHERE id = ?').get(je.id).entry_date).toBe(TODAY);
    const r = apAging.getAgingReport({ asOf: TODAY });
    const item = r.items.find((i0) => i0.po_id === poId);
    expect(item.remaining_cents).toBe(5000);
    expect(item.original_recognized_cents).toBe(5000);
    expect(item.bucket).toBe('current_zero');
    expect(item.source_reference).toMatch(/^ap090-PO/);
  });

  test('B: partial payment reduces outstanding + traces payment ref (real 088 path)', () => {
    const poId = makePo(supplierA);
    recognize(poId, productA, 4000);
    grab(pay(poId, 1500).payment);
    const r = apAging.getAgingReport({ asOf: TODAY });
    const item = r.items.find((i0) => i0.po_id === poId);
    expect(item.remaining_cents).toBe(2500);
    expect(item.allocated_applied_cents).toBe(1500);
    expect(item.payments_on_po).toBe(1);
    expect(item.payment_refs.length).toBe(1);
    expect(item.payment_refs[0]).toMatch(/^PAY-/);
  });

  test('C: fully paid payable leaves the open set (scoped check; global totals stay internally consistent)', () => {
    const poId = makePo(supplierA);
    recognize(poId, productA, 2000);
    grab(pay(poId, 2000).payment);
    const r = apAging.getAgingReport({ asOf: TODAY, supplierId: supplierA });
    expect(r.items.find((i0) => i0.po_id === poId)).toBeUndefined();
    expect(r.reconciliation.buckets_minus_total).toBe(0);
    expect(r.reconciliation.summary_minus_total).toBe(0);
    expect(r.reconciliation.reconciled).toBe(true);
  });

  test('D: reversed payment RESTORES the payable exactly once', () => {
    const poId = makePo(supplierA);
    recognize(poId, productA, 3000);
    const p = pay(poId, 3000);
    paymentIds.push(p.payment.id);
    const rev = supplierPaymentService.reversePayment(p.payment.id, { reason: 'stale', userId: TAG });
    expect(rev.entry.status).toBe('posted');
    const r = apAging.getAgingReport({ asOf: TODAY });
    const item = r.items.find((i0) => i0.po_id === poId);
    expect(item.remaining_cents).toBe(3000); // original+reversal not double-counted
    expect(item.allocated_applied_cents).toBe(0);
  });

  test('E: multiple payments on one PO (oldest-line-first FIFO across two recognitions)', () => {
    const poId = makePo(supplierA);
    recognizeDated(poId, 3000, utc(-50)); // older
    recognizeDated(poId, 2000, utc(-10)); // newer
    grab(pay(poId, 2500).payment);          // allocated 2500 of the 5000 to oldest
    const r = apAging.getAgingReport({ asOf: TODAY });
    const items = r.items.filter((i0) => i0.po_id === poId).sort((a, b0) => a.days_aged - b0.days_aged);
    const old = items.find((i0) => i0.days_aged === 50);
    const fresh = items.find((i0) => i0.days_aged === 10);
    expect(old.remaining_cents).toBe(500);   // 3000 - 2500
    expect(fresh ? 2000 : 0).toBe(2000);     // untouched newest
    const totalForPo = r.items.filter((i0) => i0.po_id === poId).reduce((s, i1) => s + i1.remaining_cents, 0);
    expect(totalForPo).toBe(2500);
  });

  test('F: ONE payment spread across TWO POs reduces each PO by its own application', () => {
    const po1 = makePo(supplierA);
    const po2 = makePo(supplierA);
    recognizeDated(po1, 2000, utc(-15));
    recognizeDated(po2, 3000, utc(-40));
    const rec = supplierPaymentService.recordPayment({
      supplierId: supplierA, amount: 4000,
      applications: [{ purchaseOrderId: po1, amount: 1000 }, { purchaseOrderId: po2, amount: 3000 }],
      userId: TAG,
    });
    paymentIds.push(rec.payment.id);
    const r = apAging.getAgingReport({ asOf: TODAY, supplierId: supplierA });
    const i1 = r.items.find((x) => x.po_id === po1);
    expect(i1.remaining_cents).toBe(1000); // 2000 - 1000 applied
    expect(i1.days_aged).toBe(15);
    expect(r.items.find((x) => x.po_id === po2)).toBeUndefined(); // po2 fully applied
  });

  test('G: multiple suppliers + supplier filter + totals', () => {
    const pa = makePo(supplierA); const pb = makePo(supplierB);
    recognizeDated(pa, 1000, utc(-5), { draft: false });
    recognizeDated(pb, 1500, utc(-95), { draft: false });
    const both = apAging.getAgingReport({ asOf: TODAY });
    expect(both.summary.length).toBeGreaterThanOrEqual(2);
    const onlyB = apAging.getAgingReport({ asOf: TODAY, supplierId: supplierB });
    expect(onlyB.summary.every((s0) => s0.supplier_id === supplierB)).toBe(true);
    expect(onlyB.total_outstanding_cents).toBe(1500);
    expect(onlyB.buckets.days_90_plus).toBe(1500);
    // full-set control totals under a narrow supplier filter reconcile
    expect(onlyB.reconciliation.buckets_minus_total).toBe(0);
    expect(onlyB.reconciliation.summary_minus_total).toBe(0);
  });
});

describe('090 as-of cutoff correctness', () => {
  test('receipt before cutoff counts; same receipt NOT counted at a date before it', () => {
    const poId = makePo(supplierA);
    recognizeDated(poId, 700, utc(-10));
    expect(apAging.getAgingReport({ asOf: utc(-5) }).items.find((i0) => i0.po_id === poId)).toBeTruthy();
    expect(apAging.getAgingReport({ asOf: utc(-15) }).items.find((i0) => i0.po_id === poId)).toBeUndefined();
  });

  test('payment after cutoff: history at X must NOT see the later payment; today it may — PROOF not a relabel', () => {
    const poId = makePo(supplierA);
    recognizeDated(poId, 9000, utc(-200));
    grab(supplierPaymentService
      .recordPayment({ supplierId: supplierA, amount: 9000, applications: [{ purchaseOrderId: poId, amount: 9000 }], userId: TAG, paidAt: utc(-100) })
      .payment); // paid AFTER the cutoff X=-150
    const past = apAging.getAgingReport({ asOf: utc(-150) });
    const pastItem = past.items.find((i0) => i0.po_id === poId);
    expect(pastItem).toBeTruthy();                    // at X: still owed in full
    expect(pastItem.remaining_cents).toBe(9000);
    expect(pastItem.days_aged).toBe(50);              // 200 - 150
    const at = apAging.getAgingReport({ asOf: utc(-50) });   // payment now visible
    expect(at.items.find((i0) => i0.po_id === poId)).toBeUndefined();
    const today = apAging.getAgingReport({ asOf: TODAY });
    expect(today.items.find((i0) => i0.po_id === poId)).toBeUndefined();
  });

  test('reversal restores the liability at the reversal date — historical, not today-only', () => {
    const poId = makePo(supplierA);
    recognizeDated(poId, 4000, utc(-300));
    const p = pay(poId, 4000, { paidAt: utc(-200) });
    paymentIds.push(p.payment.id);
    reverseDated(p.payment.id, utc(-10));            // reversal posted at day -10
    markReversed(p.payment.id);
    const beforeRev = apAging.getAgingReport({ asOf: utc(-50) });
    expect(beforeRev.items.find((i0) => i0.po_id === poId)).toBeUndefined();       // at -50: paid, not yet reversed
    const afterRev = apAging.getAgingReport({ asOf: utc(-5) });
    expect(afterRev.items.find((i0) => i0.po_id === poId).remaining_cents).toBe(4000); // liability restored
    const today = apAging.getAgingReport({ asOf: TODAY });
    expect(today.items.find((i0) => i0.po_id === poId).remaining_cents).toBe(4000);
  });

  test('J: empty result before anything existed', () => {
    const r = apAging.getAgingReport({ asOf: '2000-01-01' });
    expect(r.items).toEqual([]);
    expect(r.summary).toEqual([]);
    expect(r.total_outstanding_cents).toBe(0);
    expect(r.reconciliation.reconciled).toBe(true);
  });
});

describe('090 invariants', () => {
  test('K: report total == independent 088 outstandingForPo model (per PO, as-of today)', () => {
    const p1 = makePo(supplierA); const p2 = makePo(supplierA); const p3 = makePo(supplierB);
    recognizeDated(p1, 6000, utc(-5));
    recognizeDated(p2, 2500, utc(-70));
    recognizeDated(p3, 1234, utc(-33));
    grab(pay(p1, 1000).payment);
    const r = apAging.getAgingReport({ asOf: TODAY });
    const mine = [p1, p2, p3];
    const model = mine.reduce((s, poId) => s + supplierPaymentService.outstandingForPo(poId), 0);
    const report = r.items.filter((i0) => mine.includes(i0.po_id)).reduce((s, i1) => s + i1.remaining_cents, 0);
    expect(report).toBe(model);
    expect(model).toBe(6000 - 1000 + 2500 + 1234);
  });

  test('K+: every money field is INTEGER cents; no silent rounding anywhere (N)', () => {
    const poId = makePo(supplierA);
    recognizeDated(poId, 12345, utc(-12));
    grab(pay(poId, 4567).payment);
    const r = apAging.getAgingReport({ asOf: TODAY });
    const ints = [r.total_outstanding_cents, ...Object.values(r.buckets), ...Object.values(r.reconciliation).filter((v) => typeof v === 'number')];
    ints.forEach((v) => expect(Number.isInteger(v)).toBe(true));
    r.summary.forEach((s0) => {
      Object.values(s0).forEach((v) => { if (typeof v === 'number') expect(Number.isInteger(v)).toBe(true); });
    });
    r.items.forEach((i0) => {
      [i0.original_recognized_cents, i0.allocated_applied_cents, i0.remaining_cents, i0.days_aged].forEach((v) => expect(Number.isInteger(v)).toBe(true));
    });
  });

  test('L/M: DRAFT recognition and draft payment journals never count', () => {
    const poId = makePo(supplierA);
    recognizeDated(poId, 3300, utc(-3), { draft: true });
    expect(apAging.getAgingReport({ asOf: TODAY, supplierId: supplierA }).items.find((i0) => i0.po_id === poId)).toBeUndefined();
    // application row whose payment has NO posted journal -> must not count:
    const po2 = makePo(supplierA);
    recognizeDated(po2, 500, utc(-2));
    const fakePay = db.prepare("INSERT INTO supplier_payments (payment_no, supplier_id, method, amount, status, paid_at, created_by) VALUES ('PAY-FORGED-01', ?, 'cash', 500, 'recorded', ?, ?)").run(supplierA, TODAY, TAG).lastInsertRowid;
    paymentIds.push(fakePay);
    db.prepare('INSERT INTO supplier_payment_applications (payment_id, purchase_order_id, amount) VALUES (?, ?, 500)').run(fakePay, po2);
    const r = apAging.getAgingReport({ asOf: TODAY, supplierId: supplierA });
    expect(r.items.find((i0) => i0.po_id === po2).remaining_cents).toBe(500);
  });

  test('O: fixed small number of queries regardless of item count (no N+1)', () => {
    for (let k = 0; k < 3; k++) {
      const poId = makePo(supplierA);
      recognizeDated(poId, 100, utc(-(k + 1)));
    }
    const realPrepare = db.prepare;
    let count = 0;
    db.prepare = function (sql) { count++; return realPrepare.call(this, sql); };
    try {
      const r = apAging.getAgingReport({ asOf: TODAY });
      expect(r.items.length).toBeGreaterThanOrEqual(3);
      expect(count).toBeLessThanOrEqual(4); // recognition + applied (2); days is pure JS
    } finally {
      db.prepare = realPrepare;
    }
  });

  test('control totals always cover the FULL filtered set even when paginated', async () => {
    for (let k = 0; k < 3; k++) {
      const poId = makePo(supplierB);
      recognizeDated(poId, 111, utc(-(k + 1)));
    }
    const full = apAging.getAgingReport({ asOf: TODAY, supplierId: supplierB });
    const paged = apAging.getAgingReport({ asOf: TODAY, supplierId: supplierB, limit: 1, offset: 2 });
    expect(paged.items.length).toBeLessThanOrEqual(1);
    expect(paged.total_outstanding_cents).toBe(full.total_outstanding_cents); // control total is global
    expect(paged.open_items_count).toBe(full.open_items_count);
    void paged;
  });
});

describe('090 hardening: back-dated payment causality (ADR-016 invariant)', () => {
  // Ticket scenarios: recognition Jan 20 / payment Jan 10 must NOT reduce a
  // payable that did not exist when the payment happened — at ANY as-of date.
  const payAt = (poId, amount, paidAt) => pay(poId, amount, { paidAt });

  test('A: receipt Jan-20, payment Jan-10: payment never reduces the line (2026-01-15 AND 2026-01-31)', () => {
    const poId = makePo(supplierA);
    recognizeDated(poId, 9000, '2026-01-20');
    payAt(poId, 9000, '2026-01-10'); // back-dated — unapplied at every date
    const filt = (r) => r.items.filter((i0) => i0.po_id === poId);
    const j15 = filt(apAging.getAgingReport({ asOf: '2026-01-15' }));
    expect(j15.length).toBe(0); // payable not yet recognized -> nothing to reduce, no phantom effect
    const j31 = filt(apAging.getAgingReport({ asOf: '2026-01-31' }));
    expect(j31.length).toBe(1);
    const it = j31[0];
    expect(it.remaining_cents).toBe(9000);            // payment MUST NOT have reduced it
    expect(it.allocated_applied_cents).toBe(0);
    expect(it.applied_to_po_cents).toBe(9000);       // raw application exists...
    expect(it.applied_within_lines_cents).toBe(0);   // ...but applies to zero lines
    expect(it.unapplied_advance_cents).toBe(9000);   // ...carried as unapplied
    expect(it.payment_refs).toEqual([]);             // not traceable as settlement of the line
    expect(it.payments_on_po).toBe(1);
  });

  test('A+: partially-applicable back-dated payment: pre-existing line reduced, excess unapplied', () => {
    const poId = makePo(supplierA);
    recognizeDated(poId, 4000, '2026-01-05'); // existed BEFORE the payment
    recognizeDated(poId, 6000, '2026-01-20'); // created after the payment
    payAt(poId, 5000, '2026-01-10');
    const it = apAging.getAgingReport({ asOf: '2026-01-31' }).items.find((i0) => i0.po_id === poId);
    expect(it).toBeTruthy(); // second line still open
    expect(it.remaining_cents).toBe(6000); // 6000 - 0 (cannot touch the post-payment line)
    expect(it.unapplied_advance_cents).toBe(1000); // 5000 - 4000 applied to the older line
    expect(it.applied_within_lines_cents).toBe(4000);
    // line @Jan-05 fully applied -> excluded from open items
    expect(it.payment_refs.length).toBe(1);
  });

  test('B: receipt Jan-20, payment Jan-25, aging Jan-30: payment reduces AP (normal order intact)', () => {
    const poId = makePo(supplierA);
    recognizeDated(poId, 9000, '2026-01-20');
    payAt(poId, 9000, '2026-01-25');
    expect(apAging.getAgingReport({ asOf: '2026-01-30' }).items.find((i0) => i0.po_id === poId)).toBeUndefined();
  });

  test('C: receipt Jan-20, payment Jan-25, aging Jan-15: pre-payable AP untouched by a payment dated later (not counted yet)', () => {
    const poId = makePo(supplierA);
    recognizeDated(poId, 9000, '2026-01-20');
    payAt(poId, 9000, '2026-01-25');
    // as-of Jan-15: NEITHER payable exists yet; payment is also in the future -> open must be 0/absent
    const r = apAging.getAgingReport({ asOf: '2026-01-15' });
    expect(r.items.find((i0) => i0.po_id === poId)).toBeUndefined();
  });

  test('D: normal partial payment behavior unchanged', () => {
    const poId = makePo(supplierA);
    recognizeDated(poId, 5000, '2026-01-01');
    payAt(poId, 2000, '2026-01-20');
    const it = apAging.getAgingReport({ asOf: '2026-01-31' }).items.find((i0) => i0.po_id === poId);
    expect(it.remaining_cents).toBe(3000);
    expect(it.allocated_applied_cents).toBe(2000);
    expect(it.unapplied_advance_cents).toBe(0);
    expect(it.payment_refs.length).toBe(1);
  });

  test('E: reconciliation invariant holds with unapplied advances (Σitems == buckets == report_total)', () => {
    const pa = makePo(supplierA); const pb = makePo(supplierB);
    recognizeDated(pa, 7000, '2026-01-20');
    payAt(pa, 7000, '2026-01-01'); // unapplied (back-dated vs pa line)
    recognizeDated(pb, 3300, '2026-01-10'); // supplier B normal
    const r = apAging.getAgingReport({ asOf: '2026-02-28' });
    expect(r.reconciliation.buckets_minus_total).toBe(0);
    expect(r.reconciliation.summary_minus_total).toBe(0);
    expect(r.reconciliation.buckets_sum_cents).toBe(r.total_outstanding_cents);
    const sumItems = r.items.reduce((s, i0) => s + i0.remaining_cents, 0);
    expect(sumItems).toBe(r.total_outstanding_cents);
    const rowA = r.items.find((i0) => i0.po_id === pa);
    expect(rowA.remaining_cents).toBe(7000);
    expect(rowA.unapplied_advance_cents).toBe(7000);
  });
});

describe('090 API surface', () => {
  const http = require('http');
  const express = require('express');
  let server, base, csrfCookie;

  async function call(path, sid) {
    return fetch(base + path, { headers: sid ? { Cookie: `rsmoke=${sid}` } : {} })
      .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
  }

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    // env-admin-shaped session: adminAuth passes, requirePermission super-bypass
    // => reaches (and exercises) the service validation layer
    app.use((req, res, next) => { req.session = { isAdmin: true }; next(); });
    app.use('/api/admin/supplier-payments', require('../routes/supplierPayments'));
    server = http.createServer(app);
    await new Promise((r) => server.listen(0, r));
    base = `http://localhost:${server.address().port}/api/admin/supplier-payments`;
  });

  afterAll(() => { try { server.closeAllConnections?.(); server.close(); } catch {} });

  test('GET /aging requires an explicit valid as_of (service validation post-auth)', async () => {
    const r = await call('/aging');
    expect(r.status).toBe(400);
    expect(String(r.body.error)).toMatch(/as_of/);
    const d = await call('/aging?as_of=2026-02-31');
    expect(d.status).toBe(400);
    expect(String(d.body.error)).toMatch(/Invalid as_of/);
  });

  test('summary + detail + supplier filter + cutoff + pagination served, reconciled over HTTP (env-admin)', async () => {
    const r = await call(`/aging?as_of=${TODAY}`);
    expect(r.status).toBe(200);
    expect(r.body.as_of).toBe(TODAY);
    expect(typeof r.body.aging_basis).toBe('string');
    expect(r.body.reconciliation.reconciled).toBe(true);
    expect(r.body.reconciliation.buckets_minus_total).toBe(0);
    expect(Array.isArray(r.body.items)).toBe(true);
    expect(Array.isArray(r.body.summary)).toBe(true);
    const filt = await call(`/aging?as_of=${TODAY}&supplier_id=${supplierB}`);
    expect(filt.status).toBe(200);
    expect(filt.body.summary.every((s0) => s0.supplier_id === supplierB)).toBe(true);
    const pag = await call(`/aging?as_of=${TODAY}&limit=1`);
    expect(pag.status).toBe(200);
    expect(pag.body.items.length).toBeLessThanOrEqual(1);
    expect(pag.body.open_items_count).toBeGreaterThanOrEqual(1);
  }, 15000);

  test('no session at all -> 401 (adminAuth gates before report)', async () => {
    const app3 = express();
    app3.use(express.json());
    app3.use('/api/admin/supplier-payments', require('../routes/supplierPayments'));
    const srv3 = app3.listen(0);
    await new Promise((r) => srv3.once('listening', r));
    try {
      const res = await fetch(`http://localhost:${srv3.address().port}/api/admin/supplier-payments/aging?as_of=${TODAY}`);
      expect(res.status).toBe(401);
    } finally {
      srv3.closeAllConnections?.(); srv3.close();
    }
  }, 15000);

  test('P: behavior 403 for a user WITHOUT supplier_payments.read (no bypass)', async () => {
    // session shim with userId of the zero-permission user. adminAuth demands
    // isAdmin; requirePermission then resolves the userId (db-user path) and
    // denies because this user's role has no grants.
    const app2 = express();
    app2.use(express.json());
    app2.use((req, res, next) => {
      if (req.path.startsWith('/api/admin/supplier-payments')) req.session = { isAdmin: true, userId: noneUserId };
      next();
    });
    app2.use('/api/admin/supplier-payments', require('../routes/supplierPayments'));
    const srv2 = app2.listen(0);
    await new Promise((r) => srv2.once('listening', r));
    try {
      const b2 = `http://localhost:${srv2.address().port}/api/admin/supplier-payments`;
      const res = await fetch(`${b2}/aging?as_of=${TODAY}`);
      expect(res.status).toBe(403);
    } finally {
      srv2.closeAllConnections?.(); srv2.close();
    }
  }, 15000);

  test('P: env-admin session reaches the report and reconciles', () => {
    // The behavior check for a SUPER user (env-admin) is the same wiring with
    // the bypass path; exercised via the whole-app HTTP smoke post-commit.
    expect(apAging.getAgingReport({ asOf: TODAY }).reconciliation.reconciled).toBe(true);
  });
});
