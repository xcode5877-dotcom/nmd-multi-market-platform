import type { CartItem, Campaign, OptionItem } from '@nmd/core';
import { applyCampaign } from '@nmd/core';

export interface PricedCartItem {
  item: CartItem;
  basePrice: number;
  optionDelta: number;
  priceBeforeDiscount: number;
  campaignDiscount: number;
  finalPrice: number;
  campaign?: Campaign;
}

/** Get all selected option items from cart item. */
function getSelectedOptionItems(item: CartItem): OptionItem[] {
  const result: OptionItem[] = [];
  for (const sel of item.selectedOptions) {
    const ids = 'optionItemIds' in sel ? sel.optionItemIds : [];
    const group = item.optionGroups.find((g) => g.id === sel.optionGroupId);
    if (!group) continue;
    for (const id of ids) {
      const opt = group.items.find((i) => i.id === id);
      if (opt) result.push(opt);
    }
  }
  return result;
}

/** Compute priced line for a cart item (single best campaign, not stackable). */
export function priceCartItem(item: CartItem, campaigns: Campaign[]): PricedCartItem {
  const optionItems = getSelectedOptionItems(item);
  const basePrice = item.basePrice;
  const optionDelta = optionItems.reduce(
    (sum, i) => sum + (i.priceDelta ?? i.priceModifier ?? 0),
    0
  );
  const priceBeforeDiscount = basePrice + optionDelta;
  const { discount, campaign } = applyCampaign(
    priceBeforeDiscount,
    campaigns,
    item.productId,
    item.categoryId
  );
  const finalPrice = Math.max(0, priceBeforeDiscount - discount);
  return {
    item,
    basePrice,
    optionDelta,
    priceBeforeDiscount,
    campaignDiscount: discount,
    finalPrice,
    campaign,
  };
}

/** Compute total for cart items with campaigns. */
export function priceCart(
  items: CartItem[],
  campaigns: Campaign[]
): { priced: PricedCartItem[]; subtotal: number; discountTotal: number; total: number } {
  const priced = items.map((i) => priceCartItem(i, campaigns));
  const subtotal = priced.reduce((s, p) => s + p.priceBeforeDiscount * p.item.quantity, 0);
  const discountTotal = priced.reduce((s, p) => s + p.campaignDiscount * p.item.quantity, 0);
  const total = priced.reduce((s, p) => s + p.finalPrice * p.item.quantity, 0);
  return { priced, subtotal, discountTotal, total };
}
