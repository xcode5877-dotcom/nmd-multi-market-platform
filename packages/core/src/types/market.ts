/**
 * Market layout section for storefront home (admin-configured).
 * SLIDER = horizontal strip; MARKET_GROUP = "order together" group.
 */
export type MarketSectionType = 'SLIDER' | 'MARKET_GROUP';

export interface MarketSection {
  id: string;
  title: string;
  type: MarketSectionType;
  /** Tenant IDs or slugs. Order preserved. */
  storeIds: string[];
  /** Display order (lower = first). Optional for backward compatibility. */
  sortOrder?: number;
}
