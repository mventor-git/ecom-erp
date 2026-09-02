import { useLanguage } from '../../i18n';

/**
 * EN | ع pill toggle — switches the whole admin UI between English (LTR)
 * and Arabic (RTL). Choice persisted per browser via LanguageProvider.
 */
export default function LanguageToggle() {
  const { lang, toggleLanguage, isRTL } = useLanguage();

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center rounded-full border border-gray-200 bg-gray-50 p-0.5 text-xs font-semibold transition-colors hover:border-primary-300"
      title={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
      aria-label="Language toggle"
    >
      <span className={`rounded-full px-2.5 py-1 transition-colors ${!isRTL ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-500'}`}>
        EN
      </span>
      <span className={`rounded-full px-2.5 py-1 transition-colors ${isRTL ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-500'}`}>
        ع
      </span>
    </button>
  );
}
