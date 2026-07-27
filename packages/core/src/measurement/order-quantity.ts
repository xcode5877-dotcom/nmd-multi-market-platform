/**
 * Phase B.1 — order quantity parse / validate (milli-integer arithmetic only).
 *
 * Step alignment anchor:
 *   anchor = minimumQuantity (always present on resolved ProductMeasurement)
 *   valid iff (quantityMilli - anchorMilli) % stepMilli === 0
 *   and quantityMilli >= anchorMilli
 *   and (maximumQuantity == null || quantityMilli <= maximumMilli)
 */

import { isIntegerMilli, milliToNormalizedString, parseMeasurementDecimalStrict } from './decimal.js';
import type { ProductMeasurement } from './types.js';

export type OrderQuantityErrorCode =
  | 'INVALID_QUANTITY'
  | 'QUANTITY_BELOW_MINIMUM'
  | 'QUANTITY_ABOVE_MAXIMUM'
  | 'QUANTITY_STEP_MISMATCH'
  | 'FRACTIONAL_PIECE_QUANTITY'
  | 'MEASUREMENT_NOT_SUPPORTED'
  | 'INVALID_MEASUREMENT_CONFIG'
  | 'WEIGHTED_STOCK_NOT_SUPPORTED';

export interface OrderQuantityError {
  code: OrderQuantityErrorCode;
  error: string;
  details?: {
    requestedQuantity?: unknown;
    quantityStep?: string;
    minimumQuantity?: string;
    maximumQuantity?: string | null;
    baseUnitCode?: string;
    measurementType?: string;
    productId?: string;
  };
}

export type ParseOrderQuantityResult =
  | { ok: true; milli: number; normalized: string }
  | { ok: false; error: OrderQuantityError };

export type ValidateQuantityResult =
  | { ok: true; milli: number; normalized: string }
  | { ok: false; error: OrderQuantityError };

/** Reject scientific notation and other unsafe numeric strings. */
export function parseOrderQuantity(value: unknown): ParseOrderQuantityResult {
  if (value == null || value === '') {
    return {
      ok: false,
      error: {
        code: 'INVALID_QUANTITY',
        error: 'Quantity is required',
        details: { requestedQuantity: value },
      },
    };
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/[eE]/.test(trimmed)) {
      return {
        ok: false,
        error: {
          code: 'INVALID_QUANTITY',
          error: 'Scientific notation is not allowed',
          details: { requestedQuantity: value },
        },
      };
    }
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return {
        ok: false,
        error: {
          code: 'INVALID_QUANTITY',
          error: 'Quantity must be a finite number',
          details: { requestedQuantity: value },
        },
      };
    }
  }

  const parsed = parseMeasurementDecimalStrict(value);
  if (!parsed.ok) {
    return {
      ok: false,
      error: {
        code: 'INVALID_QUANTITY',
        error: `Invalid quantity (${parsed.reason})`,
        details: { requestedQuantity: value },
      },
    };
  }

  if (parsed.milli <= 0) {
    return {
      ok: false,
      error: {
        code: 'INVALID_QUANTITY',
        error: 'Quantity must be greater than 0',
        details: { requestedQuantity: parsed.normalized },
      },
    };
  }

  return { ok: true, milli: parsed.milli, normalized: parsed.normalized };
}

export function normalizeQuantityDecimal(value: unknown): string | null {
  const parsed = parseOrderQuantity(value);
  return parsed.ok ? parsed.normalized : null;
}

export function serializeOrderQuantity(milli: number): string {
  return milliToNormalizedString(milli);
}

/**
 * Validate requested quantity against a resolved ProductMeasurement.
 * Uses milli integers — no floating-point commercial math.
 */
export function validateQuantityAgainstMeasurement(
  requested: unknown,
  measurement: ProductMeasurement,
  extras?: { productId?: string }
): ValidateQuantityResult {
  const parsed = parseOrderQuantity(requested);
  if (!parsed.ok) {
    return {
      ok: false,
      error: {
        ...parsed.error,
        details: {
          ...parsed.error.details,
          quantityStep: measurement.quantityStep,
          minimumQuantity: measurement.minimumQuantity,
          maximumQuantity: measurement.maximumQuantity,
          baseUnitCode: measurement.baseUnitCode,
          measurementType: measurement.measurementType,
          productId: extras?.productId,
        },
      },
    };
  }

  const step = parseMeasurementDecimalStrict(measurement.quantityStep);
  const min = parseMeasurementDecimalStrict(measurement.minimumQuantity);
  if (!step.ok || !min.ok || step.milli <= 0 || min.milli <= 0) {
    return {
      ok: false,
      error: {
        code: 'INVALID_MEASUREMENT_CONFIG',
        error: 'Product measurement configuration is invalid',
        details: {
          requestedQuantity: parsed.normalized,
          productId: extras?.productId,
          baseUnitCode: measurement.baseUnitCode,
          measurementType: measurement.measurementType,
        },
      },
    };
  }

  const details = {
    requestedQuantity: parsed.normalized,
    quantityStep: measurement.quantityStep,
    minimumQuantity: measurement.minimumQuantity,
    maximumQuantity: measurement.maximumQuantity,
    baseUnitCode: measurement.baseUnitCode,
    measurementType: measurement.measurementType,
    productId: extras?.productId,
  };

  if (
    (measurement.measurementType === 'PIECE' || measurement.measurementType === 'PACKAGE') &&
    !isIntegerMilli(parsed.milli)
  ) {
    return {
      ok: false,
      error: {
        code: 'FRACTIONAL_PIECE_QUANTITY',
        error: 'PIECE/PACKAGE quantities must be whole integers',
        details,
      },
    };
  }

  // Anchor = minimumQuantity (resolved config always has it)
  const anchorMilli = min.milli;

  if (parsed.milli < anchorMilli) {
    return {
      ok: false,
      error: { code: 'QUANTITY_BELOW_MINIMUM', error: 'Quantity is below minimum', details },
    };
  }

  if (measurement.maximumQuantity != null && measurement.maximumQuantity !== '') {
    const max = parseMeasurementDecimalStrict(measurement.maximumQuantity);
    if (!max.ok) {
      return {
        ok: false,
        error: {
          code: 'INVALID_MEASUREMENT_CONFIG',
          error: 'Product maximumQuantity is invalid',
          details,
        },
      };
    }
    if (parsed.milli > max.milli) {
      return {
        ok: false,
        error: { code: 'QUANTITY_ABOVE_MAXIMUM', error: 'Quantity is above maximum', details },
      };
    }
  }

  if ((parsed.milli - anchorMilli) % step.milli !== 0) {
    return {
      ok: false,
      error: {
        code: 'QUANTITY_STEP_MISMATCH',
        error: 'Quantity is not aligned to the product step',
        details,
      },
    };
  }

  return { ok: true, milli: parsed.milli, normalized: parsed.normalized };
}

/**
 * Fee billable units for FIXED_ITEM / HYBRID platform fees.
 * PIECE/PACKAGE: integer quantity (milli/1000).
 * WEIGHT/VOLUME: 1 per line (never multiply fee by kg/litre).
 */
export function feeBillableItemUnits(
  measurementType: ProductMeasurement['measurementType'],
  quantityMilli: number
): number {
  if (measurementType === 'WEIGHT' || measurementType === 'VOLUME') return 1;
  return Math.max(0, Math.trunc(quantityMilli / 1000));
}
