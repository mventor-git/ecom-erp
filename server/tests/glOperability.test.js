/**
 * mventor-ticket-092 — GL operability.
 *
 * Proves the OPERATOR surface adds capability without touching the model:
 * CoA CRUD with reference protection, manual journal lifecycle (draft→post→
 * manual-unpost cycle) with every accounting invariant enforced server-side
 * (balance, integer cents, inactive accounts, fail-closed periods), sourced
 * journals immutable through this whole surface, journal-derived Trial
 * Balance / P&L / Balance Sheet (operational state is NOT an input), RBAC
 * on every new endpoint, and a complete audit trail with actors.
 */
const db = require('../db');
const bcrypt = require('bcryptjs');
const express = require('express');
const accounting = require('../services/accountingService');
const journalService = require('../services/journalService');
const accountService = require('../services/accountService');
const ledgerService = require('../services/ledgerService');
const wos = require('../services/warehouseOrderService');

let noneUserId = null;
let noneRoleId = null;
const accountIds = [];
const entryIds = [];
const periodIds = [];
const orders092 = [];
const customers092 = [];

function jestAccount(code, name, type, active = 1) {
  const acct = accountService.createAccount({ code, name, type });
  accountIds.push(acct.id);
  if (!active) accountService.updateAccount(acct.id, { is_active: 0 });
  return accountService.getAccount(acct.id);
}

function closeTodayPeriod(name) {
  const p = wos.createFinancialPeriod({ name, months: 1 });
  wos.closeFinancialPeriod(p.id);
  periodIds.push(p.id);
  return p;
}
function dropPeriods() {
  for (const id of periodIds.splice(0)) {
    try { db.prepare('DELETE FROM financial_periods WHERE id = ?').run(id); } catch {}
  }
}

let cashId, revId, expId, liabId;

beforeAll(async () => {
  await db.initPromise;
  cashId = jestAccount('jest092-1000', 'Jest092 Cash', 'asset').id;
  revId = jestAccount('jest092-4000', 'Jest092 Revenue', 'revenue').id;
  expId = jestAccount('jest092-5000', 'Jest092 Expense', 'expense').id;
  liabId = jestAccount('jest092-2100', 'Jest092 Payable', 'liability').id;
  noneRoleId = db.prepare('INSERT INTO roles (name) VALUES (?)').run('jest092_none').lastInsertRowid;
  noneUserId = db.prepare('INSERT INTO users (email, name, password_hash, role_id, is_active) VALUES (?, ?, ?, ?, 1)')
    .run('none@jest092.test', 'No Perm 092', bcrypt.hashSync('x', 10), noneRoleId).lastInsertRowid;
});

function bal(d, c) {
  return [
    { account_id: cashId, debit: d, credit: 0, description: 'jest092 dr' },
    { account_id: revId, debit: 0, credit: c, description: 'jest092 cr' },
  ];
}

afterEach(() => {
  dropPeriods();
});

afterAll(() => {
  dropPeriods();
  for (const eid of entryIds.splice(0)) {
    db.prepare('DELETE FROM journal_lines WHERE entry_id = ?').run(eid);
    db.prepare('DELETE FROM journal_entries WHERE id = ?').run(eid);
  }
  db.prepare("DELETE FROM journal_lines WHERE entry_id IN (SELECT id FROM journal_entries WHERE description LIKE 'jest092%')").run();
  db.prepare("DELETE FROM journal_entries WHERE description LIKE 'jest092%'").run();
  for (const oid of orders092.splice(0)) { try { db.prepare('DELETE FROM order_items WHERE order_id = ?').run(oid); db.prepare('DELETE FROM orders WHERE id = ?').run(oid); } catch {} }
  for (const cid of customers092.splice(0)) { try { db.prepare('DELETE FROM customers WHERE id = ?').run(cid); } catch {} }
  for (const aid of accountIds.splice(0)) {
    try { db.prepare('DELETE FROM events WHERE entity_type = ? AND entity_id = ?').run('account', aid); } catch {}
    try { db.prepare('DELETE FROM accounts WHERE id = ?').run(aid); } catch {}
  }
  db.prepare("DELETE FROM events WHERE entity_type = 'journal' AND entity_id NOT IN (SELECT id FROM journal_entries)").run();
  db.prepare("DELETE FROM events WHERE entity_type = 'financial_period' AND entity_id NOT IN (SELECT id FROM financial_periods)").run();
  try {
    db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(noneUserId);
    db.prepare('DELETE FROM users WHERE id = ?').run(noneUserId);
    if (noneRoleId) db.prepare('DELETE FROM roles WHERE id = ?').run(noneRoleId);
  } catch {}
  db.saveDb();
});

/* ──────────────────────────── Chart of Accounts ─────────────────────────── */

describe('CoA operational surface (accountService reuse + audit)', () => {
  test('operator create/update audited with actor; duplicate code + bad type refused', () => {
    const acct = accounting.createAccount({ code: 'jest092-6000', name: 'Jest092 Freel', type: 'expense' }, { userId: 'boss092' });
    accountIds.push(acct.id);
    expect(acct.is_active).toBe(1);
    expect(() => accounting.createAccount({ code: 'jest092-6000', name: 'dup', type: 'expense' })).toThrow(/already exists/);
    expect(() => accounting.createAccount({ code: 'jest092-6001', name: 'bad', type: 'volcano' })).toThrow(/Invalid account type/);
    const updated = accounting.updateAccount(acct.id, { name: 'Jest092 Renamed', is_active: false }, { userId: 'boss092' });
    expect(updated.name).toBe('Jest092 Renamed');
    expect(updated.is_active).toBe(0);
    const evs = db.prepare("SELECT event_type, user_id FROM events WHERE entity_type = 'account' AND entity_id = ? ORDER BY id").all(acct.id);
    expect(evs.map(e => e.event_type)).toEqual(expect.arrayContaining(['account_created', 'account_updated']));
    expect(evs.every(e => e.user_id === 'boss092')).toBe(true);
  });

  test('referenced account cannot be deleted; unreferenced can', () => {
    const draft = accounting.createManualEntry({ description: 'jest092 aref', lines: bal(500, 500) }, { userId: 'b' });
    entryIds.push(draft.id);
    expect(() => accounting.deleteAccount(cashId)).toThrow(/still reference/);
    const free = accounting.createAccount({ code: 'jest092-9999', name: 'Jest092 Free', type: 'other' });
    accountIds.push(free.id);
    expect(accounting.deleteAccount(free.id).deleted).toBe('jest092-9999');
    expect(accountService.getAccount(free.id)).toBe(null);
  });
});

/* ───────────────────────── Manual journal workflow ──────────────────────── */

describe('manual JE lifecycle — every invariant enforced by the model', () => {
  test('draft → post → shows in TB; draft invisible until posted; posted_by recorded', () => {
    const before = ledgerService.getTrialBalance({});
    const draft = accounting.createManualEntry({ description: 'jest092 lifecycle', lines: bal(12000, 12000) }, { userId: 'bookkeeper092' });
    entryIds.push(draft.id);
    expect(draft.status).toBe('draft');
    expect(draft.source_type).toBe(null);
    expect(ledgerService.getTrialBalance({}).total_period_debit).toBe(before.total_period_debit);
    const posted = accounting.postManualEntry(draft.id, { userId: 'bookkeeper092' });
    expect(posted.status).toBe('posted');
    expect(posted.posted_by).toBe('bookkeeper092');
    expect(ledgerService.getTrialBalance({}).total_period_debit).toBe(before.total_period_debit + 12000);
    // manual unpost cycle (079 behavior kept) — back to draft, audited
    const back = accounting.unpostManualEntry(draft.id, { userId: 'bookkeeper092' });
    expect(back.status).toBe('draft');
    const evs = db.prepare("SELECT event_type FROM events WHERE entity_type = 'journal' AND entity_id = ? ORDER BY id").all(draft.id).map(e => e.event_type);
    expect(evs).toEqual(expect.arrayContaining(['journal_entry_created', 'journal_posted', 'journal_unposted']));
    expect(evs[evs.length - 1]).toBe('journal_unposted');
  });

  test('unbalanced / fractional cents / single-line / negative journals are all refused', () => {
    expect(() => accounting.createManualEntry({ description: 'jest092 unbal', lines: [{ account_id: cashId, debit: 900, credit: 0 }, { account_id: revId, debit: 0, credit: 800 }] })).toThrow(/Unbalanced/);
    expect(() => accounting.createManualEntry({ description: 'jest092 frac', lines: [{ account_id: cashId, debit: 100.5, credit: 0 }, { account_id: revId, debit: 0, credit: 100.5 }] })).toThrow(/integer number of cents/);
    expect(() => accounting.createManualEntry({ description: 'jest092 one', lines: [{ account_id: cashId, debit: 500, credit: 0 }] })).toThrow(/at least 2/);
    expect(() => accounting.createManualEntry({ description: 'jest092 neg', lines: [{ account_id: cashId, debit: -5, credit: 0 }, { account_id: revId, debit: 0, credit: -5 }] })).toThrow(/negative/);
    // string-integers are legitimate cents and accepted
    const ok = accounting.createManualEntry({ description: 'jest092 str', lines: [{ account_id: cashId, debit: '700', credit: 0 }, { account_id: revId, debit: 0, credit: '700' }] });
    entryIds.push(ok.id);
    expect(ok.lines.reduce((s, l) => s + l.debit, 0)).toBe(700);
  });

  test('inactive-account rule: enforced at authoring AND re-enforced at posting', () => {
    const draft = accounting.createManualEntry({ description: 'jest092 inact', lines: [
      { account_id: cashId, debit: 400, credit: 0 }, { account_id: expId, debit: 0, credit: 400 },
    ] });
    entryIds.push(draft.id);
    accountService.updateAccount(expId, { is_active: 0 });
    try {
      expect(() => accounting.postManualEntry(draft.id, { userId: 'b' })).toThrow(/inactive/i);
      expect(db.prepare('SELECT status FROM journal_entries WHERE id = ?').get(draft.id).status).toBe('draft');
      expect(() => accounting.createManualEntry({ description: 'jest092 inact2', lines: [
        { account_id: cashId, debit: 400, credit: 0 }, { account_id: expId, debit: 0, credit: 400 },
      ] })).toThrow(/inactive/i);
    } finally {
      accountService.updateAccount(expId, { is_active: 1 });
    }
  });

  test('closed period fails closed on manual post; reopen recovers; drafts may exist', () => {
    const draft = accounting.createManualEntry({ description: 'jest092 perlock', lines: bal(800, 800) });
    entryIds.push(draft.id);
    closeTodayPeriod('jest092-closed');
    expect(() => accounting.postManualEntry(draft.id, { userId: 'b' })).toThrow(/closed financial period "jest092-closed"/);
    expect(db.prepare('SELECT status FROM journal_entries WHERE id = ?').get(draft.id).status).toBe('draft');
    dropPeriods();
    expect(accounting.postManualEntry(draft.id, { userId: 'b' }).status).toBe('posted');
  });

  test('unpost is period-locked too: a posted journal inside a CLOSED period cannot be unposted', () => {
    const draft = accounting.createManualEntry({ description: 'jest092 unpostlock', lines: bal(600, 600) });
    entryIds.push(draft.id);
    accounting.postManualEntry(draft.id, { userId: 'b' });
    closeTodayPeriod('jest092-revlock');
    expect(() => accounting.unpostManualEntry(draft.id, { userId: 'b' })).toThrow(/closed financial period/);
    expect(db.prepare('SELECT status FROM journal_entries WHERE id = ?').get(draft.id).status).toBe('posted');
    dropPeriods();
    expect(accounting.unpostManualEntry(draft.id, { userId: 'b' }).status).toBe('draft');
  });

  test('SOURCED journals are fully machine-owned across this surface (no unpost, no edit, no delete)', () => {
    const sourced = journalService.createEntry({ description: 'jest092 sourced', lines: bal(700, 700), source: { type: 'jest092', id: 424242, event: 'probe' } });
    entryIds.push(sourced.id);
    journalService.postEntry(sourced.id, 'bridge');
    expect(() => accounting.unpostManualEntry(sourced.id, { userId: 'b' })).toThrow(/immutable/i);
    expect(() => accounting.updateManualEntry(sourced.id, { lines: bal(1, 1) })).toThrow(/source flow/);
    expect(() => accounting.deleteManualDraft(sourced.id, { userId: 'b' })).toThrow(/source flow/);
    expect(db.prepare('SELECT status FROM journal_entries WHERE id = ?').get(sourced.id).status).toBe('posted');
    // posted (manual) delete refused; draft delete allowed
    const manual = journalService.getEntry(entryIds[entryIds.length - 2]);
    void manual;
    const draft = accounting.createManualEntry({ description: 'jest092 deleteme', lines: bal(50, 50) });
    accounting.updateManualEntry(draft.id, { description: 'jest092 deleteme edited', lines: bal(60, 60) });
    expect(accounting.deleteManualDraft(draft.id, { userId: 'b' }).deleted).toMatch(/^JE-/);
    expect(journalService.getEntry(draft.id)).toBe(null);
    const postedManual = accounting.createManualEntry({ description: 'jest092 postedkeep', lines: bal(70, 70) });
    entryIds.push(postedManual.id);
    accounting.postManualEntry(postedManual.id, { userId: 'b' });
    expect(() => accounting.deleteManualDraft(postedManual.id, { userId: 'b' })).toThrow(/Only draft/);
  });

  test('operator-created journals can NEVER carry a source (injection attempt)', () => {
    const craft = accounting.createManualEntry({ description: 'jest092 inject', lines: bal(30, 30), source: { type: 'order', id: 99 } }, { userId: 'sneaky' });
    entryIds.push(craft.id);
    expect(craft.source_type).toBe(null);
    expect(craft.source_id).toBe(null);
  });
});

/* ────────────────────────────── Statements ──────────────────────────────── */

describe('journal-derived statements — the books, proved not stored', () => {
  test('trial balance: drafts invisible, totals stay debit==credit', () => {
    const tb1 = ledgerService.getTrialBalance({});
    expect(tb1.balanced).toBe(true);
    expect(tb1.total_period_debit).toBe(tb1.total_period_credit);
    const d = accounting.createManualEntry({ description: 'jest092 tb-invis', lines: bal(99999900, 99999900) });
    entryIds.push(d.id);
    const tb2 = ledgerService.getTrialBalance({});
    expect(tb2.total_period_debit).toBe(tb1.total_period_debit); // draft changed nothing
    accounting.postManualEntry(d.id, { userId: 'b' });
    const tb3 = ledgerService.getTrialBalance({});
    expect(tb3.balanced).toBe(true);
    expect(tb3.total_period_debit).toBe(tb1.total_period_debit + 99999900);
  });

  test('P&L derives ONLY from journals: orders and product cost changes do not move it', () => {
    const pl0 = accounting.profitAndLoss({});
    // change the operational world: product costs and a fake 'paid' order
    const cat = db.prepare('SELECT id FROM categories ORDER BY id LIMIT 1').get();
    const pid = db.prepare("INSERT INTO products (name, price, cost_price, category_id, active, stock) VALUES ('jest092 pl decoy', 1000, 10, ?, 1, 5)").run(cat.id).lastInsertRowid;
    const cid = db.prepare("INSERT INTO customers (email, name, google_id) VALUES ('pl092@t.local','P',NULL)").run().lastInsertRowid;
    customers092.push(cid);
    const oid = db.prepare("INSERT INTO orders (customer_id, total, status, items, payment_method, payment_status) VALUES (?, 77000000, 'paid', '[]', 'kashier', 'verified')")
      .run(cid).lastInsertRowid;
    orders092.push(oid);
    const pl1 = accounting.profitAndLoss({});
    expect(pl1.total_revenue_cents).toBe(pl0.total_revenue_cents);
    expect(pl1.net_income_cents).toBe(pl0.net_income_cents);
    db.prepare('DELETE FROM products WHERE id = ?').run(pid);
    // now book it in journals: revenue + expense entries move P&L by exactly the booked cents
    const rev = accounting.createManualEntry({ description: 'jest092 pl rev', entry_date: journalService.todayISO(), lines: [
      { account_id: cashId, debit: 25000, credit: 0 }, { account_id: revId, debit: 0, credit: 25000 },
    ] });
    entryIds.push(rev.id); accounting.postManualEntry(rev.id, { userId: 'b' });
    const exp = accounting.createManualEntry({ description: 'jest092 pl exp', lines: [
      { account_id: expId, debit: 9000, credit: 0 }, { account_id: cashId, debit: 0, credit: 9000 },
    ] });
    entryIds.push(exp.id); accounting.postManualEntry(exp.id, { userId: 'b' });
    const pl2 = accounting.profitAndLoss({});
    expect(pl2.total_revenue_cents - pl1.total_revenue_cents).toBe(25000);
    expect(pl2.total_expense_cents - pl1.total_expense_cents).toBe(9000);
    expect(pl2.net_income_cents - pl1.net_income_cents).toBe(16000);
    expect(Number.isInteger(pl2.net_income_cents)).toBe(true);
    expect(pl2.basis).toMatch(/POSTED journal/i);
  });

  test('P&L respects the date window (backdated postings excluded)', () => {
    const y2000 = accounting.createManualEntry({ description: 'jest092 pl old', entry_date: '2000-01-05', lines: bal(500000, 500000) });
    entryIds.push(y2000.id);
    accounting.postManualEntry(y2000.id, { userId: 'b' });
    const inRange = accounting.profitAndLoss({ from: '2000-01-01', to: '2000-12-31' });
    const outRange = accounting.profitAndLoss({ from: '2001-01-01', to: '2001-12-31' });
    expect(inRange.total_revenue_cents).toBeGreaterThanOrEqual(500000);
    expect(outRange.total_revenue_cents).toBe(0);
    expect(outRange.net_income_cents).toBe(0);
  });

  test('balance sheet: identity holds over posted journals; coverage limitations surfaced verbatim', () => {
    const bs = accounting.balanceSheet({});
    expect(bs.balanced).toBe(true);
    expect(bs.balance_check.difference_cents).toBe(0);
    expect(bs.total_assets_cents + bs.total_other_cents)
      .toBe(bs.total_liabilities_cents + bs.total_equity_cents + bs.current_earnings_cents);
    expect(Array.isArray(bs.limitations) && bs.limitations.length >= 2).toBe(true);
    expect(bs.basis).toMatch(/POSTED journal/i);
    expect(() => accounting.balanceSheet({ as_of: '2026-02-31' })).toThrow(/Invalid as_of/);
  });

  test('balance-sheet classification nets on the normal side and never drops an account', () => {
    // an ISOLATED asset account carrying net credit must appear as a NEGATIVE
    // asset (debit-normal sign convention), never vanish from the statement
    const special = accounting.createAccount({ code: 'jest092-1100', name: 'Jest092 Contra Asset', type: 'asset' }, { userId: 'b' });
    accountIds.push(special.id);
    const odd = accounting.createManualEntry({ description: 'jest092 bs odd', entry_date: '2004-06-01', lines: [
      { account_id: liabId, debit: 4000, credit: 0 }, { account_id: special.id, debit: 0, credit: 4000 },
    ] });
    entryIds.push(odd.id);
    accounting.postManualEntry(odd.id, { userId: 'b' });
    const bs = accounting.balanceSheet({ as_of: '2004-12-31' });
    const line = bs.assets.find((a) => a.account_id === special.id);
    expect(line).toBeTruthy();
    expect(line.balance_cents).toBe(-4000);
    expect(bs.balanced).toBe(true);
  });
});

/* ─────────────────────────── Journal list & detail ──────────────────────── */

describe('journal browsing — filters over the one real model', () => {
  test('source/status/account/date/text filters + pagination metadata', () => {
    const all = accounting.listJournals({ limit: 5 });
    expect(all.rows.length).toBeLessThanOrEqual(5);
    expect(all.total).toBeGreaterThan(all.rows.length - 1);
    expect(all.rows.every(r => typeof r.total_cents === 'number')).toBe(true);
    const manual = accounting.listJournals({ source: 'manual', status: 'draft', limit: 200 });
    expect(manual.rows.every(r => r.source_type === null && r.status === 'draft')).toBe(true);
    byAccount();
    function byAccount() {
      const byAcct = accounting.listJournals({ account: 'jest092-4000', limit: 200 });
      expect(byAcct.rows.length).toBeGreaterThan(0);
      expect(byAcct.rows.every(r => journalService.getEntry(r.id).lines.some(l => l.account_code === 'jest092-4000'))).toBe(true);
    }
    backdates();
    function backdates() {
      expect(() => accounting.listJournals({ from: 'not-a-date' })).toThrow(/Invalid from/);
      expect(() => accounting.listJournals({ account: 'zzz-missing' })).toThrow(/Unknown account filter/);
      const q = accounting.listJournals({ q: 'jest092 lifecycle', limit: 10 });
      expect(q.rows.length).toBe(1);
      const page2 = accounting.listJournals({ limit: 3, offset: 3 });
      expect(page2.rows[0].id).not.toBe(all.rows[0].id);
    }
  });
});

/* ───────────────────── HTTP surface: routing, RBAC, audit ───────────────── */

describe('HTTP accounting surface (mount + RBAC + actor audit)', () => {
  async function callAs(session, method, path, body) {
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.session = session; next(); });
    app.use('/api/admin/accounting', require('../routes/accounting'));
    const srv = app.listen(0);
    await new Promise((r) => srv.once('listening', r));
    try {
      const res = await fetch(`http://localhost:${srv.address().port}/api/admin/accounting${path}`, {
        method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
      });
      let json = null; try { json = await res.json(); } catch {}
      return { status: res.status, body: json };
    } finally { srv.closeAllConnections?.(); srv.close(); }
  }
  const ADMIN = { isAdmin: true, username: 'env-admin-092' };

  test('no-session requests are refused on every verb', async () => {
    for (const spec of [['GET', '/journals'], ['GET', '/accounts'], ['GET', '/trial-balance'], ['POST', '/journals', { lines: [] }]]) {
      const res = await accountingCall(...spec);
      expect([401, 403]).toContain(res.status);
    }
    async function accountingCall(method, path, body) {
      const app = express();
      app.use(express.json());
      app.use('/api/admin/accounting', require('../routes/accounting'));
      const srv = app.listen(0);
      await new Promise((r) => srv.once('listening', r));
      try {
        const res = await fetch(`http://localhost:${srv.address().port}/api/admin/accounting${path}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
        return { status: res.status };
      } finally { srv.closeAllConnections?.(); srv.close(); }
    }
  }, 20000);

  test('zero-permission user gets 403 on ALL accounting endpoints (read and write)', async () => {
    const no = { isAdmin: true, userId: noneUserId };
    const checks = [
      ['GET', '/accounts'], ['POST', '/accounts', { code: 'x', name: 'y', type: 'asset' }],
      ['GET', '/journals'], ['POST', '/journals', { lines: [] }],
      ['GET', '/trial-balance'], ['GET', '/profit-loss'], ['GET', '/balance-sheet'],
      ['GET', `/accounts/${cashId}/ledger`],
    ];
    for (const [m, p, b] of checks) {
      const r = await callAs(no, m, p, b);
      expect(r.status).toBe(403);
    }
  }, 25000);

  test('env-admin: full manual lifecycle over HTTP with actor recording', async () => {
    const created = await callAs(ADMIN, 'POST', '/journals', { description: 'jest092 http je', lines: [
      { account_id: cashId, debit: 3300, credit: 0 }, { account_id: revId, debit: 0, credit: 3300 },
    ] });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('draft');
    entryIds.push(created.body.data.id);
    const badPost = await callAs(ADMIN, 'POST', '/journals', { description: 'jest092 http bad', lines: [
      { account_id: cashId, debit: 3301, credit: 0 }, { account_id: revId, debit: 0, credit: 3300 },
    ] });
    expect(badPost.status).toBe(400);
    expect(badPost.body.error).toMatch(/Unbalanced/);
    const posted = await callAs(ADMIN, 'POST', `/journals/${created.body.data.id}/post`, {});
    expect(posted.status).toBe(200);
    expect(posted.body.data.status).toBe('posted');
    expect(posted.body.data.posted_by).toBe('env-admin-092');
    const detail = await callAs(ADMIN, 'GET', `/journals/${created.body.data.id}`);
    expect(detail.body.data.lines.map(l => l.account_code)).toEqual(expect.arrayContaining(['jest092-1000', 'jest092-4000']));
    const list = await callAs(ADMIN, 'GET', '/journals?source=manual&q=jest092%20http%20je');
    expect(list.body.data.total).toBe(1);
    const unpost = await callAs(ADMIN, 'POST', `/journals/${created.body.data.id}/unpost`, {});
    expect(unpost.body.data.status).toBe('draft');
    const evs = db.prepare("SELECT event_type, user_id FROM events WHERE entity_type='journal' AND entity_id = ? ORDER BY id").all(created.body.data.id).map(e => `${e.event_type}:${e.user_id}`);
    expect(evs).toEqual(expect.arrayContaining([
      'journal_entry_created:env-admin-092', 'journal_posted:env-admin-092', 'journal_unposted:env-admin-092',
    ]));
  }, 25000);

  test('route-level period lock: post refused (400) while closed, succeeds after reopen', async () => {
    const draft = accounting.createManualEntry({ description: 'jest092 http period', lines: bal(2100, 2100) }, { userId: 'x' });
    entryIds.push(draft.id);
    closeTodayPeriod('jest092-httplock');
    const refused = await callAs(ADMIN, 'POST', `/journals/${draft.id}/post`, {});
    expect(refused.status).toBe(400);
    expect(refused.body.error).toMatch(/closed financial period/);
    dropPeriods();
    const ok = await callAs(ADMIN, 'POST', `/journals/${draft.id}/post`, {});
    expect(ok.body.data.status).toBe('posted');
  }, 25000);

  test('404 vs 400 mapping: missing journal/account answered honestly', async () => {
    const j = await callAs(ADMIN, 'GET', '/journals/999999999');
    expect(j.status).toBe(404);
    const a = await callAs(ADMIN, 'GET', '/accounts/999999999');
    expect(a.status).toBe(404);
    const del = await callAs(ADMIN, 'DELETE', `/accounts/${cashId}`);
    expect(del.status).toBe(400); // referenced — refused, not 500
    expect(del.body.error).toMatch(/still reference/);
  }, 20000);

  test('statements over HTTP carry the journal-only basis + integers', async () => {
    const tb = await callAs(ADMIN, 'GET', '/trial-balance');
    expect(tb.status).toBe(200);
    expect(tb.body.data.balanced).toBe(true);
    const pl = await callAs(ADMIN, 'GET', '/profit-loss');
    expect(Number.isInteger(pl.body.data.net_income_cents)).toBe(true);
    const bs = await callAs(ADMIN, 'GET', '/balance-sheet?as_of=2099-12-31');
    expect(bs.body.data.balanced).toBe(true);
    const bad = await callAs(ADMIN, 'GET', '/profit-loss?from=nope');
    expect(bad.status).toBe(400);
  }, 20000);
});
