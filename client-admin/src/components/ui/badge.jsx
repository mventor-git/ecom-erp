import { cn } from './utils';

/**
 * Formal status badge. Variants map to business meanings:
 * paid/completed/active → success · pending/review → warning ·
 * shipped/confirmed → info · cancelled/refunded/inactive → destructive.
 */
const VARIANTS = {
  default: 'border-transparent bg-primary-600 text-white',
  secondary: 'border-transparent bg-gray-100 text-gray-700',
  outline: 'border-gray-300 text-gray-700',
  success: 'border-transparent bg-emerald-100 text-emerald-800',
  warning: 'border-transparent bg-amber-100 text-amber-800',
  info: 'border-transparent bg-sky-100 text-sky-800',
  destructive: 'border-transparent bg-red-100 text-red-800',
};

const STATUS_MAP = {
  paid: 'success',
  completed: 'success',
  active: 'success',
  received: 'success',
  delivered: 'success',
  issued: 'success',
  confirmed: 'info',
  shipped: 'info',
  sent: 'info',
  picking: 'info',
  packing: 'info',
  ready_for_shipping: 'info',
  pending: 'warning',
  admin_review: 'warning',
  payment_pending: 'warning',
  draft: 'secondary',
  received_partial: 'warning',
  cancelled: 'destructive',
  refunded: 'destructive',
  inactive: 'destructive',
};

export function Badge({ className, variant = 'default', status, children, ...props }) {
  const resolved = status ? (STATUS_MAP[status] || 'secondary') : variant;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize leading-5 transition-colors',
        VARIANTS[resolved] || VARIANTS.secondary,
        className
      )}
      {...props}
    >
      {children ?? status}
    </span>
  );
}
