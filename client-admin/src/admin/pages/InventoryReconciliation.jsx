import { useState, useEffect, useCallback } from 'react';
import StatCard from '../components/StatCard';
import { getInventoryReconciliation, postInventoryMovementJournal } from '../../api/adminApi';
import { useAdminCurrency } from '../../utils/currency';

// mventor-ticket-093 — inventory <-> GL reconciliation control.
// It makes ledger-vs-warehouse drift VISIBLE and catch-up posting
// one click away; it never forces figures to agree and never auto-writes
// financial history (the same philosophy as AP aging + revenue recon).

export default function InventoryReconciliation() {
  const { format } = useAdminCurrency();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  const load = useCallback(() => {
    setLoading(true); setError('');
    getInventoryReconciliation()
      .then((res) => setData(res.data.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load reconciliation'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const catchUp = async (mvId) => {
    setBusy(mvId); setError('');
    try {
      const res = await postInventoryMovementJournal(mvId);
      const r = res.data.data;
      if (r.posted) {
        load();
      } else {
        setError(r.reason || (r.replay ? 'already posted' : 'not posted') || 'No change');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Catch-up posting failed');
    } finally { setBusy(null); }
  };

  const rows = data?.unposted_value_movements?.detail || [];
  const issues = data?.issues_without_settlement?.detail || [];
  const receipts = data?.purchase_unowned_receipts?.detail || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory &rarr; GL Reconciliation</h1>
          <p className="text-xs text-gray-500 mt-1 max-w-3xl">{data?.basis || 'Ledger inventory account vs cost-layer book value. Every difference is explained and reachable, never hidden.'}</p>
        </div>
        <button onClick={load} disabled={loading} className="text-sm px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">{loading ? '…' : 'Refresh'}</button>
      </div>

      {error && <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {data && (
        <>
          <div className="flex gap-3 flex-wrap mb-5">
            <StatCard label="Ledger Inventory (1300)" value={format(data.ledger_inventory_cents)} tone="primary" icon="box" sub="posted journals only" />
            <StatCard label="Cost-layer book value" value={format(data.layer_book_value_cents)} tone="neutral" sub="actual stock x real costs" />
            <StatCard label="Drift" value={format(data.drift_cents)} tone={data.drift_cents === 0 ? 'success' : 'warning'} sub="listed below, never auto-repaired" icon="chart" />
          </div>

          <section className="bg-white rounded-xl border border-gray-200 shadow-sm mb-5">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Ledger-owned movements without a posted journal ({data.unposted_value_movements.count}){data.unposted_value_movements.truncated ? ' — showing first 200' : ''}</h2>
              <span className="text-xs text-gray-400">opening balances, adjustments, damages, counts, booked-sale returns, vendor returns</span>
            </div>
            {rows.length === 0 ? (
              <p className="px-5 py-8 text-sm text-green-700">Nothing unposted — every value-changing stock movement in range has its journal. ✓</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500">
                    <th className="px-4 py-2">Mv</th><th className="px-4 py-2">Type</th><th className="px-4 py-2">Qty</th>
                    <th className="px-4 py-2">Value</th><th className="px-4 py-2">Reference</th><th className="px-4 py-2">Why</th><th className="px-4 py-2 text-end">Action</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {rows.map((m) => (
                      <tr key={m.movement_id}>
                        <td className="px-4 py-2 font-mono text-xs">#{m.movement_id}</td>
                        <td className="px-4 py-2"><span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">{m.type}</span></td>
                        <td className="px-4 py-2 font-medium">{m.qty_change}</td>
                        <td className="px-4 py-2">{m.value_cents ? `${format(m.value_cents)}${m.valuation ? '' : ''}` : '—'}</td>
                        <td className="px-4 py-2 text-xs text-gray-500">{m.reference}</td>
                        <td className="px-4 py-2 text-xs text-gray-500">{m.can_post_now ? (m.valuation || 'ready') : 'cost unknown - set product cost or movement cost'}</td>
                        <td className="px-4 py-2 text-end">
                          <button onClick={() => catchUp(m.movement_id)} disabled={!m.can_post_now || busy === m.movement_id}
                            className="px-2.5 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed">
                            {busy === m.movement_id ? '…' : 'Post journal'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-5 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-800">Issues whose order never settled ({data.issues_without_settlement.count})</h2>
                <p className="text-xs text-gray-400 mt-0.5">Legacy/web-COD stock that left without a booked sale; they settle with their own payment evidence (091 seams), never from here.</p>
              </div>
              {issues.length === 0 ? <p className="px-5 py-6 text-sm text-gray-500">None — every issue belongs to a settled order.</p> : (
                <ul className="px-5 py-2 text-sm divide-y divide-gray-50 max-h-64 overflow-auto">
                  {issues.map((i) => <li key={i.movement_id} className="py-1.5 flex justify-between"><span className="font-mono text-xs">mv #{i.movement_id} · order #{i.order_id}</span><span>{i.qty_change} @ {i.unit_cost ? format(i.unit_cost) : '—'}</span></li>)}
                </ul>
              )}
            </section>
            <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="px-5 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-800">Manual receipts outside receiving ({data.purchase_unowned_receipts.count})</h2>
                <p className="text-xs text-gray-400 mt-0.5">PO-less stock-ins own no bridge; bring them in through a PO receipt (real payable) or an adjustment with cost. Listed for visibility only.</p>
              </div>
              {receipts.length === 0 ? <p className="px-5 py-6 text-sm text-gray-500">None.</p> : (
                <ul className="px-5 py-2 text-sm divide-y divide-gray-50 max-h-64 overflow-auto">
                  {receipts.map((i) => <li key={i.movement_id} className="py-1.5 flex justify-between"><span className="font-mono text-xs">mv #{i.movement_id} · product {i.product_id}</span><span>+{i.qty_change} @ {i.unit_cost ? format(i.unit_cost) : '—'} · {i.created_at}</span></li>)}
                </ul>
              )}
            </section>
          </div>
          <p className="mt-4 text-xs text-gray-400 max-w-3xl">The control posts nothing on its own and never edits books: &ldquo;Post journal&rdquo; runs the same canonical, period-gated, idempotent bridge a movement went through at creation — it can only complete missing postings, never duplicate or rewrite them.</p>
        </>
      )}
    </div>
  );
}
