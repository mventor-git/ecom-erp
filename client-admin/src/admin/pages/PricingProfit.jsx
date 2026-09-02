import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminProducts, getAdminCategories, pricingProfitReport } from '../../api/adminApi';
import AdminIcon from '../components/AdminIcon';
import { playTone } from '../../utils/sounds';
import { useLanguage } from '../../i18n';

/**
 * Profit dashboard — the expanded view behind Pricing Engine's chart.
 *  · Animated line: operating profit across opening-balance anchored periods
 *  · Animated bars: potential profit per category (stock on hand at margin)
 *  · Table: per-item lifetime performance + potential
 * Data: GET /api/admin/pricing/profit-report (through the authed API client)
 */

const fmt = (cents) => ((cents ?? 0) / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });

export default function PricingProfit() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [catMap, setCatMap] = useState({});
  const [hover, setHover] = useState(null);

  useEffect(() => {
    pricingProfitReport()
      .then(r => setData(r.data))
      .catch(() => setData({ periods: [], per_product: [], position: {} }));
    Promise.all([getAdminProducts(), getAdminCategories()])
      .then(([p, c]) => {
        const cname = Object.fromEntries((c.data || []).map(x => [x.id, x.name]));
        const map = {};
        (p.data || []).forEach(prod => { map[prod.id] = cname[prod.category_id] || '—'; });
        setCatMap(map);
      }).catch(() => {});
  }, []);

  const periods = data?.periods || [];
  const maxProfit = Math.max(...periods.map(p => Math.abs(p.operating_profit)), 1);

  // Aggregate potential profit per category
  const catBars = useMemo(() => {
    if (!data?.per_product) return [];
    const agg = {};
    data.per_product.forEach(r => {
      const c = catMap[r.id] || '—';
      agg[c] = (agg[c] || 0) + (r.potential_profit || 0);
    });
    return Object.entries(agg)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [data, catMap]);
  const maxBar = Math.max(...catBars.map(b => b.value), 1);

  const topItems = useMemo(
    () => (data?.per_product || []).slice().sort((a, b) => b.potential_profit - a.potential_profit).slice(0, 12),
    [data]
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AdminIcon name="bars" className="w-6 h-6 text-primary-600" />
            {t('Profit dashboard')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t('Operating profit over time · potential by category and item')}</p>
        </div>
        <button onClick={() => { playTone('nav'); navigate('/pricing-engine'); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-white border border-gray-200 hover:border-primary-300 transition-colors">
          <svg className="w-4 h-4 rotate-180 rtl:rotate-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 5l7 7-7 7"/></svg>
          {t('Back to engine')}
        </button>
      </div>

      {/* ── Line chart: operating profit per period ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">{t('Operating profit — time periods')}</h2>
        {periods.length === 0 ? (
          <div className="h-48 animate-pulse bg-gray-100 rounded-lg" />
        ) : (
          <svg viewBox={`0 0 ${Math.max(periods.length * 90, 300)} 220`} className="w-full h-56">
            {[0.25, 0.5, 0.75].map(f => (
              <line key={f} x1="40" x2={Math.max(periods.length * 90 - 20, 280)}
                    y1={190 - f * 160} y2={190 - f * 160} stroke="#e7e0cf" strokeDasharray="3 4" />
            ))}
            {(() => {
              const stepX = periods.length > 1 ? (Math.max(periods.length * 90 - 80, 200)) / (periods.length - 1) : 0;
              const pts = periods.map((p, i) => {
                const x = 50 + i * stepX;
                const y = 190 - (Math.abs(p.operating_profit) / maxProfit) * 150;
                return { x, y, p };
              });
              const path = pts.map((pt, i) => `${i ? 'L' : 'M'}${pt.x} ${pt.y}`).join(' ');
              return (
                <>
                  <path d={path} fill="none" stroke="#1f857a" strokeWidth="3" strokeLinecap="round"
                        className="pp-line" style={{ strokeDasharray: 1200, strokeDashoffset: 1200 }} />
                  {pts.map((pt, i) => (
                    <g key={i} onMouseEnter={() => setHover(pt.p)} onMouseLeave={() => setHover(null)}>
                      <circle cx={pt.x} cy={pt.y} r={hover === pt.p ? 7 : 4.5}
                              fill="#fffdf7" stroke="#1f857a" strokeWidth="2.5"
                              className="transition-all duration-200 cursor-pointer"
                              style={{ animation: `pp-pop .5s cubic-bezier(.34,1.56,.64,1) ${i * 0.12}s both` }} />
                      <text x={pt.x} y={212} textAnchor="middle" fontSize="9" fill="#877e6d">
                        {pt.p.start}
                      </text>
                      {(hover === pt.p) && (
                        <text x={pt.x} y={pt.y - 14} textAnchor="middle" fontSize="11" fontWeight="700" fill="#26231d">
                          {fmt(pt.p.operating_profit)}
                        </text>
                      )}
                    </g>
                  ))}
                </>
              );
            })()}
          </svg>
        )}
      </div>

      {/* ── Bars: potential profit per category ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">{t('Potential profit — category stock on hand')}</h2>
        <div className="space-y-3">
          {catBars.map((b, i) => (
            <div key={b.name} className="flex items-center gap-3">
              <span className="w-40 truncate text-xs text-gray-500">{b.name}</span>
              <div className="flex-1 h-5 bg-gray-100 rounded-md overflow-hidden">
                <div className="h-full rounded-md bg-gradient-to-r from-primary-500 to-primary-600 origin-left transition-all duration-1000 ease-out hover:brightness-110"
                     style={{ width: `${(b.value / maxBar) * 100}%`, animation: `pp-grow 1s cubic-bezier(.22,1,.36,1) ${i * 0.08}s both` }} />
              </div>
              <span className="w-24 text-end text-xs font-semibold text-gray-700">{fmt(b.value)}</span>
            </div>
          ))}
          {!catBars.length && <div className="h-24 animate-pulse bg-gray-100 rounded-lg" />}
        </div>
      </div>

      {/* ── Per-item table ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="text-start font-medium px-4 py-3">{t('Item')}</th>
              <th className="text-start font-medium px-4 py-3">{t('Category')}</th>
              <th className="text-end font-medium px-4 py-3">{t('Sold')}</th>
              <th className="text-end font-medium px-4 py-3">{t('On hand')}</th>
              <th className="text-end font-medium px-4 py-3">{t('Est. profit')}</th>
              <th className="text-end font-medium px-4 py-3">{t('Potential')}</th>
            </tr>
          </thead>
          <tbody>
            {topItems.map(r => (
              <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2.5 font-medium text-gray-900">{r.name}</td>
                <td className="px-4 py-2.5 text-gray-500">{catMap[r.id] || '—'}</td>
                <td className="px-4 py-2.5 text-end">{r.units_sold}</td>
                <td className="px-4 py-2.5 text-end">{r.on_hand}</td>
                <td className={`px-4 py-2.5 text-end ${r.est_profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(r.est_profit)}</td>
                <td className="px-4 py-2.5 text-end font-semibold text-gray-900">{fmt(r.potential_profit)}</td>
              </tr>
            ))}
            {!topItems.length && (
              <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-400 animate-pulse">Loading…</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* chart keyframes */}
      <style>{`
        @keyframes pp-pop { from { transform: scale(0); } to { transform: scale(1); } }
        .pp-line { animation: pp-draw 1.6s cubic-bezier(.22,1,.36,1) forwards; }
        @keyframes pp-draw { to { stroke-dashoffset: 0; } }
        @keyframes pp-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
      `}</style>
    </div>
  );
}
