import type { Campaign } from './campaign';
import type { OptionItem } from './product';

export interface PricedLine {
  basePrice: number;
  optionDelta: number;
  campaignDiscount: number;
  finalPrice: number;
  campaign?: Campaign;
}

/**
 * Apply options price deltas to a base price.
 */
export function applyOptionDeltas(basePrice: number, items: OptionItem[]): number {
  const delta = items.reduce((sum, i) => sum + (i.priceDelta ?? i.priceModifier ?? 0), 0);
  return basePrice + delta;
}

/**
 * Apply single best campaign (highest priority) if not stackable.
 * Returns discount amount.
 */
export function applyCampaign(
  price: number,
  campaigns: Campaign[],
  productId?: string,
  categoryId?: string
): { discount: number; campaign?: Campaign } {
  const now = new Date().toISOString();
  const active = campaigns.filter((c) => {
    if (c.status !== 'active') return false;
    if (c.startAt && c.startAt > now) return false;
    if (c.endAt && c.endAt < now) return false;
    if (c.appliesTo === 'CATEGORIES' && categoryId && c.categoryIds?.includes(categoryId)) return true;
    if (c.appliesTo === 'PRODUCTS' && productId && c.productIds?.includes(productId)) return true;
    if (c.appliesTo === 'ALL') return true;
    return false;
  });
  if (active.length === 0) return { discount: 0 };
  const best = active.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
  let discount = 0;
  if (best.type === 'PERCENT') discount = (price * best.value) / 100;
  else if (best.type === 'FIXED') discount = Math.min(best.value, price);
  return { discount, campaign: best };
}
