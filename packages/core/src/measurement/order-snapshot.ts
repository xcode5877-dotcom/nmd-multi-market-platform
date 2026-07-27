/**
 * Phase B.1 — immutable order-line measurement + pricing snapshots.
 *
 * Persistence: order lines live in Order.payload JSON (no OrderItem table).
 * Snapshot fields are written onto each payload item at create/add time.
 * Historical lines without snapshots are treated as PIECE on read (no rewrite).
 */

import { arabicUnitLabel } from './units.js';
import { defaultPieceMeasurement } from './resolve.js';
import type {
  BaseUnitCode,
  DisplayUnitCode,
  MeasurementType,
  PriceBasis,
  ProductMeasurement,
} from './types.js';
import { parseOrderQuantity, serializeOrderQuantity } from './order-quantity.js';

export interface OrderLineMeasurementSnapshot {
  measurementTypeSnapshot: MeasurementType;
  baseUnitCodeSnapshot: BaseUnitCode;
  displayUnitCodeSnapshot: DisplayUnitCode;
  quantityStepSnapshot: string;
  minimumQuantitySnapshot: string;
  maximumQuantitySnapshot: string | null;
  priceBasisSnapshot: PriceBasis;
  measurementVersionSnapshot: number;
  displayPrecisionSnapshot: number | null;
}

export interface OrderLinePricingSnapshot {
  /** Authoritative catalog base price at create (per base unit), shekels. */
  basePriceSnapshot: number;
  /**
   * Product unit price used for × quantity (shekels / base unit).
   * PIECE/PACKAGE: includes option deltas (legacy).
   * WEIGHT/VOLUME: product unit only — options are modifierLineSnapshot (fixed per line).
   */
  unitPriceSnapshot: number;
  /**
   * Fixed per-line modifier total (shekels). Non-zero for WEIGHT/VOLUME when options selected.
   * PIECE/PACKAGE: 0 (options already baked into unitPriceSnapshot).
   */
  modifierLineSnapshot: number;
  /** Authoritative line subtotal, shekels. */
  lineSubtotalSnapshot: number;
}

export type OrderLineSnapshot = OrderLineMeasurementSnapshot & OrderLinePricingSnapshot;

export interface AuthoritativeOrderLineFields extends OrderLineSnapshot {
  /** Decimal string quantity in base units. */
  quantityDecimal: string;
  /**
   * Legacy numeric quantity for PIECE-compatible clients.
   * Integer for PIECE/PACKAGE; JSON number for fractional WEIGHT/VOLUME.
   */
  quantity: number;
  basePrice: number;
  totalPrice: number;
  /** Dual-emit legacy. */
  isWeightBased: boolean;
  unitName: string;
}

export function measurementToSnapshot(m: ProductMeasurement): OrderLineMeasurementSnapshot {
  return {
    measurementTypeSnapshot: m.measurementType,
    baseUnitCodeSnapshot: m.baseUnitCode,
    displayUnitCodeSnapshot: m.displayUnitCode,
    quantityStepSnapshot: m.quantityStep,
    minimumQuantitySnapshot: m.minimumQuantity,
    maximumQuantitySnapshot: m.maximumQuantity,
    priceBasisSnapshot: m.priceBasis,
    measurementVersionSnapshot: m.measurementVersion,
    displayPrecisionSnapshot: m.displayPrecision,
  };
}

export function snapshotToMeasurement(s: OrderLineMeasurementSnapshot): ProductMeasurement {
  return {
    measurementType: s.measurementTypeSnapshot,
    baseUnitCode: s.baseUnitCodeSnapshot,
    displayUnitCode: s.displayUnitCodeSnapshot,
    quantityStep: s.quantityStepSnapshot,
    minimumQuantity: s.minimumQuantitySnapshot,
    maximumQuantity: s.maximumQuantitySnapshot,
    priceBasis: s.priceBasisSnapshot,
    measurementVersion: s.measurementVersionSnapshot,
    displayPrecision: s.displayPrecisionSnapshot,
  };
}

function quantityDecimalFromItem(item: Record<string, unknown>): string {
  if (item.quantityDecimal != null && item.quantityDecimal !== '') {
    const p = parseOrderQuantity(item.quantityDecimal);
    if (p.ok) return p.normalized;
  }
  const p = parseOrderQuantity(item.quantity ?? 1);
  return p.ok ? p.normalized : '1';
}

/** Read-path: fill missing historical snapshots as PIECE without rewriting stored money. */
export function coerceOrderLineSnapshots(
  item: Record<string, unknown>
): Record<string, unknown> {
  const piece = defaultPieceMeasurement();
  const hasSnap = item.measurementTypeSnapshot != null || item.quantityStepSnapshot != null;
  const quantityDecimal = quantityDecimalFromItem(item);
  const qtyParsed = parseOrderQuantity(quantityDecimal);
  const quantityNum = qtyParsed.ok ? qtyParsed.milli / 1000 : Number(item.quantity) || 1;

  if (hasSnap) {
    const display = String(item.displayUnitCodeSnapshot ?? 'piece') as DisplayUnitCode;
    return {
      ...item,
      quantityDecimal,
      quantity: item.quantity ?? quantityNum,
      isWeightBased:
        item.isWeightBased ??
        (item.measurementTypeSnapshot === 'WEIGHT' || item.measurementTypeSnapshot === 'VOLUME'),
      unitName: item.unitName ?? arabicUnitLabel(display),
    };
  }

  const basePrice = Number(item.basePrice);
  const totalPrice = Number(item.totalPrice);
  const safeBase = Number.isFinite(basePrice) ? basePrice : 0;
  const safeTotal = Number.isFinite(totalPrice) ? totalPrice : 0;
  const unitFromTotal =
    quantityNum > 0 ? Math.round((safeTotal / quantityNum) * 100) / 100 : safeBase;

  return {
    ...item,
    quantity: quantityNum,
    quantityDecimal,
    measurementTypeSnapshot: piece.measurementType,
    baseUnitCodeSnapshot: piece.baseUnitCode,
    displayUnitCodeSnapshot: piece.displayUnitCode,
    quantityStepSnapshot: piece.quantityStep,
    minimumQuantitySnapshot: piece.minimumQuantity,
    maximumQuantitySnapshot: piece.maximumQuantity,
    priceBasisSnapshot: piece.priceBasis,
    measurementVersionSnapshot: piece.measurementVersion,
    displayPrecisionSnapshot: piece.displayPrecision,
    basePriceSnapshot: safeBase,
    unitPriceSnapshot: unitFromTotal,
    modifierLineSnapshot: Number(item.modifierLineSnapshot) || 0,
    lineSubtotalSnapshot: safeTotal,
    isWeightBased: false,
    unitName: item.unitName ?? 'حبة',
  };
}

export function buildAuthoritativeLineFields(input: {
  measurement: ProductMeasurement;
  quantityMilli: number;
  basePrice: number;
  unitPrice: number;
  modifierLine: number;
  lineSubtotal: number;
}): AuthoritativeOrderLineFields {
  const { measurement, quantityMilli, basePrice, unitPrice, modifierLine, lineSubtotal } = input;
  const quantityDecimal = serializeOrderQuantity(quantityMilli);
  const isWeight =
    measurement.measurementType === 'WEIGHT' || measurement.measurementType === 'VOLUME';
  const quantity =
    measurement.measurementType === 'PIECE' || measurement.measurementType === 'PACKAGE'
      ? quantityMilli / 1000
      : Number(quantityDecimal);

  return {
    ...measurementToSnapshot(measurement),
    basePriceSnapshot: basePrice,
    unitPriceSnapshot: unitPrice,
    modifierLineSnapshot: Math.round(modifierLine * 100) / 100,
    lineSubtotalSnapshot: lineSubtotal,
    quantityDecimal,
    quantity,
    basePrice,
    totalPrice: lineSubtotal,
    isWeightBased: isWeight,
    unitName: arabicUnitLabel(measurement.displayUnitCode),
  };
}

/** Whether a line carries fractional (non-integer) quantity. */
export function orderLineHasFractionalQuantity(item: Record<string, unknown>): boolean {
  const d = quantityDecimalFromItem(item);
  const p = parseOrderQuantity(d);
  return p.ok ? p.milli % 1000 !== 0 : false;
}
