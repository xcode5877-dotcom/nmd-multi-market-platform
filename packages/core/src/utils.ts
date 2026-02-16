import { formatMoney } from './utils/money.js';

/**
 * Format price for display (ILS ₪).
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
