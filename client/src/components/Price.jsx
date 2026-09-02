import { useCurrency, formatAmount } from '../context/CurrencyContext';
import { useLanguage } from '../i18n';
import EgpSymbol from './EgpSymbol';
import './Price.css';

/**
 * Localized price line — the store's single source of truth for money display.
 *
 * Arabic:  ١٢٤٩ جنيه مصري   (Aref Ruqaa wordmark, gold)
 * English: 1249 EGP   (engraved italic serif, gold)
 * No grouping separators: 1200 stays 1200. variant overrides per-spot.
 */
export default function Price({ cents, currency, className = '', decimals = 2 }) {
  const { code } = useCurrency();
  const { lang } = useLanguage();
  const cur = currency || code;
  const hindi = lang === 'ar';
  const amount = formatAmount(cents, decimals, hindi);

  if (cur === 'EGP' || cur === 'EGP-TXT') {
    return (
      <span className={`price-egp ${className}`} dir={hindi ? 'rtl' : 'ltr'}>
        <span className="price-egp-amount">{amount}</span>
        {hindi
          ? <span className="price-egp-word" aria-label="Egyptian Pound">جنيه مصري</span>
          : <span className="price-egp-word-en" aria-label="Egyptian Pound">EGP</span>}
      </span>
    );
  }

  return <span className={`whitespace-nowrap ${className}`}>{amount}</span>;
}
