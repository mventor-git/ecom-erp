/**
 * Ledger / trial balance proofs — mventor-ticket-080.
 * Fixture book: E1 cash+10000/revenue−10000 (Jan), E2 expense+3000/cash−3000
 * (Jun), E3 draft (invisible). Entry dates in 2000 dodge ambient periods.
 */
const db = require('../db');
const accountService = require('../services/accountService');
const journalService = require('../services/journalService');
const ledgerService = require('../services/ledgerService');

let cashId = null;
let revId = null;
let expId = null;
const entryIds = [];

beforeAll(async () => {
  await db.initPromise;
  cashId = accountService.createAccount({ code: 'jest-080-1000', name: 'Jest Cash', type: 'asset' }).id;
  revId = accountService.createAccount({ code: 'jest-080-4000', name: 'Jest Revenue', type: 'revenue' }).id;
  expId = accountService.createAccount({ code: 'jest-080-5000', name: 'Jest Expense', type: 'expense' }).id;
});

function post(desc, entry_date, lines, user = 'jest080') {
  const e = journalService.createEntry({ description: desc, entry_date, lines });
  entryIds.push(e.id);
  return journalService.postEntry(e.id, user);
}

function draft(desc, lines) {
  const e = journalService.createEntry({ description: desc, entry_date: '2000-01-01', lines });
  entryIds.push(e.id);
  return e;
}

function book() {
  post('jest080-e1', '2000-01-01', [
    { account_id: cashId, debit: 10000, credit: 0 },
    { account_id: revId, debit: 0, credit: 10000 },
  ]);
  post('jest080-e2', '2000-06-01', [
    { account_id: expId, debit: 3000, credit: 0 },
    { account_id: cashId, debit: 0, credit: 3000 },
  ]);
  draft('jest080-e3', [
    { account_id: cashId, debit: 999, credit: 0 },
    { account_id: revId, debit: 0, credit: 999 },
  ]);
}

afterEach(() => {
  for (const eid of entryIds.splice(0)) {
    db.prepare('DELETE FROM journal_lines WHERE entry_id = ?').run(eid);
    db.prepare('DELETE FROM journal_entries WHERE id = ?').run(eid);
  }
  db.prepare("DELETE FROM events WHERE entity_type = 'journal' AND entity_id NOT IN (SELECT id FROM journal_entries)").run();
});

afterAll(() => {
  db.prepare("DELETE FROM journal_lines WHERE entry_id IN (SELECT id FROM journal_entries WHERE description LIKE 'jest080%')").run();
  db.prepare("DELETE FROM journal_entries WHERE description LIKE 'jest080%'").run();
  db.prepare("DELETE FROM accounts WHERE code LIKE 'jest-080-%'").run();
  db.saveDb();
});

describe('ledger / trial balance (080)', () => {
  test('ledger running balance recomputes; drafts invisible', () => {
    book();
    const cash = ledgerService.getLedger('jest-080-1000', {});
    expect(cash.opening_balance).toBe(0);
    expect(cash.lines.map(l => l.running_balance)).toEqual([10000, 7000]);
    expect(cash.total_debit).toBe(10000);
    expect(cash.total_credit).toBe(3000);
    const rev = ledgerService.getLedger(revId, {});
    expect(rev.lines.map(l => l.running_balance)).toEqual([-10000]);
  });
  test('ledger date window splits opening vs period', () => {
    book();
    const cash = ledgerService.getLedger(cashId, { from: '2000-03-01' });
    expect(cash.opening_balance).toBe(10000);
    expect(cash.lines.length).toBe(1);
    expect(cash.lines[0].running_balance).toBe(7000);
  });
  test('trial balance proves D==C; unknown account throws; empty book clean', () => {
    book();
    const tb = ledgerService.getTrialBalance({});
    expect(tb.balanced).toBe(true);
    expect(tb.total_period_debit).toBe(tb.total_period_credit);
    expect(tb.total_period_debit).toBe(13000);
    const byCode = Object.fromEntries(tb.rows.map(r => [r.code, r]));
    expect(byCode['jest-080-1000']).toMatchObject({ opening_debit: 0, opening_credit: 0, period_debit: 10000, period_credit: 3000, final_debit: 7000, final_credit: 0 });
    expect(byCode['jest-080-4000']).toMatchObject({ final_debit: 0, final_credit: 10000 });
    expect(() => ledgerService.getLedger('nope-080', {})).toThrow(/not found/);
  });
  test('trial date filter narrows; zero rows skipped', () => {
    book();
    const tb = ledgerService.getTrialBalance({ from: '2000-03-01' });
    expect(tb.balanced).toBe(true);
    const byCode = Object.fromEntries(tb.rows.map(r => [r.code, r]));
    expect(byCode['jest-080-1000']).toMatchObject({ opening_debit: 10000, period_debit: 0, period_credit: 3000 });
    expect(byCode['jest-080-4000']).toMatchObject({ opening_debit: 0, opening_credit: 10000, period_debit: 0, period_credit: 0 });
    expect(tb.rows.every(r => r.opening_debit + r.opening_credit + r.period_debit + r.period_credit > 0)).toBe(true);
  });
});
