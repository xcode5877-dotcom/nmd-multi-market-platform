import type { CartItem, Campaign, OptionItem } from '@nmd/core';
import { applyCampaign, customerUnitPrice, roundMoney } from '@nmd/core';
import { isWeightBasedLine, storefrontLineTotal } from './measurement-line-total';

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
  /**
   * Customer-visible **line** total after campaign (agora/milli).
   * For PIECE this equals unit×qty; for WEIGHT it is product×qty + fixed modifiers.
   */
  finalPrice: number;
  /** Merchant **line** total after campaign. */
  merchantFinalPrice: number;
  /** Customer-visible unit after campaign (product unit for WEIGHT; full unit for PIECE). */
  finalUnitPrice: number;
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
  const weight = isWeightBasedLine(item);

  if (weight) {
    // WEIGHT/VOLUME: customerUnitPrice is product-only; options are fixed per line.
    const merchantCampaign = applyCampaign(merchantBase, campaigns, item.productId, item.categoryId);
    const customerCampaign = applyCampaign(customerBase, campaigns, item.productId, item.categoryId);
    const merchantUnit = Math.max(0, merchantBase - merchantCampaign.discount);
    const customerUnit = Math.max(0, customerBase - customerCampaign.discount);
    const merchantLineBefore = storefrontLineTotal({
      unitPrice: merchantBase,
      quantity: item.quantity,
      isWeightBased: true,
      fixedModifier: merchantOptionDelta,
    });
    const customerLineBefore = storefrontLineTotal({
      unitPrice: customerBase,
      quantity: item.quantity,
      isWeightBased: true,
      fixedModifier: customerOptionDelta,
    });
    const merchantFinalPrice = storefrontLineTotal({
      unitPrice: merchantUnit,
      quantity: item.quantity,
      isWeightBased: true,
      fixedModifier: merchantOptionDelta,
    });
    const finalPrice = storefrontLineTotal({
      unitPrice: customerUnit,
      quantity: item.quantity,
      isWeightBased: true,
      fixedModifier: customerOptionDelta,
    });
    return {
      item,
      basePrice: merchantBase,
      optionDelta: customerOptionDelta,
      merchantPriceBeforeDiscount: merchantLineBefore,
      customerPriceBeforeDiscount: customerLineBefore,
      priceBeforeDiscount: customerLineBefore,
      campaignDiscount: roundMoney(customerLineBefore - finalPrice),
      finalPrice,
      merchantFinalPrice,
      finalUnitPrice: customerUnit,
      campaign: customerCampaign.campaign,
    };
  }

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

  const merchantFinalUnit = Math.max(0, merchantPriceBeforeDiscount - merchantCampaign.discount);
  const finalUnit = Math.max(0, customerPriceBeforeDiscount - customerCampaign.discount);
  const merchantFinalPrice = storefrontLineTotal({
    unitPrice: merchantFinalUnit,
    quantity: item.quantity,
    isWeightBased: false,
  });
  const finalPrice = storefrontLineTotal({
    unitPrice: finalUnit,
    quantity: item.quantity,
    isWeightBased: false,
  });
  const merchantLineBefore = storefrontLineTotal({
    unitPrice: merchantPriceBeforeDiscount,
    quantity: item.quantity,
    isWeightBased: false,
  });
  const customerLineBefore = storefrontLineTotal({
    unitPrice: customerPriceBeforeDiscount,
    quantity: item.quantity,
    isWeightBased: false,
  });

  return {
    item,
    basePrice: merchantBase,
    optionDelta: customerOptionDelta,
    merchantPriceBeforeDiscount: merchantLineBefore,
    customerPriceBeforeDiscount: customerLineBefore,
    priceBeforeDiscount: customerLineBefore,
    campaignDiscount: roundMoney(customerLineBefore - finalPrice),
    finalPrice,
    merchantFinalPrice,
    finalUnitPrice: finalUnit,
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
  const subtotal = roundMoney(priced.reduce((s, p) => s + p.customerPriceBeforeDiscount, 0));
  const discountTotal = roundMoney(priced.reduce((s, p) => s + p.campaignDiscount, 0));
  const total = roundMoney(priced.reduce((s, p) => s + p.finalPrice, 0));
  const merchantSubtotal = roundMoney(priced.reduce((s, p) => s + p.merchantPriceBeforeDiscount, 0));
  const merchantTotal = roundMoney(priced.reduce((s, p) => s + p.merchantFinalPrice, 0));
  return { priced, subtotal, discountTotal, total, merchantSubtotal, merchantTotal };
}

/** Customer-visible unit price for catalog product cards. */
export function catalogCustomerPrice(product: Parameters<typeof customerUnitPrice>[0]): number {
  return customerUnitPrice(product);
}
