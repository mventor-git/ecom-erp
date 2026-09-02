import { cn } from './utils';

/**
 * Formal native select (no heavy dependencies). Compact size fits card headers.
 * props: value, onChange, options [{value,label}], className
 */
export function Select({ className, options = [], ...props }) {
  return (
    <div className={cn('relative', className)}>
      <select
        className={cn(
          'appearance-none h-8 ps-2.5 pe-7 rounded-lg border border-gray-300 bg-white text-xs font-medium text-gray-700',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 cursor-pointer',
          'hover:border-gray-400 transition-colors'
        )}
        {...props}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}
