/**
 * Platform fee preview math — mirrors apps/mock-api/src/platform-fee.ts (Phase 1).
 * Used for Super Admin config UI preview only; orders still gated by server flag.
 */

export type PlatformFeeModel = 'PERCENTAGE' | 'FIXED_ORDER' | 'FIXED_ITEM' | 'HYBRID';

export interface PlatformFeeConfig {
  enabled?: boolean;
  model?: PlatformFeeModel;
  percentage?: number;
  fixedPerOrder?: number;
  fixedPerItem?: number;
  minFee?: number;
  maxFee?: number;
}

export interface TenantPlatformFeeOverride extends PlatformFeeConfig {
  useMarketDefault?: boolean;
}

export type PlatformFeeConfigSource = 'MARKET' | 'TENANT' | 'DISABLED';

export const PLATFORM_FEE_MODEL_OPTIONS: { value: PlatformFeeModel; label: string }[] = [
  { value: 'PERCENTAGE', label: 'نسبة مئوية' },
  { value: 'FIXED_ORDER', label: 'مبلغ ثابت على الطلب' },
  { value: 'FIXED_ITEM', label: 'مبلغ ثابت على كل منتج' },
  { value: 'HYBRID', label: 'هجين: نسبة + حد أدنى/أقصى' },
];

export const DEFAULT_PLATFORM_FEE_CONFIG: PlatformFeeConfig = {
  enabled: false,
  model: 'PERCENTAGE',
  percentage: 8,
  fixedPerOrder: 0,
  fixedPerItem: 0,
  minFee: 2,
  maxFee: 50,
};

export function isPlatformAdminRole(role: string | undefined): boolean {
  return role === 'ROOT_ADMIN' || role === 'SUPER_ADMIN';
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function resolvePlatformFeeConfig(
  marketFeeConfig?: PlatformFeeConfig | null,
  tenantFeeOverride?: TenantPlatformFeeOverride | null
): { config: PlatformFeeConfig | null; source: PlatformFeeConfigSource } {
  if (tenantFeeOverride && tenantFeeOverride.useMarketDefault === false) {
    if (tenantFeeOverride.enabled) {
      return { config: tenantFeeOverride, source: 'TENANT' };
    }
    return { config: null, source: 'DISABLED' };
  }
  if (marketFeeConfig?.enabled) {
    return { config: marketFeeConfig, source: 'MARKET' };
  }
  return { config: null, source: 'DISABLED' };
}

function clampFee(fee: number, minFee?: number, maxFee?: number): number {
  let result = fee;
  if (minFee != null && Number.isFinite(minFee)) result = Math.max(result, minFee);
  if (maxFee != null && Number.isFinite(maxFee)) result = Math.min(result, maxFee);
  return roundMoney(Math.max(0, result));
}

function calculateRawFee(
  feeBase: number,
  itemCount: number,
  config: PlatformFeeConfig
): number {
  const model = config.model ?? 'PERCENTAGE';
  const percentage = config.percentage ?? 0;
  const fixedPerOrder = config.fixedPerOrder ?? 0;
  const fixedPerItem = config.fixedPerItem ?? 0;

  switch (model) {
    case 'FIXED_ORDER':
      return fixedPerOrder;
    case 'FIXED_ITEM':
      return fixedPerItem * itemCount;
    case 'HYBRID':
      return feeBase * (percentage / 100) + fixedPerOrder + fixedPerItem * itemCount;
    case 'PERCENTAGE':
    default:
      return feeBase * (percentage / 100);
  }
}

export interface ComputePlatformFeeInput {
  itemsSubtotal: number;
  discountAmount: number;
  itemCount: number;
  deliveryFee: number;
  marketFeeConfig?: PlatformFeeConfig | null;
  tenantFeeOverride?: TenantPlatformFeeOverride | null;
  /** Preview as if orders apply fees (true). Config-only preview when false uses resolved config only. */
  simulateOrdersEnabled?: boolean;
}

export interface ComputePlatformFeeResult {
  platformFee: number;
  feeBase: number;
  customerTotal: number;
  merchantPayout: number;
  appliedConfigSource: PlatformFeeConfigSource;
  itemsSubtotal: number;
  discountAmount: number;
  deliveryFee: number;
}

/** Preview calculator — simulates order fee when simulateOrdersEnabled is true. */
export function computePlatformFeePreview(input: ComputePlatformFeeInput): ComputePlatformFeeResult {
  const itemsSubtotal = roundMoney(Math.max(0, input.itemsSubtotal));
  const discountAmount = roundMoney(Math.max(0, input.discountAmount));
  const deliveryFee = roundMoney(Math.max(0, input.deliveryFee));
  const itemCount = Math.max(0, Math.floor(Number(input.itemCount) || 0));
  const feeBase = roundMoney(Math.max(itemsSubtotal - discountAmount, 0));
  const merchantPayout = feeBase;
  const legacyCustomerTotal = roundMoney(feeBase + deliveryFee);

  const simulateEnabled = input.simulateOrdersEnabled !== false;
  if (!simulateEnabled) {
    return {
      platformFee: 0,
      feeBase,
      customerTotal: legacyCustomerTotal,
      merchantPayout,
      appliedConfigSource: 'DISABLED',
      itemsSubtotal,
      discountAmount,
      deliveryFee,
    };
  }

  const { config, source } = resolvePlatformFeeConfig(input.marketFeeConfig, input.tenantFeeOverride);
  if (!config || source === 'DISABLED') {
    return {
      platformFee: 0,
      feeBase,
      customerTotal: legacyCustomerTotal,
      merchantPayout,
      appliedConfigSource: 'DISABLED',
      itemsSubtotal,
      discountAmount,
      deliveryFee,
    };
  }

  const raw = calculateRawFee(feeBase, itemCount, config);
  const platformFee = clampFee(raw, config.minFee, config.maxFee);
  const customerTotal = roundMoney(feeBase + deliveryFee + platformFee);

  return {
    platformFee,
    feeBase,
    customerTotal,
    merchantPayout,
    appliedConfigSource: source,
    itemsSubtotal,
    discountAmount,
    deliveryFee,
  };
}

export function disabledPlatformFeeConfig(): PlatformFeeConfig {
  return {
    enabled: false,
    model: 'PERCENTAGE',
    percentage: 0,
    fixedPerOrder: 0,
    fixedPerItem: 0,
    minFee: 0,
    maxFee: 0,
  };
}
