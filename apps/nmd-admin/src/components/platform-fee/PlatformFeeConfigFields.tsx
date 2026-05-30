import type { PlatformFeeConfig, PlatformFeeModel, TenantFeeMode, TenantPlatformFeeOverride } from '../../lib/platform-fee';
import { FEE_SOURCE_LABELS, PLATFORM_FEE_MODEL_OPTIONS } from '../../lib/platform-fee';

type Props = {
  config: PlatformFeeConfig;
  onChange: (next: PlatformFeeConfig) => void;
  idPrefix?: string;
  /** Tenant override: inherit market / custom / exempt */
  tenantMode?: boolean;
  tenantFeeMode?: TenantFeeMode;
  onTenantFeeModeChange?: (mode: TenantFeeMode) => void;
  /** @deprecated use tenantFeeMode */
  useMarketDefault?: boolean;
  /** @deprecated use tenantFeeMode */
  onUseMarketDefaultChange?: (useMarket: boolean) => void;
};

const fieldClass =
  'w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent';

export default function PlatformFeeConfigFields({
  config,
  onChange,
  idPrefix = 'pf',
  tenantMode = false,
  tenantFeeMode,
  onTenantFeeModeChange,
  useMarketDefault = true,
  onUseMarketDefaultChange,
}: Props) {
  const resolvedTenantFeeMode: TenantFeeMode =
    tenantFeeMode ??
    (useMarketDefault ? 'MARKET_DEFAULT' : config.enabled === false ? 'EXEMPT' : 'CUSTOM');
  const setTenantFeeMode = (mode: TenantFeeMode) => {
    onTenantFeeModeChange?.(mode);
    if (mode === 'MARKET_DEFAULT') onUseMarketDefaultChange?.(true);
    else onUseMarketDefaultChange?.(false);
    if (mode === 'CUSTOM') onChange({ ...config, enabled: true });
    if (mode === 'EXEMPT') onChange({ ...config, enabled: false });
  };

  const model = config.model ?? 'PERCENTAGE';
  const showPercentage = model === 'PERCENTAGE' || model === 'HYBRID';
  const showFixedOrder = model === 'FIXED_ORDER' || model === 'HYBRID';
  const showFixedItem = model === 'FIXED_ITEM' || model === 'HYBRID';
  const showMinMax = model === 'PERCENTAGE' || model === 'HYBRID';
  const showCustomFields = !tenantMode || resolvedTenantFeeMode === 'CUSTOM';
  const fieldsDisabled = tenantMode && resolvedTenantFeeMode !== 'CUSTOM';

  const patch = (partial: Partial<PlatformFeeConfig>) => onChange({ ...config, ...partial });

  return (
    <div className="grid gap-4 max-w-lg">
      {tenantMode && (onTenantFeeModeChange || onUseMarketDefaultChange) && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">تسعير الزبون (رسوم منصة Now Market)</p>
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 mb-2">
            يُضاف لسعر المنتج الذي يراه الزبون في التطبيق. هذا ليس «عمولة المحل» أعلاه ولا يظهر كسطر منفصل للزبون.
          </p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={`${idPrefix}-source`}
              checked={resolvedTenantFeeMode === 'MARKET_DEFAULT'}
              onChange={() => setTenantFeeMode('MARKET_DEFAULT')}
            />
            <span className="text-sm text-gray-900">{FEE_SOURCE_LABELS.MARKET} — وراثة إعداد السوق</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={`${idPrefix}-source`}
              checked={resolvedTenantFeeMode === 'CUSTOM'}
              onChange={() => setTenantFeeMode('CUSTOM')}
            />
            <span className="text-sm text-gray-900">{FEE_SOURCE_LABELS.TENANT} — إعداد خاص (مثال: ₪5 على كل منتج)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name={`${idPrefix}-source`}
              checked={resolvedTenantFeeMode === 'EXEMPT'}
              onChange={() => setTenantFeeMode('EXEMPT')}
            />
            <span className="text-sm text-gray-900">{FEE_SOURCE_LABELS.EXEMPT} — بدون رسوم منصة</span>
          </label>
        </div>
      )}

      {!tenantMode && (
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={config.enabled ?? false}
            onChange={(e) => patch({ enabled: e.target.checked })}
            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="font-medium text-gray-900">تفعيل رسوم المنصة</span>
        </label>
      )}

      {tenantMode && resolvedTenantFeeMode === 'EXEMPT' && (
        <p className="text-sm text-gray-600 rounded-lg border border-gray-200 bg-gray-50 p-3">
          هذا المتجر معفى من رسوم المنصة حتى لو كان السوق مفعّلاً.
        </p>
      )}

      {tenantMode && resolvedTenantFeeMode === 'MARKET_DEFAULT' && (
        <p className="text-sm text-gray-600 rounded-lg border border-gray-200 bg-gray-50 p-3">
          يُطبَّق إعداد السوق الافتراضي عند تفعيل رسوم المنصة على مستوى المنصة.
        </p>
      )}

      {showCustomFields && (
      <div className={fieldsDisabled ? 'opacity-50 pointer-events-none' : ''}>
        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={`${idPrefix}-model`}>
          نموذج رسوم المنصة (سعر الزبون)
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
              مبلغ ثابت يُضاف لسعر كل منتج/وجبة للزبون (₪)
            </label>
            <p className="text-xs text-gray-500 mb-1">
              مثال: ₪5 هنا → منتج ₪60 يظهر للزبون ₪65. لا تخلط مع «قيمة عمولة المحل» في قسم الحسابات الداخلية.
            </p>
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
      )}
    </div>
  );
}

export function tenantOverrideToConfig(override: TenantPlatformFeeOverride | undefined): PlatformFeeConfig {
  if (!override) return { enabled: false, model: 'PERCENTAGE', percentage: 8, minFee: 2, maxFee: 50 };
  const { useMarketDefault: _u, ...rest } = override;
  return rest;
}
