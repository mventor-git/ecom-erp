/**
 * Accounting Operator Service — GL operability (mventor-ticket-092).
 *
 * The thin business layer BEHIND the accounting routes. It adds NOTHING to
 * the accounting model: every write is delegated to the existing primitives
 * and every figure read is derived from posted journals via `ledgerService`.
 *
 *   · Chart of Accounts   -> accountService (the ONLY CoA; accountChart stays
 *                            the sole skeleton seed — this never re-seeds and
 *                            never forks a second chart)
 *   · Manual journals     -> journalService (draft -> post -> manual unpost).
 *                            Manual entries are created with source=NULL so
 *                            they can never masquerade as a bridge journal, and
 *                            posting inherits the fail-closed period gate +
 *                            balance/inactive-account revalidation + integer
 *                            cents. Sourced journals stay immutable (the model
 *                            refuses their unpost).
 *   · Trial balance       -> ledgerService.getTrialBalance (verbatim)
 *   · P&L / Balance Sheet -> ledgerService (journal-derived, net-new reads)
 *
 * This layer adds two things the services did not have: OPERATOR AUDIT
 * (every manual mutation emits an immutable event with the acting user — a
 * posted/sourced journal is never edited/deleted, so there is nothing here to
 * silently change) and ACTOR attribution (journalService's bridge recovery
 * path uses an internal actor; operator actions carry the true session user).
 *
 * No account codes, no arithmetic, no period logic live above this file —
 * routes parse, this validates context, the services do the accounting.
 */

const journalService = require('./journalService');
const ledgerService = require('./ledgerService');
const accountService = require('./accountService');
const eventService = require('./eventService');

const ET = eventService.EVENT_TYPES;
const ENT = eventService.ENTITY_TYPES;

function actor(userId) { return { userId: userId == null ? '' : String(userId) }; }

/* ────────────────────────── Chart of Accounts ────────────────────────── */

function listAccounts({ includeInactive = false } = {}) {
  return accountService.listAccounts(!!includeInactive);
}

function getAccount(idOrCode) {
  const account = accountService.getAccount(idOrCode);
  if (!account) throw new Error('Account not found');
  return { ...account, references: accountService.countReferences(account.id) };
}

const ACCOUNT_TYPE_SET = new Set(accountService.ACCOUNT_TYPES);

function createAccount({ code, name, type, description = '' }, { userId = '' } = {}) {
  const cleanType = String(type || '').trim().toLowerCase();
  if (!ACCOUNT_TYPE_SET.has(cleanType)) {
    throw new Error(`Invalid account type "${type}" — expected one of: ${accountService.ACCOUNT_TYPES.join(', ')}`);
  }
  const created = accountService.createAccount({ code, name, type: cleanType, description });
  eventService.emit(ET.ACCOUNT_CREATED, ENT.ACCOUNT, created.id, {
    ...actor(userId), payload: { code: created.code, name: created.name, type: created.type, manual: true },
  });
  return created;
}

function updateAccount(id, updates, { userId = '' } = {}) {
  const before = accountService.getAccount(id);
  if (!before) throw new Error('Account not found');
  const updated = accountService.updateAccount(id, updates);
  const activation = before.is_active !== updated.is_active
    ? (updated.is_active ? 'reactivated' : 'deactivated') : null;
  eventService.emit(ET.ACCOUNT_UPDATED, ENT.ACCOUNT, id, {
    ...actor(userId),
    payload: { code: updated.code, name: updated.name, type: updated.type, is_active: updated.is_active, activation, manual: true },
  });
  return updated;
}

function deleteAccount(id, { userId = '' } = {}) {
  const existing = accountService.getAccount(id);
  if (!existing) throw new Error('Account not found');
  // accountService refuses any account still referenced by a journal line;
  // posted history can never be orphaned. Deactivation is the non-destructive
  // alternative offered to operators.
  const result = accountService.deleteAccount(id);
  eventService.emit(ET.ACCOUNT_DELETED, ENT.ACCOUNT, id, {
    ...actor(userId), payload: { code: existing.code, refs: 0, manual: true },
  });
  return result;
}

/* ──────────────────────────── Journals ───────────────────────────────── */

function listJournals(params = {}) {
  return journalService.listEntriesFiltered(params);
}

function getJournal(id) {
  const entry = journalService.getEntry(id);
  if (!entry) throw new Error('Journal entry not found');
  return entry;
}

function accountLedger(idOrCode, { from = null, to = null } = {}) {
  return ledgerService.getLedger(idOrCode, { from, to });
}

/** Author a MANUAL draft journal. source is intentionally NOT accepted. */
function createManualEntry({ entry_date, description, lines }, { userId = '' } = {}) {
  const draft = journalService.createEntry({ entry_date, description, lines, source: null });
  eventService.emit(ET.JOURNAL_ENTRY_CREATED, ENT.JOURNAL, draft.id, {
    ...actor(userId),
    payload: { entry_no: draft.entry_no, entry_date: draft.entry_date, manual: true, description: draft.description },
  });
  return draft;
}

function updateManualEntry(id, { entry_date, description, lines }, { userId = '' } = {}) {
  const before = journalService.getEntry(id);
  const updated = journalService.updateDraftEntry(id, { entry_date, description, lines });
  eventService.emit(ET.JOURNAL_ENTRY_UPDATED, ENT.JOURNAL, id, {
    ...actor(userId),
    payload: { entry_no: updated.entry_no, entry_date: updated.entry_date, manual: true, was_description: before ? before.description : '' },
  });
  return updated;
}

function deleteManualDraft(id, { userId = '' } = {}) {
  const before = journalService.getEntry(id);
  const result = journalService.deleteDraftEntry(id); // model refuses posted + sourced
  eventService.emit(ET.JOURNAL_ENTRY_DELETED, ENT.JOURNAL, id, {
    ...actor(userId),
    payload: { entry_no: result.deleted, entry_date: before ? before.entry_date : null, draft_only: true, manual: true },
  });
  return result;
}

/** Post a manual draft. All gates (balance, inactive, closed period, cents)
 *  are enforced by journalService.postEntry — this only adds actor audit. */
function postManualEntry(id, { userId = '' } = {}) {
  const entry = journalService.postEntry(id, userId || 'manual');
  return entry;
}

function unpostManualEntry(id, { userId = '' } = {}) {
  const entry = journalService.unpostEntry(id, userId || 'manual');
  return entry;
}

/* ─────────────────────────── Statements ─────────────────────────────── */

/** Range params are the operator's responsibility: reject impossible dates
 *  loudly instead of letting `date('garbage')` silently match nothing. */
function assertRange({ from = null, to = null } = {}) {
  for (const [k, v] of [['from', from], ['to', to]]) {
    if (v && !journalService.isValidCalendarDate(String(v))) {
      throw new Error(`Invalid ${k} "${v}" — expected real calendar date YYYY-MM-DD`);
    }
  }
}

function trialBalance(params = {}) {
  assertRange(params);
  return ledgerService.getTrialBalance({ from: params.from || null, to: params.to || null });
}

function profitAndLoss(params = {}) {
  assertRange(params);
  return ledgerService.getProfitAndLoss({ from: params.from || null, to: params.to || null });
}

function balanceSheet(params = {}) {
  const asOf = params.as_of || null;
  if (asOf && !journalService.isValidCalendarDate(String(asOf))) {
    throw new Error(`Invalid as_of "${asOf}" — expected real calendar date YYYY-MM-DD`);
  }
  return ledgerService.getBalanceSheet({ as_of: asOf });
}

module.exports = {
  listAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  listJournals,
  getJournal,
  accountLedger,
  createManualEntry,
  updateManualEntry,
  deleteManualDraft,
  postManualEntry,
  unpostManualEntry,
  trialBalance,
  profitAndLoss,
  balanceSheet,
};
