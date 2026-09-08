/**
 * Chart of Accounts foundation — mventor-ticket-075.
 * Flow-through service test on the live DB with jest-tagged fixture codes
 * and full cleanup. Never touches real accounts.
 */
const db = require('../db');
const accountService = require('../services/accountService');

beforeAll(async () => { await db.initPromise; });
afterAll(() => {
  db.prepare("DELETE FROM accounts WHERE code LIKE 'jest-075-%'").run();
  db.saveDb();
});

describe('chart of accounts (075)', () => {
  test('create + read + list', () => {
    const a = accountService.createAccount({ code: 'jest-075-1000', name: 'Jest Cash', type: 'asset' });
    expect(a.code).toBe('jest-075-1000');
    expect(a.type).toBe('asset');
    expect(a.is_active).toBe(1);
    expect(accountService.getAccount(a.id).name).toBe('Jest Cash');
    expect(accountService.getAccount('jest-075-1000').id).toBe(a.id);
    expect(accountService.listAccounts().map(x => x.code)).toContain('jest-075-1000');
    accountService.deleteAccount(a.id);
    expect(accountService.getAccount(a.id)).toBeNull();
  });
  test('duplicate code rejected on create', () => {
    const a = accountService.createAccount({ code: 'jest-075-2000', name: 'A', type: 'liability' });
    try {
      expect(() => accountService.createAccount({ code: 'jest-075-2000', name: 'B', type: 'asset' }))
        .toThrow(/already exists/);
    } finally {
      accountService.deleteAccount(a.id);
    }
  });
  test('code/name/type required', () => {
    expect(() => accountService.createAccount({ code: '', name: 'x', type: 'asset' })).toThrow(/code is required/);
    expect(() => accountService.createAccount({ code: 'jest-075-x', name: '', type: 'asset' })).toThrow(/name is required/);
    expect(() => accountService.createAccount({ code: 'jest-075-x', name: 'x', type: 'nonsense' })).toThrow(/Invalid account type/);
  });
  test('update + duplicate-on-update rejected', () => {
    const a = accountService.createAccount({ code: 'jest-075-3000', name: 'A', type: 'revenue' });
    const b = accountService.createAccount({ code: 'jest-075-4000', name: 'B', type: 'expense' });
    try {
      const u = accountService.updateAccount(a.id, { name: 'A2', type: 'other', is_active: 0 });
      expect(u.name).toBe('A2');
      expect(u.is_active).toBe(0);
      expect(() => accountService.updateAccount(a.id, { code: 'jest-075-4000' })).toThrow(/already exists/);
      expect(accountService.listAccounts().map(x => x.code)).not.toContain('jest-075-3000');
      expect(accountService.listAccounts(true).map(x => x.code)).toContain('jest-075-3000');
    } finally {
      accountService.deleteAccount(a.id);
      accountService.deleteAccount(b.id);
    }
  });
  test('delete missing throws; references currently zero (no journals yet)', () => {
    expect(() => accountService.deleteAccount(999999999)).toThrow(/not found/);
    const a = accountService.createAccount({ code: 'jest-075-5000', name: 'C', type: 'equity' });
    expect(accountService.countReferences(a.id)).toBe(0);
    expect(accountService.deleteAccount(a.id).success).toBe(true);
  });
});
