import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import StatCard from '../components/StatCard';
import { getSetupStatus, getSettings, updateSetting } from '../../api/adminApi';
import { useLanguage } from '../../i18n';

// mventor-ticket-094 — First-run setup. Everything on this page WRITES REAL
// DOMAIN RECORDS through the normal gated endpoints (Settings here; period,
// warehouse, masters through their own screens); the checklist re-reads the
// server-derived status, so it can never claim a lie and completion survives
// any restart. The store stays fully usable at any point — this is guidance,
// not a lock-in.

const STEP_ICONS = { company: 'banknote', locale: 'globe', warehouse: 'building', fiscal_period: 'calendar', catalog: 'box', suppliers: 'user', customers: 'user', opening_stock: 'arrows', chart: 'chart', team: 'user' };

export default function SetupWizard() {
  const { t } = useLanguage();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [company, setCompany] = useState({ store_name: '', store_description: '', site_tagline: '' });
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  // Manual checkpoint (103): ordered guidance — start the site (1), read the
  // manual (2), then work the checklist (3). An acknowledgment, not a lock:
  // the store stays fully usable; this only orders the journey.
  const [manualRead, setManualRead] = useState(() => {
    try { return localStorage.getItem('setup-manual-read') === '1'; } catch { return false; }
  });
  const toggleManualRead = () => {
    setManualRead((v) => {
      try { localStorage.setItem('setup-manual-read', v ? '0' : '1'); } catch {}
      return !v;
    });
  };

  const refresh = useCallback(() => {
    getSetupStatus()
      .then((res) => setStatus(res.data.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load setup status'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    // Pre-fill from the PUBLIC settings shape when possible (no permission needed).
    fetch('/api/settings/public').then((r) => r.json()).then((rows) => {
      const pick = (k) => (Array.isArray(rows) ? rows.find((x) => x.key === k)?.value : rows?.[k]?.value) || '';
      setCompany((c) => ({ store_name: pick('store_name') || c.store_name, store_description: pick('store_description'), site_tagline: pick('site_tagline') }));
    }).catch(() => { /* admin-only fallback below */ });
  }, []);

  // Fallback pre-fill through the admin settings API (settings.read).
  useEffect(() => {
    if (!status) return;
    getSettings().then((res) => {
      const rows = res.data || [];
      const byKey = (k) => rows.find((x) => x.key === k)?.value || '';
      if (byKey('store_name')) {
        setCompany({ store_name: byKey('store_name'), store_description: byKey('store_description'), site_tagline: byKey('site_tagline') });
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.setup_complete]);

  const saveCompany = async () => {
    setSaving(true); setError('');
    try {
      await updateSetting('store_name', company.store_name.trim());
      await updateSetting('store_description', company.store_description.trim());
      await updateSetting('site_tagline', company.site_tagline.trim());
      setSavedMsg('Company identity saved — documents, storefront and journals now carry it.');
      setTimeout(() => setSavedMsg(''), 4000);
      refresh();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save company identity (settings.manage required)');
    } finally { setSaving(false); }
  };

  const core = status?.items?.filter((i) => i.core) || [];
  const guidance = status?.items?.filter((i) => !i.core) || [];
  const doneCore = core.filter((i) => i.done).length;

  return (
    <div className="pb-10">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">{t('Complete your setup')}</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-3xl">
          This system ships intentionally EMPTY — no invented products, customers or transactions.
          Answer a few questions and it becomes your company: identity, first period, warehouse, catalog, then the records your business runs on.
          Every step writes real records through the normal screens; you can leave and come back at any time.
        </p>
      </div>

      {loading && <div className="p-8 text-center text-gray-400">{t('Loading…')}</div>}
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      {savedMsg && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700" role="status">{savedMsg}</div>}

      {status && (
        <div className="flex gap-3 flex-wrap mb-6">
          <StatCard label="Core steps" value={`${doneCore} / ${core.length}`} tone={status.setup_complete ? 'success' : 'warning'} sub={status.setup_complete ? 'ready for business ✓' : 'next: ' + status.remaining_core.join(', ')} icon="gauge" />
          <StatCard label="Products" value={String(status.counts.products)} tone="neutral" />
          <StatCard label="Suppliers" value={String(status.counts.suppliers)} tone="neutral" />
          <StatCard label="Customers" value={String(status.counts.customers)} tone="neutral" />
          <StatCard label="Ledger accounts" value={String(status.counts.accounts)} tone="neutral" />
        </div>
      )}

      {status && !status.setup_complete && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">1 · Company identity</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-sm text-gray-700">Company / store name *
              <input value={company.store_name} onChange={(e) => setCompany((c) => ({ ...c, store_name: e.target.value }))} maxLength={120}
                placeholder="e.g., Comfort Sign" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </label>
            <label className="text-sm text-gray-700">Short tagline
              <input value={company.site_tagline} onChange={(e) => setCompany((c) => ({ ...c, site_tagline: e.target.value }))} maxLength={160}
                placeholder="What you sell, in one line" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </label>
          </div>
          <label className="block text-sm text-gray-700 mt-3">Description (optional)
            <textarea value={company.store_description} onChange={(e) => setCompany((c) => ({ ...c, store_description: e.target.value }))} rows={2} maxLength={400}
              placeholder="Used by documents, the AI assistant and SEO" className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </label>
          <div className="mt-3 flex items-center gap-3">
            <button onClick={saveCompany} disabled={saving || !company.store_name.trim() || company.store_name.trim() === 'E-Commerce'}
              className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50">
              {saving ? '…' : 'Save company name'}
            </button>
            <span className="text-xs text-gray-400">Currency &amp; timezone default to <b>{status.currency}</b> / <b>{status.timezone}</b> — change them in <Link to="/erp/settings" className="text-primary-700 hover:underline">Settings</Link>.</span>
          </div>
        </div>
      )}

      {status && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-1">2 · {t('Read the operator manual')}</h2>
          <p className="text-xs text-gray-500 mb-3">{t('The full path from install to daily business — one page, printable.')}</p>
          <div className="flex items-center gap-3 flex-wrap">
            <a href="/manual.html" target="_blank" rel="noopener noreferrer"
              className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg font-medium hover:bg-gray-50">
              {t('Open the manual')} →
            </a>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <input type="checkbox" checked={manualRead} onChange={toggleManualRead}
                className="rounded border-gray-300 text-primary-600 w-4 h-4" />
              {t('I have read the manual')}
            </label>
          </div>
        </div>
      )}

      {status && (
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">3 · {t('Work through the checklist')}</h2>
      )}

      {status && (
        <div className="grid grid-cols-1 gap-3">
          {[{ title: 'Core — required before ordinary business', list: core }, { title: 'Next — what a real company loads in', list: guidance }].map((group) => (
            <div key={group.title} className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
              <div className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{group.title}</div>
              {group.list.map((item) => (
                <div key={item.key} className="px-5 py-3.5 flex items-start gap-3">
                  <span className={`mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full text-xs shrink-0 ${item.done ? 'bg-green-100 text-green-700' : item.core ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                    {item.done ? '✓' : item.core ? '•' : '·'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{item.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{item.hint}</div>
                  </div>
                  <Link to={item.link} className="text-xs px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shrink-0">{item.done ? 'Open' : 'Go'} →</Link>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {status?.setup_complete && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
          <b>Core setup finished.</b> Your ERP is live: add suppliers/customers or import them, open purchasing (PO → receive → AP), sell (storefront, mobile, counter or admin orders — every settlement posts real journals), and read the truth in <Link to="/erp/statements" className="underline">Statements</Link>. Reconciliation controls: <Link to="/erp/ap-aging" className="underline">AP Aging</Link> · <Link to="/erp/revenue-reconciliation" className="underline">Revenue</Link>.
        </div>
      )}

      <p className="mt-6 text-xs text-gray-400 max-w-3xl">Nothing on this page is a flag: leaving and returning, a fresh-start reset, or a restart keep exactly the same honest picture because it is recomputed from your data every time.</p>
    </div>
  );
}
