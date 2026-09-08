import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  pricingPreview, pricingApply, pricingOffers, pricingRevert, pricingLastApply,
  getAdminCategories, getAdminProducts,
  getSettingsByCategory, updateSetting, getPriceLists,
} from '../../api/adminApi';
import { useLanguage } from '../../i18n';
import AdminIcon from '../components/AdminIcon';
import { AlertTriangle } from 'lucide-react';
import { playTone } from '../../utils/sounds';

/**
 * Pricing Engine — flagship interactive pricing dashboard.
 *
 *  · Wholesale (cost) is the baseline entered via Warehouse → Catalog.
 *  · Defaults card: default markup over wholesale + the price list customers
 *    pay with (moved here from Site Config — this IS pricing configuration).
 *  · Category cards: per-category markup % and one-tap OFFER % (deducts from
 *    retail; old price preserved so the storefront ribbon fires).
 *  · Live preview: every card shows projected profit BEFORE you commit.
 *  · Undo reverts the last apply in one tap.
 */

const fmt = (cents, decimals = 0) =>
  ((cents ?? 0) / 100).toLocaleString('en-US', {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  });

export default function PricingEngine() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [catState, setCatState] = useState({});   // id -> {markup, offerOn, offerPct}
  const [catStats, setCatStats] = useState({});   // id -> {count, avgMargin, projected}
  const [offers, setOffers] = useState([]);
  const [flash, setFlash] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [lastApply, setLastApply] = useState(null);
  const [undoing, setUndoing] = useState(false);
  const [vipPct, setVipPct] = useState(10); // VIP preview % off retail — display only, never stored/applied

  const flashMsg = (ok, msg) => {
    playTone(ok ? 'success' : 'error');
    setFlash({ ok, msg });
    setTimeout(() => setFlash(null), 2400);
  };

  const defaultMarkupRef = useRef(25);

  // ── Load categories + per-category stats ────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      const [catsRes, prodRes, offersRes] = await Promise.all([
        getAdminCategories(), getAdminProducts(), pricingOffers().catch(() => ({ data: [] })),
      ]);
      const cats = catsRes.data || [];
      const prods = prodRes.data || [];
      setCategories(cats);
      setOffers(offersRes.data || []);

      setCatStats(prev => {
        const next = {};
        cats.forEach(c => {
          const items = prods.filter(p => p.category_id === c.id && !p.deleted_at);
          const count = items.length;
          const avgMargin = count ? Math.round(
            items.reduce((s, p) => s + (p.cost_price > 0 ? ((p.price - p.cost_price) / p.cost_price) * 100 : 0), 0) / count
          ) : 0;
          const prevC = prev[c.id] || {};
          next[c.id] = {
            count, avgMargin,
            markup: prevC.markup ?? defaultMarkupRef.current ?? 25,
            offerOn: false,
            offerPct: prevC.offerPct ?? 10,
          };
        });
        return next;
      });
    } catch { /* keep UI */ }
  }, []);

  const [defaults, setDefaults] = useState({ markup: 25, listCode: 'retail', lists: [], saving: false });

  useEffect(() => {
    loadAll();
    // Defaults live here (moved from Site Config) — they ARE pricing config
    Promise.all([
      getSettingsByCategory('pricing').catch(() => ({ data: [] })),
      getPriceLists().catch(() => ({ data: [] })),
    ]).then(([settingsRes, listsRes]) => {
      const map = {};
      (settingsRes.data || []).forEach(s => { if ('parsed_value' in s) map[s.key] = s.parsed_value; });
      const markup = Number(map.default_markup_percent ?? 25);
      const safe = Number.isFinite(markup) ? markup : 25;
      defaultMarkupRef.current = safe;
      setDefaults(d => ({
        ...d, markup: safe,
        listCode: map.storefront_price_list || 'retail',
        lists: (listsRes.data || []).filter(l => l.is_active),
      }));
      setCatState(prev => {
        const next = {};
        for (const [id, st] of Object.entries(prev)) next[id] = { ...st, markup: st.markup ?? safe };
        return next;
      });
    }).catch(() => {});
    pricingLastApply().then(r => setLastApply(r.data?.none ? null : r.data)).catch(() => {});
  }, [loadAll]);

  const saveDefault = async (patch) => {
    const next = { ...defaults, ...patch };
    setDefaults(next);
    setDefaults(d => ({ ...d, saving: true }));
    try {
      await updateSetting('default_markup_percent', next.markup);
      if (patch.listCode !== undefined) await updateSetting('storefront_price_list', next.listCode);
      defaultMarkupRef.current = next.markup;
      flashMsg(true, t('Pricing defaults saved'));
    } catch (err) {
      flashMsg(false, err.response?.data?.error || t('Save failed'));
    } finally {
      setDefaults(d => ({ ...d, saving: false }));
    }
  };

  const applyCategory = async (c, kind) => {
    const st = catState[c.id] || {};
    setBusyId(c.id);
    try {
      if (kind === 'offer') {
        await pricingApply({ scope: 'category', category_id: c.id, mode: 'offer', value: st.offerPct || 0, rounding: '99' });
      } else {
        await pricingApply({ scope: 'category', category_id: c.id, mode: 'markup', value: st.markup || 0, rounding: '99' });
      }
      const la = await pricingLastApply().catch(() => null);
      if (la?.data && !la.data.none) setLastApply(la.data);
      flashMsg(true, `${c.name}: ${kind === 'offer' ? `−${st.offerPct}% ${t('offer')}` : `+${st.markup}%`}`);
    } catch (err) {
      flashMsg(false, err.response?.data?.error || t('Apply failed'));
    } finally {
      setBusyId(null);
      loadAll();
    }
  };

  const undoLastApply = async () => {
    setUndoing(true);
    try {
      await pricingRevert();
      setLastApply(null);
      playTone('success');
      setFlash({ ok: true, msg: t('Reverted to previous prices') });
      setTimeout(() => setFlash(null), 2400);
      loadAll();
    } catch (err) {
      flashMsg(false, err.response?.data?.error || t('Nothing to revert'));
    } finally {
      setUndoing(false);
    }
  };

  const updateSt = (id, patch) => setCatState(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AdminIcon name="gauge" className="w-6 h-6 text-primary-600" />
            {t('Pricing Engine')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t('Wholesale is the baseline — set markups, fire offers, watch profit react live')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastApply && (
            <button onClick={undoLastApply} disabled={undoing}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-40 transition-colors">
              <AdminIcon name="arrows" className="w-4 h-4" />
              {undoing ? t('Reverting…') : t(`Undo (${lastApply.products} prices)`)}
            </button>
          )}
          <button
            onClick={() => navigate('/pricing-engine/profits')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-white border border-gray-200 hover:border-primary-300 transition-colors"
          >
            <AdminIcon name="bars" className="w-4 h-4" />
            {t('Profit dashboard')}
          </button>
        </div>
      </div>

      {/* ── Pricing defaults (moved from Site Config) ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <AdminIcon name="gear" className="w-4 h-4 text-primary-600" />
          {t('Pricing defaults')}
        </h2>
        <p className="text-xs text-gray-400 mb-4 -mt-2">
          {t('New products without a retail price get wholesale × markup. The chosen list is what customers pay. Cost basis uses inventory layers where present, else wholesale cost. VIP is a preview % off retail — never stored, never gateway-paid.')}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl">
          <label className="block">
            <span className="block text-xs font-medium text-gray-500 mb-1.5">{t('Default markup over wholesale (%)')}</span>
            <div className="flex items-center gap-2">
              <input type="number" min="-20" max="500" className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                value={defaults.markup}
                onChange={e => setDefaults(d => ({ ...d, markup: Number(e.target.value) }))} />
              <button onClick={() => saveDefault({})} disabled={defaults.saving}
                className="px-3 py-2 rounded-lg bg-primary-600 text-white text-xs font-semibold hover:bg-primary-500 disabled:opacity-40 transition-colors">
                {t('Save')}
              </button>
            </div>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-500 mb-1.5">{t('Storefront price list')}</span>
            <select className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={defaults.listCode}
              onChange={e => saveDefault({ listCode: e.target.value })}>
              {(defaults.lists.length ? defaults.lists : [{ code: 'retail', name: 'Retail' }]).map(l => (
                <option key={l.code} value={l.code}>{l.name || l.code}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-gray-500 mb-1.5">{t('VIP preview (% off retail, display only)')}</span>
            <input type="number" min="0" max="90" className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={vipPct}
              onChange={e => setVipPct(Math.min(Math.max(Number(e.target.value) || 0, 0), 90))} />
          </label>
        </div>
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        {categories.map(c => {
          const st = catState[c.id];
          if (!st) return null;
          return (
            <CategoryCard key={c.id} cat={c} st={st} busyId={busyId} vipPct={vipPct}
              onApply={applyCategory} onUpdate={updateSt} />
          );
        })}
        {!categories.length && (
          <div className="col-span-full py-12 text-center text-gray-400 animate-pulse">{t('Loading...')}</div>
        )}
      </div>

      <ProfitStrip />

      {/* Active offers list */}
      {offers.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mt-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <AdminIcon name="tag" className="w-4 h-4 text-gold" />
            {t('Products with offers')} ({offers.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {offers.map(o => {
              const pct = o.old_price > o.price ? Math.round(((o.old_price - o.price) / o.old_price) * 100) : 0;
              return (
                <span key={o.id} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-gray-50 border border-gray-200">
                  {o.name}{pct > 0 && <b className="text-gold">−{pct}%</b>}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {flash && (
        <div className={`fixed bottom-6 end-6 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg ${
          flash.ok ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {flash.msg}
        </div>
      )}
    </div>
  );
}

/* ── One category card with debounced live preview ─────────────────── */
function CategoryCard({ cat, st, busyId, vipPct, onApply, onUpdate }) {
  const { t } = useLanguage();
  const [preview, setPreview] = useState(null);   // totals from the preview API
  const [rows, setRows] = useState([]);           // honest per-product Cost→Retail→VIP rows
  const [basis, setBasis] = useState('');
  const timer = useRef(null);

  // Debounced live projection as the admin types markup/offer %
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const params = st.offerOn
        ? { scope: 'category', category_id: cat.id, mode: 'offer', value: st.offerPct ?? 10, rounding: 'none', vip_pct: vipPct ?? 0 }
        : { scope: 'category', category_id: cat.id, mode: 'markup', value: st.markup ?? 0, rounding: 'none', vip_pct: vipPct ?? 0 };
      pricingPreview(params)
        .then(r => { setPreview(r.data?.totals || null); setRows(r.data?.rows || []); setBasis(r.data?.rows?.[0]?.retail_basis || ''); })
        .catch(() => { setPreview(null); setRows([]); });
    }, 350);
    return () => clearTimeout(timer.current);
  }, [cat.id, st.offerOn, st.offerPct, st.markup, vipPct]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-gray-900 leading-tight">{cat.name}</h3>
          {cat.name_ar && <p className="text-xs text-gray-400" dir="rtl">{cat.name_ar}</p>}
        </div>
        <span className="text-[11px] px-2 py-1 rounded-full bg-gray-100 text-gray-500">
          {st.count} {t('items')}
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-2xl font-extrabold text-gray-900">{st.avgMargin}%</span>
        <span className="text-xs text-gray-400">{t('avg margin')}</span>
      </div>

      {/* Live projection strip */}
      {preview && (
        <div className={`mb-3 rounded-lg px-3 py-2 text-xs border ${
          preview.below_cost > 0
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
        }`}>
          <div className="flex items-center justify-between">
            <span>{t('Projected profit')}</span>
            <b>{fmt(preview.total_new_profit)}</b>
          </div>
          <div className="flex items-center justify-between opacity-80">
            <span>{preview.below_cost > 0 ? <span className="inline-flex items-center gap-1 text-amber-600"><AlertTriangle className="w-3.5 h-3.5" /> {t('items below cost')}</span> : t('vs current')}{preview.below_cost > 0 ? '' : ` ${fmt(preview.profit_delta >= 0 ? '+' : '')}${fmt(preview.profit_delta)}`}</span>
            <span>{t('avg')} {preview.avg_margin_pct}%</span>
          </div>
          {basis && <div className="mt-1 opacity-70">{t('Cost basis')}: {basis} · {t('VIP preview')} {vipPct}% {t('off retail, display only')}</div>}
        </div>
      )}

      {/* Honest Cost→Retail→VIP rows — missing-pricing guard built in */}
      {rows.length > 0 ? (
        <div className="mb-3 overflow-x-auto rounded-lg border border-gray-100">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-gray-400 text-start">
                <th className="text-start font-medium px-2 py-1">{t('Product')}</th>
                <th className="text-end font-medium px-2 py-1">{t('Cost')}</th>
                <th className="text-end font-medium px-2 py-1">{t('Retail')}</th>
                <th className="text-end font-medium px-2 py-1">{t('VIP')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-gray-50">
                  <td className="px-2 py-1 max-w-28 truncate" title={`${r.name} · ${r.cost_source}`}>{r.name}</td>
                  <td className="px-2 py-1 text-end text-gray-500" title={r.cost_source}>{fmt(r.cost_basis)}</td>
                  <td className={`px-2 py-1 text-end font-semibold ${r.new_margin <= 0 ? 'text-red-600' : 'text-gray-900'}`}>{fmt(r.proposed_price)}</td>
                  <td className="px-2 py-1 text-end text-emerald-700">{fmt(r.vip_price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mb-3 rounded-lg px-3 py-2 text-xs bg-gray-50 border border-gray-200 text-gray-500">
          {t('No priced products here yet — products need a wholesale cost above zero.')}
        </div>
      )}

      {/* Markup row */}
      <div className="flex items-center gap-2 mb-2">
        <input type="number" min="-20" max="300" value={st.markup}
          onChange={e => onUpdate(cat.id, { markup: Number(e.target.value) })}
          className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm" />
        <span className="text-xs text-gray-500">% {t('markup')}</span>
        <button onClick={() => onApply(cat, 'markup')} disabled={busyId === cat.id}
          className="ms-auto text-xs px-3 py-1.5 rounded-lg bg-primary-600 text-white hover:bg-primary-500 disabled:opacity-40 transition-colors">
          {t('Set')}
        </button>
      </div>

      {/* Offer row */}
      <div className="flex items-center gap-2 pt-2 border-t border-dashed border-gray-200">
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input type="checkbox" checked={st.offerOn}
            onChange={e => onUpdate(cat.id, { offerOn: e.target.checked })}
            className="rounded border-gray-300 text-gold" />
          <span className="text-xs font-medium text-gray-600">{t('Offer badge')}</span>
        </label>
        {st.offerOn && (
          <>
            <input type="number" min="1" max="90" value={st.offerPct}
              onChange={e => onUpdate(cat.id, { offerPct: Number(e.target.value) })}
              className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-sm" />
            <span className="text-xs text-gray-500">% {t('off')}</span>
          </>
        )}
        {st.offerOn && (
          <button onClick={() => onApply(cat, 'offer')} disabled={busyId === cat.id}
            className="ms-auto inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-gold text-white hover:brightness-110 disabled:opacity-40 transition-all">
            <AdminIcon name="bolt" className="w-3 h-3" />
            {t('Fire')}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Mini animated chart: projected profit per category ──────────────── */
function ProfitStrip() {
  const [bars, setBars] = useState([]);
  const navigate = useNavigate();
  const { t } = useLanguage();

  useEffect(() => {
    let alive = true;
    // ONE store-scope call, aggregated by category client-side (no N+1)
    pricingPreview({ scope: 'store', mode: 'match', value: 0, rounding: 'none' })
      .then(res => {
        if (!alive) return;
        const rows = res.data?.rows || [];
        const agg = {};
        rows.forEach(r => {
          const name = r.category_name || '—';
          agg[name] = (agg[name] || 0) + r.current_margin;
        });
        setBars(Object.entries(agg).map(([name, value]) => ({ name, value })));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const max = Math.max(...bars.map(b => b.value), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <AdminIcon name="chart" className="w-4 h-4 text-primary-600" />
          {t('Current profit by category')}
        </h2>
        <button onClick={() => navigate('/pricing-engine/profits')}
          className="text-xs font-semibold text-primary-700 hover:text-primary-600 flex items-center gap-1 transition-colors">
          {t('Expand')}
          <svg className="w-3 h-3 rtl:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
      <div className="flex items-end gap-3 h-36 overflow-x-auto">
        {bars.map(b => (
          <div key={b.name} className="flex-1 min-w-16 flex flex-col items-center gap-1 group">
            <span className="text-[10px] font-semibold text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
              {fmt(b.value)}
            </span>
            <div className="w-full rounded-t-md bg-gradient-to-t from-primary-600 to-primary-400 origin-bottom transition-all duration-700 ease-out hover:brightness-110"
                 style={{ height: `${Math.max((b.value / max) * 100, 3)}%` }} />
            <span className="text-[10px] text-gray-400 truncate w-full text-center">{b.name.split(' ')[0]}</span>
          </div>
        ))}
        {!bars.length && <div className="w-full h-full animate-pulse bg-gray-100 rounded-lg" />}
      </div>
    </div>
  );
}
