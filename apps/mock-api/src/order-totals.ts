/**
 * Shared order total refresh after line-item changes.
 *
 * DELIVERY FEE POLICY (explicit business rule):
 * After checkout, Super Admin product edits keep the original delivery.fee fixed.
 * Delivery is NOT recalculated from basket value, distance, weight, or promotions
 * during order management.
 *
 * PRICING:
 * When platform fee is enabled, totals use computeMarketplaceDisplayPricing
 * (same engine as POST /orders create) — not a divergent manual formula.
 */
import type { Market, RegistryTenant } from './store.js';
import type { OrderRecord, Repos } from './repos/types.js';
import { readGateFields } from './order-submission-gate.js';
import {
  computePlatformFee,
  computeMarketplaceDisplayPricing,
  isPlatformFeeEnabled,
  ceilShekel,
  roundMoney,
  type MarketplacePricingContext,
} from './platform-fee.js';

export const DELIVERY_FEE_POLICY = {
  frozenAfterCheckout: true as const,
  description:
    'Super Admin order management preserves the original delivery.fee; it is not recomputed.',
};

async function buildExemptionMaps(
  repos: Repos,
  tenantId: string
): Promise<{ categoryExemptById: Map<string, boolean>; productCategoryById: Map<string, string> }> {
  const catalog = await repos.catalog.getCatalog(tenantId);
  const categoryExemptById = new Map<string, boolean>();
  for (const c of catalog.categories ?? []) {
    const cat = c as { id?: string; markupExempt?: boolean };
    if (cat.id) categoryExemptById.set(cat.id, cat.markupExempt === true);
  }
  const productCategoryById = new Map<string, string>();
  for (const p of catalog.products ?? []) {
    const prod = p as { id?: string; categoryId?: string };
    if (prod.id && prod.categoryId) productCategoryById.set(prod.id, prod.categoryId);
  }
  return { categoryExemptById, productCategoryById };
}

/** Total refresh after item edit — aligned with order-create marketplace pricing. */
export async function refreshOrderTotalsAfterItemEdit(
  order: OrderRecord,
  tenant: RegistryTenant | undefined,
  repos: Repos,
  opts?: { bumpRevision?: boolean }
): Promise<OrderRecord> {
  const items = (Array.isArray(order.items) ? order.items : []) as {
    quantity?: number;
    totalPrice?: number;
    productId?: string;
    categoryId?: string;
  }[];
  const orderSubtotal = roundMoney(items.reduce((s, i) => s + (Number(i.totalPrice) || 0), 0));
  // BUSINESS RULE: delivery fee frozen after checkout for Super Admin edits
  const orderDeliveryFee = Number((order.delivery as { fee?: number } | undefined)?.fee ?? 0);
  const couponDiscount = roundMoney(Math.max(0, Math.min(Number(order.discountAmount ?? 0), orderSubtotal)));
  const itemCount = items.reduce((s, i) => s + (Number(i.quantity) || 1), 0);
  const marketForFee = tenant?.marketId
    ? ((await repos.markets.findAll()) as Market[]).find((m) => m.id === tenant.marketId)
    : undefined;

  const pricingCtx: MarketplacePricingContext = {
    marketFeeConfig: marketForFee?.platformFeeConfig,
    tenantFeeOverride: tenant?.financialConfig?.platformFee,
    featureFlagEnabled: isPlatformFeeEnabled(),
  };

  const tenantId = String(order.tenantId ?? tenant?.id ?? '');
  const { categoryExemptById, productCategoryById } = tenantId
    ? await buildExemptionMaps(repos, tenantId)
    : { categoryExemptById: new Map<string, boolean>(), productCategoryById: new Map<string, string>() };

  const displayLines = items.map((i, idx) => {
    const catId =
      i.categoryId || (i.productId ? productCategoryById.get(String(i.productId)) : undefined);
    const markupExempt = catId ? categoryExemptById.get(String(catId)) === true : false;
    return {
      lineId: String(idx),
      baseAmount: roundMoney(Number(i.totalPrice) || 0),
      quantity: Math.max(1, Number(i.quantity) || 1),
      itemCount: Math.max(0, Math.floor(Number(i.quantity) || 1)),
      markupExempt,
      categoryId: catId,
    };
  });

  const displayPricing = computeMarketplaceDisplayPricing(displayLines, pricingCtx, {
    discountAmount: couponDiscount,
  });

  const feeResult = computePlatformFee({
    itemsSubtotal: orderSubtotal,
    discountAmount: couponDiscount,
    itemCount,
    deliveryFee: orderDeliveryFee,
    marketFeeConfig: marketForFee?.platformFeeConfig,
    tenantFeeOverride: tenant?.financialConfig?.platformFee,
    featureFlagEnabled: isPlatformFeeEnabled(),
  });

  const legacyTotal = Math.max(0, orderSubtotal + orderDeliveryFee - couponDiscount);
  let finalTotal = legacyTotal;
  if (isPlatformFeeEnabled()) {
    feeResult.platformFee = displayPricing.platformFee;
    feeResult.merchantPayout = displayPricing.merchantPayout;
    feeResult.feeBase = displayPricing.feeBase;
    finalTotal = ceilShekel(displayPricing.displayMerchandiseTotal + orderDeliveryFee);
    feeResult.customerTotal = finalTotal;
  }

  const payment = { ...((order.payment as Record<string, unknown>) ?? {}) };
  if (payment.financials && typeof payment.financials === 'object') {
    (payment.financials as Record<string, unknown>).gross = finalTotal;
  }
  const prevRev = readGateFields(order).revision;
  const bump = opts?.bumpRevision !== false;
  return {
    ...order,
    subtotal: orderSubtotal,
    discountAmount: couponDiscount,
    total: finalTotal,
    customerTotal: finalTotal,
    platformFee: feeResult.platformFee,
    platformFeeBase: feeResult.feeBase,
    merchantPayout: feeResult.merchantPayout,
    merchantAmount: feeResult.merchantPayout,
    platformDeliveryFee: orderDeliveryFee,
    payment,
    revision: bump ? prevRev + 1 : prevRev,
  };
}

/** Financial identity: matches create-path total formula. */
export function reconcileOrderTotals(order: OrderRecord): {
  ok: boolean;
  expected: number;
  actual: number;
  delta: number;
} {
  const subtotal = Number(order.subtotal ?? 0);
  const discount = Number(order.discountAmount ?? 0);
  const delivery = Number((order.delivery as { fee?: number } | undefined)?.fee ?? 0);
  const platformFee = Number(order.platformFee ?? 0);
  const actual = Number(order.total ?? 0);
  // When fee enabled, customer total ≈ merchandise display (subtotal - discount + fee) + delivery
  const expected = isPlatformFeeEnabled()
    ? ceilShekel(Math.max(0, subtotal - discount) + platformFee + delivery)
    : Math.max(0, subtotal + delivery - discount);
  const delta = roundMoney(actual - expected);
  return { ok: Math.abs(delta) < 0.05, expected, actual, delta };
}
