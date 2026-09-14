/**
 * Accounting Operator Routes — GL operability surface (mventor-ticket-092).
 *
 * Thin HTTP over `accountingService` (which delegates to journalService /
 * accountService / ledgerService). ZERO accounting semantics here: no
 * arithmetic, no account codes, no period logic, no balance rules — every
 * rule lives server-side in the services, so a raw API call cannot be more
 * privileged than the UI and vice versa.
 *
 * Guards (RBAC seed: db.js ticket92Permissions):
 *   accounts.read/.manage · journals.read/.manage · ledger.read
 * Env-admin (super) passes via the standard requirePermission bootstrap.
 *
 * Manual journals can only be created here with source NULL (the service
 * enforces it); sourced (bridge/posting) journals remain immutable through
 * this whole surface — unpost refuses them, drafts refuse edits, delete
 * refuses posted anything.
 */

const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const { requirePermission } = require('../middleware/rbac');
const accounting = require('../services/accountingService');

// Uniform error translation: services throw domain-truth messages.
// 404 for missing records, 400 for refused accounting invariants, 500 only
// for the unexpected — never a silent success.
function fail(res, err) {
  const m = String((err && err.message) || err);
  if (/not found/i.test(m)) return res.status(404).json({ error: m });
  if (/closed financial period|refusing to post|inactive|Unbalanced|integer number of cents|cannot be|Cannot |must be|requires|Invalid|already exists|at least 2|immutable|negative|both debit|refuse|source flow|belongs to/i.test(m)) {
    return res.status(400).json({ error: m });
  }
  console.error('[accounting] unexpected error:', m);
  return res.status(500).json({ error: 'Accounting operation failed' });
}

function actor(req) {
  return { userId: req.session?.username || req.user?.email || req.session?.email || String(req.session?.userId ?? 'admin') };
}

/* ───────────────────────── Chart of Accounts ───────────────────────── */

// GET /api/admin/accounting/accounts?include_inactive=1
router.get('/accounts', adminAuth, requirePermission('accounts.read'), (req, res) => {
  try {
    res.json({ success: true, data: accounting.listAccounts({ includeInactive: req.query.include_inactive }) });
  } catch (err) { fail(res, err); }
});

// POST /api/admin/accounting/accounts { code, name, type, description? }
router.post('/accounts', adminAuth, requirePermission('accounts.manage'), (req, res) => {
  try {
    const { code, name, type, description } = req.body || {};
    res.status(201).json({ success: true, data: accounting.createAccount({ code, name, type, description }, actor(req)) });
  } catch (err) { fail(res, err); }
});

// GET /api/admin/accounting/accounts/:id — detail incl. journal-line references
router.get('/accounts/:id', adminAuth, requirePermission('accounts.read'), (req, res) => {
  try {
    res.json({ success: true, data: accounting.getAccount(req.params.id) });
  } catch (err) { fail(res, err); }
});

// PUT /api/admin/accounting/accounts/:id — edit fields / activate / deactivate
router.put('/accounts/:id', adminAuth, requirePermission('accounts.manage'), (req, res) => {
  try {
    res.json({ success: true, data: accounting.updateAccount(parseInt(req.params.id, 10), req.body || {}, actor(req)) });
  } catch (err) { fail(res, err); }
});

// DELETE /api/admin/accounting/accounts/:id — service refuses referenced
router.delete('/accounts/:id', adminAuth, requirePermission('accounts.manage'), (req, res) => {
  try {
    res.json({ success: true, data: accounting.deleteAccount(parseInt(req.params.id, 10), actor(req)) });
  } catch (err) { fail(res, err); }
});

// GET /api/admin/accounting/accounts/:id/ledger?from&to — posted-only ledger
router.get('/accounts/:id/ledger', adminAuth, requirePermission('ledger.read'), (req, res) => {
  try {
    res.json({ success: true, data: accounting.accountLedger(req.params.id, { from: req.query.from || null, to: req.query.to || null }) });
  } catch (err) { fail(res, err); }
});

/* ──────────────────────────── Journals ──────────────────────────────── */

// GET /api/admin/accounting/journals?from&to&status&source&account&q&limit&offset
router.get('/journals', adminAuth, requirePermission('journals.read'), (req, res) => {
  try {
    const { from, to, status, source, account, q, limit, offset } = req.query;
    res.json({ success: true, data: accounting.listJournals({ from, to, status, source, account, q, limit, offset }) });
  } catch (err) { fail(res, err); }
});

// GET /api/admin/accounting/journals/:id — header + lines (audit timeline via
// the existing /api/admin/events/timeline/journal/:id)
router.get('/journals/:id', adminAuth, requirePermission('journals.read'), (req, res) => {
  try {
    res.json({ success: true, data: accounting.getJournal(parseInt(req.params.id, 10)) });
  } catch (err) { fail(res, err); }
});

// POST /api/admin/accounting/journals — author a MANUAL draft { entry_date?, description, lines[] }
router.post('/journals', adminAuth, requirePermission('journals.manage'), (req, res) => {
  try {
    const { entry_date, description, lines } = req.body || {};
    res.status(201).json({ success: true, data: accounting.createManualEntry({ entry_date, description, lines }, actor(req)) });
  } catch (err) { fail(res, err); }
});

// PUT /api/admin/accounting/journals/:id — edit a manual DRAFT only
router.put('/journals/:id', adminAuth, requirePermission('journals.manage'), (req, res) => {
  try {
    const { entry_date, description, lines } = req.body || {};
    res.json({ success: true, data: accounting.updateManualEntry(parseInt(req.params.id, 10), { entry_date, description, lines }, actor(req)) });
  } catch (err) { fail(res, err); }
});

// DELETE /api/admin/accounting/journals/:id — discard a manual DRAFT only
router.delete('/journals/:id', adminAuth, requirePermission('journals.manage'), (req, res) => {
  try {
    res.json({ success: true, data: accounting.deleteManualDraft(parseInt(req.params.id, 10), actor(req)) });
  } catch (err) { fail(res, err); }
});

// POST /api/admin/accounting/journals/:id/post — all invariants enforced by
// journalService.postEntry (balanced revalidation, active accounts, cents,
// fail-closed period). Also the operator recovery for stranded bridge drafts.
router.post('/journals/:id/post', adminAuth, requirePermission('journals.manage'), (req, res) => {
  try {
    res.json({ success: true, data: accounting.postManualEntry(parseInt(req.params.id, 10), actor(req)) });
  } catch (err) { fail(res, err); }
});

// POST /api/admin/accounting/journals/:id/unpost — MANUAL posted only;
// sourced journals are refused by the model, closed periods fail closed.
router.post('/journals/:id/unpost', adminAuth, requirePermission('journals.manage'), (req, res) => {
  try {
    res.json({ success: true, data: accounting.unpostManualEntry(parseInt(req.params.id, 10), actor(req)) });
  } catch (err) { fail(res, err); }
});

/* ─────────────────────────── Statements ─────────────────────────────── */

// GET /api/admin/accounting/trial-balance?from&to
router.get('/trial-balance', adminAuth, requirePermission('ledger.read'), (req, res) => {
  try {
    res.json({ success: true, data: accounting.trialBalance({ from: req.query.from || null, to: req.query.to || null }) });
  } catch (err) { fail(res, err); }
});

// GET /api/admin/accounting/profit-loss?from&to — POSTED journals only
router.get('/profit-loss', adminAuth, requirePermission('ledger.read'), (req, res) => {
  try {
    res.json({ success: true, data: accounting.profitAndLoss({ from: req.query.from || null, to: req.query.to || null }) });
  } catch (err) { fail(res, err); }
});

// GET /api/admin/accounting/balance-sheet?as_of — truthful ledger position
// (limitations surfaced verbatim in the payload)
router.get('/balance-sheet', adminAuth, requirePermission('ledger.read'), (req, res) => {
  try {
    res.json({ success: true, data: accounting.balanceSheet({ as_of: req.query.as_of || null }) });
  } catch (err) { fail(res, err); }
});

// GET /api/admin/accounting/inventory-reconciliation — ledger-vs-inventory
// control (mventor-ticket-093): posted 1300 net vs cost-layer book value +
// every ledger-owned movement still lacking its journal. Differences are
// LISTED, never forced (same philosophy as AP aging + revenue recon).
router.get('/inventory-reconciliation', adminAuth, requirePermission('ledger.read'), (req, res) => {
  try {
    res.json({ success: true, data: require('../services/inventoryPosting').reconcile({ limit: req.query.limit }) });
  } catch (err) { fail(res, err); }
});

// POST /api/admin/accounting/inventory-reconciliation/post/:movementId —
// operator catch-up for a movement whose posting failed/was blocked earlier
// (idempotent: replay returns the posted entry; skip-reasons answer honestly).
router.post('/inventory-reconciliation/post/:movementId', adminAuth, requirePermission('journals.manage'), (req, res) => {
  try {
    const r = require('../services/inventoryPosting').postMovement(parseInt(req.params.movementId, 10), {
      userId: req.session.username || req.user?.email || 'operator',
    });
    res.json({ success: true, data: r });
  } catch (err) { fail(res, err); }
});

module.exports = router;
