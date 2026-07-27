/**
 * Measurement V2 — catalog product form helpers (Phase B.2.1).
 * Pure logic for merchant/admin editors. Server remains authoritative on save.
 */

import { calculateLineSubtotal } from './order-pricing.js';
import { milliToNormalizedString, parseMeasurementDecimalStrict } from './decimal.js';
import { formatQuantity } from './format.js';
import { validateMeasurementConfiguration } from './validate.js';
import { resolveProductMeasurementForRead, serializeMeasurementConfig } from './serialize.js';
import type {
  BaseUnitCode,
  DisplayUnitCode,
  MeasurementType,
  PriceBasis,
  ProductMeasurement,
  ProductMeasurementApi,
} from './types.js';

export type CatalogMeasurementFormState = {
  measurementType: MeasurementType;
  baseUnitCode: BaseUnitCode;
  displayUnitCode: DisplayUnitCode;
  quantityStep: string;
  minimumQuantity: string;
  maximumQuantity: string;
  priceBasis: PriceBasis;
  measurementVersion: number;
  displayPrecision: number | null;
  /** Custom step text when not using a preset */
  customStep: string;
  useCustomStep: boolean;
};

export type CatalogMeasurementFieldError = {
  field: string;
  code: string;
  message: string;
};

export const WEIGHT_STEP_PRESETS = ['0.05', '0.1', '0.25', '0.5', '1'] as const;
export const VOLUME_STEP_PRESETS = ['0.1', '0.25', '0.5', '1'] as const;

export function defaultCatalogMeasurementForm(
  type: MeasurementType = 'PIECE'
): CatalogMeasurementFormState {
  if (type === 'WEIGHT') {
    return {
      measurementType: 'WEIGHT',
      baseUnitCode: 'kg',
      displayUnitCode: 'g',
      quantityStep: '0.25',
      minimumQuantity: '0.25',
      maximumQuantity: '',
      priceBasis: 'PER_BASE_UNIT',
      measurementVersion: 1,
      displayPrecision: null,
      customStep: '',
      useCustomStep: false,
    };
  }
  if (type === 'VOLUME') {
    return {
      measurementType: 'VOLUME',
      baseUnitCode: 'l',
      displayUnitCode: 'ml',
      quantityStep: '0.5',
      minimumQuantity: '0.5',
      maximumQuantity: '',
      priceBasis: 'PER_BASE_UNIT',
      measurementVersion: 1,
      displayPrecision: null,
      customStep: '',
      useCustomStep: false,
    };
  }
  if (type === 'PACKAGE') {
    return {
      measurementType: 'PACKAGE',
      baseUnitCode: 'pack',
      displayUnitCode: 'pack',
      quantityStep: '1',
      minimumQuantity: '1',
      maximumQuantity: '',
      priceBasis: 'PER_BASE_UNIT',
      measurementVersion: 1,
      displayPrecision: 0,
      customStep: '',
      useCustomStep: false,
    };
  }
  return {
    measurementType: 'PIECE',
    baseUnitCode: 'piece',
    displayUnitCode: 'piece',
    quantityStep: '1',
    minimumQuantity: '1',
    maximumQuantity: '',
    priceBasis: 'PER_BASE_UNIT',
    measurementVersion: 1,
    displayPrecision: 0,
    customStep: '',
    useCustomStep: false,
  };
}

/** Load form state from a catalog product (authoritative V2 or legacy). */
export function measurementFormFromProduct(
  product: Record<string, unknown> | null | undefined
): CatalogMeasurementFormState {
  if (!product) return defaultCatalogMeasurementForm('PIECE');
  const resolved = resolveProductMeasurementForRead(product);
  const presets =
    resolved.measurementType === 'WEIGHT'
      ? WEIGHT_STEP_PRESETS
      : resolved.measurementType === 'VOLUME'
        ? VOLUME_STEP_PRESETS
        : (['1'] as readonly string[]);
  const useCustom = !presets.includes(resolved.quantityStep as (typeof presets)[number]);
  return {
    measurementType: resolved.measurementType,
    baseUnitCode: resolved.baseUnitCode,
    displayUnitCode: resolved.displayUnitCode,
    quantityStep: resolved.quantityStep,
    minimumQuantity: resolved.minimumQuantity,
    maximumQuantity: resolved.maximumQuantity ?? '',
    priceBasis: resolved.priceBasis,
    measurementVersion: resolved.measurementVersion,
    displayPrecision: resolved.displayPrecision,
    customStep: useCustom ? resolved.quantityStep : '',
    useCustomStep: useCustom,
  };
}

export function applyMeasurementTypeSwitch(
  prev: CatalogMeasurementFormState,
  nextType: MeasurementType
): CatalogMeasurementFormState {
  const next = defaultCatalogMeasurementForm(nextType);
  // Preserve price meaning confirmation is handled in UI; do not copy step across incompatible types.
  return {
    ...next,
    measurementVersion: prev.measurementVersion || 1,
  };
}

export function effectiveStepString(form: CatalogMeasurementFormState): string {
  if (form.useCustomStep && form.customStep.trim()) return form.customStep.trim();
  return form.quantityStep;
}

export function buildMeasurementPayload(form: CatalogMeasurementFormState): ProductMeasurement {
  const step = effectiveStepString(form);
  const min = form.minimumQuantity.trim() || step;
  const max = form.maximumQuantity.trim() ? form.maximumQuantity.trim() : null;
  let baseUnitCode = form.baseUnitCode;
  let displayUnitCode = form.displayUnitCode;
  if (form.measurementType === 'WEIGHT') {
    baseUnitCode = 'kg';
    if (displayUnitCode !== 'kg' && displayUnitCode !== 'g') displayUnitCode = 'g';
  } else if (form.measurementType === 'VOLUME') {
    baseUnitCode = 'l';
    if (displayUnitCode !== 'l' && displayUnitCode !== 'ml') displayUnitCode = 'ml';
  } else if (form.measurementType === 'PIECE') {
    baseUnitCode = 'piece';
    displayUnitCode = 'piece';
  } else if (form.measurementType === 'PACKAGE') {
    if (!['pack', 'box', 'bundle'].includes(baseUnitCode)) baseUnitCode = 'pack';
    displayUnitCode = baseUnitCode as DisplayUnitCode;
  }
  return {
    measurementType: form.measurementType,
    baseUnitCode,
    displayUnitCode,
    quantityStep: step,
    minimumQuantity: min,
    maximumQuantity: max,
    priceBasis: 'PER_BASE_UNIT',
    measurementVersion: form.measurementVersion || 1,
    displayPrecision: form.displayPrecision,
  };
}

/** Authoritative + dual-emit legacy fields for catalog PUT payloads. */
export function buildMeasurementApiPayload(form: CatalogMeasurementFormState): ProductMeasurementApi {
  const payload = buildMeasurementPayload(form);
  const validated = validateMeasurementConfiguration({ ...payload });
  if (validated.ok) return serializeMeasurementConfig(validated.config);
  // Still emit attempted fields for server to reject with field details
  return serializeMeasurementConfig(payload);
}

export function validateCatalogMeasurementForm(
  form: CatalogMeasurementFormState,
  opts?: { supportsWeightSelling?: boolean }
): CatalogMeasurementFieldError[] {
  const errors: CatalogMeasurementFieldError[] = [];
  const supports = opts?.supportsWeightSelling === true;
  if (
    (form.measurementType === 'WEIGHT' || form.measurementType === 'VOLUME') &&
    !supports
  ) {
    errors.push({
      field: 'measurementType',
      code: 'MEASUREMENT_NOT_SUPPORTED',
      message: 'البيع بالوزن/الحجم غير مفعّل لهذا المتجر. فعّله من إعدادات المتجر أولاً.',
    });
    return errors;
  }

  const payload = buildMeasurementPayload(form);
  const result = validateMeasurementConfiguration({ ...payload });
  if (!result.ok) {
    const field = String(result.error.details?.field ?? 'measurementType');
    errors.push({
      field,
      code: result.error.code,
      message: mapMeasurementErrorToAr(result.error.code, result.error.error),
    });
  }

  const stepParsed = parseMeasurementDecimalStrict(effectiveStepString(form));
  if (!stepParsed.ok) {
    errors.push({
      field: 'quantityStep',
      code: 'INVALID_MEASUREMENT_CONFIG',
      message: 'خطوة الكمية غير صالحة',
    });
  }

  return errors;
}

export function mapMeasurementErrorToAr(code: string, fallback: string): string {
  switch (code) {
    case 'INVALID_MEASUREMENT_CONFIG':
      return 'إعداد القياس غير صالح. راجع النوع والوحدات والخطوة.';
    case 'MEASUREMENT_NOT_SUPPORTED':
      return 'البيع بالوزن/الحجم غير مفعّل لهذا المتجر.';
    case 'INVALID_QUANTITY':
      return 'الكمية غير صالحة.';
    case 'QUANTITY_STEP_MISMATCH':
      return 'الكمية لا تتوافق مع خطوة البيع.';
    case 'QUANTITY_BELOW_MINIMUM':
      return 'الكمية أقل من الحد الأدنى.';
    case 'QUANTITY_ABOVE_MAXIMUM':
      return 'الكمية أعلى من الحد الأقصى.';
    default:
      return fallback || 'تحقق من إعدادات القياس.';
  }
}

export function priceBasisExplanationAr(type: MeasurementType): string {
  switch (type) {
    case 'WEIGHT':
      return 'السعر المُدخل هو سعر 1 كغم';
    case 'VOLUME':
      return 'السعر المُدخل هو سعر 1 لتر';
    case 'PACKAGE':
      return 'السعر المُدخل هو سعر العبوة الواحدة';
    case 'PIECE':
    default:
      return 'السعر المُدخل هو سعر القطعة الواحدة';
  }
}

export type MeasurementPreviewRow = {
  quantityBase: string;
  label: string;
  priceShekels: number;
};

/** Product-only preview (no modifiers). Uses integer agora/milli math via calculateLineSubtotal. */
export function buildMeasurementPricePreview(
  basePrice: number,
  form: CatalogMeasurementFormState
): MeasurementPreviewRow[] {
  const payload = buildMeasurementPayload(form);
  const step = payload.quantityStep;
  const stepParsed = parseMeasurementDecimalStrict(step);
  if (!stepParsed.ok || !Number.isFinite(basePrice) || basePrice < 0) return [];

  const multipliers = [1, 2, 4];
  const rows: MeasurementPreviewRow[] = [];
  const seen = new Set<string>();
  for (const m of multipliers) {
    const q = milliToNormalizedString(stepParsed.milli * m);
    if (seen.has(q)) continue;
    seen.add(q);
    const label = formatQuantity({
      quantityBase: q,
      baseUnitCode: payload.baseUnitCode,
      displayUnitCode: payload.displayUnitCode,
      displayPrecision: payload.displayPrecision,
    });
    rows.push({
      quantityBase: q,
      label,
      priceShekels: calculateLineSubtotal(basePrice, q),
    });
  }
  // Always include 1 base unit when step != 1
  if (step !== '1' && !seen.has('1')) {
    const oneLabel = formatQuantity({
      quantityBase: '1',
      baseUnitCode: payload.baseUnitCode,
      displayUnitCode:
        payload.baseUnitCode === 'kg'
          ? 'kg'
          : payload.baseUnitCode === 'l'
            ? 'l'
            : payload.displayUnitCode,
      displayPrecision: payload.displayPrecision,
    });
    rows.push({
      quantityBase: '1',
      label: oneLabel,
      priceShekels: calculateLineSubtotal(basePrice, '1'),
    });
  }
  return rows;
}

export function measurementBadgeAr(type: MeasurementType | undefined): string {
  switch (type) {
    case 'WEIGHT':
      return 'وزن';
    case 'VOLUME':
      return 'حجم';
    case 'PACKAGE':
      return 'عبوة';
    case 'PIECE':
    default:
      return 'قطعة';
  }
}

export function measurementPriceBadgeAr(type: MeasurementType | undefined): string | null {
  if (type === 'WEIGHT') return 'سعر الكغم';
  if (type === 'VOLUME') return 'سعر اللتر';
  return null;
}

export function measurementStepHintAr(product: Record<string, unknown>): string | null {
  const m = resolveProductMeasurementForRead(product);
  if (m.measurementType !== 'WEIGHT' && m.measurementType !== 'VOLUME') return null;
  const label = formatQuantity({
    quantityBase: m.quantityStep,
    baseUnitCode: m.baseUnitCode,
    displayUnitCode: m.displayUnitCode,
    displayPrecision: m.displayPrecision,
  });
  return `يُباع كل ${label}`;
}

/** True when switching type changes price meaning (requires confirmation). */
export function measurementTypeSwitchRequiresConfirm(
  from: MeasurementType,
  to: MeasurementType
): boolean {
  if (from === to) return false;
  const group = (t: MeasurementType) =>
    t === 'WEIGHT' || t === 'VOLUME' ? 'mass' : t === 'PACKAGE' ? 'pack' : 'piece';
  return group(from) !== group(to) || from !== to;
}
