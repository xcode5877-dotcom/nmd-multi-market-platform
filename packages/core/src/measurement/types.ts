/**
 * Measurement V2 — authoritative product measurement model.
 *
 * Pricing: always PER_BASE_UNIT (kg / litre / piece / pack|box|bundle).
 * Never price per gram or millilitre.
 * quantityStep / min / max / order quantity are always in base units.
 * displayUnitCode and displayPrecision affect formatting only.
 *
 * Phase B must copy product.measurementVersion into every new order-line snapshot.
 */

export type MeasurementType = 'PIECE' | 'WEIGHT' | 'VOLUME' | 'PACKAGE';

/** API / domain base unit codes (lowercase). Never g or ml. */
export type BaseUnitCode = 'kg' | 'l' | 'piece' | 'pack' | 'box' | 'bundle';

/** API / domain display unit codes (lowercase). Formatting only. */
export type DisplayUnitCode = 'kg' | 'g' | 'l' | 'ml' | 'piece' | 'pack' | 'box' | 'bundle';

export type PriceBasis = 'PER_BASE_UNIT';

/** Prisma enum names for BaseUnitCode / DisplayUnitCode (uppercase). */
export type PrismaBaseUnitCode = 'KG' | 'L' | 'PIECE' | 'PACK' | 'BOX' | 'BUNDLE';
export type PrismaDisplayUnitCode = 'KG' | 'G' | 'L' | 'ML' | 'PIECE' | 'PACK' | 'BOX' | 'BUNDLE';

export interface ProductMeasurement {
  measurementType: MeasurementType;
  baseUnitCode: BaseUnitCode;
  displayUnitCode: DisplayUnitCode;
  /** Base-unit increment, normalized decimal string (e.g. "0.25"). */
  quantityStep: string;
  /** Base-unit minimum, normalized decimal string. */
  minimumQuantity: string;
  /** Base-unit maximum, or null. */
  maximumQuantity: string | null;
  priceBasis: PriceBasis;
  /** Reserved for future interpretation changes. Phase B copies into order-line snapshots. */
  measurementVersion: number;
  /**
   * Formatting preference only (0–3). Null = smart defaults.
   * Never used for pricing or quantity validation.
   * Never rounds into a different commercial amount — if preferred
   * precision cannot represent the stored value exactly, display
   * precision is raised automatically (up to scale 3).
   */
  displayPrecision: number | null;
}

/** Serialized product measurement fragment for catalog API responses. */
export interface ProductMeasurementApi extends ProductMeasurement {
  /** @deprecated Dual-emit for old clients. Derived from authoritative fields. */
  isWeightBased: boolean;
  /** @deprecated Dual-emit Arabic label from displayUnitCode. */
  unitName: string;
}

export interface MeasurementConfigError {
  code: 'INVALID_MEASUREMENT_CONFIG';
  error: string;
  messageAr?: string;
  details?: Record<string, unknown>;
}

/** Raw product-like input for resolve (authoritative + legacy). */
export type MeasurementProductInput = {
  measurementType?: unknown;
  baseUnitCode?: unknown;
  displayUnitCode?: unknown;
  quantityStep?: unknown;
  minimumQuantity?: unknown;
  maximumQuantity?: unknown;
  priceBasis?: unknown;
  measurementVersion?: unknown;
  displayPrecision?: unknown;
  /** @deprecated */
  isWeightBased?: unknown;
  /** @deprecated */
  unitName?: unknown;
};
