import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ar } from './translations';
import { animateSwitch } from '../utils/fx';

const LanguageContext = createContext();
const STORAGE_KEY = 'lang';

function initialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'ar' || saved === 'en') return saved;
  } catch { /* ignore */ }
  // Default to Arabic for browsers whose primary language is Arabic
  if (typeof navigator !== 'undefined' && (navigator.language || '').toLowerCase().startsWith('ar')) {
    return 'ar';
  }
  return 'en';
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(initialLang);
  const [toast, setToast] = useState(null);
  const busyRef = useRef(false);
  const timers = useRef([]);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => clearTimers, []);

  useEffect(() => {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
  }, [lang]);

  // Premium circular-wipe transition; a toast confirms once it settles.
  const toggleLanguage = useCallback((e) => {
    if (busyRef.current) return;
    busyRef.current = true;
    const next = lang === 'ar' ? 'en' : 'ar';
    const toArabic = next === 'ar';
    // Wipe follows the active theme so the moment always feels native
    const dark = document.documentElement.classList.contains('dark');
    animateSwitch({
      content: toArabic ? 'العربية' : 'English',
      origin: e ? { x: e.clientX, y: e.clientY } : undefined,
      color: dark ? '#101c2c' : '#f4f1ea',
      textColor: dark ? '#e9c46a' : '#1a2332',
      apply: () => setLang(next),
    });
    timers.current.push(setTimeout(() => {
      setToast(toArabic ? 'تم التبديل إلى العربية' : 'Switched to English');
      timers.current.push(setTimeout(() => { setToast(null); busyRef.current = false; }, 1600));
    }, 700));
  }, [lang]);

  // t('Products') → العربية when active; falls back to the English input
  const t = useCallback((key) => {
    if (lang !== 'ar') return key;
    return ar[key] ?? key;
  }, [lang]);

  const value = {
    lang,
    setLang,
    toggleLanguage,
    t,
    dir: lang === 'ar' ? 'rtl' : 'ltr',
    isRTL: lang === 'ar',
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}

      {/* Confirmation popup */}
      <div className={`lang-toast ${toast ? 'show' : ''}`} role="status">
        {toast || ''}
      </div>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}

/**
 * Pick a localized field from a database row.
 * localized(lang, product, 'name') → name_ar when Arabic is active and set,
 * otherwise the English value. Safe on missing rows/fields.
 */
export function localized(lang, row, field) {
  if (!row) return '';
  if (lang === 'ar') {
    const arVal = row[`${field}_ar`];
    if (arVal !== undefined && arVal !== null && String(arVal).trim() !== '') return arVal;
  }
  return row[field] ?? '';
}
