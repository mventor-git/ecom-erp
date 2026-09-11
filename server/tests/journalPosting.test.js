/**
 * Posting machine — mventor-ticket-079.
 * Gates proved at POST time (not just creation): tampered totals, dead
 * accounts, double-post, closed periods. Deterministic by construction:
 * non-period tests date entries 2000-01-01 (no period can ever cover it —
 * live DB carries leaked ambient CLOSED periods, see ticket); the open
 * test dates mid-fixture, beyond any short ambient period.
 */
const db = require('../db');
const accountService = require('../services/accountService');
const journalService = require('../services/journalService');
const wos = require('../services/warehouseOrderService');

const SAFE_DATE = '2000-01-01'; // predates the system; uncoverable by periods

let cashId = null;
let revId = null;
const entryIds = [];
const periodIds = [];

beforeAll(async () => {
  await db.initPromise;
  cashId = accountService.createAccount({ code: 'jest-079-1000', name: 'Jest Cash', type: 'asset' }).id;
  revId = accountService.createAccount({ code: 'jest-079-4000', name: 'Jest Revenue', type: 'revenue' }).id;
});

afterEach(() => {
  for (const eid of entryIds.splice(0)) {
    db.prepare('DELETE FROM journal_lines WHERE entry_id = ?').run(eid);
    db.prepare('DELETE FROM journal_entries WHERE id = ?').run(eid);
  }
  db.prepare("DELETE FROM events WHERE entity_type = 'journal' AND entity_id NOT IN (SELECT id FROM journal_entries)").run();
  for (const pid of periodIds.splice(0)) {
    db.prepare('DELETE FROM financial_periods WHERE id = ?').run(pid);
  }
});

afterAll(() => {
  db.prepare("DELETE FROM journal_lines WHERE entry_id IN (SELECT id FROM journal_entries WHERE description LIKE 'jest079%')").run();
  db.prepare("DELETE FROM journal_entries WHERE description LIKE 'jest079%'").run();
  db.prepare("DELETE FROM accounts WHERE code LIKE 'jest-079-%'").run();
  db.prepare("DELETE FROM financial_periods WHERE name LIKE 'jest079%'").run();
  db.saveDb();
});

function entry(desc = 'jest079', entry_date = SAFE_DATE) {
  const e = journalService.createEntry({
    description: desc,
    entry_date,
    lines: [
      { account_id: cashId, debit: 5000, credit: 0 },
      { account_id: revId, debit: 0, credit: 5000 },
    ],
  });
  entryIds.push(e.id);
  return e;
}

function postedEvent(eid, type) {
  return db.prepare("SELECT * FROM events WHERE entity_type = 'journal' AND entity_id = ? AND event_type = ?").get(eid, type);
}

function todayPlusMonths(n) {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

describe('posting machine (079)', () => {
  test('post sets markers + audits; unpost cycles + clears', () => {
    const e = entry();
    const p = journalService.postEntry(e.id, 'jest079-admin');
    expect(p.status).toBe('posted');
    expect(p.posted_by).toBe('jest079-admin');
    expect(p.posted_at).toBeTruthy();
    expect(postedEvent(e.id, 'journal_posted')).toBeTruthy();
    expect(() => journalService.postEntry(e.id, 'x')).toThrow(/already posted/);
    const u = journalService.unpostEntry(e.id, 'jest079-admin');
    expect(u.status).toBe('draft');
    expect(u.posted_by).toBeNull();
    expect(u.posted_at).toBeNull();
    expect(postedEvent(e.id, 'journal_unposted')).toBeTruthy();
    expect(() => journalService.unpostEntry(e.id, 'x')).toThrow(/Only posted/);
  });
  test('tampered totals fail AT POST, entry stays draft', () => {
    const e = entry();
    db.prepare('UPDATE journal_lines SET debit = 1 WHERE entry_id = ? AND debit > 0').run(e.id);
    expect(() => journalService.postEntry(e.id, 'x')).toThrow(/Unbalanced/);
    expect(journalService.getEntry(e.id).status).toBe('draft');
  });
  test('deactivated account fails AT POST', () => {
    const e = entry();
    accountService.updateAccount(cashId, { is_active: 0 });
    try {
      expect(() => journalService.postEntry(e.id, 'x')).toThrow(/inactive/);
    } finally {
      accountService.updateAccount(cashId, { is_active: 1 });
    }
    expect(journalService.getEntry(e.id).status).toBe('draft');
  });
  test('closed period refuses (fixture covers entry date)', () => {
    const shut = wos.createFinancialPeriod({ name: 'jest079-closed', months: 1 });
    periodIds.push(shut.id);
    wos.closeFinancialPeriod(shut.id);
    const today = new Date().toISOString().slice(0, 10);
    const e = entry('jest079', today);
    expect(journalService.closedPeriodContaining(today).name).toBe('jest079-closed');
    expect(() => journalService.postEntry(e.id, 'x')).toThrow(/closed financial period/);
    expect(journalService.getEntry(e.id).status).toBe('draft');
  });
  test('open covering period allows (mid-fixture, beyond ambient short periods)', () => {
    const open = wos.createFinancialPeriod({ name: 'jest079-open', months: 60 });
    periodIds.push(open.id);
    const e = entry('jest079', todayPlusMonths(48));
    expect(journalService.postEntry(e.id, 'x').status).toBe('posted');
  });
  test('gate is read-only for uncoverable dates', () => {
    expect(journalService.closedPeriodContaining(SAFE_DATE)).toBeNull();
  });
  test('post missing throws', () => {
    expect(() => journalService.postEntry(999999999, 'x')).toThrow(/not found/);
  });
});
