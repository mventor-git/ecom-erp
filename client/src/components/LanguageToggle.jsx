import { useLanguage } from '../i18n';

/**
 * EN | ع pill toggle — switches the storefront between English (LTR)
 * and Arabic (RTL). Choice persisted per browser via LanguageProvider.
 */
export default function LanguageToggle({ compact = false }) {
  const { lang, toggleLanguage, isRTL } = useLanguage();

  return (
    <button
      onClick={(e) => toggleLanguage(e)}
      className="flex items-center rounded-full border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-sm p-0.5 text-xs font-semibold transition-colors hover:border-primary-400/50"
      title={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
      aria-label="Language toggle"
    >
      <span className={`rounded-full px-2.5 py-1 transition-colors ${!isRTL ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
        EN
      </span>
      <span className={`rounded-full px-2.5 py-1 transition-colors ${isRTL ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
        ع
      </span>
    </button>
  );
}
