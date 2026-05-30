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
    platformFeeConfigSnapshot: feeResult.configSnapshot,
  };
}

export type CheckoutPricingStoreInput = {
  tenantId: string;
  itemsSubtotal: number;
  itemCount: number;
  /** Coupon discount applied to this store's items (first store in multi-store checkout). */
  discountAmount?: number;
};

export type CheckoutPricingQuoteInput = {
  stores: CheckoutPricingStoreInput[];
  deliveryFee?: number;
};

/** Customer-facing checkout totals — platform fee is baked into merchandise amount, not exposed. */
export type CheckoutPricingQuoteResult = {
  customerTotal: number;
  deliveryFee: number;
  /** Product amount shown to customer (includes hidden platform markup when flag on). */
  displayMerchandiseTotal: number;
  discountAmount: number;
  itemsSubtotal: number;
  platformFeeApplied: boolean;
};

export function computeCheckoutPricingQuote(
  input: CheckoutPricingQuoteInput,
  resolveStore: (tenantId: string) => {
    marketFeeConfig?: PlatformFeeConfig | null;
    tenantFeeOverride?: TenantPlatformFeeOverride | null;
  }
): CheckoutPricingQuoteResult {
  const deliveryFee = roundMoney(Math.max(0, input.deliveryFee ?? 0));
  const flagEnabled = isPlatformFeeEnabled();
  let displayMerchandiseTotal = 0;
  let discountAmount = 0;
  let itemsSubtotal = 0;

  for (const store of input.stores) {
    const itemsSub = roundMoney(Math.max(0, store.itemsSubtotal));
    const discount = roundMoney(Math.max(0, store.discountAmount ?? 0));
    itemsSubtotal += itemsSub;
    discountAmount += discount;

    const { marketFeeConfig, tenantFeeOverride } = resolveStore(store.tenantId);
    const display = computeMarketplaceDisplayPricing(
      [{ baseAmount: itemsSub, quantity: 1, itemCount: store.itemCount }],
      { marketFeeConfig, tenantFeeOverride },
      { discountAmount: discount, featureFlagEnabled: flagEnabled }
    );
    displayMerchandiseTotal += display.displayMerchandiseTotal;
  }

  const customerTotal = roundMoney(displayMerchandiseTotal + deliveryFee);
  const legacyMerchandise = roundMoney(Math.max(itemsSubtotal - discountAmount, 0));

  return {
    customerTotal: flagEnabled ? customerTotal : roundMoney(legacyMerchandise + deliveryFee),
    deliveryFee,
    displayMerchandiseTotal: flagEnabled ? displayMerchandiseTotal : legacyMerchandise,
    discountAmount,
    itemsSubtotal,
    platformFeeApplied: flagEnabled && displayMerchandiseTotal > legacyMerchandise,
  };
}

// --- Marketplace catalog repricing (customer-visible prices) ---

export type MarketplacePricingContext = {
  marketFeeConfig?: PlatformFeeConfig | null;
  tenantFeeOverride?: TenantPlatformFeeOverride | null;
  featureFlagEnabled?: boolean;
};

export type MarketplaceDisplayLineInput = {
  lineId?: string;
  /** Merchant line total (unit × qty at merchant rates, before platform markup). */
  baseAmount: number;
  quantity: number;
  itemCount?: number;
};

export type MarketplaceDisplayLineResult = {
  lineId?: string;
  baseAmount: number;
  displayAmount: number;
  displayUnitPrice: number;
  quantity: number;
};

export type MarketplaceDisplayPricingResult = {
  lines: MarketplaceDisplayLineResult[];
  itemsSubtotal: number;
  discountAmount: number;
  feeBase: number;
  platformFee: number;
  merchantPayout: number;
  displayMerchandiseTotal: number;
  appliedConfigSource: PlatformFeeConfigSource;
};

/**
 * Allocate marketplace markup across cart/catalog lines (server-authoritative).
 * Uses computePlatformFee() then distributes display total proportionally by merchant fee base share.
 */
export function computeMarketplaceDisplayPricing(
  lines: MarketplaceDisplayLineInput[],
  ctx: MarketplacePricingContext,
  options?: { discountAmount?: number }
): MarketplaceDisplayPricingResult {
  const flagEnabled = ctx.featureFlagEnabled ?? isPlatformFeeEnabled();
  const discountAmount = roundMoney(Math.max(0, options?.discountAmount ?? 0));
  const itemsSubtotal = roundMoney(
    lines.reduce((s, l) => s + Math.max(0, Number(l.baseAmount) || 0), 0)
  );
  const itemCount = lines.reduce(
    (s, l) => s + Math.max(0, Math.floor(Number(l.itemCount ?? l.quantity) || 0)),
    0
  );

  if (!flagEnabled || lines.length === 0) {
    const mapped = lines.map((l) => {
      const baseAmount = roundMoney(Math.max(0, l.baseAmount));
      const qty = Math.max(1, Number(l.quantity) || 1);
      return {
        lineId: l.lineId,
        baseAmount,
        displayAmount: baseAmount,
        displayUnitPrice: roundMoney(baseAmount / qty),
        quantity: qty,
      };
    });
    const feeBase = roundMoney(Math.max(itemsSubtotal - discountAmount, 0));
    return {
      lines: mapped,
      itemsSubtotal,
      discountAmount,
      feeBase,
      platformFee: 0,
      merchantPayout: feeBase,
      displayMerchandiseTotal: feeBase,
      appliedConfigSource: 'DISABLED',
    };
  }

  const feeResult = computePlatformFee({
    itemsSubtotal,
    discountAmount,
    itemCount,
    deliveryFee: 0,
    marketFeeConfig: ctx.marketFeeConfig,
    tenantFeeOverride: ctx.tenantFeeOverride,
    featureFlagEnabled: true,
  });

  const feeBase = feeResult.feeBase;
  const displayMerchandiseTotal = roundMoney(feeBase + feeResult.platformFee);

  const resultLines: MarketplaceDisplayLineResult[] = lines.map((l) => {
    const baseAmount = roundMoney(Math.max(0, l.baseAmount));
    const qty = Math.max(1, Number(l.quantity) || 1);
    let displayAmount = baseAmount;
    if (feeBase > 0 && itemsSubtotal > 0) {
      const lineFeeBaseShare = roundMoney((baseAmount / itemsSubtotal) * feeBase);
      const lineFeeShare =
        feeResult.platformFee > 0
          ? roundMoney((lineFeeBaseShare / feeBase) * feeResult.platformFee)
          : 0;
      displayAmount = roundMoney(lineFeeBaseShare + lineFeeShare);
    } else if (feeBase === 0) {
      displayAmount = 0;
    }
    return {
      lineId: l.lineId,
      baseAmount,
      displayAmount,
      displayUnitPrice: roundMoney(displayAmount / qty),
      quantity: qty,
    };
  });

  return {
    lines: resultLines,
    itemsSubtotal,
    discountAmount,
    feeBase,
    platformFee: feeResult.platformFee,
    merchantPayout: feeResult.merchantPayout,
    displayMerchandiseTotal,
    appliedConfigSource: feeResult.appliedConfigSource,
  };
}

/** Single-unit catalog/card price (assumes qty=1 line context). */
export function displayMarketplaceUnitPrice(
  baseUnitPrice: number,
  ctx: MarketplacePricingContext
): number {
  const base = roundMoney(Math.max(0, baseUnitPrice));
  const result = computeMarketplaceDisplayPricing(
    [{ baseAmount: base, quantity: 1, itemCount: 1 }],
    ctx
  );
  return result.lines[0]?.displayUnitPrice ?? base;
}

export type CatalogProductPricingFields = {
  displayPrice: number;
  displayComparePrice?: number;
};

export function enrichProductDisplayPricing(
  product: { basePrice: number; compareAtPrice?: number | null },
  ctx: MarketplacePricingContext
): CatalogProductPricingFields {
  const flagEnabled = ctx.featureFlagEnabled ?? isPlatformFeeEnabled();
  if (!flagEnabled) {
    return {
      displayPrice: roundMoney(Math.max(0, product.basePrice)),
      ...(product.compareAtPrice != null
        ? { displayComparePrice: roundMoney(Math.max(0, product.compareAtPrice)) }
        : {}),
    };
  }
  const displayPrice = displayMarketplaceUnitPrice(product.basePrice, ctx);
  const displayComparePrice =
    product.compareAtPrice != null && Number.isFinite(product.compareAtPrice)
      ? displayMarketplaceUnitPrice(Number(product.compareAtPrice), ctx)
      : undefined;
  return { displayPrice, ...(displayComparePrice != null ? { displayComparePrice } : {}) };
}
