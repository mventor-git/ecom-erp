import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../components/ui/utils';
import AdminIcon from './AdminIcon';
import { useLanguage } from '../../i18n';

const TONES = {
  primary: 'bg-primary-50 text-primary-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  info: 'bg-sky-50 text-sky-700',
  neutral: 'bg-gray-100 text-gray-600',
};

/**
 * Formal KPI card:
 * - Click anywhere → expands/collapses inline detail rows (revenue breakdown).
 * - "View details" link still jumps to the full page.
 * - `masked` replaces every figure with dots (privacy hide/show toggle).
 */
export default function StatCard({
  label, value, sub, icon: Icon, tone = 'primary', to,
  details = [], expanded = false, onExpand, masked = false,
}) {
  const { t } = useLanguage();
  const mask = v => (masked ? '••••••' : v);


  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <p className="text-xl sm:text-2xl font-semibold tracking-tight text-gray-900 mt-1.5 break-words leading-tight">
            {mask(value)}
          </p>
          {sub && !expanded && <p className="text-[11px] text-gray-400 mt-0.5 break-words">{mask(sub)}</p>}
        </div>
        {Icon && (
          <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', TONES[tone] || TONES.primary)}>
            {typeof Icon === 'string' ? <AdminIcon name={Icon} className="w-[18px] h-[18px]" strokeWidth={2} /> : <Icon className="w-[18px] h-[18px]" strokeWidth={2} />}
          </div>
        )}
      </div>

      {/* Inline expansion — revenue/details rows */}
      {expanded && details.length > 0 && (
        <dl className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
          {details.map(d => (
            <div key={d.label} className="flex items-center justify-between gap-2">
              <dt className="text-[11px] text-gray-500">{d.label}</dt>
              <dd className="text-xs font-semibold text-gray-900 text-right">{mask(d.value)}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        {(onExpand || details.length > 0) && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onExpand?.(); }}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 hover:text-primary-600 transition-colors"
            aria-expanded={expanded}
            aria-label={`${t(expanded ? 'Collapse' : 'Expand')} ${label}`}
          >
            <ChevronDown className={cn('w-3 h-3 transition-transform duration-200', expanded && 'rotate-180')} />
            {expanded ? t('Less') : t('More')}
          </button>
        )}
        {to && (
          <Link
            to={to}
            onClick={e => e.stopPropagation()}
            className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 group-hover:text-primary-600 hover:text-primary-600 transition-colors"
          >
            {t('View details')}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>
    </>
  );

  const classes = cn(
    'block rounded-xl border bg-white p-4 sm:p-5 shadow-sm transition-all h-full',
    expanded ? 'border-primary-300 shadow-md' : 'border-gray-200',
    'hover:border-primary-200 cursor-pointer group'
  );

  return (
    <div
      className={classes}
      onClick={() => onExpand?.()}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onExpand?.(); } }}
      aria-expanded={expanded}
    >
      {body}
    </div>
  );
}
