import { isIntegerMilli, parseMeasurementDecimalStrict } from './decimal.js';
import type { MeasurementConfigError, ProductMeasurement } from './types.js';
import { isPairAllowed, parseBaseUnitCode, parseDisplayUnitCode, parseMeasurementType } from './units.js';

const MAX_STEP = 1000;

export type ValidateMeasurementResult =
  | { ok: true; config: ProductMeasurement }
  | { ok: false; error: MeasurementConfigError };

/**
 * Validate a measurement configuration for catalog writes.
 * Does not validate customer order quantities (Phase B).
 */
export function validateMeasurementConfiguration(
  input: Partial<ProductMeasurement> & Record<string, unknown>
): ValidateMeasurementResult {
  const details: Record<string, unknown> = {};

  const measurementType = parseMeasurementType(input.measurementType);
  if (!measurementType) {
    return fail('Invalid measurementType', { field: 'measurementType', value: input.measurementType });
  }

  const baseUnitCode = parseBaseUnitCode(input.baseUnitCode);
  if (!baseUnitCode) {
    return fail('Invalid baseUnitCode', { field: 'baseUnitCode', value: input.baseUnitCode });
  }
  // Explicit reject of pricing-by-g/ml (not valid base units)
  const rawBase = String(input.baseUnitCode ?? '').trim().toLowerCase();
  if (rawBase === 'g' || rawBase === 'ml') {
    return fail('baseUnitCode must not be g or ml; price is always per kg or litre', {
      field: 'baseUnitCode',
      value: input.baseUnitCode,
    });
  }

  const displayUnitCode = parseDisplayUnitCode(input.displayUnitCode);
  if (!displayUnitCode) {
    return fail('Invalid displayUnitCode', { field: 'displayUnitCode', value: input.displayUnitCode });
  }

  if (!isPairAllowed(measurementType, baseUnitCode, displayUnitCode)) {
    return fail('Illegal measurementType / baseUnitCode / displayUnitCode combination', {
      measurementType,
      baseUnitCode,
      displayUnitCode,
    });
  }

  const stepParsed = parseMeasurementDecimalStrict(input.quantityStep);
  if (!stepParsed.ok) {
    return fail(`Invalid quantityStep (${stepParsed.reason})`, { field: 'quantityStep', value: input.quantityStep });
  }
  if (stepParsed.milli <= 0) {
    return fail('quantityStep must be greater than 0', { field: 'quantityStep', value: input.quantityStep });
  }
  if (stepParsed.milli / 1000 > MAX_STEP) {
    return fail(`quantityStep must be <= ${MAX_STEP}`, { field: 'quantityStep', value: input.quantityStep });
  }

  const minParsed = parseMeasurementDecimalStrict(input.minimumQuantity ?? input.quantityStep);
  if (!minParsed.ok) {
    return fail(`Invalid minimumQuantity (${minParsed.reason})`, {
      field: 'minimumQuantity',
      value: input.minimumQuantity,
    });
  }
  if (minParsed.milli <= 0) {
    return fail('minimumQuantity must be greater than 0', { field: 'minimumQuantity' });
  }
  if (minParsed.milli < stepParsed.milli) {
    return fail('minimumQuantity must be >= quantityStep', {
      field: 'minimumQuantity',
      minimumQuantity: minParsed.normalized,
      quantityStep: stepParsed.normalized,
    });
  }

  let maximumQuantity: string | null = null;
  if (input.maximumQuantity != null && input.maximumQuantity !== '') {
    const maxParsed = parseMeasurementDecimalStrict(input.maximumQuantity);
    if (!maxParsed.ok) {
      return fail(`Invalid maximumQuantity (${maxParsed.reason})`, {
        field: 'maximumQuantity',
        value: input.maximumQuantity,
      });
    }
    if (maxParsed.milli < minParsed.milli) {
      return fail('maximumQuantity must be >= minimumQuantity', {
        field: 'maximumQuantity',
        maximumQuantity: maxParsed.normalized,
        minimumQuantity: minParsed.normalized,
      });
    }
    maximumQuantity = maxParsed.normalized;
  }

  if (input.priceBasis != null && input.priceBasis !== 'PER_BASE_UNIT') {
    return fail('priceBasis must be PER_BASE_UNIT', { field: 'priceBasis', value: input.priceBasis });
  }

  const versionRaw = input.measurementVersion == null ? 1 : Number(input.measurementVersion);
  if (!Number.isInteger(versionRaw) || versionRaw < 1) {
    return fail('measurementVersion must be an integer >= 1', {
      field: 'measurementVersion',
      value: input.measurementVersion,
    });
  }

  let displayPrecision: number | null = null;
  if (input.displayPrecision != null && String(input.displayPrecision).trim() !== '') {
    const dp = Number(input.displayPrecision);
    if (!Number.isInteger(dp)) {
      return fail('displayPrecision must be an integer or null', {
        field: 'displayPrecision',
        value: input.displayPrecision,
      });
    }
    if (dp < 0 || dp > 3) {
      return fail('displayPrecision must be between 0 and 3', {
        field: 'displayPrecision',
        value: input.displayPrecision,
      });
    }
    displayPrecision = dp;
  }

  const discrete = measurementType === 'PIECE' || measurementType === 'PACKAGE';
  if (discrete) {
    if (!isIntegerMilli(stepParsed.milli)) {
      details.quantityStep = stepParsed.normalized;
      return fail('PIECE/PACKAGE quantityStep must be an integer', {
        field: 'quantityStep',
        value: stepParsed.normalized,
      });
    }
    if (!isIntegerMilli(minParsed.milli)) {
      return fail('PIECE/PACKAGE minimumQuantity must be an integer', {
        field: 'minimumQuantity',
        value: minParsed.normalized,
      });
    }
    if (maximumQuantity != null) {
      const maxMilli = parseMeasurementDecimalStrict(maximumQuantity);
      if (maxMilli.ok && !isIntegerMilli(maxMilli.milli)) {
        return fail('PIECE/PACKAGE maximumQuantity must be an integer', {
          field: 'maximumQuantity',
          value: maximumQuantity,
        });
      }
    }
  }

  return {
    ok: true,
    config: {
      measurementType,
      baseUnitCode,
      displayUnitCode,
      quantityStep: stepParsed.normalized,
      minimumQuantity: minParsed.normalized,
      maximumQuantity,
      priceBasis: 'PER_BASE_UNIT',
      measurementVersion: versionRaw,
      displayPrecision,
    },
  };
}

function fail(error: string, details?: Record<string, unknown>): ValidateMeasurementResult {
  return {
    ok: false,
    error: {
      code: 'INVALID_MEASUREMENT_CONFIG',
      error,
      messageAr: 'إعدادات وحدة القياس غير صالحة',
      details,
    },
  };
}
