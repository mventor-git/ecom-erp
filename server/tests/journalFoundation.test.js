/**
 * Journal foundation — mventor-ticket-077.
 * Structural invariants on fixture accounts; proves 075's delete-guard
 * activation (referenced account cannot be deleted). Full cleanup.
 */
const db = require('../db');
const accountService = require('../services/accountService');
const journalService = require('../services/journalService');

let cashId = null;
let revId = null;
const entryIds = [];

beforeAll(async () => {
  await db.initPromise;
  cashId = accountService.createAccount({ code: 'jest-077-1000', name: 'Jest Cash', type: 'asset' }).id;
  revId = accountService.createAccount({ code: 'jest-077-4000', name: 'Jest Revenue', type: 'revenue' }).id;
});

afterEach(() => {
  for (const eid of entryIds.splice(0)) {
    db.prepare('DELETE FROM journal_lines WHERE entry_id = ?').run(eid);
    db.prepare('DELETE FROM journal_entries WHERE id = ?').run(eid);
  }
});

afterAll(() => {
  // Belt-and-braces: afterEach removes tracked entries; this catches strays.
  db.prepare("DELETE FROM journal_lines WHERE entry_id IN (SELECT id FROM journal_entries WHERE description LIKE 'jest077%')").run();
  db.prepare("DELETE FROM journal_entries WHERE description LIKE 'jest077%'").run();
  db.prepare("DELETE FROM accounts WHERE code LIKE 'jest-077-%'").run();
  db.saveDb();
});

function entry(overrides = {}) {
  const e = journalService.createEntry({
    description: 'jest077',
    lines: [
      { account_id: cashId, debit: 5000, credit: 0 },
      { account_id: revId, debit: 0, credit: 5000 },
    ],
    ...overrides,
  });
  entryIds.push(e.id);
  return e;
}

describe('journal foundation (077)', () => {
  test('balanced draft creates with JE number + joined lines', () => {
    const e = entry();
    expect(e.entry_no).toMatch(/^JE-\d{4}-\d+$/);
    expect(e.status).toBe('draft');
    expect(e.lines.length).toBe(2);
    expect(e.lines[0]).toMatchObject({ account_code: 'jest-077-1000', debit: 5000, credit: 0 });
  });
  test('sequence increments across entries', () => {
    const a = entry();
    const b = entry();
    expect(a.entry_no).not.toBe(b.entry_no);
  });
  test('structural violations rejected', () => {
    const bal = (aD, aC, bD, bC) => [
      { account_id: cashId, debit: aD, credit: aC },
      { account_id: revId, debit: bD, credit: bC },
    ];
    expect(() => journalService.createEntry({ lines: bal(5000, 0, 0, 4000) })).toThrow(/Unbalanced/);
    expect(() => journalService.createEntry({ lines: bal(1, 1, 0, 1) })).toThrow(/both debit and credit/);
    expect(() => journalService.createEntry({ lines: [{ account_id: cashId, debit: -5, credit: 0 }, { account_id: revId, debit: 0, credit: 5 }] }))
      .toThrow(/negative/);
    expect(() => journalService.createEntry({ lines: [{ account_id: cashId, debit: 5000, credit: 0 }] }))
      .toThrow(/at least 2/);
    expect(() => journalService.createEntry({ lines: [{ account_id: 999999999, debit: 5, credit: 0 }, { account_id: revId, debit: 0, credit: 5 }] }))
      .toThrow(/Unknown account/);
    expect(() => journalService.createEntry({ lines: bal(0, 0, 0, 0) })).toThrow(/at least 2/);
    expect(() => journalService.createEntry({ entry_date: 'tomorrow', lines: bal(1, 0, 0, 1) })).toThrow(/YYYY-MM-DD/);
    expect(() => journalService.createEntry({})).toThrow(/lines array/);
  });
  test('inactive account rejected', () => {
    const off = accountService.createAccount({ code: 'jest-077-9000', name: 'Off', type: 'other' });
    accountService.updateAccount(off.id, { is_active: 0 });
    try {
      expect(() => journalService.createEntry({ lines: [{ account_id: off.id, debit: 5, credit: 0 }, { account_id: revId, debit: 0, credit: 5 }] }))
        .toThrow(/inactive/);
    } finally {
      accountService.updateAccount(off.id, { is_active: 1 });
      accountService.deleteAccount(off.id);
    }
  });
  test('update draft preserves entry_no; delete draft cascades', () => {
    const e = entry();
    const u = journalService.updateDraftEntry(e.id, {
      description: 'jest077 edited',
      lines: [
        { account_id: cashId, debit: 7000, credit: 0 },
        { account_id: revId, debit: 0, credit: 7000 },
      ],
    });
    expect(u.entry_no).toBe(e.entry_no);
    expect(u.lines.reduce((s, l) => s + l.debit, 0)).toBe(7000);
    expect(journalService.deleteDraftEntry(e.id).deleted).toBe(e.entry_no);
    entryIds.splice(entryIds.indexOf(e.id), 1);
    expect(journalService.getEntry(e.id)).toBeNull();
    expect(() => journalService.updateDraftEntry(e.id, { lines: [] })).toThrow(/not found/);
    expect(() => journalService.deleteDraftEntry(999999999)).toThrow(/not found/);
  });
  test('075 delete-guard activates on referenced accounts', () => {
    const e = entry();
    expect(() => accountService.deleteAccount(cashId)).toThrow(/still reference/);
    journalService.deleteDraftEntry(e.id);
    entryIds.splice(entryIds.indexOf(e.id), 1);
    expect(accountService.getAccount(cashId).code).toBe('jest-077-1000');
  });
});
