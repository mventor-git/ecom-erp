import { useState } from 'react';
import { getTheme, toggleTheme } from '../../utils/theme';
import { animateSwitch } from '../../utils/fx';

/** Compact dark/light pill for the admin top bar, beside the language toggle. */
export default function AdminThemeToggle() {
  const [theme, setThemeState] = useState(getTheme);

  return (
    <button
      onClick={(e) => animateSwitch({
        content: theme !== 'dark' ? 'Dark' : 'Light',
        origin: e ? { x: e.clientX, y: e.clientY } : undefined,
        color: theme !== 'dark' ? '#101c2c' : '#f4f1ea',
        textColor: theme !== 'dark' ? '#e9c46a' : '#1a2332',
        apply: () => setThemeState(toggleTheme()),
      })}
      className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Theme toggle"
    >
      {theme === 'dark' ? (
        // sun
        <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
        </svg>
      ) : (
        // moon
        <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 20 20">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      )}
    </button>
  );
}
