import type { CartItem, Campaign, OptionItem } from '@nmd/core';
import { applyCampaign, customerUnitPrice, roundMoney } from '@nmd/core';

export interface PricedCartItem {
  item: CartItem;
  /** Merchant unit base (unchanged). */
  basePrice: number;
  optionDelta: number;
  /** Merchant line before campaign. */
  merchantPriceBeforeDiscount: number;
  /** Customer-visible line before campaign (repriced when server set customerUnitPrice). */
  customerPriceBeforeDiscount: number;
  priceBeforeDiscount: number;
  campaignDiscount: number;
  /** Customer-visible unit after campaign. */
  finalPrice: number;
  /** Merchant unit after campaign (for order payload). */
  merchantFinalPrice: number;
  campaign?: Campaign;
}

function readOptionDelta(opt: OptionItem, useCustomer: boolean): number {
  if (useCustomer) {
    const display = (opt as OptionItem & { displayPriceDelta?: number }).displayPriceDelta;
    if (display != null && Number.isFinite(display)) return display;
  }
  return opt.priceDelta ?? opt.priceModifier ?? 0;
}

function getSelectedOptionItems(item: CartItem, useCustomer: boolean): Array<{ option: OptionItem; multiplier: number; delta: number }> {
  const result: Array<{ option: OptionItem; multiplier: number; delta: number }> = [];
  for (const sel of item.selectedOptions) {
    const ids = 'optionItemIds' in sel ? sel.optionItemIds : [];
    const placements = 'optionPlacements' in sel ? (sel.optionPlacements ?? {}) : {};
    const group = item.optionGroups.find((g) => g.id === sel.optionGroupId);
    if (!group) continue;
    for (const id of ids) {
      const opt = group.items.find((i) => i.id === id);
      if (!opt) continue;
      const p = placements[id];
      const multiplier = p === 'LEFT' || p === 'RIGHT' ? 0.5 : 1;
      result.push({ option: opt, multiplier, delta: readOptionDelta(opt, useCustomer) });
    }
  }
  return result;
}

function optionDeltaFromSelection(item: CartItem, useCustomer: boolean): number {
  return getSelectedOptionItems(item, useCustomer).reduce(
    (sum, i) => sum + i.delta * i.multiplier,
    0
  );
}

/** Compute priced line — campaigns apply to customer-visible amounts; merchant amounts kept for orders. */
export function priceCartItem(item: CartItem, campaigns: Campaign[]): PricedCartItem {
  const merchantOptionDelta = optionDeltaFromSelection(item, false);
  const customerOptionDelta = optionDeltaFromSelection(item, true);
  const merchantBase = item.basePrice;
  const customerBase = item.customerUnitPrice ?? item.basePrice;
  const merchantPriceBeforeDiscount = merchantBase + merchantOptionDelta;
  const customerPriceBeforeDiscount = customerBase + customerOptionDelta;

  const merchantCampaign = applyCampaign(
    merchantPriceBeforeDiscount,
    campaigns,
    item.productId,
    item.categoryId
  );
  const customerCampaign = applyCampaign(
    customerPriceBeforeDiscount,
    campaigns,
    item.productId,
    item.categoryId
  );

  const merchantFinalPrice = Math.max(0, merchantPriceBeforeDiscount - merchantCampaign.discount);
  const finalPrice = Math.max(0, customerPriceBeforeDiscount - customerCampaign.discount);

  return {
    item,
    basePrice: merchantBase,
    optionDelta: customerOptionDelta,
    merchantPriceBeforeDiscount,
    customerPriceBeforeDiscount,
    priceBeforeDiscount: customerPriceBeforeDiscount,
    campaignDiscount: customerCampaign.discount,
    finalPrice,
    merchantFinalPrice,
    campaign: customerCampaign.campaign,
  };
}

export function priceCart(
  items: CartItem[],
  campaigns: Campaign[]
): {
  priced: PricedCartItem[];
  subtotal: number;
  discountTotal: number;
  total: number;
  merchantSubtotal: number;
  merchantTotal: number;
} {
  const priced = items.map((i) => priceCartItem(i, campaigns));
  const subtotal = roundMoney(
    priced.reduce((s, p) => s + p.customerPriceBeforeDiscount * p.item.quantity, 0)
  );
  const discountTotal = roundMoney(
    priced.reduce((s, p) => s + p.campaignDiscount * p.item.quantity, 0)
  );
  const total = roundMoney(priced.reduce((s, p) => s + p.finalPrice * p.item.quantity, 0));
  const merchantSubtotal = roundMoney(
    priced.reduce((s, p) => s + p.merchantPriceBeforeDiscount * p.item.quantity, 0)
  );
  const merchantTotal = roundMoney(
    priced.reduce((s, p) => s + p.merchantFinalPrice * p.item.quantity, 0)
  );
  return { priced, subtotal, discountTotal, total, merchantSubtotal, merchantTotal };
}

/** Customer-visible unit price for catalog product cards. */
export function catalogCustomerPrice(product: Parameters<typeof customerUnitPrice>[0]): number {
  return customerUnitPrice(product);
}
