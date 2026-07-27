import { formatMoney } from './utils/money.js';

export { formatDateGregorian, formatDateTimeGregorian, formatTimeGregorian, formatDateISO, formatRelativeTimeAr } from './utils/dates.js';
export { sortByOperationalStatus } from './utils/store-sort.js';
export { customerUnitPrice, customerComparePrice } from './utils/customer-price.js';

/**
 * Format price for display (ILS ₪, 2 decimals, Western numerals).
 * @deprecated Prefer formatMoney from './utils/money'
 */
export function formatPrice(amount: number): string {
  return formatMoney(amount);
}

/**
 * Generate a unique ID (simple, for mock/local use)
 */
export function generateId(): string {
  return crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
