import { MockApiClient } from '@nmd/mock';
import { apiHeaders } from '../api';
import type { GlobalCourierRow } from './globalCourierTypes';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

export interface MarketOption {
  id: string;
  name: string;
  slug?: string;
}

export async function fetchMarketOptions(): Promise<MarketOption[]> {
  if (!MOCK_API_URL) return [];
  const res = await fetch(`${MOCK_API_URL}/markets?all=true`, { headers: apiHeaders() });
  if (!res.ok) throw new Error(`Markets: ${res.status}`);
  const raw = await res.json();
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((m: { id: string; name: string; slug?: string }) => ({ id: m.id, name: m.name, slug: m.slug }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

/**
 * Loads all MARKET-scoped couriers by calling existing per-market APIs.
 */
export async function fetchAllMarketCouriers(
  api: MockApiClient,
  options?: { withStats?: boolean }
): Promise<GlobalCourierRow[]> {
  const markets = await fetchMarketOptions();
  const withStats = options?.withStats ?? false;

  const perMarket = await Promise.all(
    markets.map(async (market) => {
      const [couriers, stats] = await Promise.all([
        api.getMarketCouriers(market.id).catch(() => []),
        withStats ? api.getMarketCourierStats(market.id).catch(() => []) : Promise.resolve([]),
      ]);
      const statsById = new Map(stats.map((s) => [s.id, s]));
      return couriers.map((c) => {
        const extra = statsById.get(c.id);
        return {
          ...c,
          ...extra,
          marketId: market.id,
          marketName: market.name,
        } satisfies GlobalCourierRow;
      });
    })
  );

  return perMarket.flat().sort((a, b) => {
    const mc = a.marketName.localeCompare(b.marketName, 'ar');
    if (mc !== 0) return mc;
    return a.name.localeCompare(b.name, 'ar');
  });
}

export function filterGlobalCouriers(rows: GlobalCourierRow[], filters: import('./globalCourierTypes').GlobalCourierFilters): GlobalCourierRow[] {
  const q = filters.search.trim().toLowerCase();
  return rows.filter((c) => {
    if (filters.marketId && c.marketId !== filters.marketId) return false;
    if (filters.online === 'online' && !c.isOnline) return false;
    if (filters.online === 'offline' && c.isOnline) return false;
    if (filters.active === 'active' && !c.isActive) return false;
    if (filters.active === 'inactive' && c.isActive) return false;
    if (filters.available === 'available' && c.isAvailable === false) return false;
    if (filters.available === 'busy' && c.isAvailable !== false) return false;
    if (q) {
      const hay = [c.name, c.phone ?? '', c.email ?? '', c.id].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
