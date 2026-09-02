import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../i18n';
import { animateSwitch } from '../utils/fx';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t, isRTL } = useLanguage();
  const knobPos = theme === 'dark'
    ? (isRTL ? '-translate-x-7' : 'translate-x-7')
    : (isRTL ? '-translate-x-0.5' : 'translate-x-0.5');

  return (
    <button
      onClick={() => {
        const dark = document.documentElement.classList.contains('dark');
        animateSwitch({
          content: theme === 'dark' ? t('Light Mode') : t('Dark Mode'),
          color: dark ? '#f4f1ea' : '#101c2c',
          textColor: dark ? '#1a2332' : '#e9c46a',
          apply: toggleTheme,
        });
      }}
      className="relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-dark-900"
      style={{
        backgroundColor: theme === 'dark' ? '#3d5a80' : '#e7e1d2'
      }}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <div
        className={`absolute top-0.5 start-0.5 w-6 h-6 rounded-full transition-transform duration-300 flex items-center justify-center ${knobPos}`}
        style={{
          backgroundColor: theme === 'dark' ? '#121c30' : '#ffffff'
        }}
      >
        {theme === 'dark' ? (
          <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
          </svg>
        )}
      </div>
    </button>
  );
}
