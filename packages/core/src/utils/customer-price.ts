import type { Product } from '../types/product';

/** Customer-visible unit price (marketplace repriced when server sets displayPrice). */
export function customerUnitPrice(
  product: Pick<Product, 'basePrice' | 'displayPrice'> & { priceOverride?: number },
  variantPriceOverride?: number
): number {
  const base = variantPriceOverride ?? product.displayPrice ?? product.basePrice;
  return Number.isFinite(base) ? base : 0;
}

/** Strikethrough / compare price for offers when repriced. */
export function customerComparePrice(
  product: Pick<Product, 'basePrice' | 'displayPrice' | 'displayComparePrice'>
): number | undefined {
  if (product.displayComparePrice != null && Number.isFinite(product.displayComparePrice)) {
    return product.displayComparePrice;
  }
  return undefined;
}
