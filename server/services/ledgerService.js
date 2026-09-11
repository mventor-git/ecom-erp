/**
 * Ledger Service — posted-only read model (mventor-ticket-080).
 *
 * The book is proved, not stored: every figure derives from POSTED journal
 * lines at query time. Drafts are invisible. No opening_balance column
 * exists yet (owner equity decision pending) — opening derives purely from
 * pre-`from` posted history. Reference-shaped math, ECOM-ERP cents.
 * Pure reads: no writes, no transactions needed.
 */

const db = require('../db');

function dateFilter(from, to) {
  const conds = [];
  const params = [];
  if (from) { conds.push('date(e.entry_date) >= date(?)'); params.push(from); }
  if (to) { conds.push('date(e.entry_date) <= date(?)'); params.push(to); }
  return { clause: conds.length ? ` AND ${conds.join(' AND ')}` : '', params };
}

function resolveAccount(idOrCode) {
  const row = db.prepare('SELECT * FROM accounts WHERE id = ? OR code = ?').get(idOrCode, idOrCode);
  if (!row) throw new Error('Account not found');
  return row;
}

/**
 * Per-account ledger: opening (pre-`from` posted net) + posted rows in
 * [from, to] ordered by date/id + running balance + period totals.
 */
function getLedger(idOrCode, { from = null, to = null } = {}) {
  const account = resolveAccount(idOrCode);
  // No `from` ⇒ opening is 0 by definition (period = everything);
  // otherwise opening = pre-`from` posted net. Never double-count.
  let openD = 0;
  let openC = 0;
  if (from) {
    const pre = db.prepare(`
      SELECT COALESCE(SUM(l.debit), 0) AS d, COALESCE(SUM(l.credit), 0) AS c
      FROM journal_lines l
      JOIN journal_entries e ON e.id = l.entry_id
      WHERE l.account_id = ? AND e.status = 'posted'
        AND date(e.entry_date) < date(?)
    `).all(account.id, from)[0];
    openD = pre.d;
    openC = pre.c;
  }
  const opening = openD - openC;

  const range = dateFilter(from, to);
  const rows = db.prepare(`
    SELECT e.id AS entry_id, e.entry_no, e.entry_date, e.description,
           l.debit, l.credit, l.description AS line_description
    FROM journal_lines l
    JOIN journal_entries e ON e.id = l.entry_id
    WHERE l.account_id = ? AND e.status = 'posted'${range.clause}
    ORDER BY date(e.entry_date) ASC, e.id ASC, l.id ASC
  `).all(account.id, ...range.params);

  let running = opening;
  let totalD = 0;
  let totalC = 0;
  const lines = rows.map(r => {
    running += r.debit - r.credit;
    totalD += r.debit;
    totalC += r.credit;
    return { ...r, running_balance: running };
  });
  return {
    account: { id: account.id, code: account.code, name: account.name, type: account.type },
    from: from || null,
    to: to || null,
    opening_balance: opening,
    lines,
    total_debit: totalD,
    total_credit: totalC,
  };
}

/** Split a signed net into debit/credit presentation columns. */
function split(net) {
  return net >= 0 ? { debit: net, credit: 0 } : { debit: 0, credit: -net };
}

/**
 * Trial balance over posted lines: per-account opening/period/final splits,
 * all-zero rows skipped. Balanced ⇔ total period debit == total credit.
 */
function getTrialBalance({ from = null, to = null } = {}) {
  const accounts = db.prepare('SELECT id, code, name, type FROM accounts ORDER BY code ASC').all();
  const range = dateFilter(from, to);
  const rows = [];
  let periodD = 0;
  let periodC = 0;
  for (const a of accounts) {
    let openD = 0;
    let openC = 0;
    if (from) {
      const pre = db.prepare(`
        SELECT COALESCE(SUM(l.debit), 0) AS d, COALESCE(SUM(l.credit), 0) AS c
        FROM journal_lines l
        JOIN journal_entries e ON e.id = l.entry_id
        WHERE l.account_id = ? AND e.status = 'posted'
          AND date(e.entry_date) < date(?)
      `).all(a.id, from)[0];
      openD = pre.d;
      openC = pre.c;
    }
    const per = db.prepare(`
      SELECT COALESCE(SUM(l.debit), 0) AS d, COALESCE(SUM(l.credit), 0) AS c
      FROM journal_lines l
      JOIN journal_entries e ON e.id = l.entry_id
      WHERE l.account_id = ? AND e.status = 'posted'${range.clause}
    `).all(a.id, ...range.params)[0];
    const openNet = openD - openC;
    const finalNet = openNet + (per.d - per.c);
    if (openNet === 0 && per.d === 0 && per.c === 0) continue;
    const o = split(openNet);
    const f = split(finalNet);
    periodD += per.d;
    periodC += per.c;
    rows.push({
      account_id: a.id, code: a.code, name: a.name, type: a.type,
      opening_debit: o.debit, opening_credit: o.credit,
      period_debit: per.d, period_credit: per.c,
      final_debit: f.debit, final_credit: f.credit,
    });
  }
  return {
    from: from || null,
    to: to || null,
    rows,
    total_period_debit: periodD,
    total_period_credit: periodC,
    balanced: periodD === periodC,
  };
}

module.exports = { getLedger, getTrialBalance };
