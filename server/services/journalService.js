/**
 * Journal Service — double-entry foundation (mventor-ticket-077).
 *
 * Draft entries only: create / get / list / update-draft / delete-draft.
 * Post/unpost transitions arrive in Ticket D — there is deliberately NO
 * path to `posted` yet, so nothing here can create immutable state.
 *
 * Structural invariants (reference semantics, ECOM-ERP cents):
 *   · ≥2 effective lines (all-zero debit+credit lines are skipped, documented)
 *   · no negative amounts; never debit>0 AND credit>0 on one line
 *   · total debit == total credit, total > 0
 *   · every line references an existing ACTIVE account
 *   · entry_no immutable once assigned (JE-YYYY-NNNN via document_sequences)
 * All writes run inside db.transaction. Money INTEGER cents (ADR-014).
 */

const db = require('../db');
const documentNumberService = require('./documentNumberService');

function todayISO() {
  // Canonical business-date rule (stabilization): "today" = UTC calendar date.
  // No timezone was ever configured in this project (settings has none) — this
  // keeps entry/paid dates deterministic and matching SQLite's UTC `date('now')`
  // gates. If per-country dates are ever a requirement, it becomes its own
  // settings-backed slice — not an implicit local-machine behavior.
  return new Date().toISOString().slice(0, 10);
}

/** Money in cents must arrive as INTEGERS — no silent rounding (stabilization). */
function assertIntegerCents(value, label) {
  if (value === null || value === undefined || value === '') {
    throw new Error(`${label} is required (integer cents)`);
  }
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error(`${label} must be an integer number of cents (got ${value})`);
  }
  return n;
}

/** Real-calendar YYYY-MM-DD (rejects 2026-02-31 et al.); canonical persisted shape. */
function isValidCalendarDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  const chk = new Date(t);
  return chk.getUTCFullYear() === y && chk.getUTCMonth() === m - 1 && chk.getUTCDate() === d;
}

function assertEntryDate(v) {
  const s = String(v || '').trim() || todayISO();
  if (!isValidCalendarDate(s)) {
    throw new Error(`Invalid entry_date "${v}" — expected real calendar date in YYYY-MM-DD`);
  }
  return s;
}

/** Validate + normalize raw lines against live accounts. Throws on violation. */
function normalizeLines(rawLines) {
  if (!Array.isArray(rawLines)) throw new Error('Journal entry requires a lines array');
  const out = [];
  for (const raw of rawLines) {
    const accountId = parseInt(raw.account_id ?? 0, 10) || 0;
    if (!accountId) throw new Error('Journal line requires account_id');
    const account = db.prepare('SELECT id, is_active FROM accounts WHERE id = ?').get(accountId);
    if (!account) throw new Error(`Unknown account id ${accountId}`);
    if (!account.is_active) throw new Error(`Account id ${accountId} is inactive`);
    const debit = raw.debit == null ? 0 : assertIntegerCents(raw.debit, 'Journal debit');
    const credit = raw.credit == null ? 0 : assertIntegerCents(raw.credit, 'Journal credit');
    if (debit < 0 || credit < 0) throw new Error('Journal amounts cannot be negative');
    if (debit > 0 && credit > 0) throw new Error('Journal line cannot carry both debit and credit');
    if (debit === 0 && credit === 0) continue; // all-zero lines carry no meaning — skipped
    out.push({ account_id: accountId, debit, credit, description: String(raw.description || '') });
  }
  if (out.length < 2) throw new Error('Journal entry requires at least 2 non-zero lines');
  const totalD = out.reduce((s, l) => s + l.debit, 0);
  const totalC = out.reduce((s, l) => s + l.credit, 0);
  if (totalD <= 0 || totalD !== totalC) {
    throw new Error(`Unbalanced journal entry (debit ${totalD} ≠ credit ${totalC})`);
  }
  return out;
}

function getEntry(id) {
  const header = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(id);
  if (!header) return null;
  header.lines = db.prepare(`
    SELECT jl.*, a.code AS account_code, a.name AS account_name, a.type AS account_type
    FROM journal_lines jl JOIN accounts a ON a.id = jl.account_id
    WHERE jl.entry_id = ? ORDER BY jl.id
  `).all(id);
  return header;
}

function listEntries({ limit = 100 } = {}) {
  const n = Math.min(Math.max(parseInt(limit) || 100, 1), 500);
  return db.prepare('SELECT * FROM journal_entries ORDER BY id DESC LIMIT ?').all(n);
}

/**
 * Filtered journal listing for the operator surface (mventor-ticket-092).
 * Reads only — the same `journal_entries` model, never a second one.
 * Filters: from/to (calendar-valid), status, source ('order'|'inventory_movement'|
 * 'supplier_payment'|'manual'), account (id or code — matches ANY line using it),
 * q (entry_no/description contains). Each row carries total_cents (debit sum).
 * Returns { rows, total } where total is the count over the FULL filtered set.
 */
function listEntriesFiltered({ from = null, to = null, status = null, source = null, account = null, q = null, limit = 50, offset = 0 } = {}) {
  const conds = [];
  const params = [];
  if (from) {
    if (!isValidCalendarDate(from)) throw new Error(`Invalid from "${from}" — expected real calendar date YYYY-MM-DD`);
    conds.push('date(e.entry_date) >= date(?)'); params.push(from);
  }
  if (to) {
    if (!isValidCalendarDate(to)) throw new Error(`Invalid to "${to}" — expected real calendar date YYYY-MM-DD`);
    conds.push('date(e.entry_date) <= date(?)'); params.push(to);
  }
  if (status) {
    if (!['draft', 'posted'].includes(status)) throw new Error(`Invalid status filter "${status}"`);
    conds.push('e.status = ?'); params.push(status);
  }
  if (source) {
    const s = String(source);
    conds.push(s === 'manual' ? 'e.source_type IS NULL' : 'e.source_type = ?');
    if (s !== 'manual') params.push(s);
  }
  const acct = account != null && account !== '' ? parseInt(account, 10) : null;
  if (account != null && account !== '') {
    if (!db.prepare('SELECT id FROM accounts WHERE id = ? OR code = ?').get(acct, String(account))) {
      throw new Error(`Unknown account filter "${account}"`);
    }
    conds.push('EXISTS (SELECT 1 FROM journal_lines fl WHERE fl.entry_id = e.id AND fl.account_id = (SELECT id FROM accounts WHERE id = ? OR code = ?))');
    params.push(acct, String(account));
  }
  if (q && String(q).trim()) {
    conds.push('(e.entry_no LIKE ? OR e.description LIKE ?)');
    const like = `%${String(q).trim().slice(0, 80)}%`;
    params.push(like, like);
  }
  const where = conds.length ? ` WHERE ${conds.join(' AND ')}` : '';
  const n = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  const rows = db.prepare(`
    SELECT e.*, (SELECT COALESCE(SUM(l.debit), 0) FROM journal_lines l WHERE l.entry_id = e.id) AS total_cents
    FROM journal_entries e${where}
    ORDER BY e.id DESC LIMIT ? OFFSET ?
  `).all(...params, n, off);
  const total = db.prepare(`SELECT COUNT(*) AS n FROM journal_entries e${where}`).get(...params).n;
  return { rows, total };
}

/**
 * Create a DRAFT journal (never posted — posting is its own audited step).
 * Manual-operator lifecycle events belong to the accounting service (092);
 * bridges create+post their sourced journals and are audited by their own
 * source flow. Keeping THIS model quiet preserves every existing caller.
 */
function createEntry({ entry_date, description = '', lines, source = null }) {
  const date = assertEntryDate(entry_date);
  const clean = normalizeLines(lines);
  const src = source || {};
  let entryId = null;
  db.transaction(() => {
    const { document_number } = documentNumberService.generate('JE');
    const res = db.prepare(`
      INSERT INTO journal_entries (entry_no, entry_date, description, status, source_type, source_id, source_event)
      VALUES (?, ?, ?, 'draft', ?, ?, ?)
    `).run(document_number, date, String(description || ''),
      src.type != null ? String(src.type) : null,
      src.id != null ? parseInt(src.id) || null : null,
      src.event != null ? String(src.event) : null);
    entryId = res.lastInsertRowid;
    const ins = db.prepare(`
      INSERT INTO journal_lines (entry_id, account_id, debit, credit, description)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const l of clean) ins.run(entryId, l.account_id, l.debit, l.credit, l.description);
  });
  return getEntry(entryId);
}

function assertDraft(id) {
  const header = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(id);
  if (!header) throw new Error('Journal entry not found');
  if (header.status !== 'draft') throw new Error('Only draft entries can be modified (posting arrives in Ticket D)');
  return header;
}

/**
 * A SOURCED draft belongs to an accounting bridge (a stranded posting waiting
 * for its own recovery path, e.g. re-settlement) — humans never edit or
 * delete it. Manual (source-less) drafts are bookkeeper-owned. (092)
 * Source ownership outranks the draft rule so the refusal states the deeper
 * fact first: bridged journals are machine property at ANY status.
 */
function assertManualDraft(id) {
  const header = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(id);
  if (!header) throw new Error('Journal entry not found');
  if (header.source_type) {
    throw new Error(`Sourced journal ${header.entry_no} belongs to its source flow (${header.source_type}/${header.source_id}) — recover via the posting service, not by editing`);
  }
  if (header.status !== 'draft') throw new Error('Only draft entries can be modified');
  return header;
}

function updateDraftEntry(id, { entry_date, description, lines }) {
  const header = assertManualDraft(id);
  const date = entry_date !== undefined ? assertEntryDate(entry_date) : header.entry_date;
  const desc = description !== undefined ? String(description) : header.description;
  const clean = normalizeLines(lines);
  db.transaction(() => {
    db.prepare('DELETE FROM journal_lines WHERE entry_id = ?').run(id);
    const ins = db.prepare(`
      INSERT INTO journal_lines (entry_id, account_id, debit, credit, description)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const l of clean) ins.run(id, l.account_id, l.debit, l.credit, l.description);
    db.prepare('UPDATE journal_entries SET entry_date = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(date, desc, id);
  });
  return getEntry(id);
}

function deleteDraftEntry(id) {
  assertManualDraft(id);
  const entryNo = db.prepare('SELECT entry_no FROM journal_entries WHERE id = ?').get(id).entry_no;
  db.transaction(() => {
    db.prepare('DELETE FROM journal_lines WHERE entry_id = ?').run(id);
    db.prepare('DELETE FROM journal_entries WHERE id = ?').run(id);
  });
  return { success: true, deleted: entryNo };
}

/**
 * Period gate, read-only (079 — Ticket F owns period policy).
 * Refuses posting when a CLOSED financial period contains the entry date.
 * No covering period (or none closed) = allowed, documented default.
 * Stabilization: the period CONTROL itself failing is NOT "no closed
 * period" — a lookup failure means the control is unavailable, and accounting
 * controls fail CLOSED: we throw, callers must treat as refusal.
 */
function closedPeriodContaining(entryDate) {
  let row;
  try {
    row = db.prepare(`
      SELECT id, name FROM financial_periods
      WHERE status = 'CLOSED' AND date(?) BETWEEN date(start_date) AND date(end_date)
      ORDER BY id DESC LIMIT 1
    `).get(entryDate);
  } catch (err) {
    throw new Error(`Financial period control unavailable — refusing to post: ${err.message}`);
  }
  return row || null;
}

/** Re-validate STORED lines (same shape as input) — the post-time gate. */
function revalidateStored(id) {
  const rows = db.prepare('SELECT account_id, debit, credit, description FROM journal_lines WHERE entry_id = ? ORDER BY id').all(id);
  return normalizeLines(rows);
}

function postEntry(id, userId = '') {
  const header = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(id);
  if (!header) throw new Error('Journal entry not found');
  if (header.status === 'posted') throw new Error('Journal entry is already posted');
  if (header.status !== 'draft') throw new Error(`Journal entry cannot be posted from status "${header.status}"`);
  const clean = revalidateStored(id); // accounts still live+active? still balanced?
  const blocker = closedPeriodContaining(header.entry_date);
  if (blocker) {
    throw new Error(`Cannot post into closed financial period "${blocker.name}"`);
  }
  const total = clean.reduce((s, l) => s + l.debit, 0);
  const eventService = require('./eventService');
  db.transaction(() => {
    db.prepare(`UPDATE journal_entries SET status = 'posted', posted_by = ?, posted_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(userId || null, id);
    eventService.emit(eventService.EVENT_TYPES.JOURNAL_POSTED, eventService.ENTITY_TYPES.JOURNAL, id, {
      userId: userId || '',
      payload: { entry_no: header.entry_no, entry_date: header.entry_date, total_cents: total, lines: clean.length },
    });
  });
  return getEntry(id);
}

/**
 * Posted financial journals are IMMUTABLE (stabilization P0#6):
 * a journal created by an accounting posting bridge carries a source
 * (source_type/source_id/source_event) — those can NEVER be unposted.
 * Corrections go through the source's own reversal flow (e.g.
 * supplierPaymentService.reversePayment posts the opposite entry), so the
 * ledger keeps both sides of the story.
 * Manual journals (no source) are bookkeeper-authored and keep the 079
 * posted->draft cycle.
 */
function unpostEntry(id, userId = '') {
  const header = db.prepare('SELECT * FROM journal_entries WHERE id = ?').get(id);
  if (!header) throw new Error('Journal entry not found');
  if (header.status !== 'posted') throw new Error('Only posted entries can be unposted');
  if (header.source_type) {
    throw new Error(`Posted sourced journals are immutable ${header.source_type}/${header.source_id} — use the posting service's reversal flow, not unpost`);
  }
  // Period lock for manual accounting (092): un-posting removes a journal
  // from a CLOSED period's books — fail closed. A closed period's truth is
  // frozen; correct it with a new dated entry once reopened, never by
  // deleting history.
  const blocker = closedPeriodContaining(header.entry_date);
  if (blocker) {
    throw new Error(`Cannot unpost into closed financial period "${blocker.name}" — reopen the period first`);
  }
  const eventService = require('./eventService');
  db.transaction(() => {
    db.prepare(`UPDATE journal_entries SET status = 'draft', posted_by = NULL, posted_at = NULL,
      updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(id);
    eventService.emit(eventService.EVENT_TYPES.JOURNAL_UNPOSTED, eventService.ENTITY_TYPES.JOURNAL, id, {
      userId: userId || '',
      payload: { entry_no: header.entry_no, entry_date: header.entry_date },
    });
  });
  return getEntry(id);
}

module.exports = {
  todayISO,
  isValidCalendarDate,
  assertIntegerCents,
  getEntry,
  listEntries,
  listEntriesFiltered,
  createEntry,
  updateDraftEntry,
  deleteDraftEntry,
  postEntry,
  unpostEntry,
  closedPeriodContaining, // exported for gate unit tests (read-only)
};
