import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSettingsByCategory, updateSetting } from '../../api/adminApi';
import AdminIcon from '../components/AdminIcon';
import { playTone } from '../../utils/sounds';
import { useLanguage } from '../../i18n';

/**
 * Settings — rebuilt for speed and clarity.
 *  · Tab per settings category; only the active tab loads & renders.
 *  · Edits stay in a local draft; one Save bar commits changed keys.
 *  · Native selects/inputs keep typing snappy even on long option lists.
 */

const TABS = [
  { key: 'general',       label: 'General',       icon: 'gear' },
  { key: 'payments',      label: 'Payments',      icon: 'card' },
  { key: 'delivery',      label: 'Delivery',      icon: 'truck' },
  { key: 'notifications', label: 'Notifications', icon: 'bell' },
  { key: 'documents',     label: 'Documents',     icon: 'receipt' },
  { key: 'security',      label: 'Security',      icon: 'shield' },
];

// One home per setting (070): these keys have a richer dedicated editor and
// are hidden here so two screens never fight over the same value.
const DEDICATED_HOME_KEYS = {
  store_name: '/site-config/homepage',
  site_logo_url: '/site-config/homepage',
  site_tagline: '/site-config/homepage',
};

// Friendly labels for known keys (everything else shows the raw key)
const LABELS = {
  store_name: 'Store name',
  site_tagline: 'Tagline',
  site_logo_url: 'Logo URL',
  store_description: 'Store description (AI & SEO)',
  currency: 'Currency',
  logo_link: 'Logo click link',
  admin_site_url: 'Admin panel URL',
  welcome_3d_enabled: 'Welcome 3D showcase',
  welcome_3d_model_url: '3D model (.glb) URL',
  welcome_3d_motion: '3D motion preset (float / spin / none)',
  welcome_3d_scale: '3D scale',
  welcome_3d_speed: '3D speed',
};

function pretty(key) {
  return LABELS[key] ||
    key.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
}

export default function SettingsPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [tab, setTab] = useState('general');
  const [rows, setRows] = useState(null);       // loaded rows for active tab
  const [draft, setDraft] = useState({});       // key -> edited value
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Visible rows: keys with a dedicated home are edited there, not here.
  const visibleRows = useMemo(
    () => (rows || []).filter(r => !(r.key in DEDICATED_HOME_KEYS)),
    [rows]
  );
  const hiddenCount = (rows || []).length - visibleRows.length;

  const loadTab = useCallback((k) => {
    setRows(null);
    setDraft({});
    getSettingsByCategory(k)
      .then(r => setRows(r.data || []))
      .catch(() => setRows([]));
  }, []);

  useEffect(() => { loadTab(tab); }, [tab, loadTab]);

  const dirtyKeys = useMemo(
    () => Object.keys(draft).filter(k => {
      const row = (rows || []).find(r => r.key === k);
      return row && String(row.value) !== String(draft[k]);
    }),
    [draft, rows]
  );

  const setValue = (key, v) => setDraft(prev => ({ ...prev, [key]: v }));

  const save = async () => {
    if (!dirtyKeys.length) return;
    setSaving(true);
    try {
      await Promise.all(dirtyKeys.map(k =>
        updateSetting(k, rows.find(r => r.key === k)?.type === 'number' ? Number(draft[k]) : draft[k])
      ));
      playTone('success');
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1800);
      loadTab(tab);
    } catch {
      playTone('error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('Settings')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('Everything that shapes how the store runs')}</p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {TABS.map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === tb.key ? 'bg-white shadow text-primary-700' : 'text-gray-500 hover:text-gray-800'
            }`}>
            <AdminIcon name={tb.icon} className="w-4 h-4" />
            {t(tb.label)}
          </button>
        ))}
      </div>

      {/* Active tab body */}
      {rows === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : visibleRows.length === 0 && hiddenCount === 0 ? (
        <p className="text-sm text-gray-400 py-10 text-center">{t('Nothing configured under this tab yet.')}</p>
      ) : (
        <div className="space-y-3">
          {hiddenCount > 0 && (
            <button onClick={() => navigate('/site-config/homepage')}
              className="w-full text-start rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500 hover:border-primary-300 hover:text-primary-700 transition-colors">
              {t('Brand & Identity (name, logo, tagline) lives in Site Config →')}
            </button>
          )}
          {visibleRows.map(row => (
            <Field key={row.key} row={row} value={draft[row.key] ?? row.value}
                   onChange={v => setValue(row.key, v)} />
          ))}
        </div>
      )}

      {/* Save bar */}
      {dirtyKeys.length > 0 && (
        <div className="sticky bottom-4 mt-6 z-10">
          <div className="bg-navy text-white rounded-xl shadow-xl px-5 py-3.5 flex items-center justify-between"
               style={{ backgroundColor: '#101c2c' }}>
            <span className="text-sm opacity-80">{dirtyKeys.length} {t(dirtyKeys.length > 1 ? 'changes' : 'change')}</span>
            <button onClick={save} disabled={saving}
              className="px-5 py-2 rounded-lg text-sm font-semibold bg-primary-600 hover:bg-primary-500 disabled:opacity-50 transition-colors">
              {saving ? t('Saving…') : savedFlash ? t('Saved') : t('Save changes')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── One settings row ─────────────────────────────────────────────────── */
function Field({ row, value, onChange }) {
  const { key, type } = row;
  const label = pretty(key);
  const common = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500';

  let control;
  if (type === 'bool') {
    control = (
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" checked={value === true || value === 'true' || value === 1}
               onChange={e => onChange(e.target.checked)}
               className="rounded border-gray-300 text-primary-600" />
        <span className="text-sm">{String(value === true || value === 'true' || value === 1)}</span>
      </label>
    );
  } else if (type === 'number') {
    control = <input type="number" step="any" value={value ?? ''} onChange={e => onChange(e.target.value)} className={common} />;
  } else if (key === 'currency') {
    control = (
      <select value={value ?? ''} onChange={e => onChange(e.target.value)} className={common}>
        {['EGP','EGP-TXT','USD','EUR','GBP','SAR','AED','KWD','QAR','TRY'].map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
    );
  } else if (/url|link/.test(key)) {
    control = <input type="text" dir="ltr" value={value ?? ''} onChange={e => onChange(e.target.value)} className={common} placeholder="https://…" />;
  } else {
    control = <input type="text" value={value ?? ''} onChange={e => onChange(e.target.value)} className={common} />;
  }

  return (
    <div className={`rounded-xl p-4 ${dirtyStyle(row, value)}`}>
      <label className="block text-xs font-semibold text-gray-600 mb-1.5">{label}</label>
      {control}
      {row.description && <p className="mt-1 text-[11px] text-gray-400">{row.description}</p>}
    </div>
  );
}

function dirtyStyle(row, value) {
  const dirty = String(row.value) !== String(value);
  return dirty
    ? 'border border-gold/50 bg-[#fdf8ea]'
    : 'border border-gray-200 bg-white';
}
