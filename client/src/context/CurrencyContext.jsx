import { createContext, useContext, useEffect, useState } from 'react';
import { getPublicSetting } from '../api/settings';
import { useLanguage } from '../i18n';

// Currency symbols for all supported currencies (see admin Settings -> General)
const SYMBOLS = {
  EGP: 'EGP', 'EGP-TXT': 'EGP', USD: '$', EUR: '€', GBP: '£', SAR: 'ر.س', AED: 'د.إ', KWD: 'د.ك',
  QAR: 'ر.ق', BHD: 'د.ب', OMR: 'ر.ع', JOD: 'د.أ', LBP: 'ل.ل', MAD: 'د.م.', DZD: 'د.ج',
  TND: 'د.ت', LYD: 'ل.د', IQD: 'ع.د', SYP: 'ل.س', YER: 'ر.ي', SDG: 'ج.س', TRY: '₺',
  IRR: '﷼', ILS: '₪', INR: '₹', PKR: '₨', BDT: '৳', LKR: 'රු', CNY: '¥', JPY: '¥',
  KRW: '₩', THB: '฿', VND: '₫', MYR: 'RM', IDR: 'Rp', PHP: '₱', SGD: 'S$', HKD: 'HK$',
  AUD: 'A$', NZD: 'NZ$', CAD: 'C$', CHF: 'CHF', SEK: 'kr', NOK: 'kr', DKK: 'kr',
  PLN: 'zł', CZK: 'Kč', HUF: 'Ft', RON: 'lei', BGN: 'лв', UAH: '₴', RUB: '₽', GEL: '₾',
  AMD: '֏', AZN: '₼', KZT: '₸', UZS: "so'm", BRL: 'R$', MXN: '$', ARS: '$', CLP: '$',
  COP: '$', PEN: 'S/', VES: 'Bs', ZAR: 'R', NGN: '₦', KES: 'KSh', GHS: '₵', ETB: 'Br',
  TZS: 'TSh', UGX: 'USh', XOF: 'CFA', XAF: 'FCFA',
};

/** Amount only — NO currency symbol, NO grouping separators: 1200 / ١٢٠٠ */
export function formatAmount(cents, decimals = 2, hindi = false) {
  return ((cents ?? 0) / 100).toLocaleString(hindi ? 'ar-EG' : 'en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: false,
  });
}

/** Legacy combined string (symbol included) — used by older call sites. */
export function formatPrice(cents, code, decimals = 2, hindi = false) {
  const amount = formatAmount(cents, decimals, hindi);
  const symbol = SYMBOLS[code] || code;
  return `${amount} ${symbol}`;
}

const CurrencyContext = createContext({ code: 'EGP', symbol: 'ج.م', format: (c) => formatPrice(c, 'EGP') });

export function CurrencyProvider({ children }) {
  const [code, setCode] = useState('EGP');
  const { lang } = useLanguage();

  // The admin sets the currency in Settings -> General; it applies to ALL users.
  useEffect(() => {
    getPublicSetting('currency', 'EGP')
      .then(v => {
        if (v && typeof v === 'string' && v.trim()) setCode(v.trim());
      })
      .catch(() => {});
  }, []);

  // Arabic display uses Hindi digits; English keeps Western digits.
  // No grouping separators — 1200 stays 1200 in every locale.
  const format = (cents, decimals = 2, hindi = lang === 'ar') =>
    formatPrice(cents, code, decimals, hindi);
  const formatClean = (cents, decimals = 2, hindi = lang === 'ar') =>
    formatAmount(cents, decimals, hindi);

  return (
    <CurrencyContext.Provider value={{ code, symbol: SYMBOLS[code] || code, format, formatClean: formatAmount }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
