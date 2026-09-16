import { useState, useEffect, useCallback } from 'react';
import StatCard from '../components/StatCard';
import { getTrialBalance, getProfitLoss, getBalanceSheet } from '../../api/adminApi';
import { useAdminCurrency } from '../../utils/currency';

// mventor-ticket-092 — GL statements derived from POSTED journals only.
// If an economic event is not in the books, it is not in these statements;
// reconciliation controls (090 AP aging, 091 revenue) show operational-vs-book
// differences elsewhere and stay visible — statements never force agreement.

const TABS = ['Trial balance', 'Profit & loss', 'Balance sheet'];

export default function FinancialStatements() {
  const { format } = useAdminCurrency();
  const [tab, setTab] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = useCallback(() => {
    setLoading(true); setError('');
    const p = tab === 2 ? getBalanceSheet({ as_of: asOf })
      : tab === 1 ? getProfitLoss({ from: from || undefined, to: to || undefined })
        : getTrialBalance({ from: from || undefined, to: to || undefined });
    p.then((res) => setData(res.data.data))
      .catch((err) => { setError(err.response?.data?.error || 'Failed to build statement'); setData(null); })
      .finally(() => setLoading(false));
  }, [tab, from, to, asOf]);

  useEffect(() => { run(); }, [run]);

  const money = (v) => format(v || 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Statements</h1>
          <p className="text-xs text-gray-500 mt-1">{data?.basis || 'Computed live from posted journal lines — the books are proved, not stored.'}</p>
        </div>
        <div className="flex items-end gap-2 flex-wrap">
          {tab === 2 ? (
            <label className="text-sm text-gray-700"><span className="block mb-1 text-xs text-gray-500">As of *</span>
              <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" /></label>
          ) : (
            <>
              <label className="text-sm text-gray-700"><span className="block mb-1 text-xs text-gray-500">From (optional)</span>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" /></label>
              <label className="text-sm text-gray-700"><span className="block mb-1 text-xs text-gray-500">To (optional)</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" /></label>
            </>
          )}
          <button onClick={run} disabled={loading} className="text-sm px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">{loading ? '…' : 'Run'}</button>
        </div>
      </div>

      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === i ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{t}</button>
        ))}
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {data && tab === 0 && (
        <div>
          <div className={`mb-4 p-3 rounded-lg text-xs ${data.balanced ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`} role="status">
            Period Σ Debit {money(data.total_period_debit)} = Σ Credit {money(data.total_period_credit)} · {data.balanced ? 'balanced ✓' : 'MISMATCH — investigate'} · drafts are never included.
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 border-b border-gray-200 text-start text-xs font-semibold text-gray-600">
                <th className="px-4 py-2">Account</th><th className="px-4 py-2">Type</th>
                <th className="px-4 py-2 text-end">Opening Dr</th><th className="px-4 py-2 text-end">Cr</th>
                <th className="px-4 py-2 text-end">Period Dr</th><th className="px-4 py-2 text-end">Cr</th>
                <th className="px-4 py-2 text-end">Final Dr</th><th className="px-4 py-2 text-end">Cr</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {data.rows.map((r) => (
                  <tr key={r.account_id}>
                    <td className="px-4 py-2"><span className="font-mono text-xs me-1">{r.code}</span>{r.name}</td>
                    <td className="px-4 py-2 text-xs text-gray-500">{r.type}</td>
                    <td className="px-4 py-2 text-end">{r.opening_debit ? money(r.opening_debit) : '—'}</td>
                    <td className="px-4 py-2 text-end">{r.opening_credit ? money(r.opening_credit) : '—'}</td>
                    <td className="px-4 py-2 text-end">{r.period_debit ? money(r.period_debit) : '—'}</td>
                    <td className="px-4 py-2 text-end">{r.period_credit ? money(r.period_credit) : '—'}</td>
                    <td className="px-4 py-2 text-end font-medium">{r.final_debit ? money(r.final_debit) : '—'}</td>
                    <td className="px-4 py-2 text-end font-medium">{r.final_credit ? money(r.final_credit) : '—'}</td>
                  </tr>
                ))}
                {data.rows.length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No posted activity in this window</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data && tab === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Revenue (net)" value={money(data.total_revenue_cents)} tone="success" sub="credited by posted journals" />
          <StatCard label="Expenses" value={money(data.total_expense_cents)} tone="neutral" sub="debited by posted journals" />
          <StatCard label="Net income" value={money(data.net_income_cents)} tone={data.net_income_cents >= 0 ? 'primary' : 'warning'} sub={data.ledger_balanced ? 'ledger balanced ✓' : 'LEDGER MISMATCH'} />
          <div className="md:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <table className="w-full text-sm">
              <thead><tr className="text-start text-xs font-semibold text-gray-500 border-b border-gray-200"><th className="py-2">Account</th><th className="py-2">Type</th><th className="py-2 text-end">Net</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {[...(data.revenue || []).map((r) => ({ ...r, t: 'revenue' })), ...(data.expenses || []).map((r) => ({ ...r, t: 'expense' }))].map((r) => (
                  <tr key={`${r.t}-${r.account_id}`}>
                    <td className="py-1.5"><span className="font-mono text-xs me-1">{r.code}</span>{r.name}</td>
                    <td className="py-1.5 text-xs text-gray-500">{r.t}</td>
                    <td className="py-1.5 text-end font-medium">{money(r.net_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-gray-400">{data.basis} — order status and product cost are NOT inputs; book what happened, then watch it here.</p>
          </div>
        </div>
      )}

      {data && tab === 2 && (
        <div>
          <div className={`mb-4 p-3 rounded-lg text-xs ${data.balanced ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`} role="status">
            A {money(data.balance_check.assets_plus_other_cents)} = L+E+earnings {money(data.balance_check.liabilities_equity_earnings_cents)} · {data.balanced ? 'books balance ✓' : `difference ${money(data.balance_check.difference_cents)} ⚠`} — balancing proves the journals, not their COVERAGE (see limitations).
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatCard label="Assets" value={money(data.total_assets_cents)} tone="primary" />
            <StatCard label="Liabilities" value={money(data.total_liabilities_cents)} tone="neutral" />
            <StatCard label="Equity accounts" value={money(data.total_equity_cents)} tone="neutral" />
            <StatCard label="Current earnings" value={money(data.current_earnings_cents)} sub="from posted revenue−expense nets" tone={data.current_earnings_cents >= 0 ? 'success' : 'warning'} />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            {['assets', 'liabilities', 'equity', 'unclassified_other'].map((section) => {
              const rows = data[section] || [];
              if (!rows.length) return null;
              return (
                <div key={section} className="mb-4">
                  <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">{section.replace(/_/g, ' ')}</div>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r) => (
                        <tr key={r.account_id}>
                          <td className="py-1.5"><span className="font-mono text-xs me-1">{r.code}</span>{r.name}</td>
                          <td className="py-1.5 text-end font-medium">{money(r.balance_cents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
              {(data.limitations || []).map((l, i) => <p key={i} className="text-xs text-gray-400">• {l}</p>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

