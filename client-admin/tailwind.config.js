/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Teal — ADMIN brand primary/action color ──
        // DECISION (locked): the Admin ERP primary = Clinical Teal #1f857a.
        // Dark mode already tints primary to #83d2c9/#b3e5de; this ramp makes
        // the light mode match. The Customer Storefront keeps its own terracotta
        // identity (client/tailwind.config.js) — unchanged.
        primary: {
          50: '#edf7f5',
          100: '#d6ece8',
          200: '#a9d9d1',
          300: '#7cc2b9',
          400: '#4fa89e',
          500: '#34958a',
          600: '#1f857a',
          700: '#16655d',
          800: '#12504a',
          900: '#0e3f3a',
        },
        // ── Warm Stone neutrals — replace Tailwind default gray everywhere ──
        // Softer, warmer, more premium than the default cool gray ramp.
        gray: {
          50:  '#fafaf9',
          100: '#f5f5f4',
          200: '#e7e5e4',
          300: '#d6d3d1',
          400: '#a8a29e',
          500: '#78716c',
          600: '#57534e',
          700: '#44403c',
          800: '#292524',
          900: '#1c1917',
          950: '#0c0a09',
        },
        // ── Dark surface tokens (one dark mode) ──
        // Resolves `dark:bg-dark-NNN` used in DocumentViewer / InventoryDashboard /
        // IssueOrdersList. Aligned to the authoritative dark body `#101c2c` so
        // undefined `dark-NNN` classes no longer fall through unstyled.
        dark: {
          100: '#37424f',
          300: '#2b3543',
          500: '#24303f',
          600: '#1f2b39',
          700: '#1a2533',
          800: '#16202c',
          900: '#101c2c',
          950: '#0b1420',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Cairo', 'Tajawal', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
