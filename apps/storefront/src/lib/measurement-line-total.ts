import { calculateLineSubtotal, roundMoney } from '@nmd/core';

/** True when product/line should use WEIGHT/VOLUME (fixed-modifier) pricing. */
export function isWeightBasedLine(item: {
  isWeightBased?: boolean;
  measurementType?: string;
  measurementTypeSnapshot?: string;
  quantityStep?: number | string;
}): boolean {
  const t = item.measurementTypeSnapshot ?? item.measurementType;
  if (t === 'WEIGHT' || t === 'VOLUME') return true;
  if (item.isWeightBased === true) return true;
  const step = Number(item.quantityStep ?? 1);
  return Number.isFinite(step) && step > 0 && step < 1;
}

/**
 * Storefront line total using agora/milli math (matches server Measurement V2).
 * WEIGHT/VOLUME: (unitPrice × qty) + fixedModifier; PIECE: unitPrice × qty (options already in unitPrice).
 */
export function storefrontLineTotal(input: {
  unitPrice: number;
  quantity: number | string;
  isWeightBased: boolean;
  /** Fixed per-line modifier total for WEIGHT/VOLUME only. */
  fixedModifier?: number;
}): number {
  const productPart = calculateLineSubtotal(input.unitPrice, input.quantity);
  if (!input.isWeightBased) return productPart;
  const mod = roundMoney(Number(input.fixedModifier) || 0);
  return roundMoney(productPart + mod);
}
