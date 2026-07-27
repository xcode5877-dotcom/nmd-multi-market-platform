export type {
  BaseUnitCode,
  DisplayUnitCode,
  MeasurementConfigError,
  MeasurementProductInput,
  MeasurementType,
  PriceBasis,
  PrismaBaseUnitCode,
  PrismaDisplayUnitCode,
  ProductMeasurement,
  ProductMeasurementApi,
} from './types.js';

export {
  coerceMeasurementDecimalString,
  isIntegerMilli,
  milliToNormalizedString,
  milliToNumber,
  parseMeasurementDecimalStrict,
} from './decimal.js';

export {
  arabicUnitLabel,
  BASE_UNIT_CODES,
  DISPLAY_UNIT_CODES,
  defaultDisplayForBase,
  fromPrismaBaseUnitCode,
  fromPrismaDisplayUnitCode,
  isPairAllowed,
  MEASUREMENT_TYPES,
  parseBaseUnitCode,
  parseDisplayUnitCode,
  parseMeasurementType,
  toPrismaBaseUnitCode,
  toPrismaDisplayUnitCode,
} from './units.js';

export { defaultPieceMeasurement, resolveProductMeasurement } from './resolve.js';
export { validateMeasurementConfiguration } from './validate.js';
export type { ValidateMeasurementResult } from './validate.js';
export {
  attachMeasurementToProduct,
  normalizeAndValidateMeasurementForWrite,
  normalizeCatalogProductsForWrite,
  normalizeProductMeasurementForWrite,
  resolveProductMeasurementForRead,
  serializeMeasurementConfig,
} from './serialize.js';
export { InvalidMeasurementConfigError, isInvalidMeasurementConfigError } from './errors.js';
export { formatQuantity } from './format.js';
export type { FormatQuantityInput } from './format.js';
