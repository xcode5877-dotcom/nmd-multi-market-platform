/**
 * Local (in-memory) parity with apps/mock-api/src/merchant-stats.ts for MockApiClient when useApi is false.
 */

export type MerchantTimeRange = 'day' | 'week' | 'month';

export type MerchantStatsPayload = {
  timeRange: MerchantTimeRange;
  start: string;
  end: string;
  totalSales: number;
  cashSales: number;
  onlineSales: number;
  orderCount: number;
  cashOrderCount: number;
  onlineOrderCount: number;
};

export function isRevenueOrderStatus(status: unknown): boolean {
  const s = String(status ?? '').toUpperCase();
  return s === 'COMPLETED' || s === 'DELIVERED' || s === 'PAID';
}

export function orderPaymentChannel(o: Record<string, unknown>): 'CASH' | 'CARD' {
  const pay = o.payment as { method?: string } | undefined;
  const raw = String(pay?.method ?? o.paymentMethod ?? 'CASH')
    .toUpperCase()
    .trim();
  if (
    raw === 'CARD' ||
    raw === 'CREDIT_CARD' ||
    raw === 'CREDIT' ||
    raw === 'ONLINE' ||
    raw === 'VISA' ||
    raw === 'DEBIT_CARD'
  ) {
    return 'CARD';
  }
  return 'CASH';
}

export function dateRangeForMerchant(timeRange: MerchantTimeRange, now = new Date()): { start: Date; end: Date } {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  let start: Date;
  if (timeRange === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  } else if (timeRange === 'week') {
    const d = new Date(now);
    const day = d.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + mondayOffset);
    start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }
  return { start, end };
}

export function aggregateMerchantStats(
  orders: Record<string, unknown>[],
  timeRange: MerchantTimeRange,
  now = new Date()
): MerchantStatsPayload {
  const { start, end } = dateRangeForMerchant(timeRange, now);
  const startMs = start.getTime();
  const endMs = end.getTime();

  let totalSales = 0;
  let cashSales = 0;
  let onlineSales = 0;
  let orderCount = 0;
  let cashOrderCount = 0;
  let onlineOrderCount = 0;

  for (const o of orders) {
    if (!isRevenueOrderStatus(o.status)) continue;
    const created = o.createdAt != null ? new Date(String(o.createdAt)).getTime() : NaN;
    if (!Number.isFinite(created) || created < startMs || created > endMs) continue;

    const total = Number(o.total);
    const amt = Number.isFinite(total) ? total : 0;
    const ch = orderPaymentChannel(o);

    orderCount += 1;
    totalSales += amt;
    if (ch === 'CARD') {
      onlineSales += amt;
      onlineOrderCount += 1;
    } else {
      cashSales += amt;
      cashOrderCount += 1;
    }
  }

  return {
    timeRange,
    start: start.toISOString(),
    end: end.toISOString(),
    totalSales: Math.round(totalSales * 100) / 100,
    cashSales: Math.round(cashSales * 100) / 100,
    onlineSales: Math.round(onlineSales * 100) / 100,
    orderCount,
    cashOrderCount,
    onlineOrderCount,
  };
}
