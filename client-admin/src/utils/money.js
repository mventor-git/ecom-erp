/**
 * Money utilities — the single source of the EGP↔cents invariant.
 *
 * Business rule (project-wide): monetary values are stored in the database as
 * INTEGER minor units ("cents"). The UI inputs present user-readable major
 * units ("EGP", up to 2 decimals).
 *
 *   DB (INTEGER cents)  <--  centsToEGPInput  --  UI (human EGP string)
 *   UI (human EGP)      --  egpToCents        -->  DB (INTEGER cents)
 *
 * These helpers are PURE (no React, no I/O) so they can be unit-tested.
 * Keep this module dependency-free.
 */

const DECIMAL_RE = /^-?\d+(\.\d+)?$/;
export const MAX_EGP_DECIMALS = 2;

/**
 * Convert INTEGER cents to a plain major-unit string for an <input> value.
 * No symbol, no thousands separator, no trailing ".00" unless the fraction
 * is non-zero. Example: 25000 -> "250", 9999 -> "99.99", 50 -> "0.5", 0 -> "0".
 * Returns '' for null/undefined/NaN so the field can render blank.
 */
export function centsToEGPInput(cents) {
  // null/undefined/''/whitespace must render blank (not '0'), because
  // Number(null) === 0 and Number('') === 0 would otherwise show "0".
  if (cents == null) return '';
  const text = String(cents).trim();
  if (text === '') return '';
  const n = Number(text);
  if (!Number.isFinite(n)) return '';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(Math.round(n));
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  return sign + whole + (frac ? '.' + String(frac).padStart(2, '0') : '');
}

/**
 * Validate + convert a human EGP value to INTEGER cents.
 * Returns { ok: true, cents } on success, or { ok: false, reason } where
 * reason is one of: 'empty' | 'malformed' | 'negative' | 'too_precise'.
 *
 * - empty        : required field left blank
 * - malformed    : not a plain decimal number (letters, exponent, commas)
 * - negative     : < 0
 * - too_precise  : more than 2 decimal places
 */
export function egpToCents(value) {
  const text = value == null ? '' : String(value).trim();
  if (text === '') return { ok: false, reason: 'empty' };
  // Guard against whitespace-only / non-string primitives being coerced to 0.
  if (value !== null && typeof value !== 'number' && String(value).trim() === '') return { ok: false, reason: 'empty' };
  if (!DECIMAL_RE.test(text)) return { ok: false, reason: 'malformed' };
  const n = Number(text);
  if (!Number.isFinite(n)) return { ok: false, reason: 'malformed' };
  if (n < 0) return { ok: false, reason: 'negative' };
  const decimals = text.includes('.') ? text.split('.')[1].length : 0;
  if (decimals > MAX_EGP_DECIMALS) return { ok: false, reason: 'too_precise' };
  const cents = Math.round(n * 100); // n*100 is safe for |n| < 9e13; prices are far below that
  if (!Number.isSafeInteger(cents)) return { ok: false, reason: 'malformed' };
  return { ok: true, cents };
}

/** Human-readable reason for a {ok:false} result — used for form error text. */
export function egpErrorText(reason) {
  switch (reason) {
    case 'empty': return 'Required';
    case 'malformed': return 'Enter a valid number';
    case 'negative': return 'Cannot be negative';
    case 'too_precise': return `Max ${MAX_EGP_DECIMALS} decimals`;
    default: return 'Invalid value';
  }
}
