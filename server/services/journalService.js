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
  return new Date().toISOString().slice(0, 10);
}

function assertEntryDate(v) {
  const s = String(v || '').trim() || todayISO();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`Invalid entry_date "${v}" — expected YYYY-MM-DD`);
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
    const debit = Math.round(Number(raw.debit) || 0);
    const credit = Math.round(Number(raw.credit) || 0);
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

function createEntry({ entry_date, description = '', lines }) {
  const date = assertEntryDate(entry_date);
  const clean = normalizeLines(lines);
  let entryId = null;
  db.transaction(() => {
    const { document_number } = documentNumberService.generate('JE');
    const res = db.prepare(`
      INSERT INTO journal_entries (entry_no, entry_date, description, status)
      VALUES (?, ?, ?, 'draft')
    `).run(document_number, date, String(description || ''));
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

function updateDraftEntry(id, { entry_date, description, lines }) {
  const header = assertDraft(id);
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
  const header = assertDraft(id);
  db.transaction(() => {
    db.prepare('DELETE FROM journal_lines WHERE entry_id = ?').run(id);
    db.prepare('DELETE FROM journal_entries WHERE id = ?').run(id);
  });
  return { success: true, deleted: header.entry_no };
}

module.exports = {
  getEntry,
  listEntries,
  createEntry,
  updateDraftEntry,
  deleteDraftEntry,
};
