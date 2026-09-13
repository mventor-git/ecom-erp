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

/**
 * Profit & Loss — mventor-ticket-092. STRICTLY journal-derived:
 * revenue = net credit, expenses = net debit over POSTED lines in range,
 * grouped by account type. NEVER reads orders, statuses, or current product
 * cost — if an event is not in the books it is not in this statement.
 */
function getProfitAndLoss({ from = null, to = null } = {}) {
  const tb = getTrialBalance({ from, to });
  const money = (r) => ({ account_id: r.account_id, code: r.code, name: r.name, net_cents: 0 });
  const revenue = [];
  const expenses = [];
  let totalRevenue = 0;
  let totalExpense = 0;
  for (const r of tb.rows) {
    if (r.type === 'revenue') {
      const net = r.period_credit - r.period_debit; // normal-side revenue activity (reversals reduce it)
      if (net === 0 && r.period_debit === 0 && r.period_credit === 0) continue;
      revenue.push({ ...money(r), net_cents: net });
      totalRevenue += net;
    } else if (r.type === 'expense') {
      const net = r.period_debit - r.period_credit;
      if (net === 0 && r.period_debit === 0 && r.period_credit === 0) continue;
      expenses.push({ ...money(r), net_cents: net });
      totalExpense += net;
    }
  }
  return {
    from: tb.from,
    to: tb.to,
    basis: 'POSTED journal lines only (account type revenue/expense); order status and product cost are NOT inputs',
    revenue,
    expenses,
    total_revenue_cents: totalRevenue,
    total_expense_cents: totalExpense,
    net_income_cents: totalRevenue - totalExpense,
    ledger_balanced: tb.balanced,
  };
}

/**
 * Balance Sheet — mventor-ticket-092, TRUTHFUL scope: a statement of the
 * POSTED LEDGER as of a date. Every posted journal balances (service rule),
 * so Σ(debit-side nets) == Σ(credit-side nets) identically — the check here
 * proves the books, it does not bless their coverage: physical-vs-ledger
 * inventory truth is ticket 093's reconciliation, and coverage caveats are
 * surfaced verbatim. No retained-earnings roll-forward exists (the model has
 * no closing process): current earnings DERIVE from journal nets instead.
 */
function getBalanceSheet({ as_of = null } = {}) {
  if (as_of && !require('./journalService').isValidCalendarDate(as_of)) {
    throw new Error(`Invalid as_of "${as_of}" — expected real calendar date YYYY-MM-DD`);
  }
  // final_* columns of a TB run with only `to` = lifetime posted position as of date
  const tb = getTrialBalance({ from: null, to: as_of || null });
  const net = (r) => (r.final_debit - r.final_credit); // debit-normal positive
  const bucket = { asset: [], liability: [], equity: [], other: [] };
  let earnings = 0;
  for (const r of tb.rows) {
    if (r.type === 'revenue') { earnings += (r.final_credit - r.final_debit); continue; }
    if (r.type === 'expense') { earnings -= (r.final_debit - r.final_credit); continue; }
    const key = (r.type === 'liability' || r.type === 'equity' || r.type === 'asset') ? r.type : 'other';
    const signed = key === 'liability' || key === 'equity' ? -net(r) : net(r); // normal-side positive
    if (signed === 0) continue;
    bucket[key].push({ account_id: r.account_id, code: r.code, name: r.name, balance_cents: signed });
  }
  const sum = (arr) => arr.reduce((s, x) => s + x.balance_cents, 0);
  const assets = sum(bucket.asset);
  const liabilities = sum(bucket.liability);
  const equityAccounts = sum(bucket.equity);
  const other = sum(bucket.other); // 'other'-type accounts: surfaced as unclassified, never hidden
  const checkDiff = (assets + other) - (liabilities + equityAccounts + earnings);
  return {
    as_of: as_of || null,
    basis: 'POSTED journal balances per account as of date (no valuations, no closing entries, nothing carried from operational state)',
    assets: bucket.asset,
    total_assets_cents: assets,
    liabilities: bucket.liability,
    total_liabilities_cents: liabilities,
    equity: bucket.equity,
    total_equity_cents: equityAccounts,
    current_earnings_cents: earnings,
    unclassified_other: bucket.other,
    total_other_cents: other,
    balanced: checkDiff === 0,
    balance_check: { assets_plus_other_cents: assets + other, liabilities_equity_earnings_cents: liabilities + equityAccounts + earnings, difference_cents: checkDiff },
    limitations: [
      'No retained-earnings closing (model carries no closing process); current earnings derive directly from posted revenue/expense nets.',
      'Ledger balances are only as complete as what is BOOKED — inventory adjustments/returns/transfers are not journaled yet (physical-vs-ledger truth is the 093 reconciliation), and legacy unbooked settlements appear only via the 091 revenue reconciliation.',
      'No revaluation: all amounts are the cents posted at transaction time.',
    ],
  };
}

module.exports = { getLedger, getTrialBalance, getProfitAndLoss, getBalanceSheet };
