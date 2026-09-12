/**
 * Accounting stabilization regressions (owner review of 086-089 @ 4d2420d).
 *
 * Proves: #1 draft-aware posting recovery, #2 integer-cent enforcement,
 * #3 real calendar dates, #4 server-side reversal reason, #5 idempotency
 * key<->request binding, #6 posted SOURCED journals immutable (manual kept),
 * #7 period control FAILS CLOSED (both gates), #8 no silent method fallback,
 * #9 write-time overpayment authority. Self-cleaning; same style as
 * supplierPayment.test.
 */
const db = require('../db');
const inventoryService = require('../services/inventoryService');
const journalService = require('../services/journalService');
const purchasePosting = require('../services/purchasePosting');
const supplierPaymentService = require('../services/supplierPaymentService');
const { resolveAccount } = require('../services/accountChart');

const TAG = 'jhard';
let catId, whId, supplierId, pid;
const poIds = [];
const movementIds = [];
const paymentIds = [];
const manualJournalIds = [];

beforeAll(async () => {
  await db.initPromise;
  catId = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get().id;
  whId = db.prepare('SELECT id FROM warehouses ORDER BY id LIMIT 1').get().id;
  supplierId = db.prepare("INSERT INTO suppliers (name, is_active) VALUES (?, 1)").run(TAG + '-sup').lastInsertRowid;
  pid = db.prepare(
    'INSERT INTO products (name, price, cost_price, category_id, active, stock, default_warehouse_id) VALUES (?, 2000, 900, ?, 1, 0, ?)'
  ).run(TAG + '-prod', catId, whId).lastInsertRowid;
  for (const code of ['1000', '1300', '2100']) resolveAccount(code);
});

/** PO + posted 087 receipt movement → live derived payable qty*unitCost. */
function makePayable(qty, unitCost) {
  const poId = db.prepare(
    "INSERT INTO purchase_orders (po_number, supplier_id, status, total_cost) VALUES (?, ?, 'received', ?)"
  ).run(`${TAG}-PO-${poIds.length}-${Date.now().toString(36)}`, supplierId, qty * unitCost).lastInsertRowid;
  poIds.push(poId);
  const m = inventoryService.createMovement({
    productId: pid, warehouseId: whId, type: 'receipt',
    reason: TAG, referenceType: 'purchase_order', referenceId: poId,
    qtyChange: qty, unitCost, note: TAG, userId: TAG,
  });
  movementIds.push(m.id);
  purchasePosting.postReceiptMovement(m.id, { userId: TAG }); // creates the payable
  return { poId, m };
}

function deleteJournalsFor(sourceType, sourceId) {
  for (const je of db.prepare('SELECT id FROM journal_entries WHERE source_type = ? AND source_id = ?').all(sourceType, sourceId)) {
    db.prepare('DELETE FROM journal_lines WHERE entry_id = ?').run(je.id);
    db.prepare('DELETE FROM journal_entries WHERE id = ?').run(je.id);
  }
}

function trackManual(entry) { manualJournalIds.push(entry.id); return entry; }

function payApp(poId, amount) {
  return [{ purchaseOrderId: poId, amount }];
}

function pay(poId, amount, opts = {}) {
  const r = supplierPaymentService.recordPayment({
    supplierId, amount, applications: payApp(poId, amount), userId: TAG, ...opts,
  });
  if (r.payment?.id) paymentIds.push(r.payment.id);
  return r;
}

afterEach(() => {
  for (const payId of paymentIds.splice(0)) {
    db.prepare('DELETE FROM supplier_payment_applications WHERE payment_id = ?').run(payId);
    db.prepare('DELETE FROM supplier_payments WHERE id = ?').run(payId);
    deleteJournalsFor('supplier_payment', payId);
  }
  for (const id of manualJournalIds.splice(0)) {
    db.prepare('DELETE FROM journal_lines WHERE entry_id = ?').run(id);
    db.prepare('DELETE FROM journal_entries WHERE id = ?').run(id);
  }
  db.prepare(`DELETE FROM events WHERE user_id = '${TAG}'`).run();
});

afterAll(() => {
  for (const mid of movementIds.splice(0)) {
    deleteJournalsFor('inventory_movement', mid);
    db.prepare('DELETE FROM inventory_movements WHERE id = ?').run(mid);
  }
  for (const poId of poIds.splice(0)) db.prepare('DELETE FROM purchase_orders WHERE id = ?').run(poId);
  db.prepare('DELETE FROM inventory WHERE product_id = ?').run(pid);
  db.prepare('DELETE FROM inventory_cost_layers WHERE product_id = ?').run(pid);
  db.prepare('DELETE FROM products WHERE id = ?').run(pid);
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(supplierId);
  db.prepare(`DELETE FROM events WHERE user_id = '${TAG}'`).run();
  db.saveDb();
});

describe('P0#1 — receipt posting never treats a draft as posted', () => {
  test('stranded draft is RECOVERED (posted) on retry, not returned as replay', () => {
    const { m } = makePayable(4, 1000);
    // wipe the receipt posting from makePayable, then re-create ONLY a draft:
    deleteJournalsFor('inventory_movement', m.id);
    const draft = trackManual(journalService.createEntry({
      description: `${TAG} stranded draft`,
      lines: [
        { account_id: resolveAccount('1300').id, debit: 4000, credit: 0 },
        { account_id: resolveAccount('2100').id, debit: 0, credit: 4000 },
      ],
      source: { type: 'inventory_movement', id: m.id, event: purchasePosting.SOURCE_EVENT },
    }));
    expect(draft.status).toBe('draft');

    const r = purchasePosting.postReceiptMovement(m.id, { userId: TAG });
    expect(r.posted).toBe(true);
    expect(r.entry.id).toBe(draft.id);
    expect(r.entry.status).toBe('posted');

    const again = purchasePosting.postReceiptMovement(m.id, { userId: TAG });
    expect(again.posted).toBe(false);          // true replay — posted only
    expect(again.entry.id).toBe(draft.id);
    expect(db.prepare("SELECT COUNT(*) n FROM journal_entries WHERE source_type='inventory_movement' AND source_id=?").get(m.id).n).toBe(1);
  });

  test('findReceiptJournal exposes status explicitly (honest naming, #10)', () => {
    const { m } = makePayable(2, 1000);
    deleteJournalsFor('inventory_movement', m.id);
    expect(purchasePosting.findReceiptJournal(m.id)).toBeNull();
    const r = purchasePosting.postReceiptMovement(m.id, { userId: TAG });
    const je = purchasePosting.findReceiptJournal(m.id);
    expect(je.status).toBe('posted');
    expect(r.entry.id).toBe(je.id);
  });
});

describe('P0#2 — financial inputs are integer cents or fail loudly', () => {
  test('journal entry rejects fractional debit/credit (no Math.round)', () => {
    const a = resolveAccount('1000').id, b = resolveAccount('2100').id;
    expect(() => journalService.createEntry({
      description: TAG + ' frac',
      lines: [
        { account_id: a, debit: 1000.5, credit: 0 },
        { account_id: b, debit: 0, credit: 1000.5 },
      ],
    })).toThrow(/integer number of cents/);
    expect(() => journalService.createEntry({
      description: TAG + ' str',
      lines: [
        { account_id: a, debit: '1000.25', credit: 0 },
        { account_id: b, debit: 0, credit: '1000.25' },
      ],
    })).toThrow(/integer number of cents/);
  });

  test('payment amount + per-application cents rejected when fractional', () => {
    const { poId } = makePayable(3, 1000);
    expect(() => pay(poId, 1500.01)).toThrow(/integer number of cents/);
    expect(() => supplierPaymentService.recordPayment({
      supplierId, amount: 1500,
      applications: [{ purchaseOrderId: poId, amount: 1499.5 }], userId: TAG,
    })).toThrow(/integer number of cents/);
    expect(db.prepare('SELECT COUNT(*) n FROM supplier_payments').get().n).toBe(0);
  });
});

describe('P0#3 — real calendar dates (canonical YYYY-MM-DD kept)', () => {
  test('2026-02-31 rejected by payment paid_at AND journal entry_date', () => {
    const { poId } = makePayable(1, 1000); // payable 1000
    expect(() => pay(poId, 1000, { paidAt: '2026-02-31' })).toThrow(/Invalid paid_at/);
    expect(() => pay(poId, 1000, { paidAt: '2026-13-01' })).toThrow(/Invalid paid_at/);
    const a = resolveAccount('1000').id, b = resolveAccount('2100').id;
    expect(() => journalService.createEntry({
      entry_date: '2026-02-30', description: TAG + ' baddate',
      lines: [
        { account_id: a, debit: 100, credit: 0 },
        { account_id: b, debit: 0, credit: 100 },
      ],
    })).toThrow(/Invalid entry_date/);

    const leap = pay(poId, 1000, { paidAt: '2024-02-29' }); // 2024 IS a leap year
    expect(leap.payment.paid_at).toBe('2024-02-29');
    // default business date = documented canonical (UTC calendar day)
    const r2 = makePayable(1, 1000);
    const def = pay(r2.poId, 1000);
    expect(def.payment.paid_at).toBe(journalService.todayISO());
  });
});

describe('P0#4 — reversal reason is a SERVER rule', () => {
  test('missing / blank / oversized reasons rejected by direct service callers', () => {
    const { poId } = makePayable(2, 1000);
    const r = pay(poId, 2000);
    expect(() => supplierPaymentService.reversePayment(r.payment.id, { userId: TAG })).toThrow(/reason/i);
    expect(() => supplierPaymentService.reversePayment(r.payment.id, { reason: '   ', userId: TAG })).toThrow(/reason/i);
    expect(() => supplierPaymentService.reversePayment(r.payment.id, { reason: 'x'.repeat(301), userId: TAG })).toThrow(/300/);
    const rev = supplierPaymentService.reversePayment(r.payment.id, { reason: 'wrong PO', userId: TAG });
    expect(rev.payment.status).toBe('reversed');
    expect(rev.payment.reversal_reason).toBe('wrong PO');
  });
});

describe('P0#5 — idempotency key is bound to the canonical request', () => {
  function newPo() { return makePayable(5, 1000); } // 5000 each

  test('same key + identical canonical request => replay of existing payment', () => {
    const { poId } = newPo();
    const first = pay(poId, 5000, { idempotencyKey: TAG + '-idem-a' });
    const replay = pay(poId, 5000, { idempotencyKey: TAG + '-idem-a' });
    expect(replay.paid).toBe(false);
    expect(replay.payment.id).toBe(first.payment.id);
  });

  test('same key + different amount => conflict, original intact', () => {
    const { poId } = newPo();
    const first = pay(poId, 5000, { idempotencyKey: TAG + '-idem-b' });
    expect(() => pay(poId, 4000, { idempotencyKey: TAG + '-idem-b' })).toThrow(/idempotency-conflict/);
    expect(supplierPaymentService.getPayment(first.payment.id).amount).toBe(5000);
  });

  test('same key + different applications => conflict', () => {
    const a = newPo();
    const b = newPo();
    const first = supplierPaymentService.recordPayment({
      supplierId, amount: 5000,
      applications: [{ purchaseOrderId: a.poId, amount: 5000 }],
      userId: TAG, idempotencyKey: TAG + '-idem-c',
    });
    paymentIds.push(first.payment.id);
    expect(() => supplierPaymentService.recordPayment({
      supplierId, amount: 5000,
      applications: [{ purchaseOrderId: b.poId, amount: 5000 }],
      userId: TAG, idempotencyKey: TAG + '-idem-c',
    })).toThrow(/idempotency-conflict/);
  });

  test('same key + different business date => conflict; case-normalized identical request => replay', () => {
    const { poId } = newPo();
    const first = pay(poId, 5000, { idempotencyKey: TAG + '-idem-d', paidAt: '2024-06-01' });
    paymentIds.push(first.payment.id);
    expect(() => pay(poId, 5000, { idempotencyKey: TAG + '-idem-d', paidAt: '2024-06-02' })).toThrow(/idempotency-conflict/);
    // method/supplier casing normalizes to the SAME canonical request => legitimate replay (not a dupe):
    const replay = supplierPaymentService.recordPayment({
      supplierId, amount: 5000,
      applications: [{ purchaseOrderId: poId, amount: 5000 }],
      userId: TAG, idempotencyKey: TAG + '-idem-d', method: 'CASH', paidAt: '2024-06-01',
    });
    expect(replay.paid).toBe(false);
    expect(replay.payment.id).toBe(first.payment.id);
  });

  test('keyless repeats are distinct payments; stored fingerprint matches canonical helper', () => {
    const { poId } = newPo();
    pay(poId, 5000, { idempotencyKey: TAG + '-idem-e', paidAt: '2024-05-01' });
    const row = db.prepare('SELECT idem_fp FROM supplier_payments WHERE idempotency_key = ?').get(`${TAG}-idem-e`);
    expect(row.idem_fp).toBe(supplierPaymentService.requestFingerprint({
      supplierId, amount: 5000, method: 'cash', date: '2024-05-01', apps: [{ poId, amount: 5000 }],
    }));
    // no key => no replay semantics => separate payments (PO has exactly 5000; use a fresh PO)
    const b = newPo();
    pay(b.poId, 2000);
    pay(b.poId, 3000);
    expect(supplierPaymentService.listPayments({ poId: b.poId }).length).toBe(2);
    void poId;
  });
});

describe('P0#6 — posted SOURCED journals immutable; manual lifecycle preserved', () => {
  test('unpost refused for payment + receipt postings; reversal remains the path', () => {
    const { poId } = makePayable(2, 1000);
    const r = pay(poId, 2000);
    const jeId = db.prepare("SELECT id FROM journal_entries WHERE source_type='supplier_payment' AND source_id=?").get(r.payment.id).id;
    expect(() => journalService.unpostEntry(jeId, TAG)).toThrow(/immutable/i);
    const rev = supplierPaymentService.reversePayment(r.payment.id, { reason: 'x', userId: TAG });
    expect(rev.entry.status).toBe('posted');
  });

  test('manual (sourceless) journals keep the 079 posted->draft cycle', () => {
    const a = resolveAccount('1000').id, b = resolveAccount('2100').id;
    const e = trackManual(journalService.createEntry({
      entry_date: '2000-01-01', description: TAG + ' manual',
      lines: [
        { account_id: a, debit: 100, credit: 0 },
        { account_id: b, debit: 0, credit: 100 },
      ],
    }));
    expect(journalService.postEntry(e.id, TAG).status).toBe('posted');
    expect(journalService.unpostEntry(e.id, TAG).status).toBe('draft');
  });
});

describe('P0#7 — period control FAILS CLOSED on lookup failure', () => {
  const realPrepare = db.prepare;
  const withBrokenPeriodTable = (fn) => {
    db.prepare = function (sql) {
      if (/financial_periods/.test(sql)) throw new Error('simulated infra failure');
      return realPrepare.call(this, sql);
    };
    try { return fn(); } finally { db.prepare = realPrepare; }
  };

  test('journal postEntry refuses when the lookup errors; entry stays draft', () => {
    const a = resolveAccount('1000').id, b = resolveAccount('2100').id;
    const e = trackManual(journalService.createEntry({
      entry_date: '2000-01-01', description: TAG + ' gatefail',
      lines: [
        { account_id: a, debit: 100, credit: 0 },
        { account_id: b, debit: 0, credit: 100 },
      ],
    }));
    withBrokenPeriodTable(() => {
      expect(() => journalService.closedPeriodContaining('2000-01-01')).toThrow(/control unavailable/i);
      expect(() => journalService.postEntry(e.id, TAG)).toThrow(/control unavailable/i);
    });
    expect(journalService.getEntry(e.id).status).toBe('draft');
    expect(journalService.postEntry(e.id, TAG).status).toBe('posted'); // allowed: no closed period
  });

  test('movement engine refuses when the twin lookup errors (then recovers)', () => {
    withBrokenPeriodTable(() => {
      expect(() => inventoryService.createMovement({
        productId: pid, warehouseId: whId, type: 'receipt', reason: TAG,
        qtyChange: 1, unitCost: 500, note: TAG, userId: TAG,
      })).toThrow(/control unavailable/i);
    });
    const m = inventoryService.createMovement({
      productId: pid, warehouseId: whId, type: 'receipt', reason: TAG,
      qtyChange: 1, unitCost: 500, note: TAG, userId: TAG,
    });
    movementIds.push(m.id);
  });
});

describe('P0#8 — reverse never silently falls back to cash for unmapped methods', () => {
  test('corrupt/legacy method row is refused; cash reverses normally', () => {
    const { poId } = makePayable(2, 1000);
    const r = pay(poId, 2000);
    db.prepare("UPDATE supplier_payments SET method = 'wire' WHERE id = ?").run(r.payment.id);
    expect(() => supplierPaymentService.reversePayment(r.payment.id, { reason: 'x', userId: TAG })).toThrow(/no chart mapping/);
    db.prepare("UPDATE supplier_payments SET method = 'cash' WHERE id = ?").run(r.payment.id);
    expect(supplierPaymentService.reversePayment(r.payment.id, { reason: 'x', userId: TAG }).payment.status).toBe('reversed');
  });
});

describe('P0#9 — overpayment authority at write time', () => {
  test('sequential partials checked against LIVE derived outstanding (in-txn re-validate)', () => {
    const { poId } = makePayable(5, 1000); // derived outstanding 5000
    expect(supplierPaymentService.outstandingForPo(poId)).toBe(5000);
    pay(poId, 3000, { idempotencyKey: TAG + '-9a' });
    expect(supplierPaymentService.outstandingForPo(poId)).toBe(2000);
    // pre-check AND write-time authority both refuse anything past 2000:
    expect(() => pay(poId, 2500, { idempotencyKey: TAG + '-9b' })).toThrow(/Overpayment/);
    expect(db.prepare(`SELECT COUNT(*) n FROM supplier_payments WHERE idempotency_key = ?`).get(`${TAG}-9b`).n).toBe(0);
    // legitimate remainder:
    pay(poId, 2000, { idempotencyKey: TAG + '-9c' });
    expect(supplierPaymentService.outstandingForPo(poId)).toBe(0);
    // and a third attempt at zero outstanding also hits the write-time gate:
    expect(() => pay(poId, 100, { idempotencyKey: TAG + '-9d' })).toThrow(/Overpayment/);
  });
});
