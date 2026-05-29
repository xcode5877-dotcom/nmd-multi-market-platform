import { MockApiClient } from '@nmd/mock';
import type { MarketCourier } from '@nmd/mock';
import { apiHeaders, listAdminExternalOrders } from '../api';
import type { DriverOpsMarketRow, DriverOpsOverview } from './types';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

interface MarketListItem {
  id: string;
  name: string;
  slug?: string;
  isActive?: boolean;
}

type OrderSlice = {
  id?: string;
  fulfillmentType?: string;
  status?: string;
  courierId?: string;
  deliveredAt?: string;
  deliveryTimeline?: { deliveredAt?: string };
};

function todayStartIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function isActiveDeliveryOrder(o: OrderSlice): boolean {
  if (!o.courierId) return false;
  const s = o.status ?? '';
  return !['COMPLETED', 'CANCELED', 'CANCELLED', 'DELIVERED'].includes(s);
}

function isDeliveredToday(o: OrderSlice, todayStart: string): boolean {
  const at = o.deliveredAt ?? o.deliveryTimeline?.deliveredAt;
  return !!at && at >= todayStart;
}

function countCouriers(couriers: MarketCourier[]) {
  const active = couriers.filter((c) => c.isActive !== false);
  const online = active.filter((c) => c.isOnline);
  const offline = active.filter((c) => !c.isOnline);
  const available = active.filter((c) => c.isOnline && c.isAvailable !== false);
  return {
    total: couriers.length,
    active: active.length,
    online: online.length,
    offline: offline.length,
    available: available.length,
  };
}

async function fetchMarkets(): Promise<MarketListItem[]> {
  if (!MOCK_API_URL) return [];
  const res = await fetch(`${MOCK_API_URL}/markets?all=true`, { headers: apiHeaders() });
  if (!res.ok) throw new Error(`Markets: ${res.status}`);
  const raw = await res.json();
  return Array.isArray(raw) ? raw : [];
}

/**
 * Aggregates existing per-market courier/order APIs into a global read-only snapshot.
 * No new backend endpoints.
 */
export async function fetchDriverOpsOverview(api: MockApiClient): Promise<DriverOpsOverview> {
  const todayStart = todayStartIso();
  const [markets, externalOrders] = await Promise.all([
    fetchMarkets(),
    listAdminExternalOrders().catch(() => []),
  ]);

  const externalToday = externalOrders.filter((o) => (o.createdAt ?? '') >= todayStart);

  const marketRows: DriverOpsMarketRow[] = await Promise.all(
    markets.map(async (market) => {
      const [couriers, orders, queue] = await Promise.all([
        api.getMarketCouriers(market.id).catch(() => [] as MarketCourier[]),
        api.getMarketOrders(market.id).catch(() => [] as OrderSlice[]),
        api.getDispatchQueue(market.id).catch(() => [] as { id?: string }[]),
      ]);

      const deliveryOrders = (orders as OrderSlice[]).filter(
        (o) => o.fulfillmentType === 'DELIVERY' && o.status !== 'CANCELED' && o.status !== 'CANCELLED'
      );
      const courierCounts = countCouriers(couriers);

      return {
        marketId: market.id,
        marketName: market.name,
        marketSlug: market.slug,
        isActive: market.isActive !== false,
        totalCouriers: courierCounts.total,
        activeCouriers: courierCounts.active,
        onlineCouriers: courierCounts.online,
        offlineCouriers: courierCounts.offline,
        availableCouriers: courierCounts.available,
        queueCount: Array.isArray(queue) ? queue.length : 0,
        activeDeliveries: deliveryOrders.filter(isActiveDeliveryOrder).length,
        deliveriesToday: deliveryOrders.filter((o) => isDeliveredToday(o, todayStart)).length,
      };
    })
  );

  const totals = marketRows.reduce(
    (acc, row) => ({
      markets: acc.markets + 1,
      couriers: acc.couriers + row.totalCouriers,
      activeCouriers: acc.activeCouriers + row.activeCouriers,
      onlineCouriers: acc.onlineCouriers + row.onlineCouriers,
      offlineCouriers: acc.offlineCouriers + row.offlineCouriers,
      availableCouriers: acc.availableCouriers + row.availableCouriers,
      activeDeliveries: acc.activeDeliveries + row.activeDeliveries,
      queueCount: acc.queueCount + row.queueCount,
      deliveriesToday: acc.deliveriesToday + row.deliveriesToday,
      externalOrdersTotal: externalOrders.length,
      externalOrdersToday: externalToday.length,
    }),
    {
      markets: 0,
      couriers: 0,
      activeCouriers: 0,
      onlineCouriers: 0,
      offlineCouriers: 0,
      availableCouriers: 0,
      activeDeliveries: 0,
      queueCount: 0,
      deliveriesToday: 0,
      externalOrdersTotal: externalOrders.length,
      externalOrdersToday: externalToday.length,
    }
  );

  return {
    markets: marketRows.sort((a, b) => a.marketName.localeCompare(b.marketName, 'ar')),
    totals,
    fetchedAt: new Date().toISOString(),
  };
}

/** Finance rollup per market (existing finance APIs). */
export async function fetchDriverOpsFinanceRollup(
  api: MockApiClient,
  from?: string,
  to?: string
): Promise<import('./types').DriverOpsMarketFinanceRow[]> {
  const markets = await fetchMarkets();
  const rows = await Promise.all(
    markets.map(async (market) => {
      const [summary, couriers] = await Promise.all([
        api.getMarketFinanceSummary(market.id, from, to).catch(() => null),
        api.getMarketFinanceCouriers(market.id, from, to).catch(() => []),
      ]);
      return {
        marketId: market.id,
        marketName: market.name,
        gross: summary?.gross ?? 0,
        cashCollected: summary?.cashCollected ?? 0,
        outstandingCash: summary?.outstandingCash ?? 0,
        deliveredOrders: summary?.deliveredOrders ?? 0,
        courierRows: Array.isArray(couriers) ? couriers.length : 0,
      };
    })
  );
  return rows.sort((a, b) => a.marketName.localeCompare(b.marketName, 'ar'));
}

/** Reports rollup per market (existing reports APIs). */
export async function fetchDriverOpsReportsRollup(
  api: MockApiClient,
  from?: string,
  to?: string
): Promise<import('./types').DriverOpsMarketReportRow[]> {
  const markets = await fetchMarkets();
  const rows = await Promise.all(
    markets.map(async (market) => {
      const [leaderboard, settlements] = await Promise.all([
        api.getReportsDriverLeaderboard(market.id, from, to).catch(() => []),
        api.getReportsSettlementLog(market.id).catch(() => []),
      ]);
      const top = Array.isArray(leaderboard) && leaderboard.length > 0 ? leaderboard[0] : null;
      return {
        marketId: market.id,
        marketName: market.name,
        topDriverName: top?.courierName ?? null,
        topDriverDeliveries: top?.deliveryCount ?? 0,
        settlementEntries: Array.isArray(settlements) ? settlements.length : 0,
      };
    })
  );
  return rows.sort((a, b) => a.marketName.localeCompare(b.marketName, 'ar'));
}
