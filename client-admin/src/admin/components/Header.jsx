import { useNavigate } from 'react-router-dom';
import { adminLogout, clearCsrfToken } from '../../api/adminApi';
import { useLanguage } from '../../i18n';
import LanguageToggle from './LanguageToggle';
import AdminThemeToggle from './AdminThemeToggle';
import NotificationCenter from './NotificationCenter';

export default function Header({ title, subtitle, onMenuToggle, actions }) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleLogout = async () => {
    await adminLogout();
    clearCsrfToken();
    navigate('/');
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Toggle menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{title}</h1>
          {subtitle && <p className="text-xs sm:text-sm text-gray-500 truncate">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {actions}
        <LanguageToggle />
        <AdminThemeToggle />
        <NotificationCenter />
        <button
          onClick={handleLogout}
          className="px-3 py-2 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5"
          title={t('Logout')}
        >
          <svg className="w-4 h-4 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          <span className="hidden sm:inline">{t('Logout')}</span>
        </button>
      </div>
    </header>
  );
}
