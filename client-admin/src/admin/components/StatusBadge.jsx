import { useLanguage } from '../../i18n';

const STATUS_STYLES = {
  pending:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  paid:     'bg-green-50 text-green-700 border-green-200',
  shipped:  'bg-blue-50 text-blue-700 border-blue-200',
  cancelled:'bg-red-50 text-red-700 border-red-200',
  active:   'bg-green-50 text-green-700 border-green-200',
  inactive: 'bg-gray-50 text-gray-500 border-gray-200',
};

const STATUS_DOTS = {
  pending:  'bg-yellow-500',
  paid:     'bg-green-500',
  shipped:  'bg-blue-500',
  cancelled:'bg-red-500',
  active:   'bg-green-500',
  inactive: 'bg-gray-400',
};

export default function StatusBadge({ status, style = 'pill' }) {
  const { t } = useLanguage();
  const s = (status || '').toLowerCase();
  const styles = STATUS_STYLES[s] || 'bg-gray-50 text-gray-600 border-gray-200';
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
