import { useId } from 'react';

/**
 * Stars — a real star-rating element.
 * Each star is drawn with SOLID colors + a clip path:
 *   2.5 => 2 fully highlighted stars + 1 half-highlighted + 2 empty
 * - Interactive: left half of a star = N-0.5, right half = N
 * - Colors via CSS variables (dark-mode aware)
 */
const STAR_CLASS = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

// 24x24 five-pointed star (Material design shape)
const STAR_PATH = 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z';

/** One star filled to `fillPct` (0-100) via a clip of the amber layer over the gray base */
function StarCell({ fillPct, clipId, className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={`${fillPct}%`} height="24" />
        </clipPath>
      </defs>
      <path d={STAR_PATH} style={{ fill: 'var(--star-empty, #d1d5db)' }} />
      <path d={STAR_PATH} style={{ fill: 'var(--star-filled, #f59e0b)' }} clipPath={`url(#${clipId})`} />
    </svg>
  );
}

export default function Stars({ rating = 0, size = 'sm', interactive = false, onChange, className = '' }) {
  const gradientId = useId();
  const clamped = Math.max(0, Math.min(5, Number(rating) || 0));
  const starClass = STAR_CLASS[size] || STAR_CLASS.sm;

  if (interactive) {
    return (
      <div className={`inline-flex items-center gap-0.5 ${className}`} role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map(value => {
          const fillPct = Math.max(0, Math.min(1, clamped - (value - 1))) * 100;
          return (
            <button
              key={value}
              type="button"
              aria-label={`${value} star${value !== 1 ? 's' : ''}`}
              className={`relative ${starClass} transition-transform hover:scale-125`}
            >
              {/* Left half → N - 0.5 */}
              <span
                className="absolute inset-y-0 left-0 w-1/2 z-10"
                onClick={e => { e.stopPropagation(); onChange?.(value - 0.5); }}
                aria-hidden="true"
              />
              {/* Right half → N */}
              <span
                className="absolute inset-y-0 right-0 w-1/2 z-10"
                onClick={e => { e.stopPropagation(); onChange?.(value); }}
                aria-hidden="true"
              />
              <StarCell fillPct={fillPct} clipId={`${gradientId}-${value}`} className="w-full h-full pointer-events-none" />
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-0.5 ${className}`} role="img" aria-label={`${Number(clamped).toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map(value => {
        const fillPct = Math.max(0, Math.min(1, clamped - (value - 1))) * 100;
        return <StarCell key={value} fillPct={fillPct} clipId={`${gradientId}-d${value}`} className={starClass} />;
      })}
    </div>
  );
}
