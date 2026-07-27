/**
 * Super Admin store profit report — read-only aggregation from order financial fields.
 * Separates app orders (commission + delivery) from external orders (delivery only).
 */

import { isOrderExternal } from '@nmd/core';
import { roundMoney } from './platform-fee.js';
import { isSettlementEligibleStatus } from './settlement.js';

export type StoreProfitDatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

export type StoreProfitOrderFinancials = {
  totalSales: number;
  platformCommission: number;
  deliveryFee: number;
  nowMarketRevenue: number;
};

export type StoreProfitSourceTotals = {
  appOrderCount: number;
  externalOrderCount: number;
  totalOrderCount: number;
  appDeliveryProfit: number;
  appCommissionProfit: number;
  appTotalPlatformProfit: number;
  externalDeliveryProfit: number;
  externalTotalPlatformProfit: number;
  totalDeliveryProfit: number;
  totalCommissionProfit: number;
  totalPlatformProfit: number;
};

export type StoreProfitRow = StoreProfitSourceTotals & {
  tenantId: string;
  storeName: string;
  marketId?: string;
  /** @deprecated Use totalPlatformProfit — kept for reconciliation with legacy consumers */
  nowMarketRevenue: number;
  /** @deprecated Use totalCommissionProfit */
  platformCommission: number;
  /** @deprecated Use totalDeliveryProfit */
  deliveryFee: number;
  /** @deprecated Use totalOrderCount */
  orderCount: number;
  /** @deprecated Informational merchant sales; not platform profit */
  totalSales: number;
};

export type StoreProfitBreakdownRow = StoreProfitSourceTotals & {
  periodKey: string;
  periodLabel: string;
  /** @deprecated */
  nowMarketRevenue: number;
  platformCommission: number;
  deliveryFee: number;
  orderCount: number;
  totalSales: number;
};

export type StoreProfitReport = {
  from: string;
  to: string;
  summary: StoreProfitSourceTotals;
  stores: StoreProfitRow[];
  /** @deprecated Use summary — legacy shape for backward compatibility */
  totals: {
    orderCount: number;
    totalSales: number;
    platformCommission: number;
    deliveryFee: number;
    nowMarketRevenue: number;
  };
};

function emptySourceTotals(): StoreProfitSourceTotals {
  return {
    appOrderCount: 0,
    externalOrderCount: 0,
    totalOrderCount: 0,
    appDeliveryProfit: 0,
    appCommissionProfit: 0,
    appTotalPlatformProfit: 0,
    externalDeliveryProfit: 0,
    externalTotalPlatformProfit: 0,
    totalDeliveryProfit: 0,
    totalCommissionProfit: 0,
    totalPlatformProfit: 0,
  };
}

export function parseStoreProfitDateRange(
  period?: string,
  from?: string,
  to?: string
): { from: string; to: string } {
  if (from && to) return { from, to };
  const today = new Date().toISOString().slice(0, 10);
  const p = String(period ?? 'week').toLowerCase();
  if (p === 'today') return { from: today, to: today };
  if (p === 'yesterday') {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const y = d.toISOString().slice(0, 10);
    return { from: y, to: y };
  }
  if (p === 'month') {
    const d = new Date();
    const fromMonth = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
    return { from: fromMonth, to: today };
  }
  if (p === 'week') {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return { from: d.toISOString().slice(0, 10), to: today };
  }
  return { from: today, to: today };
}

function safeNum(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0;
}

function isExternalOrder(order: Record<string, unknown>): boolean {
  return isOrderExternal(order as { isExternal?: boolean | null });
}

/** Extract store-level profit components from a single order (read-only, no mutation). */
export function extractOrderStoreProfit(order: Record<string, unknown>): StoreProfitOrderFinancials {
  const settlement = order.settlement as
    | {
        platformCommission?: number;
        deliveryFee?: number;
        customerGrandTotal?: number;
        customerSales?: number;
      }
    | undefined;

  let platformCommission = 0;
  let deliveryFee = 0;
  let totalSales = 0;

  if (settlement) {
    platformCommission = roundMoney(Math.max(0, safeNum(settlement.platformCommission)));
    deliveryFee = roundMoney(Math.max(0, safeNum(settlement.deliveryFee)));
    totalSales = roundMoney(
      Math.max(0, safeNum(settlement.customerGrandTotal) || safeNum(settlement.customerSales))
    );
  }

  const pay = order.payment as
    | {
        breakdown?: { platformFee?: number; deliveryFee?: number; customerTotal?: number };
        financials?: { platformFee?: number; commission?: number; customerTotal?: number; gross?: number };
      }
    | undefined;

  if (platformCommission <= 0) {
    platformCommission = roundMoney(
      Math.max(
        0,
        safeNum(pay?.financials?.platformFee) ||
          safeNum(pay?.breakdown?.platformFee) ||
          safeNum(order.platformFee) ||
          safeNum(pay?.financials?.commission)
      )
    );
  }

  if (deliveryFee <= 0) {
    deliveryFee = roundMoney(
      Math.max(
        0,
        safeNum(order.platformDeliveryFee) ||
          safeNum(pay?.breakdown?.deliveryFee) ||
          safeNum((order.delivery as { fee?: number } | undefined)?.fee)
      )
    );
  }

  if (totalSales <= 0) {
    totalSales = roundMoney(
      Math.max(
        0,
        safeNum(pay?.financials?.customerTotal) ||
          safeNum(pay?.financials?.gross) ||
          safeNum(order.customerTotal) ||
          safeNum(order.total)
      )
    );
  }

  const nowMarketRevenue = roundMoney(platformCommission + deliveryFee);
  return { totalSales, platformCommission, deliveryFee, nowMarketRevenue };
}

/** External orders: delivery profit only; commission is always zero. */
export function extractExternalOrderDeliveryProfit(order: Record<string, unknown>): number {
  const fin = extractOrderStoreProfit(order);
  if (fin.deliveryFee > 0) return fin.deliveryFee;
  return roundMoney(Math.max(0, safeNum(order.total)));
}

export type OrderProfitBySource = {
  isExternal: boolean;
  totalSales: number;
  appDeliveryProfit: number;
  appCommissionProfit: number;
  externalDeliveryProfit: number;
  /** Legacy combined revenue (app: commission+delivery; external: delivery only) */
  nowMarketRevenue: number;
  platformCommission: number;
  deliveryFee: number;
};

/** Split one eligible order into app vs external profit buckets. */
export function extractOrderProfitBySource(order: Record<string, unknown>): OrderProfitBySource {
  const fin = extractOrderStoreProfit(order);
  if (isExternalOrder(order)) {
    const externalDeliveryProfit = extractExternalOrderDeliveryProfit(order);
    return {
      isExternal: true,
      totalSales: fin.totalSales,
      appDeliveryProfit: 0,
      appCommissionProfit: 0,
      externalDeliveryProfit,
      nowMarketRevenue: externalDeliveryProfit,
      platformCommission: 0,
      deliveryFee: externalDeliveryProfit,
    };
  }
  return {
    isExternal: false,
    totalSales: fin.totalSales,
    appDeliveryProfit: fin.deliveryFee,
    appCommissionProfit: fin.platformCommission,
    externalDeliveryProfit: 0,
    nowMarketRevenue: fin.nowMarketRevenue,
    platformCommission: fin.platformCommission,
    deliveryFee: fin.deliveryFee,
  };
}

function addSourceTotals(
  acc: StoreProfitSourceTotals,
  profit: OrderProfitBySource
): StoreProfitSourceTotals {
  const appTotalPlatformProfit = roundMoney(profit.appDeliveryProfit + profit.appCommissionProfit);
  const externalTotalPlatformProfit = profit.externalDeliveryProfit;
  const appOrderCount = profit.isExternal ? 0 : 1;
  const externalOrderCount = profit.isExternal ? 1 : 0;

  return {
    appOrderCount: acc.appOrderCount + appOrderCount,
    externalOrderCount: acc.externalOrderCount + externalOrderCount,
    totalOrderCount: acc.totalOrderCount + 1,
    appDeliveryProfit: roundMoney(acc.appDeliveryProfit + profit.appDeliveryProfit),
    appCommissionProfit: roundMoney(acc.appCommissionProfit + profit.appCommissionProfit),
    appTotalPlatformProfit: roundMoney(acc.appTotalPlatformProfit + appTotalPlatformProfit),
    externalDeliveryProfit: roundMoney(acc.externalDeliveryProfit + profit.externalDeliveryProfit),
    externalTotalPlatformProfit: roundMoney(acc.externalTotalPlatformProfit + externalTotalPlatformProfit),
    totalDeliveryProfit: roundMoney(acc.totalDeliveryProfit + profit.appDeliveryProfit + profit.externalDeliveryProfit),
    totalCommissionProfit: roundMoney(acc.totalCommissionProfit + profit.appCommissionProfit),
    totalPlatformProfit: roundMoney(acc.totalPlatformProfit + appTotalPlatformProfit + externalTotalPlatformProfit),
  };
}

function mergeLegacyFields(
  source: StoreProfitSourceTotals,
  totalSales: number
): StoreProfitRow {
  return {
    ...source,
    totalSales: roundMoney(totalSales),
    platformCommission: source.totalCommissionProfit,
    deliveryFee: source.totalDeliveryProfit,
    nowMarketRevenue: source.totalPlatformProfit,
    orderCount: source.totalOrderCount,
  } as StoreProfitRow;
}

function orderInDateRange(createdAt: string | undefined, from: string, to: string): boolean {
  if (!createdAt) return false;
  const day = createdAt.slice(0, 10);
  return day >= from && day <= to;
}

function isCountableOrder(order: Record<string, unknown>): boolean {
  return isSettlementEligibleStatus(String(order.status ?? ''));
}

export function computeStoreProfitReport(input: {
  orders: Record<string, unknown>[];
  tenants: { id?: string; name?: string; marketId?: string }[];
  from: string;
  to: string;
  marketId?: string;
  tenantId?: string;
}): StoreProfitReport {
  const tenantNameById = new Map(
    input.tenants.map((t) => [String(t.id ?? ''), String(t.name ?? t.id ?? '—')])
  );
  const tenantMarketById = new Map(
    input.tenants.map((t) => [String(t.id ?? ''), t.marketId ? String(t.marketId) : undefined])
  );

  const byTenant = new Map<
    string,
    StoreProfitSourceTotals & { totalSales: number; tenantId: string; storeName: string; marketId?: string }
  >();

  for (const order of input.orders) {
    if (!isCountableOrder(order)) continue;
    const tenantId = String(order.tenantId ?? '');
    if (!tenantId) continue;
    if (input.tenantId && tenantId !== input.tenantId) continue;
    if (input.marketId && tenantMarketById.get(tenantId) !== input.marketId) continue;
    if (!orderInDateRange(String(order.createdAt ?? ''), input.from, input.to)) continue;

    const profit = extractOrderProfitBySource(order);
    const existing = byTenant.get(tenantId) ?? {
      ...emptySourceTotals(),
      tenantId,
      storeName: tenantNameById.get(tenantId) ?? tenantId,
      marketId: tenantMarketById.get(tenantId),
      totalSales: 0,
    };

    const nextSource = addSourceTotals(existing, profit);
    byTenant.set(tenantId, {
      ...existing,
      ...nextSource,
      totalSales: roundMoney(existing.totalSales + profit.totalSales),
    });
  }

  const stores: StoreProfitRow[] = [...byTenant.values()]
    .map((row) =>
      mergeLegacyFields(row, row.totalSales)
    )
    .sort((a, b) => b.totalPlatformProfit - a.totalPlatformProfit);

  const summary = stores.reduce((acc, row) => ({
    appOrderCount: acc.appOrderCount + row.appOrderCount,
    externalOrderCount: acc.externalOrderCount + row.externalOrderCount,
    totalOrderCount: acc.totalOrderCount + row.totalOrderCount,
    appDeliveryProfit: roundMoney(acc.appDeliveryProfit + row.appDeliveryProfit),
    appCommissionProfit: roundMoney(acc.appCommissionProfit + row.appCommissionProfit),
    appTotalPlatformProfit: roundMoney(acc.appTotalPlatformProfit + row.appTotalPlatformProfit),
    externalDeliveryProfit: roundMoney(acc.externalDeliveryProfit + row.externalDeliveryProfit),
    externalTotalPlatformProfit: roundMoney(acc.externalTotalPlatformProfit + row.externalTotalPlatformProfit),
    totalDeliveryProfit: roundMoney(acc.totalDeliveryProfit + row.totalDeliveryProfit),
    totalCommissionProfit: roundMoney(acc.totalCommissionProfit + row.totalCommissionProfit),
    totalPlatformProfit: roundMoney(acc.totalPlatformProfit + row.totalPlatformProfit),
  }), emptySourceTotals());

  const totalSales = roundMoney(stores.reduce((s, r) => s + r.totalSales, 0));

  const totals = {
    orderCount: summary.totalOrderCount,
    totalSales,
    platformCommission: summary.totalCommissionProfit,
    deliveryFee: summary.totalDeliveryProfit,
    nowMarketRevenue: summary.totalPlatformProfit,
  };

  return { from: input.from, to: input.to, summary, stores, totals };
}

function breakdownKey(createdAt: string, granularity: 'day' | 'week' | 'month'): string {
  const day = createdAt.slice(0, 10);
  if (granularity === 'day') return day;
  if (granularity === 'month') return day.slice(0, 7);
  const d = new Date(day);
  const dayOfWeek = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dayOfWeek);
  return d.toISOString().slice(0, 10);
}

function breakdownLabel(key: string, granularity: 'day' | 'week' | 'month'): string {
  if (granularity === 'day') return key;
  if (granularity === 'month') {
    const [y, m] = key.split('-');
    return `${m}/${y}`;
  }
  return `أسبوع ${key}`;
}

export function computeStoreProfitBreakdown(input: {
  orders: Record<string, unknown>[];
  tenantId: string;
  from: string;
  to: string;
  granularity: 'day' | 'week' | 'month';
}): StoreProfitBreakdownRow[] {
  const byKey = new Map<
    string,
    StoreProfitSourceTotals & { periodKey: string; periodLabel: string; totalSales: number }
  >();

  for (const order of input.orders) {
    if (!isCountableOrder(order)) continue;
    if (String(order.tenantId ?? '') !== input.tenantId) continue;
    const createdAt = String(order.createdAt ?? '');
    if (!orderInDateRange(createdAt, input.from, input.to)) continue;

    const key = breakdownKey(createdAt, input.granularity);
    const profit = extractOrderProfitBySource(order);
    const existing = byKey.get(key) ?? {
      ...emptySourceTotals(),
      periodKey: key,
      periodLabel: breakdownLabel(key, input.granularity),
      totalSales: 0,
    };

    const nextSource = addSourceTotals(existing, profit);
    byKey.set(key, {
      ...existing,
      ...nextSource,
      totalSales: roundMoney(existing.totalSales + profit.totalSales),
    });
  }

  return [...byKey.values()]
    .map((row) => ({
      ...row,
      orderCount: row.totalOrderCount,
      platformCommission: row.totalCommissionProfit,
      deliveryFee: row.totalDeliveryProfit,
      nowMarketRevenue: row.totalPlatformProfit,
    }))
    .sort((a, b) => b.periodKey.localeCompare(a.periodKey));
}

/** Verify row-level and summary reconciliation invariants. */
export function assertStoreProfitReconciliation(report: StoreProfitReport): string[] {
  const errors: string[] = [];

  for (const store of report.stores) {
    if (store.appTotalPlatformProfit !== roundMoney(store.appDeliveryProfit + store.appCommissionProfit)) {
      errors.push(`store ${store.tenantId}: app total mismatch`);
    }
    if (store.externalTotalPlatformProfit !== store.externalDeliveryProfit) {
      errors.push(`store ${store.tenantId}: external total mismatch`);
    }
    if (store.totalDeliveryProfit !== roundMoney(store.appDeliveryProfit + store.externalDeliveryProfit)) {
      errors.push(`store ${store.tenantId}: total delivery mismatch`);
    }
    if (store.totalCommissionProfit !== store.appCommissionProfit) {
      errors.push(`store ${store.tenantId}: total commission mismatch`);
    }
    if (store.totalPlatformProfit !== roundMoney(store.appTotalPlatformProfit + store.externalTotalPlatformProfit)) {
      errors.push(`store ${store.tenantId}: total platform profit mismatch`);
    }
    if (store.nowMarketRevenue !== store.totalPlatformProfit) {
      errors.push(`store ${store.tenantId}: legacy nowMarketRevenue mismatch`);
    }
  }

  const sumStores = report.stores.reduce(
    (acc, row) => ({
      appOrderCount: acc.appOrderCount + row.appOrderCount,
      externalOrderCount: acc.externalOrderCount + row.externalOrderCount,
      totalOrderCount: acc.totalOrderCount + row.totalOrderCount,
      appDeliveryProfit: roundMoney(acc.appDeliveryProfit + row.appDeliveryProfit),
      appCommissionProfit: roundMoney(acc.appCommissionProfit + row.appCommissionProfit),
      appTotalPlatformProfit: roundMoney(acc.appTotalPlatformProfit + row.appTotalPlatformProfit),
      externalDeliveryProfit: roundMoney(acc.externalDeliveryProfit + row.externalDeliveryProfit),
      externalTotalPlatformProfit: roundMoney(acc.externalTotalPlatformProfit + row.externalTotalPlatformProfit),
      totalDeliveryProfit: roundMoney(acc.totalDeliveryProfit + row.totalDeliveryProfit),
      totalCommissionProfit: roundMoney(acc.totalCommissionProfit + row.totalCommissionProfit),
      totalPlatformProfit: roundMoney(acc.totalPlatformProfit + row.totalPlatformProfit),
    }),
    emptySourceTotals()
  );

  if (sumStores.totalPlatformProfit !== report.summary.totalPlatformProfit) {
    errors.push('summary.totalPlatformProfit !== sum(stores)');
  }
  if (sumStores.totalOrderCount !== report.summary.totalOrderCount) {
    errors.push('summary.totalOrderCount !== sum(stores)');
  }
  if (report.totals.nowMarketRevenue !== report.summary.totalPlatformProfit) {
    errors.push('legacy totals.nowMarketRevenue !== summary.totalPlatformProfit');
  }

  return errors;
}

/** Compare new split totals against legacy single-bucket aggregation for app-only orders. */
export function computeLegacyStoreProfitReport(input: {
  orders: Record<string, unknown>[];
  tenants: { id?: string; name?: string; marketId?: string }[];
  from: string;
  to: string;
  marketId?: string;
  tenantId?: string;
}): number {
  let total = 0;
  const tenantMarketById = new Map(
    input.tenants.map((t) => [String(t.id ?? ''), t.marketId ? String(t.marketId) : undefined])
  );

  for (const order of input.orders) {
    if (!isCountableOrder(order)) continue;
    const tenantId = String(order.tenantId ?? '');
    if (!tenantId) continue;
    if (input.tenantId && tenantId !== input.tenantId) continue;
    if (input.marketId && tenantMarketById.get(tenantId) !== input.marketId) continue;
    if (!orderInDateRange(String(order.createdAt ?? ''), input.from, input.to)) continue;
    total = roundMoney(total + extractOrderStoreProfit(order).nowMarketRevenue);
  }
  return total;
}
