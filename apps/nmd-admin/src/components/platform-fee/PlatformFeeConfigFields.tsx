import type { PlatformFeeConfig, PlatformFeeModel, TenantPlatformFeeOverride } from '../../lib/platform-fee';
import { PLATFORM_FEE_MODEL_OPTIONS } from '../../lib/platform-fee';

type Props = {
  config: PlatformFeeConfig;
  onChange: (next: PlatformFeeConfig) => void;
  idPrefix?: string;
  /** Tenant override: show market-default vs custom toggle */
  tenantMode?: boolean;
  useMarketDefault?: boolean;
  onUseMarketDefaultChange?: (useMarket: boolean) => void;
};

const fieldClass =
  'w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent';

export default function PlatformFeeConfigFields({
  config,
  onChange,
  idPrefix = 'pf',
  tenantMode = false,
  useMarketDefault = true,
  onUseMarketDefaultChange,
}: Props) {
  const model = config.model ?? 'PERCENTAGE';
  const showPercentage = model === 'PERCENTAGE' || model === 'HYBRID';
  const showFixedOrder = model === 'FIXED_ORDER' || model === 'HYBRID';
  const showFixedItem = model === 'FIXED_ITEM' || model === 'HYBRID';
  const showMinMax = model === 'PERCENTAGE' || model === 'HYBRID';
  const fieldsDisabled = tenantMode && useMarketDefault;

  const patch = (partial: Partial<PlatformFeeConfig>) => onChange({ ...config, ...partial });

  return (
    <div className="grid gap-4 max-w-lg">
      {tenantMode && onUseMarketDefaultChange && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">مصدر الإعداد</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={`${idPrefix}-source`}
              checked={useMarketDefault}
              onChange={() => onUseMarketDefaultChange(true)}
            />
            <span className="text-sm text-gray-900">استخدام إعدادات السوق</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={`${idPrefix}-source`}
              checked={!useMarketDefault}
              onChange={() => onUseMarketDefaultChange(false)}
            />
            <span className="text-sm text-gray-900">إعداد خاص لهذا المتجر</span>
          </label>
        </div>
      )}

      <label className={`flex items-center gap-3 ${fieldsDisabled ? 'opacity-50' : 'cursor-pointer'}`}>
        <input
          type="checkbox"
          checked={config.enabled ?? false}
          disabled={fieldsDisabled}
          onChange={(e) => patch({ enabled: e.target.checked })}
          className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <span className="font-medium text-gray-900">تفعيل رسوم المنصة {tenantMode && !useMarketDefault ? 'لهذا المتجر' : ''}</span>
      </label>

      <div className={fieldsDisabled ? 'opacity-50 pointer-events-none' : ''}>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={`${idPrefix}-model`}>
          نموذج الرسوم
        </label>
        <select
          id={`${idPrefix}-model`}
          value={model}
          onChange={(e) => patch({ model: e.target.value as PlatformFeeModel })}
          className={fieldClass}
        >
          {PLATFORM_FEE_MODEL_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {showPercentage && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={`${idPrefix}-pct`}>
              النسبة المئوية (%)
            </label>
            <input
              id={`${idPrefix}-pct`}
              type="number"
              min={0}
              step={0.1}
              value={config.percentage ?? 0}
              onChange={(e) => patch({ percentage: Number(e.target.value) || 0 })}
              className={fieldClass}
            />
          </div>
        )}

        {showFixedOrder && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={`${idPrefix}-fixed-order`}>
              مبلغ ثابت على الطلب (₪)
            </label>
            <input
              id={`${idPrefix}-fixed-order`}
              type="number"
              min={0}
              step={0.01}
              value={config.fixedPerOrder ?? 0}
              onChange={(e) => patch({ fixedPerOrder: Number(e.target.value) || 0 })}
              className={fieldClass}
            />
          </div>
        )}

        {showFixedItem && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={`${idPrefix}-fixed-item`}>
              مبلغ ثابت على كل منتج (₪)
            </label>
            <input
              id={`${idPrefix}-fixed-item`}
              type="number"
              min={0}
              step={0.01}
              value={config.fixedPerItem ?? 0}
              onChange={(e) => patch({ fixedPerItem: Number(e.target.value) || 0 })}
              className={fieldClass}
            />
          </div>
        )}

        {showMinMax && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={`${idPrefix}-min`}>
                حد أدنى (₪)
              </label>
              <input
                id={`${idPrefix}-min`}
                type="number"
                min={0}
                step={0.01}
                value={config.minFee ?? 0}
                onChange={(e) => patch({ minFee: Number(e.target.value) || 0 })}
                className={fieldClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={`${idPrefix}-max`}>
                حد أقصى (₪)
              </label>
              <input
                id={`${idPrefix}-max`}
                type="number"
                min={0}
                step={0.01}
                value={config.maxFee ?? 0}
                onChange={(e) => patch({ maxFee: Number(e.target.value) || 0 })}
                className={fieldClass}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function tenantOverrideToConfig(override: TenantPlatformFeeOverride | undefined): PlatformFeeConfig {
  if (!override) return { enabled: false, model: 'PERCENTAGE', percentage: 8, minFee: 2, maxFee: 50 };
  const { useMarketDefault: _u, ...rest } = override;
  return rest;
}
