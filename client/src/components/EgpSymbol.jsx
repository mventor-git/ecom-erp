/**
 * EGP ICON — abstract interlocking E·G·P monogram (the compact currency mark).
 * One continuous gesture: E's middle arm slices through the stem and pierces
 * the G/P ring — the global-crossbar architecture of € £ ¥.
 * Used beside numerals where the full «جنيه مصري» wordmark is too wide.
 */
export default function EgpSymbol({ className = 'w-[1.15em] h-auto', title = 'Egyptian Pound' }) {
  return (
    <svg viewBox="0 0 86 56" fill="none" xmlns="http://www.w3.org/2000/svg"
         className={className} style={{ display: 'inline-block', verticalAlign: '-0.12em' }}
         role="img" aria-label={title}>
      <title>{title}</title>
      {/* E arms */}
      <path d="M8 8 H38" stroke="currentColor" strokeWidth="6.5" strokeLinecap="round" />
      <path d="M8 46 H38" stroke="currentColor" strokeWidth="6.5" strokeLinecap="round" />
      {/* shared spine (also P's stem) */}
      <path d="M38 6 V50" stroke="currentColor" strokeWidth="6.5" strokeLinecap="round" />
      {/* global crossbar — E's middle arm becomes G's mouth bar */}
      <path d="M8 27 H72" stroke="currentColor" strokeWidth="6.5" strokeLinecap="round" />
      {/* G · P ring with NE opening */}
      <path d="M71 13 A19 19 0 1 0 71 41" fill="none" stroke="currentColor" strokeWidth="6.5" />
    </svg>
  );
}
