/**
 * Global currency: ILS (Israeli Shekel). Display as ₪ or شيكل in UI.
 * Uses Western numerals (1,2,3) and 2 decimal places for financial amounts.
 */
export interface FormatMoneyOptions {
  /** Currency code (default ILS) */
  currency?: string;
  /** Minimum fraction digits (default 2 for money) */
  minimumFractionDigits?: number;
  /** Maximum fraction digits (default 2) */
  maximumFractionDigits?: number;
}

/**
 * Round to 2 decimal places for money (avoids floating-point errors in price × quantity).
 */
export function roundMoney(amount: number): number {
  const n = Number(amount);
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/**
 * Format amount as Israeli Shekel (₪). Gregorian/Western numerals only.
 * Financial numbers: 2 decimal places. Handles NaN/invalid safely.
 */
export function formatMoney(
  amount: number,
  opts: FormatMoneyOptions = {}
): string {
  const {
    currency = 'ILS',
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = opts;

  const n = Number(amount);
  if (Number.isNaN(n) || !Number.isFinite(n)) return '₪0.00';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(n);
}
