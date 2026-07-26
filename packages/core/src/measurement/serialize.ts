import { InvalidMeasurementConfigError } from './errors.js';
import { defaultPieceMeasurement, resolveProductMeasurement } from './resolve.js';
import type { MeasurementConfigError, MeasurementProductInput, ProductMeasurement, ProductMeasurementApi } from './types.js';
import { arabicUnitLabel } from './units.js';
import { parseMeasurementDecimalStrict } from './decimal.js';
import { validateMeasurementConfiguration } from './validate.js';

/**
 * Serialize measurement for catalog API (strings for decimals, dual-emit legacy).
 */
export function serializeMeasurementConfig(config: ProductMeasurement): ProductMeasurementApi {
  const isWeightBased = config.measurementType === 'WEIGHT' || config.measurementType === 'VOLUME';
  return {
    measurementType: config.measurementType,
    baseUnitCode: config.baseUnitCode,
    displayUnitCode: config.displayUnitCode,
    quantityStep: config.quantityStep,
    minimumQuantity: config.minimumQuantity,
    maximumQuantity: config.maximumQuantity,
    priceBasis: config.priceBasis,
    measurementVersion: config.measurementVersion,
    displayPrecision: config.displayPrecision,
    isWeightBased,
    unitName: arabicUnitLabel(config.displayUnitCode),
  };
}

/** Read path: permissive resolve + dual-emit. Never used as the final write validator. */
export function resolveProductMeasurementForRead(
  product: MeasurementProductInput | null | undefined
): ProductMeasurement {
  return resolveProductMeasurement(product);
}

/**
 * Resolve + serialize a product for GET responses (read path only).
 */
export function attachMeasurementToProduct<T extends MeasurementProductInput>(
  product: T
): T & ProductMeasurementApi {
  const resolved = resolveProductMeasurementForRead(product);
  const serialized = serializeMeasurementConfig(resolved);
  return {
    ...product,
    ...serialized,
  };
}

function hasExplicitAuthoritativeFields(product: MeasurementProductInput): boolean {
  return (
    product.measurementType != null ||
    product.baseUnitCode != null ||
    product.displayUnitCode != null ||
    product.minimumQuantity != null ||
    product.maximumQuantity !== undefined ||
    product.priceBasis != null ||
    product.measurementVersion != null ||
    product.displayPrecision !== undefined
  );
}

function hasLegacyMeasurementSignal(product: MeasurementProductInput): boolean {
  if (product.isWeightBased === true) return true;
  if (product.unitName != null && String(product.unitName).trim() !== '') return true;
  const step = parseMeasurementDecimalStrict(product.quantityStep);
  if (step.ok && step.milli > 0 && step.milli < 1000) return true;
  return false;
}

function hasQuantityStepField(product: MeasurementProductInput): boolean {
  return product.quantityStep != null && product.quantityStep !== '';
}

/**
 * Write path: resolve legacy when needed, then strictly validate.
 * Never silently converts invalid WEIGHT/VOLUME/PACKAGE into PIECE.
 *
 * - No measurement fields → safe PIECE default
 * - Legacy-only valid input → resolve then validate
 * - Explicit invalid config → INVALID_MEASUREMENT_CONFIG (fail closed)
 */
export function normalizeAndValidateMeasurementForWrite(
  product: MeasurementProductInput
): { ok: true; config: ProductMeasurement; api: ProductMeasurementApi } | { ok: false; error: MeasurementConfigError } {
  const rawBase = product.baseUnitCode != null ? String(product.baseUnitCode).trim().toLowerCase() : '';
  if (rawBase === 'g' || rawBase === 'ml') {
    return {
      ok: false,
      error: {
        code: 'INVALID_MEASUREMENT_CONFIG',
        error: 'baseUnitCode must not be g or ml; price is always per kg or litre',
        messageAr: 'إعدادات وحدة القياس غير صالحة',
        details: { field: 'baseUnitCode', value: product.baseUnitCode },
      },
    };
  }

  const explicit = hasExplicitAuthoritativeFields(product);
  const legacy = hasLegacyMeasurementSignal(product);

  let candidate: Record<string, unknown>;

  if (explicit) {
    // Authoritative fields present: validate what the writer sent (fill only missing from resolve/defaults).
    // Do NOT let the read resolver soft-correct illegal pairs into a different type.
    const resolved = resolveProductMeasurementForRead(product);
    const defaults = defaultPieceMeasurement();
    candidate = {
      measurementType: product.measurementType ?? resolved.measurementType ?? defaults.measurementType,
      baseUnitCode: product.baseUnitCode ?? resolved.baseUnitCode ?? defaults.baseUnitCode,
      displayUnitCode: product.displayUnitCode ?? resolved.displayUnitCode ?? defaults.displayUnitCode,
      quantityStep: product.quantityStep ?? resolved.quantityStep ?? defaults.quantityStep,
      minimumQuantity: product.minimumQuantity ?? resolved.minimumQuantity ?? defaults.minimumQuantity,
      maximumQuantity:
        product.maximumQuantity !== undefined ? product.maximumQuantity : resolved.maximumQuantity,
      priceBasis: product.priceBasis ?? resolved.priceBasis ?? defaults.priceBasis,
      measurementVersion: product.measurementVersion ?? resolved.measurementVersion ?? 1,
      displayPrecision:
        product.displayPrecision !== undefined ? product.displayPrecision : resolved.displayPrecision,
    };
  } else if (legacy || hasQuantityStepField(product)) {
    // Legacy-only (or quantityStep-only): resolve into authoritative, then strict-validate.
    const resolved = resolveProductMeasurementForRead(product);
    candidate = { ...resolved };
  } else {
    // Completely missing measurement → safe PIECE default for old piece products.
    candidate = { ...defaultPieceMeasurement() };
  }

  const validated = validateMeasurementConfiguration(candidate);
  if (!validated.ok) return validated;
  return { ok: true, config: validated.config, api: serializeMeasurementConfig(validated.config) };
}

/** @deprecated Use normalizeAndValidateMeasurementForWrite */
export const normalizeProductMeasurementForWrite = normalizeAndValidateMeasurementForWrite;

/**
 * Validate and normalize every product in a catalog write batch.
 * Fail-closed: throws InvalidMeasurementConfigError on first invalid product.
 * Does not mutate the input array.
 */
export function normalizeCatalogProductsForWrite<T extends MeasurementProductInput & { id?: unknown; name?: unknown }>(
  products: T[]
): Array<T & ProductMeasurementApi> {
  const out: Array<T & ProductMeasurementApi> = [];
  for (const p of products) {
    const result = normalizeAndValidateMeasurementForWrite(p);
    if (!result.ok) {
      throw new InvalidMeasurementConfigError(result.error, {
        productId: p.id != null ? String(p.id) : undefined,
        productName: p.name != null ? String(p.name) : undefined,
      });
    }
    out.push({ ...p, ...result.api });
  }
  return out;
}
