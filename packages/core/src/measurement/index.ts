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

export {
  parseOrderQuantity,
  normalizeQuantityDecimal,
  serializeOrderQuantity,
  validateQuantityAgainstMeasurement,
  feeBillableItemUnits,
} from './order-quantity.js';
export type {
  OrderQuantityError,
  OrderQuantityErrorCode,
  ParseOrderQuantityResult,
  ValidateQuantityResult,
} from './order-quantity.js';

export {
  shekelsToAgora,
  agoraToShekels,
  calculateLineSubtotal,
  moneyMismatch,
} from './order-pricing.js';

export {
  measurementToSnapshot,
  snapshotToMeasurement,
  coerceOrderLineSnapshots,
  buildAuthoritativeLineFields,
  orderLineHasFractionalQuantity,
} from './order-snapshot.js';
export type {
  OrderLineMeasurementSnapshot,
  OrderLinePricingSnapshot,
  OrderLineSnapshot,
  AuthoritativeOrderLineFields,
} from './order-snapshot.js';

export {
  WEIGHT_STEP_PRESETS,
  VOLUME_STEP_PRESETS,
  defaultCatalogMeasurementForm,
  measurementFormFromProduct,
  applyMeasurementTypeSwitch,
  effectiveStepString,
  buildMeasurementPayload,
  buildMeasurementApiPayload,
  validateCatalogMeasurementForm,
  mapMeasurementErrorToAr,
  priceBasisExplanationAr,
  buildMeasurementPricePreview,
  measurementBadgeAr,
  measurementPriceBadgeAr,
  measurementStepHintAr,
  measurementTypeSwitchRequiresConfirm,
} from './catalog-form.js';
export type {
  CatalogMeasurementFormState,
  CatalogMeasurementFieldError,
  MeasurementPreviewRow,
} from './catalog-form.js';
