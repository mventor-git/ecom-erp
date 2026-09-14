import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getOnboardingTypes, onboardingPreview, onboardingCommit, downloadOnboardingTemplate } from '../../api/adminApi';

// mventor-ticket-095 — master-data onboarding. Pick a dataset, drop the real
// sheet (CSV/XLSX), review the EXACT plan (creates/updates/errors/auto-created
// categories), then commit as ONE all-or-nothing transaction. The server is
// the single authority: this page shows the same plan it computed and nothing
// can be committed that the validator doesn't accept.

const ACTION_STYLE = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-sky-100 text-sky-700',
  error: 'bg-red-100 text-red-700',
};

export default function OnboardImport() {
  const [types, setTypes] = useState([]);
  const [type, setType] = useState('products');
  const [file, setFile] = useState(null);
  const [allowNew, setAllowNew] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [plan, setPlan] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => { getOnboardingTypes().then((r) => setTypes(r.data.data || [])).catch(() => {}); }, []);

  const reset = () => { setPlan(null); setResult(null); setError(''); };

  const doPreview = async () => {
    if (!file) return setError('Choose a CSV or XLSX file first');
    setBusy(true); reset();
    try {
      const res = await onboardingPreview(type, file, { allow_new_categories: allowNew });
      setPlan(res.data.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Preview failed');
    } finally { setBusy(false); }
  };

  const doCommit = async () => {
    setBusy(true); reset();
    try {
      const res = await onboardingCommit(type, file, { allow_new_categories: allowNew });
      setResult(res.data.data);
      setPlan(res.data.data.previews || null);
    } catch (err) {
      setError(err.response?.data?.error || 'Import failed — nothing was written');
    } finally { setBusy(false); }
  };

  const spec = types.find((t) => t.type === type);

  return (
    <div className="pb-10 max-w-4xl">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Import your business data</h1>
        <p className="text-sm text-gray-500 mt-1">
          Bring real sheets in — nothing is written until you review the plan and click Commit.
          An import is all-or-nothing: if even one row is invalid you'll see exactly why and NOTHING lands, so re-upload a fixed sheet anytime.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-sm text-gray-700">Dataset
            <select value={type} onChange={(e) => { setType(e.target.value); reset(); setFile(null); }}
              className="mt-1 block border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
              {types.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
            </select>
          </label>
          <label className="text-sm text-gray-700 flex-1 min-w-[14rem]">File (CSV or XLSX)
            <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => { setFile(e.target.files?.[0] || null); reset(); }}
              className="mt-1 block w-full text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border file:border-gray-300 file:bg-gray-50" />
          </label>
          <button onClick={() => downloadOnboardingTemplate(type)} className="text-sm px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Download template</button>
        </div>
        {type === 'products' && (
          <label className="flex items-center gap-2 mt-3 text-xs text-gray-600">
            <input type="checkbox" checked={allowNew} onChange={(e) => { setAllowNew(e.target.checked); reset(); }} />
            Allow creating missing categories/brands from the sheet (turn off to require them to exist first)
          </label>
        )}
        <div className="mt-4 flex items-center gap-3">
          <button onClick={doPreview} disabled={!file || busy} className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50">
            {busy ? '…' : 'Preview plan'}
          </button>
          {spec && <span className="text-xs text-gray-400">dedupe key: <b>{spec.business_key}</b> · needs permission <code className="bg-gray-100 px-1 rounded">{spec.permission}</code></span>}
        </div>
        {error && <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      </div>

      {plan && (
        <div className="mt-5 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Plan — {plan.dataset} ({plan.rows} data rows)</h2>
            <div className="flex gap-2 text-xs">
              <span className="px-2 py-1 rounded-full bg-green-100 text-green-700">{plan.creates} new</span>
              <span className="px-2 py-1 rounded-full bg-sky-100 text-sky-700">{plan.updates} updates</span>
              {plan.errors.length > 0 && <span className="px-2 py-1 rounded-full bg-red-100 text-red-700">{plan.errors.length} errors</span>}
            </div>
          </div>
          {(plan.auto_categories?.length || plan.auto_brands?.length) > 0 && (
            <p className="mt-2 text-xs text-amber-700">Will auto-create — categories: {plan.auto_categories.join(', ') || '—'} · brands: {plan.auto_brands.join(', ') || '—'}</p>
          )}
          {plan.errors.length > 0 && (
            <div className="mt-3 max-h-56 overflow-auto border border-red-100 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-red-50 text-red-700"><tr><th className="px-3 py-1.5 text-left">Line</th><th className="px-3 py-1.5 text-left">Problem</th></tr></thead>
                <tbody>
                  {plan.errors.map((e, i) => <tr key={i} className="border-t border-red-50"><td className="px-3 py-1 font-mono">{e.line}</td><td className="px-3 py-1">{e.error}</td></tr>)}
                </tbody>
              </table>
              <p className="px-3 py-2 text-red-600">Fix the sheet and preview again — with errors present Commit writes nothing.</p>
            </div>
          )}
          <div className="mt-3 max-h-72 overflow-auto border border-gray-100 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500"><tr><th className="px-3 py-1.5 text-left">Line</th><th className="px-3 py-1.5 text-left">Action</th><th className="px-3 py-1.5 text-left">Record</th></tr></thead>
              <tbody className="divide-y divide-gray-50">
                {plan.preview_rows.map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1 font-mono text-xs">{r.line}</td>
                    <td className="px-3 py-1"><span className={`px-1.5 py-0.5 rounded-full text-[11px] font-medium ${ACTION_STYLE[r.action] || ''}`}>{r.action}</span></td>
                    <td className="px-3 py-1 text-gray-700">{r.name || r.error || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button onClick={doCommit} disabled={busy || !plan.valid} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
              title={plan.valid ? '' : 'Fix all error rows first'}>
              {busy ? '…' : `Commit ${plan.creates + plan.updates} rows (transactional)`}
            </button>
            <button onClick={reset} className="px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">Discard</button>
          </div>
        </div>
      )}

      {result && (
        <div className="mt-5 p-5 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
          <p className="font-semibold">Imported {result.dataset}: {result.created} created, {result.updated} updated {result.images_landed ? `(${result.images_landed} images saved locally)` : ''}.</p>
          <p className="mt-1 text-xs">Source file archived (audited). Continue setup on the <Link to="/setup" className="underline font-medium">Setup</Link> checklist — next datasets: suppliers, customers, opening stock.</p>
        </div>
      )}

      <p className="mt-5 text-xs text-gray-400">Product imports never change stock on existing products — inventory moves only through receipts, opening balances, counts and adjustments (movements), never through a spreadsheet cell.</p>
    </div>
  );
}
