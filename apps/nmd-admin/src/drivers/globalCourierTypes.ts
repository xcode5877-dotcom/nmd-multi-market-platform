import type { MarketCourier, MarketCourierWithStats } from '@nmd/mock';

/** Courier row enriched with market context for global admin list. */
export type GlobalCourierRow = MarketCourier &
  Partial<MarketCourierWithStats> & {
    marketId: string;
    marketName: string;
  };

export type GlobalCourierFilters = {
  marketId: string;
  online: '' | 'online' | 'offline';
  active: '' | 'active' | 'inactive';
  available: '' | 'available' | 'busy';
  search: string;
};
