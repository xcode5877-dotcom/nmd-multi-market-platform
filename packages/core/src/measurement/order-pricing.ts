/**
 * Phase B.1 — server-authoritative line pricing using integer minor units.
 *
 * Money: agora (1 ILS = 100 agora).
 * Quantity: milli (1 base unit = 1000 milli).
 *
 * lineSubtotalAgora = round((unitPriceAgora * quantityMilli) / 1000)
 */

import { parseMeasurementDecimalStrict } from './decimal.js';

const AGORA = 100;
const MILLI = 1000;

export function shekelsToAgora(amount: unknown): number | null {
  if (amount == null || amount === '') return null;
  if (typeof amount === 'number') {
    if (!Number.isFinite(amount)) return null;
    return Math.round(amount * AGORA);
  }
  const s = String(amount).trim();
  if (!s || /[eE]/.test(s) || !/^-?\d+(\.\d+)?$/.test(s)) return null;
  const frac = s.match(/^-?\d+\.(\d+)$/);
  if (frac && frac[1].length > 2) {
    // Allow exactly 2dp money; reject excess money precision
    // Still accept catalog floats with more dp by rounding to agora
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * AGORA);
}

export function agoraToShekels(agora: number): number {
  return Math.round(agora) / AGORA;
}

/**
 * Calculate line subtotal from unit price (shekels) × quantity (decimal string / milli).
 * Returns shekels rounded to 2dp via integer agora math.
 */
export function calculateLineSubtotal(unitPriceShekels: unknown, quantity: unknown): number {
  const unitAgora = shekelsToAgora(unitPriceShekels);
  if (unitAgora == null) return 0;
  const qty =
    typeof quantity === 'number' && Number.isInteger(quantity) && Math.abs(quantity) < 1e12
      ? { ok: true as const, milli: quantity * MILLI }
      : parseMeasurementDecimalStrict(quantity);
  if (!qty.ok) return 0;
  const subtotalAgora = Math.round((unitAgora * qty.milli) / MILLI);
  return agoraToShekels(subtotalAgora);
}

/** True when client-supplied money differs from authoritative by more than 1 agora. */
export function moneyMismatch(client: unknown, authoritativeShekels: number): boolean {
  const clientAgora = shekelsToAgora(client);
  if (clientAgora == null) return false;
  return Math.abs(clientAgora - Math.round(authoritativeShekels * AGORA)) > 1;
}
