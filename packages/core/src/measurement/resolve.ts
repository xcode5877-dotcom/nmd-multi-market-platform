import { coerceMeasurementDecimalString, parseMeasurementDecimalStrict } from './decimal.js';
import type { MeasurementProductInput, ProductMeasurement } from './types.js';
import {
  defaultDisplayForBase,
  parseBaseUnitCode,
  parseDisplayUnitCode,
  parseMeasurementType,
} from './units.js';

const PIECE_DEFAULT: ProductMeasurement = {
  measurementType: 'PIECE',
  baseUnitCode: 'piece',
  displayUnitCode: 'piece',
  quantityStep: '1',
  minimumQuantity: '1',
  maximumQuantity: null,
  priceBasis: 'PER_BASE_UNIT',
  measurementVersion: 1,
  displayPrecision: null,
};

function normalizeLegacyUnitName(unitName: unknown): string {
  return String(unitName ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

/**
 * Resolve authoritative ProductMeasurement from product fields.
 * Precedence: valid new fields → legacy isWeightBased/unitName/step → PIECE defaults.
 * Never infers from product name/category/description/tenant type.
 */
export function resolveProductMeasurement(product: MeasurementProductInput | null | undefined): ProductMeasurement {
  if (!product) return { ...PIECE_DEFAULT };

  const type = parseMeasurementType(product.measurementType);
  const base = parseBaseUnitCode(product.baseUnitCode);

  if (type && base) {
    let display = parseDisplayUnitCode(product.displayUnitCode) ?? defaultDisplayForBase(type, base);
    // Soft-correct illegal display while resolving (validation rejects on write)
    if (type === 'WEIGHT' && display !== 'kg' && display !== 'g') display = 'kg';
    if (type === 'VOLUME' && display !== 'l' && display !== 'ml') display = 'l';
    if (type === 'PIECE') display = 'piece';
    if (type === 'PACKAGE' && display !== base) display = base as typeof display;

    const stepParsed = parseMeasurementDecimalStrict(product.quantityStep);
    const step = stepParsed.ok ? stepParsed.normalized : '1';
    const minParsed = parseMeasurementDecimalStrict(product.minimumQuantity);
    const min = minParsed.ok ? minParsed.normalized : step;
    let max: string | null = null;
    if (product.maximumQuantity != null && product.maximumQuantity !== '') {
      const maxParsed = parseMeasurementDecimalStrict(product.maximumQuantity);
      max = maxParsed.ok ? maxParsed.normalized : null;
    }
    const versionRaw = Number(product.measurementVersion);
    const measurementVersion =
      Number.isInteger(versionRaw) && versionRaw >= 1 ? versionRaw : 1;
    let displayPrecision: number | null = null;
    if (product.displayPrecision != null && product.displayPrecision !== '') {
      const dp = Number(product.displayPrecision);
      if (Number.isInteger(dp) && dp >= 0 && dp <= 3) displayPrecision = dp;
    }
    const priceBasis =
      product.priceBasis === 'PER_BASE_UNIT' || product.priceBasis == null
        ? 'PER_BASE_UNIT'
        : 'PER_BASE_UNIT';

    return {
      measurementType: type,
      baseUnitCode: base,
      displayUnitCode: display,
      quantityStep: step,
      minimumQuantity: min,
      maximumQuantity: max,
      priceBasis,
      measurementVersion,
      displayPrecision,
    };
  }

  // Legacy path
  const legacyStepParsed = parseMeasurementDecimalStrict(product.quantityStep);
  const legacyStepMilli = legacyStepParsed.ok ? legacyStepParsed.milli : null;
  const isWeightBased = product.isWeightBased === true;
  const treatAsWeighted = isWeightBased || (legacyStepMilli != null && legacyStepMilli < 1000);

  if (treatAsWeighted) {
    const unit = normalizeLegacyUnitName(product.unitName);
    let measurementType: ProductMeasurement['measurementType'] = 'WEIGHT';
    let baseUnitCode: ProductMeasurement['baseUnitCode'] = 'kg';
    let displayUnitCode: ProductMeasurement['displayUnitCode'] = 'kg';

    if (unit === 'لتر' || unit === 'ltr' || unit === 'liter' || unit === 'litre') {
      measurementType = 'VOLUME';
      baseUnitCode = 'l';
      displayUnitCode = 'l';
    } else if (unit === 'مل' || unit === 'ml') {
      measurementType = 'VOLUME';
      baseUnitCode = 'l';
      displayUnitCode = 'ml';
    } else if (unit === 'غرام' || unit === 'جرام' || unit === 'جم' || unit === 'g' || unit === 'gram') {
      measurementType = 'WEIGHT';
      baseUnitCode = 'kg';
      displayUnitCode = 'g';
    } else if (unit === 'كيلو' || unit === 'كغم' || unit === 'kg' || unit === 'كيلوغرام') {
      measurementType = 'WEIGHT';
      baseUnitCode = 'kg';
      displayUnitCode = 'kg';
    } else {
      // Unknown weighted unit → WEIGHT / kg / kg
      measurementType = 'WEIGHT';
      baseUnitCode = 'kg';
      displayUnitCode = 'kg';
    }

    const step =
      legacyStepParsed.ok && legacyStepParsed.milli > 0
        ? legacyStepParsed.normalized
        : '0.5';

    return {
      measurementType,
      baseUnitCode,
      displayUnitCode,
      quantityStep: step,
      minimumQuantity: step,
      maximumQuantity: null,
      priceBasis: 'PER_BASE_UNIT',
      measurementVersion: 1,
      displayPrecision: null,
    };
  }

  // Preserve legacy quantityStep/unitName piece defaults when present
  if (product.quantityStep != null || product.unitName != null) {
    return {
      ...PIECE_DEFAULT,
      quantityStep: coerceMeasurementDecimalString(product.quantityStep, '1'),
      minimumQuantity: coerceMeasurementDecimalString(
        product.minimumQuantity ?? product.quantityStep,
        '1'
      ),
    };
  }

  return { ...PIECE_DEFAULT };
}

export function defaultPieceMeasurement(): ProductMeasurement {
  return { ...PIECE_DEFAULT };
}
