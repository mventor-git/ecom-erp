import { useLanguage } from '../../i18n';

// ONE shared status vocabulary: order lifecycle + picking/packing + shipping,
// so the 3 divergent status-badge systems are consolidated (mventor-ticket-056).
const STATUS_STYLES = {
  // order lifecycle
  pending:  'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-300 dark:border-yellow-500/25',
  paid:     'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/25',
  shipped:  'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/25',
  cancelled:'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/25',
  active:   'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/25',
  inactive: 'bg-gray-50 text-gray-500 border-gray-200',
  draft:    'bg-gray-50 text-gray-500 border-gray-200',
  payment_pending: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-300 dark:border-yellow-500/25',
  payment_verified:'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/25',
  admin_review:    'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/25',
  confirmed:       'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/25',
  refining:        'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/25',
  picking:         'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/25',
  packing:         'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/25',
  ready_for_shipping: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/25',
  delivered:       'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/25',
  completed:       'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25',
  refunded:        'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/25',
  // supplier payments (mventor-ticket-088/089)
  recorded:        'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25',
  reversed:        'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/25',
  // picking / packing task
  in_progress:  'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/25',
  picked:       'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/25',
  packed:       'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/25',
  problem:      'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/25',
  // shipment
  in_transit:       'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/25',
  out_for_delivery: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/25',
  failed:           'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/25',
  returned:         'bg-gray-50 text-gray-500 border-gray-200',
};

const STATUS_DOTS = {
  pending:  'bg-yellow-500',
  paid:     'bg-green-500',
  shipped:  'bg-blue-500',
  cancelled:'bg-red-500',
  active:   'bg-green-500',
  inactive: 'bg-gray-400',
  draft:    'bg-gray-400',
  payment_pending: 'bg-yellow-500',
  payment_verified:'bg-sky-500',
  admin_review:    'bg-violet-500',
  confirmed:       'bg-teal-500',
  refining:        'bg-teal-500',
  picking:         'bg-blue-500',
  packing:         'bg-indigo-500',
  ready_for_shipping: 'bg-sky-500',
  delivered:       'bg-green-500',
  completed:       'bg-emerald-500',
  refunded:        'bg-purple-500',
  recorded:        'bg-emerald-500',
  reversed:        'bg-rose-500',
  in_progress:  'bg-blue-500',
  picked:       'bg-green-500',
  packed:       'bg-green-500',
  problem:      'bg-red-500',
  in_transit:       'bg-blue-500',
  out_for_delivery: 'bg-indigo-500',
  failed:           'bg-red-500',
  returned:         'bg-gray-400',
};

export default function StatusBadge({ status, style = 'pill' }) {
  const { t } = useLanguage();
  const s = (status || '').toLowerCase();
  const styles = STATUS_STYLES[s] || 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-white/5 dark:text-gray-400 dark:border-white/10';
  const dot = STATUS_DOTS[s] || 'bg-gray-400';

  if (style === 'dot') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium capitalize" title={s}>
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        {t(s)}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize border ${styles}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {t(s)}
    </span>
  );
}
