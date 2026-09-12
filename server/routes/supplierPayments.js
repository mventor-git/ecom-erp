/**
 * Supplier Payments API (mventor-ticket-088) — thin surface only.
 * All accounting (Dr AP / Cr Cash), idempotency and atomicity live in
 * supplierPaymentService; this router contains no account codes or money rules.
 */
const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');
const supplierPaymentService = require('../services/supplierPaymentService');

/**
 * mventor-ticket-088 — Supplier payments (thin route).
 * All accounting semantics live in supplierPaymentService — no account codes,
 * no money rules here. Status mapping (stabilization): idempotency-conflict
 * gets 409; validation rejections 400; anything else 500.
 */
function mapError(err) {
  const m = String(err.message || '');
  if (/idempotency-conflict|reused with/i.test(m)) return 409;
  if (/not found|inactive|Overpayment|must equal|positive amount|integer number of cents|must be required|requires|at least one|duplicate application|does not belong|Unsupported|Invalid paid_at|reversal/i.test(m)) {
    return 400;
  }
  return 500;
}

// GET /api/admin/supplier-payments?supplier_id= | ?purchase_order_id=
router.get('/', adminAuth, requirePermission('supplier_payments.read'), (req, res) => {
  try {
    const payments = supplierPaymentService.listPayments({
      supplierId: req.query.supplier_id || null,
      poId: req.query.purchase_order_id || null,
      limit: req.query.limit,
    });
    res.json(payments);
  } catch (err) {
    console.error('Error listing supplier payments:', err);
    res.status(mapError(err)).json({ error: err.message });
  }
});

// GET /api/admin/supplier-payments/outstanding/:poId — derived AP remaining
router.get('/outstanding/:poId', adminAuth, requirePermission('supplier_payments.read'), (req, res) => {
  try {
    const poId = parseInt(req.params.poId, 10) || 0;
    res.json({
      purchase_order_id: poId,
      receivable_from_receipts: supplierPaymentService.receiptPayableForPo(poId),
      applied: supplierPaymentService.appliedToPo(poId),
      outstanding: supplierPaymentService.outstandingForPo(poId),
    });
  } catch (err) {
    console.error('Error computing outstanding payable:', err);
    res.status(mapError(err)).json({ error: err.message });
  }
});

// GET /api/admin/supplier-payments/:id
router.get('/:id', adminAuth, requirePermission('supplier_payments.read'), (req, res) => {
  try {
    const payment = supplierPaymentService.getPayment(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Supplier payment not found' });
    res.json(payment);
  } catch (err) {
    console.error('Error fetching supplier payment:', err);
    res.status(mapError(err)).json({ error: err.message });
  }
});

// POST /api/admin/supplier-payments — record + apply + post (full or partial)
router.post('/', adminAuth, requirePermission('supplier_payments.manage'), (req, res) => {
  try {
    const { supplier_id, amount, applications, method, paid_at, notes, idempotency_key } = req.body || {};
    const result = supplierPaymentService.recordPayment({
      supplierId: supplier_id,
      amount,
      applications,
      method,
      paidAt: paid_at,
      notes,
      idempotencyKey: idempotency_key,
      userId: req.session.username || 'admin',
    });
    res.status(result.paid ? 201 : 200).json(result);
  } catch (err) {
    console.error('Error recording supplier payment:', err);
    res.status(mapError(err)).json({ error: err.message });
  }
});

// POST /api/admin/supplier-payments/:id/reverse — immutable correction
router.post('/:id/reverse', adminAuth, requirePermission('supplier_payments.manage'), (req, res) => {
  try {
    const result = supplierPaymentService.reversePayment(req.params.id, {
      reason: req.body && req.body.reason,
      userId: req.session.username || 'admin',
    });
    res.status(result.reversed ? 201 : 200).json(result);
  } catch (err) {
    console.error('Error reversing supplier payment:', err);
    res.status(mapError(err)).json({ error: err.message });
  }
});

module.exports = router;
