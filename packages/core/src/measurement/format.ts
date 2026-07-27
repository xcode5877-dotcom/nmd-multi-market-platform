import {
  baseMilliToDisplayMilli,
  milliToNormalizedString,
  parseMeasurementDecimalStrict,
} from './decimal.js';
import type { BaseUnitCode, DisplayUnitCode } from './types.js';
import { arabicUnitLabel } from './units.js';

export type FormatQuantityInput = {
  quantityBase: string | number;
  baseUnitCode: BaseUnitCode;
  displayUnitCode: DisplayUnitCode;
  /**
   * Preferred maximum decimal digits for display (0–3).
   * Never rounds into a different commercial amount.
   * If the preferred precision cannot represent the value exactly,
   * displayed precision is automatically raised (up to scale 3).
   */
  displayPrecision?: number | null;
  locale?: 'ar';
};

/**
 * Format a base-unit quantity for display.
 * Converts to g/ml only for display. Never alters pricing/source quantity.
 *
 * Commercial quantity formatting must preserve the exact normalized stored value
 * (trim trailing zeros only). displayPrecision is a preference, not permission
 * to alter quantity meaning.
 */
export function formatQuantity(input: FormatQuantityInput): string {
  const parsed = parseMeasurementDecimalStrict(input.quantityBase);
  if (!parsed.ok) return `0 ${arabicUnitLabel(input.displayUnitCode)}`;

  const displayMilli = baseMilliToDisplayMilli(
    parsed.milli,
    input.baseUnitCode,
    input.displayUnitCode
  );

  const label = arabicUnitLabel(input.displayUnitCode);
  const isAtomicDisplay =
    input.displayUnitCode === 'g' ||
    input.displayUnitCode === 'ml' ||
    input.displayUnitCode === 'piece' ||
    input.displayUnitCode === 'pack' ||
    input.displayUnitCode === 'box' ||
    input.displayUnitCode === 'bundle';

  // Exact display amount string from milli-units (no float artefacts)
  let amountStr: string;
  if (isAtomicDisplay) {
    // g/ml/piece/… — show whole numbers when exact (250 غرام)
    if (displayMilli % 1000 === 0) {
      amountStr = String(displayMilli / 1000);
    } else {
      amountStr = milliToNormalizedString(displayMilli);
    }
  } else {
    amountStr = milliToNormalizedString(displayMilli);
  }

  // displayPrecision may only trim further if the value is still exact;
  // otherwise auto-raise to the minimum required scale (≤ 3).
  const preferred =
    input.displayPrecision != null &&
    Number.isInteger(input.displayPrecision) &&
    input.displayPrecision >= 0 &&
    input.displayPrecision <= 3
      ? input.displayPrecision
      : null;

  if (preferred != null) {
    amountStr = formatWithPreferredPrecision(amountStr, preferred);
  }

  return `${amountStr} ${label}`;
}

/**
 * Prefer `preferred` decimal places only when the value is exactly representable
 * at that scale (after trimming zeros). Otherwise keep the exact normalized value.
 */
function formatWithPreferredPrecision(exactNormalized: string, preferred: number): string {
  const required = decimalPlacesOf(exactNormalized);
  const effective = Math.max(preferred, required);
  // effective is always >= required, so toFixed(effective) is exact for our milli scale
  const n = Number(exactNormalized);
  if (!Number.isFinite(n)) return exactNormalized;
  if (effective === 0) {
    // Only allowed when required === 0 (integer)
    return String(Math.trunc(n));
  }
  const fixed = n.toFixed(effective);
  return fixed.replace(/0+$/, '').replace(/\.$/, '');
}

function decimalPlacesOf(normalized: string): number {
  const i = normalized.indexOf('.');
  return i < 0 ? 0 : normalized.length - i - 1;
}
