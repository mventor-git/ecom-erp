/**
 * AdminIcon — the panel's custom stroke-icon set.
 * One 24-grid, 1.8 stroke, round caps: replaces every emoji in the UI
 * so navigation reads as one designed system (shopping + administration).
 */
const PATHS = {
  // ── commerce ──────────────────────────────────────────────────────
  box: 'M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5m0 0l9-5M12 13v8',
  wallet: 'M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm16 4h2m-6.5 1.5h.01',
  trash: 'M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3',
  star: 'M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6L12 16.8 6.6 19.6l1.1-6L3.2 9.4l6.1-.8L12 3z',
  folder: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z',
  tag: 'M20 12l-8 8-9-9V4h7l10 8zM7.5 7.5h.01',
  home: 'M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6',
  clipboard: 'M9 4h6v3H9zM9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 12h6m-6 4h4',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0',
  chart: 'M4 20V10m6 10V4m6 16v-7m5 7H3',
  arrows: 'M7 4v13M7 17l-3-3m3 3l3-3M17 20V7m0 0l-3 3m3-3l3 3',
  building: 'M4 21V6l8-3 8 3v15M9 21v-5h6v5M8 9h.01M12 9h.01M16 9h.01M8 13h.01M12 13h.01M16 13h.01',
  download: 'M12 3v11m0 0l-4-4m4 4l4-4M5 21h14M5 18h14',
  upload: 'M12 14V3m0 0L8 7m4-4l4 4M5 21h14M5 18h14',
  calendar: 'M4 6a2 2 0 012-2h12a2 2 0 012 2v13a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm4-2v4m8-4v4M4 10h16',
  gauge: 'M12 14l4-6M4.5 18a9 9 0 1115 0',
  truck: 'M2 7h11v9H2zM13 10h5l3 3v3h-8zM6.5 19a1.75 1.75 0 100-3.5 1.75 1.75 0 000 3.5zm11 0a1.75 1.75 0 100-3.5 1.75 1.75 0 000 3.5z',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zm7.4-3a7.4 7.4 0 00-.1-1.2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 00-2-1.2L14.5 3h-5l-.4 2.6a7.6 7.6 0 00-2 1.2l-2.4-1-2 3.4 2 1.6c0 .4-.1.8-.1 1.2s0 .8.1 1.2l-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2l.4 2.6h5l.4-2.6c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
  plug: 'M9 3v6m6-6v6M6 9h12v3a6 6 0 01-12 0V9zm6 12v-3',
  badge: 'M5 4h14v17l-7-3-7 3V4zm4 5h6M9 13h4',
  sparkle: 'M12 3l1.8 4.9L19 9.7l-4.4 3 .6 5.3-3.2-2.6-3.2 2.6.6-5.3-4.4-3 5.2-1.8L12 3z',
  megaphone: 'M3 11v3l12 5V6L3 11zm12-3h4a2 2 0 012 2v2a2 2 0 01-2 2h-4M7 13v5a2 2 0 004 0v-3',
  image: 'M4 5h16v14H4zM4 15l5-5 4 4 3-3 4 4M9 9.5h.01',
  film: 'M4 4h16v16H4zM4 9h16M4 15h16M9 4v16m6-16v16',
  list: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  bell: 'M6 9a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6zm4 9a2 2 0 004 0',
  bars: 'M5 20V9m7 11V4m7 16v-8M3 20h18',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  store: 'M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9c0 1.4 1.2 2.5 2.7 2.5S9.3 10.4 9.3 9c0 1.4 1.2 2.5 2.7 2.5s2.7-1.1 2.7-2.5c0 1.4 1.2 2.5 2.7 2.5S20 10.4 20 9M9.5 20v-6h5v6',
  speaker: 'M4 10v4h3l5 4V6L7 10H4zm11-1a4.5 4.5 0 010 6m2.5-9a8 8 0 010 12',
  mute: 'M4 10v4h3l5 4V6L7 10H4zm11 0l5 4m0-4l-5 4',
  // ── governance & platform ──────────────────────────────────────────
  document: 'M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6zM14 3v6h6M9 13h6M9 17h6',
  gift: 'M20 12v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8M2 8h20v4H2zM12 8v13M12 8c-1.5-3-5-3-5-3 0-1.5 1.5-3 3-2 1.3.8 2 3 2 5M12 8c1.5-3 5-3 5-3 0-1.5-1.5-3-3-2-1.3.8-2 3-2 5',
  trending: 'M23 6l-9.5 9.5-4-4L2 19M23 6h-6M23 6v6',
  wrench: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z',
  banknote: 'M2 7h20v10H2zM12 15a3 3 0 100-6 3 3 0 000 6zM6 10h.01M18 14h.01',
  globe: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.5 3.5 6 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-6-3.5-9s1-6.5 3.5-9z',
  shield: 'M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6l8-3zM8 12l3 3 5-5',
  settings: 'M4 7h16M4 12h16M4 17h16M9 5v4M15 10v4M11 15v4',
};

export default function AdminIcon({ name, className = 'w-[18px] h-[18px]', strokeWidth = 1.8 }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
         className={`${className} shrink-0`} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
