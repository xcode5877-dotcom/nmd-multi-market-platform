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

/** Customer-facing price: round UP to nearest whole shekel (₪). */
export function ceilShekel(n: number): number {
  return Math.ceil(Math.max(0, n));
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
  // 0 means unset — UI defaults write minFee/maxFee: 0 which must not cap the fee to zero.
  if (minFee != null && Number.isFinite(minFee) && minFee > 0) result = Math.max(result, minFee);
  if (maxFee != null && Number.isFinite(maxFee) && maxFee > 0) result = Math.min(result, maxFee);
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
  /** When true, no platform markup is applied (e.g. drinks category). */
  markupExempt?: boolean;
  categoryId?: string;
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
 * Exempt lines skip markup; customer prices use ceil to whole shekels.
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

  const mapLineNoMarkup = (l: MarketplaceDisplayLineInput, displayAmount: number): MarketplaceDisplayLineResult => {
    const baseAmount = roundMoney(Math.max(0, l.baseAmount));
    const qty = Math.max(1, Number(l.quantity) || 1);
    return {
      lineId: l.lineId,
      baseAmount,
      displayAmount,
      displayUnitPrice: qty > 0 ? roundMoney(displayAmount / qty) : displayAmount,
      quantity: qty,
    };
  };

  if (lines.length === 0) {
    return {
      lines: [],
      itemsSubtotal: 0,
      discountAmount,
      feeBase: 0,
      platformFee: 0,
      merchantPayout: 0,
      displayMerchandiseTotal: 0,
      appliedConfigSource: 'DISABLED',
    };
  }

  const feeBaseTotal = roundMoney(Math.max(itemsSubtotal - discountAmount, 0));

  if (!flagEnabled) {
    const mapped = lines.map((l) => {
      const baseAmount = roundMoney(Math.max(0, l.baseAmount));
      const share = itemsSubtotal > 0 ? (baseAmount / itemsSubtotal) * feeBaseTotal : 0;
      return mapLineNoMarkup(l, ceilShekel(share));
    });
    const displayMerchandiseTotal = mapped.reduce((s, x) => s + x.displayAmount, 0);
    return {
      lines: mapped,
      itemsSubtotal,
      discountAmount,
      feeBase: feeBaseTotal,
      platformFee: roundMoney(Math.max(0, displayMerchandiseTotal - feeBaseTotal)),
      merchantPayout: feeBaseTotal,
      displayMerchandiseTotal,
      appliedConfigSource: 'DISABLED',
    };
  }

  const taxableLines = lines.filter((l) => !l.markupExempt);
  const exemptLines = lines.filter((l) => l.markupExempt);
  const taxableSubtotal = roundMoney(
    taxableLines.reduce((s, l) => s + Math.max(0, Number(l.baseAmount) || 0), 0)
  );
  const exemptSubtotal = roundMoney(
    exemptLines.reduce((s, l) => s + Math.max(0, Number(l.baseAmount) || 0), 0)
  );
  const taxableDiscount =
    itemsSubtotal > 0 ? roundMoney((taxableSubtotal / itemsSubtotal) * discountAmount) : 0;
  const exemptDiscount =
    itemsSubtotal > 0 ? roundMoney((exemptSubtotal / itemsSubtotal) * discountAmount) : 0;
  const taxableFeeBase = roundMoney(Math.max(taxableSubtotal - taxableDiscount, 0));
  const exemptFeeBase = roundMoney(Math.max(exemptSubtotal - exemptDiscount, 0));

  const taxableItemCount = taxableLines.reduce(
    (s, l) => s + Math.max(0, Math.floor(Number(l.itemCount ?? l.quantity) || 0)),
    0
  );

  const feeResult = computePlatformFee({
    itemsSubtotal: taxableSubtotal,
    discountAmount: taxableDiscount,
    itemCount: taxableItemCount || itemCount,
    deliveryFee: 0,
    marketFeeConfig: ctx.marketFeeConfig,
    tenantFeeOverride: ctx.tenantFeeOverride,
    featureFlagEnabled: true,
  });

  const platformFeeOnTaxable = feeResult.platformFee;
  const appliedConfigSource = feeResult.appliedConfigSource;

  const resultLines: MarketplaceDisplayLineResult[] = lines.map((l) => {
    const baseAmount = roundMoney(Math.max(0, l.baseAmount));
    const qty = Math.max(1, Number(l.quantity) || 1);
    const lineMerchantShare =
      itemsSubtotal > 0 ? roundMoney((baseAmount / itemsSubtotal) * feeBaseTotal) : 0;

    if (l.markupExempt) {
      return {
        lineId: l.lineId,
        baseAmount,
        displayAmount: ceilShekel(lineMerchantShare),
        displayUnitPrice: qty > 0 ? roundMoney(ceilShekel(lineMerchantShare) / qty) : 0,
        quantity: qty,
      };
    }

    let displayAmount = lineMerchantShare;
    if (taxableFeeBase > 0 && taxableSubtotal > 0) {
      const lineTaxableShare = roundMoney((baseAmount / taxableSubtotal) * taxableFeeBase);
      const lineFeeShare =
        platformFeeOnTaxable > 0
          ? roundMoney((lineTaxableShare / taxableFeeBase) * platformFeeOnTaxable)
          : 0;
      displayAmount = lineTaxableShare + lineFeeShare;
    } else if (taxableFeeBase === 0 && baseAmount > 0 && !l.markupExempt) {
      displayAmount = 0;
    }
    const ceiled = ceilShekel(displayAmount);
    return {
      lineId: l.lineId,
      baseAmount,
      displayAmount: ceiled,
      displayUnitPrice: qty > 0 ? roundMoney(ceiled / qty) : ceiled,
      quantity: qty,
    };
  });

  const displayMerchandiseTotal = resultLines.reduce((s, x) => s + x.displayAmount, 0);
  const merchantPayout = feeBaseTotal;
  const platformFee = roundMoney(Math.max(0, displayMerchandiseTotal - merchantPayout));

  return {
    lines: resultLines,
    itemsSubtotal,
    discountAmount,
    feeBase: feeBaseTotal,
    platformFee,
    merchantPayout,
    displayMerchandiseTotal,
    appliedConfigSource,
  };
}

/** Single-unit catalog/card price (assumes qty=1 line context). */
export function displayMarketplaceUnitPrice(
  baseUnitPrice: number,
  ctx: MarketplacePricingContext,
  markupExempt = false
): number {
  const base = roundMoney(Math.max(0, baseUnitPrice));
  const result = computeMarketplaceDisplayPricing(
    [{ baseAmount: base, quantity: 1, itemCount: 1, markupExempt }],
    ctx
  );
  return result.lines[0]?.displayUnitPrice ?? ceilShekel(base);
}

export type CatalogProductPricingFields = {
  displayPrice: number;
  displayComparePrice?: number;
};

export function enrichProductDisplayPricing(
  product: { basePrice: number; compareAtPrice?: number | null; markupExempt?: boolean },
  ctx: MarketplacePricingContext
): CatalogProductPricingFields {
  const flagEnabled = ctx.featureFlagEnabled ?? isPlatformFeeEnabled();
  const exempt = product.markupExempt === true;
  if (!flagEnabled) {
    return {
      displayPrice: ceilShekel(Math.max(0, product.basePrice)),
      ...(product.compareAtPrice != null
        ? { displayComparePrice: ceilShekel(Math.max(0, product.compareAtPrice)) }
        : {}),
    };
  }
  const displayPrice = displayMarketplaceUnitPrice(product.basePrice, ctx, exempt);
  const displayComparePrice =
    product.compareAtPrice != null && Number.isFinite(product.compareAtPrice)
      ? displayMarketplaceUnitPrice(Number(product.compareAtPrice), ctx, exempt)
      : undefined;
  return { displayPrice, ...(displayComparePrice != null ? { displayComparePrice } : {}) };
}
