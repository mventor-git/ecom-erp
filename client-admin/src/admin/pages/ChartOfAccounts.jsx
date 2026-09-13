import { useState, useEffect, useCallback } from 'react';
import StatCard from '../components/StatCard';
import DataTable from '../components/DataTable';
import { getAccounts, createAccount, updateAccount, deleteAccount, getAccountLedger } from '../../api/adminApi';
import { useAdminCurrency } from '../../utils/currency';

// mventor-ticket-092 — Chart of Accounts, the ONE chart every posting bridge
// resolves through (accountChart). This page only presents and submits; the
// server enforces every rule (dup codes, types, referenced-account refusal).
const TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense', 'other'];
const TYPE_TONE = {
  asset: 'bg-blue-50 text-blue-700 border-blue-200',
  liability: 'bg-red-50 text-red-700 border-red-200',
  equity: 'bg-purple-50 text-purple-700 border-purple-200',
  revenue: 'bg-green-50 text-green-700 border-green-200',
  expense: 'bg-amber-50 text-amber-700 border-amber-200',
  other: 'bg-gray-50 text-gray-600 border-gray-200',
};

export default function ChartOfAccounts() {
  const { format } = useAdminCurrency();
  const [accounts, setAccounts] = useState([]);
  const [includeInactive, setIncludeInactive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [form, setForm] = useState(null); // { code, name, type, description, busy }
  const [ledger, setLedger] = useState(null); // { account, lines, opening_balance, ... }
  const [ledgerDate, setLedgerDate] = useState({ from: '', to: '' });

  const flash = (msg) => { setOk(msg); setTimeout(() => setOk(''), 3200); };

  const load = useCallback(() => {
    setLoading(true);
    getAccounts({ include_inactive: includeInactive ? 1 : 0 })
      .then((res) => setAccounts(res.data.data || []))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load accounts'))
      .finally(() => setLoading(false));
  }, [includeInactive]);

  useEffect(load, [load]);

  const submitCreate = async () => {
    setForm((f) => ({ ...f, busy: true }));
    setError('');
    try {
      await createAccount({ code: form.code, name: form.name, type: form.type, description: form.description || '' });
      setForm(null);
      flash('Account created');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create account');
      setForm((f) => ({ ...f, busy: false }));
    }
  };

  const toggleActive = async (acct) => {
    setError('');
    try {
      await updateAccount(acct.id, { is_active: !acct.is_active });
      flash(acct.is_active ? `Account ${acct.code} deactivated (existing history stays)` : `Account ${acct.code} reactivated`);
      load();
    } catch (err) { setError(err.response?.data?.error || 'Update failed'); }
  };

  const remove = async (acct) => {
    setError('');
    try {
      await deleteAccount(acct.id);
      flash(`Account ${acct.code} deleted (never referenced)`);
      load();
    } catch (err) {
      // Server refuses referenced accounts — the honest error IS the lesson.
      setError(err.response?.data?.error || 'Delete failed');
    }
  };

  const openLedger = (acct) => {
    setLedger({ account: acct, loading: true });
    getAccountLedger(acct.id, ledgerDate.from ? { from: ledgerDate.from, to: ledgerDate.to || undefined } : {})
      .then((res) => setLedger({ account: acct, ...(res.data.data || {}) }))
      .catch((err) => setLedger({ account: acct, error: err.response?.data?.error || 'Failed' }));
  };

  const columns = [
    { key: 'code', label: 'Code', render: (r) => <span className="font-mono text-sm font-semibold">{r.code}</span> },
    { key: 'name', label: 'Name', render: (r) => <span className="text-sm">{r.name}{r.description && <span className="block text-xs text-gray-400">{r.description}</span>}</span> },
    { key: 'type', label: 'Type', render: (r) => <span className={`inline-block px-2 py-0.5 rounded-full border text-xs font-medium ${TYPE_TONE[r.type] || TYPE_TONE.other}`}>{r.type}</span> },
    { key: 'is_active', label: 'Status', align: 'center', render: (r) => (
      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
        {r.is_active ? 'active' : 'inactive'}
      </span>
    ) },
    { key: 'actions', label: '', render: (r) => (
      <div className="flex items-center justify-end gap-1.5">
        <button onClick={() => openLedger(r)} className="px-2.5 py-1 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Ledger</button>
        <button onClick={() => toggleActive(r)} className="px-2.5 py-1 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50">{r.is_active ? 'Deactivate' : 'Activate'}</button>
        <button onClick={() => remove(r)} disabled={!!r.is_active} title={r.is_active ? 'Deactivate first' : ''} className="px-2.5 py-1 text-xs bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-40">Delete</button>
      </div>
    ) },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chart of Accounts</h1>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">One chart, one truth: every posting bridge (purchases, supplier payments, sales settlements) and every manual journal resolves accounts HERE. Referenced codes can never be deleted — deactivate instead; history stays intact.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600 flex items-center gap-1.5">
            <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} /> show inactive
          </label>
          <button onClick={() => { setForm({ code: '', name: '', type: 'asset', description: '', busy: false }); setError(''); }}
            className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium">+ Account</button>
        </div>
      </div>

      {ok && <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700" role="status">{ok}</div>}
      {error && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert">{error}</div>}

      {!loading && (
        <div className="flex gap-3 flex-wrap mb-5">
          <StatCard label="Accounts" value={String(accounts.length)} tone="primary" icon="box" />
          <StatCard label="Active" value={String(accounts.filter((a) => a.is_active).length)} tone="success" />
          <StatCard label="Inactive" value={String(accounts.filter((a) => !a.is_active).length)} tone="neutral" />
        </div>
      )}

      <DataTable columns={columns} data={accounts} loading={loading} emptyMessage="No accounts yet" />

      {form && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" role="presentation">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" role="dialog" aria-modal="true">
            <h3 className="text-lg font-bold text-gray-900">New account</h3>
            <div className="mt-4 space-y-3">
              {[['code', 'Code * (e.g., 1010)', 'text'], ['name', 'Name *', 'text']].map(([k, label, t]) => (
                <div key={k}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input type={t} value={form[k]} maxLength={k === 'code' ? 20 : 120}
                    onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                  {TYPES.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" value={form.description} maxLength={255}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setForm(null)} disabled={form.busy} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={submitCreate} disabled={form.busy || !form.code.trim() || !form.name.trim()}
                className="px-4 py-2 text-sm text-white bg-primary-600 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50">
                {form.busy ? '…' : 'Create account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {ledger && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" role="presentation">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-auto p-6" role="dialog" aria-modal="true">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-lg font-bold text-gray-900">Ledger — {ledger.account?.code} {ledger.account?.name}</h3>
              <button onClick={() => { setLedger(null); setLedgerDate({ from: '', to: '' }); }} className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">Close</button>
            </div>
            <div className="mt-3 flex items-end gap-2">
              <label className="text-xs text-gray-600">From <input type="date" value={ledgerDate.from} onChange={(e) => setLedgerDate((d) => ({ ...d, from: e.target.value }))} className="ml-1 border border-gray-300 rounded-lg px-2 py-1 text-sm" /></label>
              <label className="text-xs text-gray-600">To <input type="date" value={ledgerDate.to} onChange={(e) => setLedgerDate((d) => ({ ...d, to: e.target.value }))} className="ml-1 border border-gray-300 rounded-lg px-2 py-1 text-sm" /></label>
              <button onClick={() => openLedger(ledger.account)} className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700">Filter</button>
              {ledger.opening_balance !== undefined && (
                <span className="ml-auto text-xs text-gray-600">Opening: <b>{format(ledger.opening_balance || 0)}</b></span>
              )}
            </div>
            {ledger.loading && <p className="mt-4 text-sm text-gray-400">Loading…</p>}
            {ledger.error && <p className="mt-4 text-sm text-red-600">{ledger.error}</p>}
            {ledger.lines && (
              <table className="w-full mt-4 text-sm">
                <thead><tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold text-gray-600">
                  <th className="px-3 py-2">Date</th><th className="px-3 py-2">Entry</th><th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-end">Debit</th><th className="px-3 py-2 text-end">Credit</th><th className="px-3 py-2 text-end">Balance</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {ledger.lines.slice(-60).map((l) => (
                    <tr key={`${l.entry_id}-${l.line_description}`}>
                      <td className="px-3 py-1.5 text-gray-500">{l.entry_date}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">{l.entry_no}</td>
                      <td className="px-3 py-1.5 text-gray-700">{l.description || l.line_description}</td>
                      <td className="px-3 py-1.5 text-end">{l.debit ? format(l.debit) : '—'}</td>
                      <td className="px-3 py-1.5 text-end">{l.credit ? format(l.credit) : '—'}</td>
                      <td className="px-3 py-1.5 text-end font-medium">{format(l.running_balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-3 text-xs text-gray-400">Posted-only view (drafts are invisible here by design). The running balance is derived at read time — there is no stored balance to drift.</p>
          </div>
        </div>
      )}
    </div>
  );
}
