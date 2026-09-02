/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Prestige palette — warm ivory light / deep navy dark / mint gold,
        // matching the EGP price-mark previews (egp-final-*.html).
        gray: {
          50: '#faf8f3',   // ivory wash
          100: '#f4f0e6',
          200: '#e7e1d2',
          300: '#d3cbb8',
          400: '#a89f8b',
          500: '#877e6d',
          600: '#6b6355',
          700: '#524c41',
          800: '#3a362e',
          900: '#26231d',
        },
        gold: {
          DEFAULT: '#a8811f',
          light: '#e9c46a',
          pale: '#f4ead0',
        },
        // Muted, mint-smooth status colors — no harsh pure greens/reds.
        green: {
          // warm sage-khaki: reads as 'positive' without going green
          50: '#f3f3ec',
          100: '#e6e6da',
          200: '#cdcfba',
          300: '#a9b193',
          400: '#83906c',
          500: '#65744f',
          600: '#4f5c3e',
          700: '#404a34',
          800: '#363d2d',
          900: '#2e3428',
        },
        red: {
          50: '#f9efec',
          100: '#f2ded7',
          200: '#e4bdb2',
          300: '#cf9486',
          400: '#bb6a5b',
          500: '#a64b3f',
          600: '#8b3d33',
          700: '#72332b',
          800: '#5d2c26',
          900: '#4c2621',
        },
        primary: {
          // SUPER MATCH with admin light: Claude-style clay on ivory
          50: '#fdf5f0',
          100: '#fae8de',
          200: '#f4cdbb',
          300: '#ecab8f',
          400: '#e08763',
          500: '#d97757',
          600: '#c65f3e',
          700: '#a54d33',
          800: '#853e2a',
          900: '#6b3424',
        },
        dark: {
          50: '#f5efdd',
          100: '#ece4cf',
          200: '#dccfae',
          300: '#b3a67f',
          400: '#8a8067',
          500: '#6b6555',
          600: '#4d4a42',
          700: '#33405a',
          800: '#1a2841',
          850: '#152238',
          900: '#121c30',
          950: '#101c2c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Cairo', 'Tajawal', 'system-ui', '-apple-system', 'sans-serif'],
      },
      backgroundImage: {
        'glass': 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
        'glass-dark': 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0,0,0,0.12)',
        'glass-lg': '0 16px 48px rgba(0,0,0,0.15)',
        'glass-inner': 'inset 0 1px 0 rgba(255,255,255,0.1)',
        'glow': '0 0 20px rgba(198,95,62,0.30)',
        'glow-lg': '0 0 40px rgba(198,95,62,0.40)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};
