import type { CartItem, Product } from '@nmd/core';
import { customerUnitPrice, roundMoney } from '@nmd/core';

/** Refresh persisted cart lines when catalog displayPrice / platform fee changes. */
export function repriceCartItemsFromCatalog(
  items: CartItem[],
  products: Product[],
): CartItem[] {
  if (items.length === 0 || products.length === 0) return items;
  const byId = new Map(products.map((p) => [p.id, p]));
  let changed = false;
  const next = items.map((item) => {
    const product = byId.get(item.productId);
    if (!product) return item;
    const listPrice = customerUnitPrice(product);
    const markupDelta = listPrice - product.basePrice;
    const oldUnit = item.customerUnitPrice ?? item.basePrice;
    const newCustomerUnitPrice = roundMoney(oldUnit + markupDelta);
    if (Math.abs(newCustomerUnitPrice - oldUnit) < 0.001) return item;
    changed = true;
    const newTotalPrice =
      oldUnit > 0
        ? roundMoney(item.totalPrice * (newCustomerUnitPrice / oldUnit))
        : roundMoney(newCustomerUnitPrice * item.quantity);
    return {
      ...item,
      customerUnitPrice: newCustomerUnitPrice,
      totalPrice: newTotalPrice,
    };
  });
  return changed ? next : items;
}
