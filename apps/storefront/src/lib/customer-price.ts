import { customerUnitPrice } from '@nmd/core';
import type { Product } from '@nmd/core';

/** Customer-facing list price from server displayPrice or merchant basePrice. */
export function getCustomerListPrice(product: Pick<Product, 'basePrice' | 'displayPrice'>): number {
  return customerUnitPrice(product);
}

export function getCustomerStrikethroughPrice(
  product: Pick<Product, 'basePrice' | 'displayPrice' | 'displayComparePrice'>,
  campaignDiscount: number,
  finalPrice: number
): number | null {
  if (product.displayComparePrice != null && product.displayComparePrice > finalPrice) {
    return product.displayComparePrice;
  }
  if (campaignDiscount > 0) {
    return getCustomerListPrice(product);
  }
  return null;
}
