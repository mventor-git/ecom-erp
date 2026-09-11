/**
 * Supplier payment postings — mventor-ticket-088.
 * A supplier payment is persisted, applied to POs (payables) and posted
 * Dr 2100 AP / Cr 1000 Cash. Covers full, partial, multi-PO, overpayment,
 * replay, reversal, atomic rollback and correct Dr/Cr. Full cleanup.
 */
const db = require('../db');
const inventoryService = require('../services/inventoryService');
const purchasePosting = require('../services/purchasePosting');
const supplierPaymentService = require('../services/supplierPaymentService');
const journalService = require('../services/journalService');

const TAG = 'jest088';
const CODES = ['1000', '1300', '2100'];
let catId, whId, supplierId, otherSupplierId;
let pid;
const poIds = [];
const movementIds = [];
const paymentIds = [];
const entryIds = [];

beforeAll(async () => {
  await db.initPromise;
  catId = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get().id;
  whId = db.prepare('SELECT id FROM warehouses ORDER BY id LIMIT 1').get().id;
  supplierId = db.prepare("INSERT INTO suppliers (name, is_active) VALUES (?, 1)").run(TAG + '-supplier').lastInsertRowid;
  otherSupplierId = db.prepare("INSERT INTO suppliers (name, is_active) VALUES (?, 1)").run(TAG + '-other').lastInsertRowid;
  pid = db.prepare(
    'INSERT INTO products (name, price, cost_price, category_id, active, stock, default_warehouse_id) VALUES (?, 2000, 900, ?, 1, 0, ?)'
  ).run(TAG + '-product', catId, whId).lastInsertRowid;
  // Provision the shared chart codes up front (idempotent).
  for (const code of CODES) require('../services/accountChart').resolveAccount(code);
});

/**
 * Build a PO for `supplierId` and post a real receipt movement so 087 creates
 * the payable (source of outstanding AP).
 */
function makePayable(supplier, qty, unitCost) {
  const poId = db.prepare(
    "INSERT INTO purchase_orders (po_number, supplier_id, status, total_cost) VALUES (?, ?, 'received', ?)"
  ).run(`${TAG}-PO-${poIds.length}-${Date.now().toString(36)}`, supplier, qty * unitCost).lastInsertRowid;
  poIds.push(poId);
  const m = inventoryService.createMovement({
    productId: pid, warehouseId: whId, locationId: null, type: inventoryService.MOVEMENT_TYPES.RECEIPT,
    reason: TAG, referenceType: 'purchase_order', referenceId: poId,
    qtyChange: qty, unitCost, note: TAG, userId: TAG,
  });
  movementIds.push(m.id);
  const posted = purchasePosting.postReceiptMovement(m.id, { userId: TAG });
  if (posted.entry) entryIds.push(posted.entry.id);
  return poId;
}

afterEach(() => {
  // delete payments + their applications + sourced journals each test
  for (const payId of paymentIds.splice(0)) {
    for (const ev of ['payment-recorded', 'payment-reversed']) {
      const je = db.prepare("SELECT id FROM journal_entries WHERE source_type = 'supplier_payment' AND source_id = ? AND source_event = ?").get(payId, ev);
      if (je) { db.prepare('DELETE FROM journal_lines WHERE entry_id = ?').run(je.id); db.prepare('DELETE FROM journal_entries WHERE id = ?').run(je.id); }
    }
    db.prepare('DELETE FROM supplier_payment_applications WHERE payment_id = ?').run(payId);
    db.prepare('DELETE FROM supplier_payments WHERE id = ?').run(payId);
  }
  db.prepare("DELETE FROM events WHERE user_id = ?").run(TAG);
});

afterAll(() => {
  for (const mid of movementIds.splice(0)) {
    const je = db.prepare("SELECT id FROM journal_entries WHERE source_type = 'inventory_movement' AND source_id = ?").get(mid);
    if (je) { db.prepare('DELETE FROM journal_lines WHERE entry_id = ?').run(je.id); db.prepare('DELETE FROM journal_entries WHERE id = ?').run(je.id); }
    db.prepare('DELETE FROM inventory_movements WHERE id = ?').run(mid);
  }
  for (const poId of poIds.splice(0)) db.prepare('DELETE FROM purchase_orders WHERE id = ?').run(poId);
  db.prepare('DELETE FROM inventory WHERE product_id = ?').run(pid);
  db.prepare('DELETE FROM inventory_cost_layers WHERE product_id = ?').run(pid);
  db.prepare('DELETE FROM products WHERE id = ?').run(pid);
  db.prepare('DELETE FROM suppliers WHERE id IN (?, ?)').run(supplierId, otherSupplierId);
  db.prepare("DELETE FROM events WHERE user_id = ?").run(TAG);
  db.saveDb();
});

function linesOf(eid) {
  return db.prepare('SELECT a.code, l.debit, l.credit FROM journal_lines l JOIN accounts a ON a.id = l.account_id WHERE l.entry_id = ? ORDER BY l.id').all(eid);
}

describe('supplier payment postings (088)', () => {
  test('full payment posts Dr 2100 AP / Cr 1000 Cash for the whole outstanding', () => {
    const poId = makePayable(supplierId, 5, 1000); // AP = 5000
    const r = supplierPaymentService.recordPayment({
      supplierId, amount: 5000, applications: [{ purchaseOrderId: poId, amount: 5000 }],
      method: 'cash', userId: TAG, idempotencyKey: TAG + '-full',
    });
    paymentIds.push(r.payment.id);
    expect(r.paid).toBe(true);
    expect(r.entry.status).toBe('posted');
    expect(r.payment.payment_no).toMatch(/^PAY-\d{4}-\d{4}$/);
    expect(linesOf(r.entry.id)).toEqual([
      { code: '2100', debit: 5000, credit: 0 },
      { code: '1000', debit: 0, credit: 5000 },
    ]);
    expect(supplierPaymentService.outstandingForPo(poId)).toBe(0);
  });

  test('partial payment leaves the correct remaining outstanding', () => {
    const poId = makePayable(supplierId, 4, 1000); // AP = 4000
    const r = supplierPaymentService.recordPayment({
      supplierId, amount: 1500, applications: [{ purchaseOrderId: poId, amount: 1500 }], userId: TAG,
    });
    paymentIds.push(r.payment.id);
    expect(supplierPaymentService.outstandingForPo(poId)).toBe(2500);
    expect(linesOf(r.entry.id)).toEqual([
      { code: '2100', debit: 1500, credit: 0 },
      { code: '1000', debit: 0, credit: 1500 },
    ]);
  });

  test('one payment applies to multiple purchase orders', () => {
    const poA = makePayable(supplierId, 3, 1000); // 3000
    const poB = makePayable(supplierId, 2, 1000); // 2000
    const r = supplierPaymentService.recordPayment({
      supplierId, amount: 5000,
      applications: [{ purchaseOrderId: poA, amount: 3000 }, { purchaseOrderId: poB, amount: 2000 }], userId: TAG,
    });
    paymentIds.push(r.payment.id);
    expect(r.payment.applications.length).toBe(2);
    expect(linesOf(r.entry.id)).toEqual([
      { code: '2100', debit: 5000, credit: 0 },
      { code: '1000', debit: 0, credit: 5000 },
    ]);
    expect(supplierPaymentService.outstandingForPo(poA)).toBe(0);
    expect(supplierPaymentService.outstandingForPo(poB)).toBe(0);
  });

  test('overpayment over outstanding is rejected; no payment persisted', () => {
    const poId = makePayable(supplierId, 2, 1000); // 2000
    const before = db.prepare('SELECT COUNT(*) AS n FROM supplier_payments').get().n;
    expect(() => supplierPaymentService.recordPayment({
      supplierId, amount: 5000, applications: [{ purchaseOrderId: poId, amount: 5000 }], userId: TAG,
    })).toThrow(/Overpayment/);
    expect(db.prepare('SELECT COUNT(*) AS n FROM supplier_payments').get().n).toBe(before);
    expect(supplierPaymentService.outstandingForPo(poId)).toBe(2000);
  });

  test('applications that do not sum to the amount are rejected', () => {
    const poId = makePayable(supplierId, 3, 1000); // 3000
    expect(() => supplierPaymentService.recordPayment({
      supplierId, amount: 5000, applications: [{ purchaseOrderId: poId, amount: 3000 }], userId: TAG,
    })).toThrow(/must equal/);
  });

  test('foreign supplier PO is rejected', () => {
    const poId = makePayable(otherSupplierId, 2, 1000);
    expect(() => supplierPaymentService.recordPayment({
      supplierId, amount: 2000, applications: [{ purchaseOrderId: poId, amount: 2000 }], userId: TAG,
    })).toThrow(/does not belong/);
  });

  test('replayed idempotency key never creates a duplicate payment or posting', () => {
    const poId = makePayable(supplierId, 2, 1000);
    const key = TAG + '-replay';
    const first = supplierPaymentService.recordPayment({
      supplierId, amount: 2000, applications: [{ purchaseOrderId: poId, amount: 2000 }], idempotencyKey: key, userId: TAG,
    });
    paymentIds.push(first.payment.id);
    const second = supplierPaymentService.recordPayment({
      supplierId, amount: 2000, applications: [{ purchaseOrderId: poId, amount: 2000 }], idempotencyKey: key, userId: TAG,
    });
    expect(second.paid).toBe(false);
    expect(second.payment.id).toBe(first.payment.id);
    expect(db.prepare("SELECT COUNT(*) AS n FROM journal_entries WHERE source_type = 'supplier_payment' AND source_id = ?").get(first.payment.id).n).toBe(1);
  });

  test('listPayments filters by PO and echoes applied_amount (089 panel seam)', () => {
    const poA = makePayable(supplierId, 2, 1000); // 2000
    const poB = makePayable(supplierId, 3, 1000); // 3000
    const r = supplierPaymentService.recordPayment({
      supplierId, amount: 5000,
      applications: [{ purchaseOrderId: poA, amount: 2000 }, { purchaseOrderId: poB, amount: 3000 }],
      userId: TAG, idempotencyKey: TAG + '-list',
    });
    paymentIds.push(r.payment.id);
    const listA = supplierPaymentService.listPayments({ poId: poA });
    expect(listA.length).toBe(1);
    expect(listA[0].id).toBe(r.payment.id);
    expect(listA[0].applied_amount).toBe(2000);
    expect(listA[0].payment_no).toMatch(/^PAY-/);
    const listB = supplierPaymentService.listPayments({ poId: poB });
    expect(listB.length).toBe(1);
    expect(listB[0].applied_amount).toBe(3000);
    const listUnrelated = supplierPaymentService.listPayments({ poId: 999999 });
    expect(listUnrelated.length).toBe(0);
  });

  test('reversal posts the opposite entry and restores outstanding; original stays', () => {
    const poId = makePayable(supplierId, 2, 1000); // 2000
    const r = supplierPaymentService.recordPayment({
      supplierId, amount: 2000, applications: [{ purchaseOrderId: poId, amount: 2000 }], userId: TAG,
    });
    paymentIds.push(r.payment.id);
    expect(supplierPaymentService.outstandingForPo(poId)).toBe(0);

    const rev = supplierPaymentService.reversePayment(r.payment.id, { reason: 'wrong PO', userId: TAG });
    expect(rev.reversed).toBe(true);
    expect(rev.payment.status).toBe('reversed');
    expect(linesOf(rev.entry.id)).toEqual([
      { code: '1000', debit: 2000, credit: 0 },
      { code: '2100', debit: 0, credit: 2000 },
    ]);
    // original payment + its applications remain (immutable history)
    expect(db.prepare('SELECT COUNT(*) AS n FROM supplier_payment_applications WHERE payment_id = ?').get(r.payment.id).n).toBe(1);
    // reversal excluded from applied → outstanding restored
    expect(supplierPaymentService.outstandingForPo(poId)).toBe(2000);
    // reversing again is a no-op, never double-posts
    const again = supplierPaymentService.reversePayment(r.payment.id, { userId: TAG });
    expect(again.reversed).toBe(false);
    expect(db.prepare("SELECT COUNT(*) AS n FROM journal_entries WHERE source_type = 'supplier_payment' AND source_id = ? AND source_event = 'payment-reversed'").get(r.payment.id).n).toBe(1);
  });

  test('atomic rollback: a posting failure leaves no payment, application or journal', () => {
    const poId = makePayable(supplierId, 2, 1000);
    const payBefore = db.prepare('SELECT COUNT(*) AS n FROM supplier_payments').get().n;
    const appBefore = db.prepare('SELECT COUNT(*) AS n FROM supplier_payment_applications').get().n;
    const jeBefore = db.prepare('SELECT COUNT(*) AS n FROM journal_entries').get().n;

    const realPost = journalService.postEntry;
    journalService.postEntry = () => { throw new Error('injected posting failure'); };
    try {
      expect(() => supplierPaymentService.recordPayment({
        supplierId, amount: 2000, applications: [{ purchaseOrderId: poId, amount: 2000 }], userId: TAG,
      })).toThrow(/injected posting failure/);
    } finally {
      journalService.postEntry = realPost;
    }

    expect(db.prepare('SELECT COUNT(*) AS n FROM supplier_payments').get().n).toBe(payBefore);
    expect(db.prepare('SELECT COUNT(*) AS n FROM supplier_payment_applications').get().n).toBe(appBefore);
    expect(db.prepare('SELECT COUNT(*) AS n FROM journal_entries').get().n).toBe(jeBefore);
    // the injected failure must not have consumed outstanding
    expect(supplierPaymentService.outstandingForPo(poId)).toBe(2000);
  });
});
