import { useEffect, useReducer } from 'react';
import { getSettings } from '../api/adminApi';
import { useLanguage } from '../i18n';

// Shared currency state for the admin panel — reads the `currency` setting
// (Settings -> General) and updates every page that uses useAdminCurrency().

const SYMBOLS = {
  EGP: 'EGP', 'EGP-TXT': 'EGP', USD: '$', EUR: '€', GBP: '£', SAR: 'ر.س', AED: 'د.إ', KWD: 'د.ك',
  QAR: 'ر.ق', BHD: 'د.ب', OMR: 'ر.ع', JOD: 'د.أ', LBP: 'ل.ل', MAD: 'د.م.', DZD: 'د.ج',
  TND: 'د.ت', LYD: 'ل.د', IQD: 'ع.د', TRY: '₺', ILS: '₪', INR: '₹', CNY: '¥', JPY: '¥',
  KRW: '₩', THB: '฿', VND: '₫', MYR: 'RM', IDR: 'Rp', PHP: '₱', SGD: 'S$', HKD: 'HK$',
  AUD: 'A$', CAD: 'C$', CHF: 'CHF', SEK: 'kr', NOK: 'kr', DKK: 'kr', PLN: 'zł', CZK: 'Kč',
  HUF: 'Ft', RON: 'lei', UAH: '₴', RUB: '₽', BRL: 'R$', MXN: '$', ZAR: 'R', NGN: '₦',
};

let code = 'EGP';
let ready = false;
const subscribers = new Set();

export function formatPrice(cents, decimals = 2, hindi = false) {
  const amount = ((cents ?? 0) / 100).toLocaleString(hindi ? 'ar-EG' : 'en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const symbol = SYMBOLS[code] || code;
  return `${amount} ${symbol}`;
}

function notify() {
  subscribers.forEach(fn => fn());
}

/** True when the admin panel is in Arabic mode — reads <html lang>, hook-free. */
export function adminHindi() {
  try {
    return typeof document !== 'undefined' && document.documentElement.lang === 'ar';
  } catch { return false; }
}

/** Amount only (no symbol) — locale-aware digits, mirroring the storefront. */
export function formatAmount(cents, decimals = 2, hindi) {
  const h = hindi ?? adminHindi();
  return ((cents ?? 0) / 100).toLocaleString(h ? 'ar-EG' : 'en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function initAdminCurrency() {
  if (ready) return Promise.resolve(code);
  return getSettings()
    .then(res => {
      const s = (res.data || []).find(x => x.key === 'currency');
      if (s && s.value) code = String(s.value);
      ready = true;
      notify();
      return code;
    })
    .catch(() => {
      ready = true;
      notify();
      return code;
    });
}

/** Reactive hook — re-renders the page once the currency is loaded */
export function useAdminCurrency() {
  const [, force] = useReducer(x => x + 1, 0);
  const { lang } = useLanguage();
  useEffect(() => {
    if (!ready) {
      subscribers.add(force);
      initAdminCurrency();
      return () => subscribers.delete(force);
    }
  }, []);
  // Arabic mode renders Hindi digits (ar-EG), mirroring the storefront.
  return { code, format: (cents, decimals = 2) => formatPrice(cents, decimals, lang === 'ar') };
}
