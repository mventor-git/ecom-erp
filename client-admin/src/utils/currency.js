import { useEffect, useReducer } from 'react';
import { getSettings } from '../api/adminApi';

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

export function formatPrice(cents, decimals = 2) {
  const amount = ((cents ?? 0) / 100).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  const symbol = SYMBOLS[code] || code;
  return `${amount} ${symbol}`;
}

function notify() {
  subscribers.forEach(fn => fn());
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
  useEffect(() => {
    if (!ready) {
      subscribers.add(force);
      initAdminCurrency();
      return () => subscribers.delete(force);
    }
  }, []);
  return { code, format: (cents, decimals = 2) => formatPrice(cents, decimals) };
}
