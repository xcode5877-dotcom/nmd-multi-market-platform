/**
 * Platform service fee — pure calculation (Phase 1).
 * Gated by PLATFORM_FEE_ENABLED (default false).
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

/** Tenant/store override nested under financialConfig.platformFee */
export interface TenantPlatformFeeOverride extends PlatformFeeConfig {
  /** When true (default), inherit market default. When false, use tenant fields below. */
  useMarketDefault?: boolean;
}

export type PlatformFeeConfigSource = 'MARKET' | 'TENANT' | 'DISABLED';

export interface PlatformFeeConfigSnapshot {
  source: PlatformFeeConfigSource;
  model?: PlatformFeeModel;
  percentage?: number;
  fixedPerOrder?: number;
  fixedPerItem?: number;
  minFee?: number;
  maxFee?: number;
}

export interface ComputePlatformFeeInput {
  itemsSubtotal: number;
  discountAmount: number;
  itemCount: number;
  deliveryFee: number;
  marketFeeConfig?: PlatformFeeConfig | null;
  tenantFeeOverride?: TenantPlatformFeeOverride | null;
  /** Defaults to isPlatformFeeEnabled() */
  featureFlagEnabled?: boolean;
}

export interface ComputePlatformFeeResult {
  platformFee: number;
  feeBase: number;
  feeType: PlatformFeeModel | 'NONE';
  feeRate: number;
  fixedAmount: number;
  minFee: number;
  maxFee: number;
  appliedConfigSource: PlatformFeeConfigSource;
  customerTotal: number;
  merchantPayout: number;
  configSnapshot: PlatformFeeConfigSnapshot;
  itemsSubtotal: number;
  discountAmount: number;
  deliveryFee: number;
}

export function isPlatformFeeEnabled(): boolean {
  return String(process.env.PLATFORM_FEE_ENABLED ?? 'false').toLowerCase() === 'true';
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Resolve effective fee config: tenant override beats market default. */
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
): { raw: number; feeType: PlatformFeeModel; feeRate: number; fixedAmount: number } {
  const model = config.model ?? 'PERCENTAGE';
  const percentage = config.percentage ?? 0;
  const fixedPerOrder = config.fixedPerOrder ?? 0;
  const fixedPerItem = config.fixedPerItem ?? 0;

  switch (model) {
    case 'FIXED_ORDER':
      return { raw: fixedPerOrder, feeType: 'FIXED_ORDER', feeRate: 0, fixedAmount: roundMoney(fixedPerOrder) };
    case 'FIXED_ITEM': {
      const itemFee = roundMoney(fixedPerItem * itemCount);
      return { raw: itemFee, feeType: 'FIXED_ITEM', feeRate: 0, fixedAmount: itemFee };
    }
    case 'HYBRID': {
      const pctPart = feeBase * (percentage / 100);
      const fixedPart = fixedPerOrder + fixedPerItem * itemCount;
      return {
        raw: pctPart + fixedPart,
        feeType: 'HYBRID',
        feeRate: percentage,
        fixedAmount: roundMoney(fixedPart),
      };
    }
    case 'PERCENTAGE':
    default: {
      const pctPart = feeBase * (percentage / 100);
      return { raw: pctPart, feeType: 'PERCENTAGE', feeRate: percentage, fixedAmount: 0 };
    }
  }
}

/**
 * Compute platform service fee and order financial totals.
 * Delivery fee is never included in the percentage base.
 */
export function computePlatformFee(input: ComputePlatformFeeInput): ComputePlatformFeeResult {
  const itemsSubtotal = roundMoney(Math.max(0, input.itemsSubtotal));
  const discountAmount = roundMoney(Math.max(0, input.discountAmount));
  const deliveryFee = roundMoney(Math.max(0, input.deliveryFee));
  const itemCount = Math.max(0, Math.floor(Number(input.itemCount) || 0));
  const feeBase = roundMoney(Math.max(itemsSubtotal - discountAmount, 0));
  const merchantPayout = feeBase;
  const legacyCustomerTotal = roundMoney(feeBase + deliveryFee);

  const emptySnapshot: PlatformFeeConfigSnapshot = { source: 'DISABLED' };
  const baseResult = {
    feeBase,
    merchantPayout,
    itemsSubtotal,
    discountAmount,
    deliveryFee,
    customerTotal: legacyCustomerTotal,
  };

  const flagEnabled = input.featureFlagEnabled ?? isPlatformFeeEnabled();
  if (!flagEnabled) {
    return {
      ...baseResult,
      platformFee: 0,
      feeType: 'NONE' as const,
      feeRate: 0,
      fixedAmount: 0,
      minFee: 0,
      maxFee: 0,
      appliedConfigSource: 'DISABLED',
      configSnapshot: emptySnapshot,
    };
  }

  const { config, source } = resolvePlatformFeeConfig(input.marketFeeConfig, input.tenantFeeOverride);
  if (!config || source === 'DISABLED') {
    return {
      ...baseResult,
      platformFee: 0,
      feeType: 'NONE' as const,
      feeRate: 0,
      fixedAmount: 0,
      minFee: 0,
      maxFee: 0,
      appliedConfigSource: 'DISABLED',
      configSnapshot: emptySnapshot,
    };
  }

  const { raw, feeType, feeRate, fixedAmount } = calculateRawFee(feeBase, itemCount, config);
  const platformFee = clampFee(raw, config.minFee, config.maxFee);
  const customerTotal = roundMoney(feeBase + deliveryFee + platformFee);

  return {
    ...baseResult,
    platformFee,
    feeType,
    feeRate,
    fixedAmount,
    minFee: config.minFee ?? 0,
    maxFee: config.maxFee ?? 0,
    appliedConfigSource: source,
    customerTotal,
    configSnapshot: {
      source,
      model: config.model ?? feeType,
      percentage: config.percentage,
      fixedPerOrder: config.fixedPerOrder,
      fixedPerItem: config.fixedPerItem,
      minFee: config.minFee,
      maxFee: config.maxFee,
    },
  };
}

export type OrderPaymentWithPlatformFee = {
  method: 'CASH' | 'CARD';
  provider: string;
  status: 'PENDING' | 'COLLECTED' | 'AUTHORIZED' | 'CAPTURED' | 'REFUNDED';
  currency: string;
  breakdown: {
    itemsTotal: number;
    deliveryFee: number;
    discountAmount: number;
    platformFee: number;
    platformFeeBase: number;
    customerTotal: number;
    discount?: number;
    tax?: number;
  };
  financials: {
    gross: number;
    platformFee: number;
    commission: number;
    gatewayFee: number;
    netToMerchant: number;
    netToMarket: number;
    merchantPayout: number;
    customerTotal: number;
  };
  platformFeeConfigSnapshot: PlatformFeeConfigSnapshot;
};

/** Build payment object when platform fee flag is ON. */
export function buildPlatformFeePayment(
  feeResult: ComputePlatformFeeResult,
  deliveryFeeModel: 'MARKET' | 'TENANT'
): Omit<OrderPaymentWithPlatformFee, 'method'> {
  const isMarketFee = deliveryFeeModel === 'MARKET';
  const { platformFee, merchantPayout, customerTotal, feeBase, deliveryFee, discountAmount, itemsSubtotal } = feeResult;
  return {
    provider: 'NMD',
    status: 'PENDING',
    currency: 'ILS',
    breakdown: {
      itemsTotal: itemsSubtotal,
      deliveryFee,
      discountAmount,
      platformFee,
      platformFeeBase: feeBase,
      customerTotal,
      discount: discountAmount,
    },
    financials: {
      gross: customerTotal,
      platformFee,
      commission: platformFee,
      gatewayFee: 0,
      netToMerchant: merchantPayout,
      netToMarket: roundMoney(platformFee + (isMarketFee ? deliveryFee : 0)),
      merchantPayout,
      customerTotal,
    },
    platformFeeConfigSnapshot: feeResult.configSnapshot,
  };
}

/** Additive snapshot fields for legacy payment (flag OFF). Does not change gross/commission math. */
export function enrichLegacyPaymentWithSnapshot(
  payment: {
    breakdown: { itemsTotal: number; deliveryFee: number; discount?: number; tax?: number };
    financials: { gross: number; commission: number; gatewayFee: number; netToMerchant: number; netToMarket: number };
  },
  feeResult: ComputePlatformFeeResult
): OrderPaymentWithPlatformFee {
  return {
    method: 'CASH',
    provider: 'NMD',
    status: 'PENDING',
    currency: 'ILS',
    breakdown: {
      ...payment.breakdown,
      discountAmount: feeResult.discountAmount,
      platformFee: 0,
      platformFeeBase: feeResult.feeBase,
      customerTotal: feeResult.customerTotal,
      discount: feeResult.discountAmount,
    },
    financials: {
      ...payment.financials,
      platformFee: 0,
      merchantPayout: feeResult.merchantPayout,
      customerTotal: feeResult.customerTotal,
    },
    platformFeeConfigSnapshot: feeResult.configSnapshot,
  };
}
