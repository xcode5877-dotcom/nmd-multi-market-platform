/**
 * Financial Reports V1 — Super Admin finance intelligence (read-only).
 *
 * Reuses store-profit-report extractors and Driver Collections V3 accounting.
 * Does not mutate orders, settlements, checkout, or pricing.
 *
 * FINANCIAL CONTRACT (audit):
 * - Business timezone: Asia/Jerusalem (store hours SSOT); report day keys use this TZ.
 * - Completed revenue statuses: COMPLETED | DELIVERED (isSettlementEligibleStatus).
 * - grossOrderValue = extractOrderStoreProfit.totalSales (customer GMV, not platform revenue).
 * - platformRevenue = app: deliveryFee+platformCommission; external: deliveryFee only.
 * - restaurantPayable = driverRestaurantLiabilityAmount (COD cash residual with drivers).
 * - Refunds: no order.refundAmount field — REFUNDED/CANCELLED excluded from completed revenue;
 *   refundedGross is informational sum of GMV for REFUNDED statuses in range.
 * - Delivery area: order.delivery.zoneName || externalDestination || 'غير محدد'
 *   (no order.deliveryTown; customer defaultDeliveryTown is NOT used).
 * - Aggregation: in-memory over repos.orders.findAll() (payload JSON) — same as store-profit V1.
 */

import { isOrderExternal } from '@nmd/core';
import { roundMoney } from './platform-fee.js';
import { isSettlementEligibleStatus } from './settlement.js';
import {
  extractOrderProfitBySource,
  extractOrderStoreProfit,
} from './store-profit-report.js';
import {
  aggregateDriverCollections,
  computeCollectionsDashboard,
  computeDriverOrderAccounting,
  enrichOrderWithDriverCollection,
  isDriverCollectionCountable,
  normalizePaymentMethod,
  type NormalizedPaymentMethod,
} from './driver-collections.js';

export const BUSINESS_TIMEZONE = 'Asia/Jerusalem';

export type FinancialReportPreset =
  | 'TODAY'
  | 'YESTERDAY'
  | 'CURRENT_WEEK'
  | 'PREVIOUS_WEEK'
  | 'CURRENT_MONTH'
  | 'PREVIOUS_MONTH'
  | 'LAST_7_DAYS'
  | 'LAST_30_DAYS'
  | 'CUSTOM_RANGE';

export type FinancialReportFilters = {
  from: string;
  to: string;
  preset: FinancialReportPreset;
  timezone: string;
  shopId?: string;
  courierId?: string;
  deliveryAreaId?: string;
  paymentMethod?: string;
  orderSource?: 'APP' | 'EXTERNAL' | 'ALL';
  settlementStatus?: 'PENDING' | 'SETTLED' | 'ALL';
};

export type MetricSnapshot = {
  orderCount: number;
  completedOrderCount: number;
  cancelledOrderCount: number;
  refundedOrderCount: number;
  grossOrderValue: number;
  platformRevenue: number;
  deliveryFeeRevenue: number;
  platformCommissionRevenue: number;
  appDeliveryFeeRevenue: number;
  externalDeliveryFeeRevenue: number;
  restaurantPayable: number;
  driverCashInHand: number;
  driverPlatformLiability: number;
  driverRestaurantLiability: number;
  driverSettledAmount: number;
  driverOutstandingAmount: number;
  refundedGross: number;
};

export type MetricComparison = {
  metric: keyof MetricSnapshot;
  absoluteChange: number;
  percentageChange: number | null;
  trend: 'up' | 'down' | 'flat';
};

function safeNum(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0;
}

export function formatBusinessDay(date: Date, timezone = BUSINESS_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function orderBusinessDay(
  order: Record<string, unknown>,
  timezone = BUSINESS_TIMEZONE
): string {
  const raw = String(order.deliveredAt || order.createdAt || '');
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
  return formatBusinessDay(d, timezone);
}

function addDays(isoDay: string, delta: number, timezone = BUSINESS_TIMEZONE): string {
  const [y, m, d] = isoDay.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  utc.setUTCDate(utc.getUTCDate() + delta);
  return formatBusinessDay(utc, timezone);
}

function startOfWeekMonday(isoDay: string, timezone = BUSINESS_TIMEZONE): string {
  const [y, m, d] = isoDay.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(utc);
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const offset = map[wd] ?? 0;
  return addDays(isoDay, -offset, timezone);
}

function startOfMonth(isoDay: string): string {
  return `${isoDay.slice(0, 7)}-01`;
}

export function parseFinancialReportRange(
  presetRaw?: string,
  fromQ?: string,
  toQ?: string,
  timezone = BUSINESS_TIMEZONE
): { from: string; to: string; preset: FinancialReportPreset } {
  const today = formatBusinessDay(new Date(), timezone);
  const preset = String(presetRaw || 'LAST_7_DAYS').toUpperCase() as FinancialReportPreset;

  if (preset === 'CUSTOM_RANGE' || (fromQ && toQ)) {
    return {
      from: fromQ || today,
      to: toQ || today,
      preset: fromQ && toQ ? 'CUSTOM_RANGE' : preset,
    };
  }
  if (preset === 'TODAY') return { from: today, to: today, preset };
  if (preset === 'YESTERDAY') {
    const y = addDays(today, -1, timezone);
    return { from: y, to: y, preset };
  }
  if (preset === 'LAST_7_DAYS') {
    return { from: addDays(today, -6, timezone), to: today, preset };
  }
  if (preset === 'LAST_30_DAYS') {
    return { from: addDays(today, -29, timezone), to: today, preset };
  }
  if (preset === 'CURRENT_WEEK') {
    return { from: startOfWeekMonday(today, timezone), to: today, preset };
  }
  if (preset === 'PREVIOUS_WEEK') {
    const thisMon = startOfWeekMonday(today, timezone);
    const prevSun = addDays(thisMon, -1, timezone);
    const prevMon = addDays(thisMon, -7, timezone);
    return { from: prevMon, to: prevSun, preset };
  }
  if (preset === 'CURRENT_MONTH') {
    return { from: startOfMonth(today), to: today, preset };
  }
  if (preset === 'PREVIOUS_MONTH') {
    const thisMonthStart = startOfMonth(today);
    const prevMonthEnd = addDays(thisMonthStart, -1, timezone);
    const prevMonthStart = startOfMonth(prevMonthEnd);
    return { from: prevMonthStart, to: prevMonthEnd, preset };
  }
  return { from: addDays(today, -6, timezone), to: today, preset: 'LAST_7_DAYS' };
}

/** Matching previous period of equal length immediately before `from`. */
export function previousPeriod(
  from: string,
  to: string,
  timezone = BUSINESS_TIMEZONE
): { from: string; to: string } {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const start = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  const days = Math.max(0, Math.round((end - start) / 86400000));
  const prevTo = addDays(from, -1, timezone);
  const prevFrom = addDays(prevTo, -days, timezone);
  return { from: prevFrom, to: prevTo };
}

export function emptyMetricSnapshot(): MetricSnapshot {
  return {
    orderCount: 0,
    completedOrderCount: 0,
    cancelledOrderCount: 0,
    refundedOrderCount: 0,
    grossOrderValue: 0,
    platformRevenue: 0,
    deliveryFeeRevenue: 0,
    platformCommissionRevenue: 0,
    appDeliveryFeeRevenue: 0,
    externalDeliveryFeeRevenue: 0,
    restaurantPayable: 0,
    driverCashInHand: 0,
    driverPlatformLiability: 0,
    driverRestaurantLiability: 0,
    driverSettledAmount: 0,
    driverOutstandingAmount: 0,
    refundedGross: 0,
  };
}

function isCancelledStatus(status: string): boolean {
  const s = status.toUpperCase();
  return s === 'CANCELLED' || s === 'CANCELED';
}

function isRefundedStatus(status: string): boolean {
  return status.toUpperCase() === 'REFUNDED';
}

export function orderDeliveryAreaLabel(order: Record<string, unknown>): string {
  const delivery = order.delivery as { zoneName?: string; zoneId?: string } | undefined;
  const zone = String(delivery?.zoneName || '').trim();
  if (zone) return zone;
  const ext = String(order.externalDestination || '').trim();
  if (ext) return ext;
  return 'غير محدد';
}

function orderInRange(
  order: Record<string, unknown>,
  from: string,
  to: string,
  timezone: string
): boolean {
  const day = orderBusinessDay(order, timezone);
  if (!day) return false;
  return day >= from && day <= to;
}

function matchesFilters(
  order: Record<string, unknown>,
  filters: FinancialReportFilters
): boolean {
  if (!orderInRange(order, filters.from, filters.to, filters.timezone)) return false;
  if (filters.shopId && String(order.tenantId || '') !== filters.shopId) return false;
  if (filters.courierId && String(order.courierId || '') !== filters.courierId) return false;
  if (filters.deliveryAreaId) {
    const label = orderDeliveryAreaLabel(order);
    if (label !== filters.deliveryAreaId) return false;
  }
  if (filters.orderSource === 'APP' && isOrderExternal(order as { isExternal?: boolean })) {
    return false;
  }
  if (filters.orderSource === 'EXTERNAL' && !isOrderExternal(order as { isExternal?: boolean })) {
    return false;
  }
  if (filters.paymentMethod && filters.paymentMethod !== 'ALL') {
    if (normalizePaymentMethod(order) !== filters.paymentMethod) return false;
  }
  if (filters.settlementStatus && filters.settlementStatus !== 'ALL') {
    const meta = enrichOrderWithDriverCollection(order);
    if (meta.settlementStatus !== filters.settlementStatus) return false;
  }
  return true;
}

export function computeMetricSnapshot(
  orders: Record<string, unknown>[],
  filters: FinancialReportFilters
): MetricSnapshot {
  const snap = emptyMetricSnapshot();

  for (const order of orders) {
    if (!matchesFilters(order, filters)) continue;
    snap.orderCount += 1;
    const status = String(order.status || '');

    if (isCancelledStatus(status)) {
      snap.cancelledOrderCount += 1;
      continue;
    }
    if (isRefundedStatus(status)) {
      snap.refundedOrderCount += 1;
      const fin = extractOrderStoreProfit(order);
      snap.refundedGross = roundMoney(snap.refundedGross + fin.totalSales);
      continue;
    }
    if (!isSettlementEligibleStatus(status)) continue;

    snap.completedOrderCount += 1;
    const by = extractOrderProfitBySource(order);
    snap.grossOrderValue = roundMoney(snap.grossOrderValue + by.totalSales);
    snap.platformRevenue = roundMoney(snap.platformRevenue + by.nowMarketRevenue);
    snap.deliveryFeeRevenue = roundMoney(snap.deliveryFeeRevenue + by.deliveryFee);
    snap.platformCommissionRevenue = roundMoney(
      snap.platformCommissionRevenue + by.platformCommission
    );
    if (by.isExternal) {
      snap.externalDeliveryFeeRevenue = roundMoney(
        snap.externalDeliveryFeeRevenue + by.externalDeliveryProfit
      );
    } else {
      snap.appDeliveryFeeRevenue = roundMoney(
        snap.appDeliveryFeeRevenue + by.appDeliveryProfit
      );
    }

    if (isDriverCollectionCountable(order)) {
      const acc = computeDriverOrderAccounting(order);
      snap.restaurantPayable = roundMoney(
        snap.restaurantPayable + acc.driverRestaurantLiabilityAmount
      );
      snap.driverCashInHand = roundMoney(snap.driverCashInHand + acc.driverCashInHand);
      snap.driverRestaurantLiability = roundMoney(
        snap.driverRestaurantLiability + acc.driverRestaurantLiabilityAmount
      );
      if (acc.settlementStatus === 'SETTLED') {
        snap.driverSettledAmount = roundMoney(snap.driverSettledAmount + acc.settledAmount);
      } else {
        snap.driverPlatformLiability = roundMoney(
          snap.driverPlatformLiability + acc.driverPlatformLiabilityAmount
        );
        snap.driverOutstandingAmount = roundMoney(
          snap.driverOutstandingAmount + acc.outstandingAmount
        );
      }
    }
  }

  return snap;
}

export function compareMetrics(
  current: MetricSnapshot,
  previous: MetricSnapshot
): MetricComparison[] {
  const keys = Object.keys(current) as (keyof MetricSnapshot)[];
  return keys.map((metric) => {
    const a = current[metric];
    const b = previous[metric];
    const absoluteChange = roundMoney(a - b);
    let percentageChange: number | null = null;
    if (b !== 0) percentageChange = roundMoney((absoluteChange / Math.abs(b)) * 100);
    else if (a === 0) percentageChange = 0;
    else percentageChange = null;
    const trend: MetricComparison['trend'] =
      absoluteChange > 0 ? 'up' : absoluteChange < 0 ? 'down' : 'flat';
    return { metric, absoluteChange, percentageChange, trend };
  });
}

export type TimeseriesRow = {
  date: string;
  orderCount: number;
  grossOrderValue: number;
  platformRevenue: number;
  deliveryFeeRevenue: number;
  commissionRevenue: number;
  refundAmount: number;
};

export function computeTimeseries(
  orders: Record<string, unknown>[],
  filters: FinancialReportFilters
): TimeseriesRow[] {
  const byDay = new Map<string, TimeseriesRow>();
  const ensure = (day: string): TimeseriesRow => {
    let row = byDay.get(day);
    if (!row) {
      row = {
        date: day,
        orderCount: 0,
        grossOrderValue: 0,
        platformRevenue: 0,
        deliveryFeeRevenue: 0,
        commissionRevenue: 0,
        refundAmount: 0,
      };
      byDay.set(day, row);
    }
    return row;
  };

  let cursor = filters.from;
  while (cursor <= filters.to) {
    ensure(cursor);
    cursor = addDays(cursor, 1, filters.timezone);
  }

  for (const order of orders) {
    if (!matchesFilters(order, filters)) continue;
    const day = orderBusinessDay(order, filters.timezone);
    if (!day) continue;
    const row = ensure(day);
    const status = String(order.status || '');
    if (isRefundedStatus(status)) {
      const fin = extractOrderStoreProfit(order);
      row.refundAmount = roundMoney(row.refundAmount + fin.totalSales);
      continue;
    }
    if (isCancelledStatus(status) || !isSettlementEligibleStatus(status)) continue;
    const by = extractOrderProfitBySource(order);
    row.orderCount += 1;
    row.grossOrderValue = roundMoney(row.grossOrderValue + by.totalSales);
    row.platformRevenue = roundMoney(row.platformRevenue + by.nowMarketRevenue);
    row.deliveryFeeRevenue = roundMoney(row.deliveryFeeRevenue + by.deliveryFee);
    row.commissionRevenue = roundMoney(row.commissionRevenue + by.platformCommission);
  }

  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export type ShopReportRow = {
  shopId: string;
  shopName: string;
  completedOrderCount: number;
  cancelledOrderCount: number;
  grossOrderValue: number;
  restaurantPayable: number;
  platformCommission: number;
  deliveryFee: number;
  platformRevenue: number;
  averageOrderValue: number;
  refundedGross: number;
  platformRevenuePerOrder: number;
};

export function computeShopReport(
  orders: Record<string, unknown>[],
  tenants: { id?: string; name?: string }[],
  filters: FinancialReportFilters
): ShopReportRow[] {
  const names = new Map(tenants.map((t) => [String(t.id), String(t.name || t.id)]));
  const map = new Map<string, ShopReportRow>();

  for (const order of orders) {
    if (!matchesFilters(order, filters)) continue;
    const shopId = String(order.tenantId || 'unknown');
    let row = map.get(shopId);
    if (!row) {
      row = {
        shopId,
        shopName: names.get(shopId) || shopId,
        completedOrderCount: 0,
        cancelledOrderCount: 0,
        grossOrderValue: 0,
        restaurantPayable: 0,
        platformCommission: 0,
        deliveryFee: 0,
        platformRevenue: 0,
        averageOrderValue: 0,
        refundedGross: 0,
        platformRevenuePerOrder: 0,
      };
      map.set(shopId, row);
    }
    const status = String(order.status || '');
    if (isCancelledStatus(status)) {
      row.cancelledOrderCount += 1;
      continue;
    }
    if (isRefundedStatus(status)) {
      row.refundedGross = roundMoney(
        row.refundedGross + extractOrderStoreProfit(order).totalSales
      );
      continue;
    }
    if (!isSettlementEligibleStatus(status)) continue;
    const by = extractOrderProfitBySource(order);
    row.completedOrderCount += 1;
    row.grossOrderValue = roundMoney(row.grossOrderValue + by.totalSales);
    row.platformCommission = roundMoney(row.platformCommission + by.platformCommission);
    row.deliveryFee = roundMoney(row.deliveryFee + by.deliveryFee);
    row.platformRevenue = roundMoney(row.platformRevenue + by.nowMarketRevenue);
    if (isDriverCollectionCountable(order)) {
      const acc = computeDriverOrderAccounting(order);
      row.restaurantPayable = roundMoney(
        row.restaurantPayable + acc.driverRestaurantLiabilityAmount
      );
    }
  }

  return [...map.values()]
    .map((r) => ({
      ...r,
      averageOrderValue:
        r.completedOrderCount > 0
          ? roundMoney(r.grossOrderValue / r.completedOrderCount)
          : 0,
      platformRevenuePerOrder:
        r.completedOrderCount > 0
          ? roundMoney(r.platformRevenue / r.completedOrderCount)
          : 0,
    }))
    .sort((a, b) => b.platformRevenue - a.platformRevenue);
}

export type AreaReportRow = {
  areaName: string;
  deliveredOrders: number;
  cancelledOrders: number;
  grossOrderValue: number;
  deliveryFeeRevenue: number;
  platformCommission: number;
  platformRevenue: number;
  averageDeliveryFee: number;
  averageOrderValue: number;
};

export function computeAreaReport(
  orders: Record<string, unknown>[],
  filters: FinancialReportFilters
): AreaReportRow[] {
  const map = new Map<string, AreaReportRow>();
  for (const order of orders) {
    if (!matchesFilters(order, filters)) continue;
    const areaName = orderDeliveryAreaLabel(order);
    let row = map.get(areaName);
    if (!row) {
      row = {
        areaName,
        deliveredOrders: 0,
        cancelledOrders: 0,
        grossOrderValue: 0,
        deliveryFeeRevenue: 0,
        platformCommission: 0,
        platformRevenue: 0,
        averageDeliveryFee: 0,
        averageOrderValue: 0,
      };
      map.set(areaName, row);
    }
    const status = String(order.status || '');
    if (isCancelledStatus(status)) {
      row.cancelledOrders += 1;
      continue;
    }
    if (!isSettlementEligibleStatus(status)) continue;
    const by = extractOrderProfitBySource(order);
    row.deliveredOrders += 1;
    row.grossOrderValue = roundMoney(row.grossOrderValue + by.totalSales);
    row.deliveryFeeRevenue = roundMoney(row.deliveryFeeRevenue + by.deliveryFee);
    row.platformCommission = roundMoney(row.platformCommission + by.platformCommission);
    row.platformRevenue = roundMoney(row.platformRevenue + by.nowMarketRevenue);
  }
  return [...map.values()]
    .map((r) => ({
      ...r,
      averageDeliveryFee:
        r.deliveredOrders > 0 ? roundMoney(r.deliveryFeeRevenue / r.deliveredOrders) : 0,
      averageOrderValue:
        r.deliveredOrders > 0 ? roundMoney(r.grossOrderValue / r.deliveredOrders) : 0,
    }))
    .sort((a, b) => b.platformRevenue - a.platformRevenue);
}

export type PaymentMethodReportRow = {
  paymentMethod: NormalizedPaymentMethod;
  orderCount: number;
  grossOrderValue: number;
  platformRevenue: number;
  cashCollectedByDrivers: number;
  refundedGross: number;
  cancelledCount: number;
};

export function computePaymentMethodReport(
  orders: Record<string, unknown>[],
  filters: FinancialReportFilters
): PaymentMethodReportRow[] {
  const map = new Map<NormalizedPaymentMethod, PaymentMethodReportRow>();
  const ensure = (m: NormalizedPaymentMethod) => {
    let row = map.get(m);
    if (!row) {
      row = {
        paymentMethod: m,
        orderCount: 0,
        grossOrderValue: 0,
        platformRevenue: 0,
        cashCollectedByDrivers: 0,
        refundedGross: 0,
        cancelledCount: 0,
      };
      map.set(m, row);
    }
    return row;
  };

  for (const order of orders) {
    if (!matchesFilters(order, filters)) continue;
    const method = normalizePaymentMethod(order);
    const row = ensure(method);
    const status = String(order.status || '');
    if (isCancelledStatus(status)) {
      row.cancelledCount += 1;
      continue;
    }
    if (isRefundedStatus(status)) {
      row.refundedGross = roundMoney(
        row.refundedGross + extractOrderStoreProfit(order).totalSales
      );
      continue;
    }
    if (!isSettlementEligibleStatus(status)) continue;
    const by = extractOrderProfitBySource(order);
    row.orderCount += 1;
    row.grossOrderValue = roundMoney(row.grossOrderValue + by.totalSales);
    row.platformRevenue = roundMoney(row.platformRevenue + by.nowMarketRevenue);
    if (isDriverCollectionCountable(order)) {
      const acc = computeDriverOrderAccounting(order);
      row.cashCollectedByDrivers = roundMoney(
        row.cashCollectedByDrivers + acc.driverCashInHand
      );
    }
  }
  return [...map.values()].sort((a, b) => b.orderCount - a.orderCount);
}

export type OrderSourceReportRow = {
  source: 'APP' | 'EXTERNAL';
  orderCount: number;
  grossOrderValue: number;
  deliveryFees: number;
  commissions: number;
  platformRevenue: number;
  cancelledCount: number;
  cancellationRate: number;
  refundedGross: number;
};

export function computeOrderSourceReport(
  orders: Record<string, unknown>[],
  filters: FinancialReportFilters
): OrderSourceReportRow[] {
  const blank = (source: 'APP' | 'EXTERNAL'): OrderSourceReportRow => ({
    source,
    orderCount: 0,
    grossOrderValue: 0,
    deliveryFees: 0,
    commissions: 0,
    platformRevenue: 0,
    cancelledCount: 0,
    cancellationRate: 0,
    refundedGross: 0,
  });
  const app = blank('APP');
  const ext = blank('EXTERNAL');

  for (const order of orders) {
    if (!matchesFilters(order, filters)) continue;
    const row = isOrderExternal(order as { isExternal?: boolean }) ? ext : app;
    const status = String(order.status || '');
    if (isCancelledStatus(status)) {
      row.cancelledCount += 1;
      continue;
    }
    if (isRefundedStatus(status)) {
      row.refundedGross = roundMoney(
        row.refundedGross + extractOrderStoreProfit(order).totalSales
      );
      continue;
    }
    if (!isSettlementEligibleStatus(status)) continue;
    const by = extractOrderProfitBySource(order);
    row.orderCount += 1;
    row.grossOrderValue = roundMoney(row.grossOrderValue + by.totalSales);
    row.deliveryFees = roundMoney(row.deliveryFees + by.deliveryFee);
    row.commissions = roundMoney(row.commissions + by.platformCommission);
    row.platformRevenue = roundMoney(row.platformRevenue + by.nowMarketRevenue);
  }

  for (const row of [app, ext]) {
    const denom = row.orderCount + row.cancelledCount;
    row.cancellationRate = denom > 0 ? roundMoney((row.cancelledCount / denom) * 100) : 0;
  }
  return [app, ext];
}

export type FinancialAnomaly = {
  anomalyCode: string;
  severity: 'warning' | 'error';
  entityType: 'order' | 'courier';
  entityId: string;
  message: string;
  detectedAt: string;
};

export function detectFinancialAnomalies(
  orders: Record<string, unknown>[],
  filters: FinancialReportFilters
): FinancialAnomaly[] {
  const out: FinancialAnomaly[] = [];
  const now = new Date().toISOString();
  for (const order of orders) {
    if (!matchesFilters(order, filters)) continue;
    const status = String(order.status || '');
    if (!isSettlementEligibleStatus(status)) continue;
    const id = String(order.id || '');
    const by = extractOrderProfitBySource(order);
    if (by.deliveryFee <= 0) {
      out.push({
        anomalyCode: 'MISSING_DELIVERY_FEE',
        severity: 'warning',
        entityType: 'order',
        entityId: id,
        message: 'طلب مكتمل بدون رسوم توصيل',
        detectedAt: now,
      });
    }
    if (!by.isExternal && by.platformCommission <= 0) {
      out.push({
        anomalyCode: 'MISSING_PLATFORM_COMMISSION',
        severity: 'warning',
        entityType: 'order',
        entityId: id,
        message: 'طلب تطبيق مكتمل بدون عمولة منصة',
        detectedAt: now,
      });
    }
    if (normalizePaymentMethod(order) === 'UNKNOWN') {
      out.push({
        anomalyCode: 'UNKNOWN_PAYMENT_METHOD',
        severity: 'warning',
        entityType: 'order',
        entityId: id,
        message: 'طريقة دفع غير معروفة',
        detectedAt: now,
      });
    }
    if (by.totalSales <= 0 && !by.isExternal) {
      out.push({
        anomalyCode: 'ZERO_PAYABLE',
        severity: 'warning',
        entityType: 'order',
        entityId: id,
        message: 'طلب مكتمل بقيمة صفر',
        detectedAt: now,
      });
    }
    if (orderDeliveryAreaLabel(order) === 'غير محدد') {
      out.push({
        anomalyCode: 'MISSING_DELIVERY_AREA',
        severity: 'warning',
        entityType: 'order',
        entityId: id,
        message: 'لا توجد منطقة توصيل على الطلب (zoneName/externalDestination)',
        detectedAt: now,
      });
    }
    if (isDriverCollectionCountable(order)) {
      const enriched = enrichOrderWithDriverCollection(order);
      if (enriched.anomalyCode) {
        out.push({
          anomalyCode: String(enriched.anomalyCode),
          severity: 'error',
          entityType: 'order',
          entityId: id,
          message: enriched.anomalyMessage || String(enriched.anomalyCode),
          detectedAt: now,
        });
      }
      const acc = computeDriverOrderAccounting(order);
      if (acc.driverRestaurantLiabilityAmount < 0) {
        out.push({
          anomalyCode: 'NEGATIVE_RESTAURANT_SHARE',
          severity: 'error',
          entityType: 'order',
          entityId: id,
          message: 'حصة المطعم سالبة',
          detectedAt: now,
        });
      }
    }
    if (out.length >= 200) break;
  }
  return out;
}

export function buildFinancialSummary(input: {
  orders: Record<string, unknown>[];
  filters: FinancialReportFilters;
}): {
  period: FinancialReportFilters;
  current: MetricSnapshot;
  previous: MetricSnapshot;
  comparison: MetricComparison[];
  revenueBreakdown: {
    deliveryFees: number;
    platformCommissions: number;
    appDeliveryIncome: number;
    externalDeliveryIncome: number;
    grossPlatformRevenue: number;
    refundedGrossInformational: number;
    netPlatformRevenueNote: string;
  };
  driverDashboard: ReturnType<typeof computeCollectionsDashboard>;
} {
  const prevRange = previousPeriod(input.filters.from, input.filters.to, input.filters.timezone);
  const prevFilters: FinancialReportFilters = {
    ...input.filters,
    from: prevRange.from,
    to: prevRange.to,
    preset: 'CUSTOM_RANGE',
  };
  const current = computeMetricSnapshot(input.orders, input.filters);
  const previous = computeMetricSnapshot(input.orders, prevFilters);
  const today = formatBusinessDay(new Date(), input.filters.timezone);
  /** Open-balance snapshot (today) — supplemental; period cards use `current`. */
  const driverDashboard = computeCollectionsDashboard(input.orders, today);

  return {
    period: input.filters,
    current,
    previous,
    comparison: compareMetrics(current, previous),
    revenueBreakdown: {
      deliveryFees: current.deliveryFeeRevenue,
      platformCommissions: current.platformCommissionRevenue,
      appDeliveryIncome: current.appDeliveryFeeRevenue,
      externalDeliveryIncome: current.externalDeliveryFeeRevenue,
      grossPlatformRevenue: current.platformRevenue,
      refundedGrossInformational: current.refundedGross,
      netPlatformRevenueNote:
        'لا يوجد حقل refundAmount على الطلب — REFUNDED/CANCELLED مستبعدة من إيراد المكتمل. refundedGross معلوماتي فقط.',
    },
    driverDashboard,
  };
}

export function csvEscape(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) lines.push(row.map(csvEscape).join(','));
  return `\uFEFF${lines.join('\n')}`;
}

export { aggregateDriverCollections, safeNum };
