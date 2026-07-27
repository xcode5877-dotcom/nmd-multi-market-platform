import { useMemo, useState } from 'react';
import { Input, Select, ConfirmDialog } from '@nmd/ui';
import {
  WEIGHT_STEP_PRESETS,
  VOLUME_STEP_PRESETS,
  applyMeasurementTypeSwitch,
  buildMeasurementPricePreview,
  defaultCatalogMeasurementForm,
  formatMoney,
  measurementTypeSwitchRequiresConfirm,
  priceBasisExplanationAr,
  type CatalogMeasurementFieldError,
  type CatalogMeasurementFormState,
  type MeasurementType,
} from '@nmd/core';

const TYPE_OPTIONS: { value: MeasurementType; label: string }[] = [
  { value: 'PIECE', label: 'قطعة' },
  { value: 'WEIGHT', label: 'وزن' },
  { value: 'VOLUME', label: 'حجم' },
  { value: 'PACKAGE', label: 'عبوة' },
];

type Props = {
  value: CatalogMeasurementFormState;
  onChange: (next: CatalogMeasurementFormState) => void;
  basePrice: number;
  supportsWeightSelling: boolean;
  /** Product already stored as WEIGHT/VOLUME while tenant gate is off */
  lockedWeightedExisting?: boolean;
  fieldErrors?: CatalogMeasurementFieldError[];
};

function fieldError(
  errors: CatalogMeasurementFieldError[] | undefined,
  field: string
): string | undefined {
  return errors?.find((e) => e.field === field)?.message;
}

export function MeasurementProductFields({
  value,
  onChange,
  basePrice,
  supportsWeightSelling,
  lockedWeightedExisting = false,
  fieldErrors,
}: Props) {
  const [pendingType, setPendingType] = useState<MeasurementType | null>(null);

  const weightVolumeAllowed = supportsWeightSelling === true;
  const isWeightOrVolume =
    value.measurementType === 'WEIGHT' || value.measurementType === 'VOLUME';
  const readOnlyLocked = lockedWeightedExisting && !weightVolumeAllowed;

  const presets =
    value.measurementType === 'WEIGHT'
      ? WEIGHT_STEP_PRESETS
      : value.measurementType === 'VOLUME'
        ? VOLUME_STEP_PRESETS
        : null;

  const preview = useMemo(
    () => buildMeasurementPricePreview(basePrice, value),
    [basePrice, value]
  );

  const requestTypeChange = (next: MeasurementType) => {
    if (next === value.measurementType) return;
    if (readOnlyLocked) return;
    if (!weightVolumeAllowed && (next === 'WEIGHT' || next === 'VOLUME')) return;
    if (measurementTypeSwitchRequiresConfirm(value.measurementType, next)) {
      setPendingType(next);
      return;
    }
    onChange(applyMeasurementTypeSwitch(value, next));
  };

  const confirmTypeSwitch = () => {
    if (!pendingType) return;
    onChange(applyMeasurementTypeSwitch(value, pendingType));
    setPendingType(null);
  };

  const cancelTypeSwitch = () => {
    setPendingType(null);
  };

  const typeWarning =
    pendingType === 'WEIGHT'
      ? 'سيصبح سعر المنتج يعني سعر الكيلوغرام الواحد. لن نُحوّل السعر تلقائياً — راجع السعر الأساسي قبل الحفظ.'
      : pendingType === 'VOLUME'
        ? 'سيصبح سعر المنتج يعني سعر اللتر الواحد. لن نُحوّل السعر تلقائياً — راجع السعر الأساسي قبل الحفظ.'
        : pendingType === 'PIECE'
          ? 'سيصبح سعر المنتج يعني سعر القطعة الواحدة. راجع السعر الأساسي قبل الحفظ.'
          : 'تغيير نوع القياس يغيّر معنى السعر. راجع السعر الأساسي قبل الحفظ.';

  const stepUnit =
    value.measurementType === 'WEIGHT'
      ? 'كغم'
      : value.measurementType === 'VOLUME'
        ? 'لتر'
        : value.measurementType === 'PACKAGE'
          ? 'عبوة'
          : 'قطعة';

  return (
    <div className="space-y-3 p-4 rounded-xl border border-gray-200 bg-gray-50/50" dir="rtl">
      <p className="text-sm font-semibold text-gray-800">نظام القياس والبيع</p>
      <p className="text-xs text-gray-500">
        السعر دائماً لكل وحدة أساس (كغم / لتر / قطعة / عبوة). وحدات العرض (غرام، مل) للعرض فقط.
      </p>

      {!weightVolumeAllowed && (
        <div
          role="status"
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
        >
          البيع بالوزن أو الحجم غير مفعّل لهذا المتجر. يمكن تفعيله من إعدادات المتجر (دعم البيع
          بالوزن). المنتجات الموزونة الحالية لا تُحوَّل تلقائياً إلى قطعة.
        </div>
      )}

      {readOnlyLocked && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900"
        >
          هذا المنتج مضبوط كـ{value.measurementType === 'VOLUME' ? 'حجم' : 'وزن'} بينما المتجر لا يدعم
          البيع بالوزن/الحجم حالياً. الإعدادات للعرض فقط — فعّل الدعم من إعدادات المتجر لتعديلها.
        </div>
      )}

      <fieldset disabled={readOnlyLocked} className="space-y-3 disabled:opacity-70">
        <div>
          <span className="block text-sm font-medium text-gray-700 mb-1" id="measurement-type-label">
            نوع البيع
          </span>
          <div
            className="grid grid-cols-2 sm:grid-cols-4 gap-2"
            role="radiogroup"
            aria-labelledby="measurement-type-label"
          >
            {TYPE_OPTIONS.map((opt) => {
              const disabledOpt =
                (!weightVolumeAllowed && (opt.value === 'WEIGHT' || opt.value === 'VOLUME')) ||
                readOnlyLocked;
              const selected = value.measurementType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-disabled={disabledOpt}
                  disabled={disabledOpt}
                  onClick={() => requestTypeChange(opt.value)}
                  className={`rounded-lg border px-2 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    selected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  } ${disabledOpt ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {fieldError(fieldErrors, 'measurementType') && (
            <p className="mt-1 text-xs text-red-600" role="alert">
              {fieldError(fieldErrors, 'measurementType')}
            </p>
          )}
        </div>

        {(value.measurementType === 'WEIGHT' || value.measurementType === 'VOLUME') && (
          <Select
            label="وحدة العرض"
            options={
              value.measurementType === 'WEIGHT'
                ? [
                    { value: 'g', label: 'غرام (عرض)' },
                    { value: 'kg', label: 'كغم (عرض)' },
                  ]
                : [
                    { value: 'ml', label: 'مل (عرض)' },
                    { value: 'l', label: 'لتر (عرض)' },
                  ]
            }
            value={value.displayUnitCode}
            onChange={(e) =>
              onChange({
                ...value,
                displayUnitCode: e.target.value as CatalogMeasurementFormState['displayUnitCode'],
              })
            }
          />
        )}

        {value.measurementType === 'PACKAGE' && (
          <Select
            label="وحدة العبوة"
            options={[
              { value: 'pack', label: 'عبوة' },
              { value: 'box', label: 'صندوق' },
              { value: 'bundle', label: 'ربطة' },
            ]}
            value={value.baseUnitCode}
            onChange={(e) => {
              const u = e.target.value as CatalogMeasurementFormState['baseUnitCode'];
              onChange({
                ...value,
                baseUnitCode: u,
                displayUnitCode: u as CatalogMeasurementFormState['displayUnitCode'],
              });
            }}
          />
        )}

        {presets && (
          <div>
            <span className="block text-sm font-medium text-gray-700 mb-1" id="step-presets-label">
              خطوة الكمية ({stepUnit})
            </span>
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-labelledby="step-presets-label"
            >
              {presets.map((p) => {
                const selected = !value.useCustomStep && value.quantityStep === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...value,
                        quantityStep: p,
                        useCustomStep: false,
                        customStep: '',
                        minimumQuantity:
                          !value.minimumQuantity || value.minimumQuantity === value.quantityStep
                            ? p
                            : value.minimumQuantity,
                      })
                    }
                    className={`rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      selected
                        ? 'border-primary bg-primary/10 text-primary font-semibold'
                        : 'border-gray-200 bg-white text-gray-700'
                    }`}
                    dir="ltr"
                  >
                    {p} {stepUnit}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...value,
                    useCustomStep: true,
                    customStep: value.customStep || value.quantityStep,
                  })
                }
                className={`rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  value.useCustomStep
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-gray-200 bg-white text-gray-700'
                }`}
              >
                مخصص
              </button>
            </div>
            {value.useCustomStep && (
              <div className="mt-2 flex items-end gap-2">
                <div className="flex-1">
                  <Input
                    label={`خطوة مخصصة (${stepUnit})`}
                    value={value.customStep}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        customStep: e.target.value,
                        quantityStep: e.target.value,
                      })
                    }
                    dir="ltr"
                    inputMode="decimal"
                    error={fieldError(fieldErrors, 'quantityStep')}
                  />
                </div>
              </div>
            )}
            {fieldError(fieldErrors, 'quantityStep') && (
              <p className="mt-1 text-xs text-red-600" role="alert">
                {fieldError(fieldErrors, 'quantityStep')}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              تُخزَّن الخطوة بوحدة الأساس ({stepUnit}). وحدة العرض لا تغيّر القيمة المخزّنة.
            </p>
          </div>
        )}

        {(value.measurementType === 'WEIGHT' || value.measurementType === 'VOLUME') && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={`الحد الأدنى (${stepUnit})`}
              value={value.minimumQuantity}
              onChange={(e) => onChange({ ...value, minimumQuantity: e.target.value })}
              dir="ltr"
              inputMode="decimal"
              error={fieldError(fieldErrors, 'minimumQuantity')}
            />
            <Input
              label={`الحد الأقصى اختياري (${stepUnit})`}
              value={value.maximumQuantity}
              onChange={(e) => onChange({ ...value, maximumQuantity: e.target.value })}
              dir="ltr"
              inputMode="decimal"
              error={fieldError(fieldErrors, 'maximumQuantity')}
            />
          </div>
        )}
        {(fieldError(fieldErrors, 'minimumQuantity') ||
          fieldError(fieldErrors, 'maximumQuantity')) && (
          <p className="text-xs text-red-600" role="alert">
            {fieldError(fieldErrors, 'minimumQuantity') ||
              fieldError(fieldErrors, 'maximumQuantity')}
          </p>
        )}
      </fieldset>

      <div className="rounded-lg border border-sky-100 bg-sky-50/80 px-3 py-2 text-xs text-sky-950">
        <p className="font-semibold">{priceBasisExplanationAr(value.measurementType)}</p>
        {isWeightOrVolume && preview.length > 0 && Number.isFinite(basePrice) && basePrice > 0 && (
          <ul className="mt-2 space-y-1" dir="rtl">
            {preview.map((row) => (
              <li key={row.quantityBase} className="flex justify-between gap-3">
                <span>{row.label}</span>
                <span dir="ltr">₪{formatMoney(row.priceShekels)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-[11px] text-sky-800/80">
          المعاينة إرشادية فقط — التسعير النهائي على الخادم.
        </p>
      </div>

      <ConfirmDialog
        open={pendingType != null}
        onClose={cancelTypeSwitch}
        onConfirm={confirmTypeSwitch}
        title="تأكيد تغيير نوع القياس"
        message={typeWarning}
        confirmLabel="متابعة ومراجعة السعر"
        cancelLabel="إلغاء"
        variant="warning"
      />
    </div>
  );
}

export { defaultCatalogMeasurementForm };
