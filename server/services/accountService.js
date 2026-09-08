/**
 * Chart of Accounts Service — neutral skeleton (mventor-ticket-075).
 *
 * Foundation only: CRUD + guards over the `accounts` table. No journals,
 * no postings, no seeds, no routes/UI yet (see gap map + Ticket C/D).
 * Guard style mirrors priceListService (pre-check throws, UNIQUE backstop).
 * Delete-if-referenced probes `journal_lines` existence so the guard
 * activates the moment Ticket C lands — no code change needed then.
 */

const db = require('../db');

// Universal accounting types — classification backbone for future statements,
// not business policy. Codes stay admin-assigned and verbatim.
const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense', 'other'];

function cleanCode(code) {
  return String(code || '').trim();
}

function assertValidType(type) {
  const t = String(type || '').trim().toLowerCase();
  if (!ACCOUNT_TYPES.includes(t)) {
    throw new Error(`Invalid account type "${type}" — expected one of: ${ACCOUNT_TYPES.join(', ')}`);
  }
  return t;
}

function listAccounts(includeInactive = false) {
  return db.prepare(`
    SELECT * FROM accounts
    WHERE (is_active = 1 OR ? = 1)
    ORDER BY code ASC
  `).all(includeInactive ? 1 : 0);
}

function getAccount(idOrCode) {
  return db.prepare('SELECT * FROM accounts WHERE id = ? OR code = ?').get(idOrCode, idOrCode) || null;
}

function createAccount({ code, name, type, description = '' }) {
  const clean = cleanCode(code);
  if (!clean) throw new Error('Account code is required');
  if (!name || !String(name).trim()) throw new Error('Account name is required');
  const t = assertValidType(type);
  if (db.prepare('SELECT id FROM accounts WHERE code = ?').get(clean)) {
    throw new Error(`Account "${clean}" already exists`);
  }
  const res = db.prepare(`
    INSERT INTO accounts (code, name, type, description, is_active)
    VALUES (?, ?, ?, ?, 1)
  `).run(clean, String(name).trim(), t, String(description || ''));
  return db.prepare('SELECT * FROM accounts WHERE id = ?').get(res.lastInsertRowid);
}

function updateAccount(id, updates = {}) {
  const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  if (!existing) throw new Error('Account not found');
  const code = updates.code !== undefined ? cleanCode(updates.code) : existing.code;
  if (!code) throw new Error('Account code is required');
  const clash = db.prepare('SELECT id FROM accounts WHERE code = ? AND id != ?').get(code, id);
  if (clash) throw new Error(`Account "${code}" already exists`);
  const name = updates.name !== undefined ? String(updates.name).trim() : existing.name;
  if (!name) throw new Error('Account name is required');
  const type = updates.type !== undefined ? assertValidType(updates.type) : existing.type;
  const description = updates.description !== undefined ? String(updates.description) : existing.description;
  const activeInput = updates.is_active !== undefined ? updates.is_active : updates.isActive;
  const isActive = activeInput !== undefined ? (activeInput ? 1 : 0) : existing.is_active;
  db.prepare(`
    UPDATE accounts SET code = ?, name = ?, type = ?, description = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(code, name, type, description, isActive, id);
  return db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
}

/** Lines referencing this account — activates when Ticket C creates the table. */
function countReferences(accountId) {
  try {
    const hasTable = db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'journal_lines'"
    ).get();
    if (!hasTable) return 0;
    return Number(db.prepare('SELECT COUNT(*) AS n FROM journal_lines WHERE account_id = ?').get(accountId)?.n || 0);
  } catch {
    return 0;
  }
}

function deleteAccount(id) {
  const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
  if (!existing) throw new Error('Account not found');
  const refs = countReferences(id);
  if (refs > 0) {
    throw new Error(`Cannot delete account "${existing.code}": ${refs} journal line(s) still reference it`);
  }
  db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
  return { success: true, deleted: existing.code };
}

module.exports = {
  ACCOUNT_TYPES,
  listAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  countReferences,
};
