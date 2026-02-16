/**
 * Centralized currency formatter for Israeli Shekel (₪).
 * Uses Intl.NumberFormat with he-IL for RTL-friendly output.
 */
export interface FormatMoneyOptions {
  /** Currency code (default ILS) */
  currency?: string;
  /** Locale for formatting (default he-IL for RTL) */
  locale?: string;
  /** Minimum fraction digits */
  minimumFractionDigits?: number;
  /** Maximum fraction digits */
  maximumFractionDigits?: number;
}

/**
 * Format amount as Israeli Shekel (₪).
 * Handles NaN/invalid safely; integers and floats supported.
 */
export function formatMoney(
  amount: number,
  opts: FormatMoneyOptions = {}
): string {
  const {
    currency = 'ILS',
    locale = 'he-IL',
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
  } = opts;

  const n = Number(amount);
  if (Number.isNaN(n) || !Number.isFinite(n)) return '₪ 0';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(n);
}
