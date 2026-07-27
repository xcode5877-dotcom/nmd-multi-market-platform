#!/usr/bin/env npx tsx
/**
 * Financial Reports V1 verification.
 * Run: pnpm --filter mock-api verify:financial-reports
 *
 * Does not mutate checkout/pricing/settlement formulas.
 */

import {
  BUSINESS_TIMEZONE,
  buildFinancialSummary,
  compareMetrics,
  computeAreaReport,
  computeMetricSnapshot,
  computeOrderSourceReport,
  computePaymentMethodReport,
  computeShopReport,
  computeTimeseries,
  detectFinancialAnomalies,
  emptyMetricSnapshot,
  formatBusinessDay,
  orderDeliveryAreaLabel,
  parseFinancialReportRange,
  previousPeriod,
  toCsv,
  type FinancialReportFilters,
} from '../src/financial-reports.js';
import { computeDriverOrderAccounting } from '../src/driver-collections.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${message}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${message}`);
  }
}

function baseFilters(over: Partial<FinancialReportFilters> = {}): FinancialReportFilters {
  return {
    from: '2026-07-01',
    to: '2026-07-31',
    preset: 'CUSTOM_RANGE',
    timezone: BUSINESS_TIMEZONE,
    orderSource: 'ALL',
    settlementStatus: 'ALL',
    ...over,
  };
}

function runUnitTests(): void {
  console.log('\n--- Timezone / presets ---');
  assert(BUSINESS_TIMEZONE === 'Asia/Jerusalem', 'business timezone is Asia/Jerusalem');

  const today = formatBusinessDay(new Date(), BUSINESS_TIMEZONE);
  const last7 = parseFinancialReportRange('LAST_7_DAYS', undefined, undefined, BUSINESS_TIMEZONE);
  assert(last7.to === today, 'LAST_7_DAYS ends today (business TZ)');
  assert(last7.from <= last7.to, 'LAST_7_DAYS range ordered');

  const prev = previousPeriod('2026-07-10', '2026-07-16', BUSINESS_TIMEZONE);
  assert(prev.from === '2026-07-03' && prev.to === '2026-07-09', 'previous period equal length');

  console.log('\n--- App order accounting ---');
  const appOrder: Record<string, unknown> = {
    id: 'app-1',
    status: 'COMPLETED',
    tenantId: 'shop-a',
    courierId: 'c1',
    createdAt: '2026-07-15T10:00:00.000Z',
    deliveredAt: '2026-07-15T11:00:00.000Z',
    isExternal: false,
    paymentMethod: 'cash',
    payment: { method: 'cash', status: 'pending' },
    settlement: {
      platformCommission: 12,
      deliveryFee: 10,
      customerGrandTotal: 210,
    },
    delivery: { zoneName: 'دبورية' },
  };
  const appSnap = computeMetricSnapshot([appOrder], baseFilters());
  assert(appSnap.grossOrderValue === 210, 'app GMV = 210 (not platform revenue)');
  assert(appSnap.platformRevenue === 22, 'app platformRevenue = delivery+commission = 22');
  assert(appSnap.deliveryFeeRevenue === 10, 'app delivery fee = 10');
  assert(appSnap.platformCommissionRevenue === 12, 'app commission = 12');
  assert(appSnap.platformRevenue !== appSnap.grossOrderValue, 'GMV is not platform revenue');

  console.log('\n--- External order ---');
  const extOrder: Record<string, unknown> = {
    id: 'ext-1',
    status: 'DELIVERED',
    tenantId: 'shop-a',
    courierId: 'c1',
    createdAt: '2026-07-15T12:00:00.000Z',
    isExternal: true,
    total: 10,
    externalDestination: 'عبلين',
    paymentMethod: 'cash',
    payment: { method: 'cash' },
    settlement: { deliveryFee: 10, platformCommission: 0, customerGrandTotal: 10 },
  };
  const extSnap = computeMetricSnapshot([extOrder], baseFilters());
  assert(extSnap.platformRevenue === 10, 'external platformRevenue = delivery only');
  assert(extSnap.platformCommissionRevenue === 0, 'external commission = 0');

  console.log('\n--- Cancelled / refunded ---');
  const cancelled: Record<string, unknown> = {
    ...appOrder,
    id: 'cancel-1',
    status: 'CANCELLED',
  };
  const refunded: Record<string, unknown> = {
    ...appOrder,
    id: 'refund-1',
    status: 'REFUNDED',
  };
  const mixed = computeMetricSnapshot([appOrder, cancelled, refunded], baseFilters());
  assert(mixed.completedOrderCount === 1, 'only completed counted as revenue');
  assert(mixed.cancelledOrderCount === 1, 'cancelled counted separately');
  assert(mixed.refundedOrderCount === 1, 'refunded counted separately');
  assert(mixed.platformRevenue === 22, 'cancelled/refunded excluded from platform revenue');
  assert(mixed.refundedGross === 210, 'refundedGross informational GMV');

  console.log('\n--- Online paid → no fake driver cash ---');
  const online: Record<string, unknown> = {
    id: 'online-1',
    status: 'COMPLETED',
    tenantId: 'shop-a',
    courierId: 'c1',
    createdAt: '2026-07-15T14:00:00.000Z',
    isExternal: false,
    paymentMethod: 'online',
    payment: { method: 'online', status: 'paid' },
    settlement: {
      platformCommission: 12,
      deliveryFee: 10,
      customerGrandTotal: 210,
    },
    delivery: { zoneName: 'دبورية' },
  };
  const onlineAcc = computeDriverOrderAccounting(online);
  assert(onlineAcc.driverCashInHand === 0, 'online paid: driver cash in hand = 0');
  assert(onlineAcc.outstandingAmount === 0 || onlineAcc.driverPlatformLiabilityAmount === 0, 'online: no fake driver platform debt from GMV');
  const onlineSnap = computeMetricSnapshot([online], baseFilters());
  assert(onlineSnap.platformRevenue === 22, 'online still earns platform revenue');
  assert(onlineSnap.driverCashInHand === 0, 'online not in driver cash');

  console.log('\n--- Comparison / zero previous ---');
  const cur = emptyMetricSnapshot();
  cur.platformRevenue = 50;
  const zero = emptyMetricSnapshot();
  const comps = compareMetrics(cur, zero);
  const pr = comps.find((c) => c.metric === 'platformRevenue');
  assert(pr?.percentageChange === null, 'previous=0 → percentageChange null (no Infinity)');
  assert(pr?.absoluteChange === 50, 'absolute change still reported');

  console.log('\n--- Shop / area grouping ---');
  const shops = computeShopReport([appOrder, extOrder], [{ id: 'shop-a', name: 'متجر أ' }], baseFilters());
  assert(shops.length === 1, 'one shop row');
  assert(shops[0].platformRevenue === 32, 'shop platform revenue = 22+10');
  assert(shops[0].platformCommission === 12, 'shop commission excludes fake external commission');

  const areas = computeAreaReport([appOrder, extOrder], baseFilters());
  assert(areas.some((a) => a.areaName === 'دبورية'), 'uses order zoneName');
  assert(areas.some((a) => a.areaName === 'عبلين'), 'uses externalDestination');
  assert(orderDeliveryAreaLabel(appOrder) === 'دبورية', 'historical area from order');

  console.log('\n--- Payment methods / sources ---');
  const pm = computePaymentMethodReport([appOrder, online], baseFilters());
  assert(pm.some((r) => r.paymentMethod === 'CASH_ON_DELIVERY' || r.paymentMethod === 'ONLINE_PAID'), 'normalized payment categories');

  const sources = computeOrderSourceReport([appOrder, extOrder], baseFilters());
  const appSrc = sources.find((s) => s.source === 'APP');
  const extSrc = sources.find((s) => s.source === 'EXTERNAL');
  assert(appSrc?.platformRevenue === 22, 'APP source revenue');
  assert(extSrc?.commissions === 0, 'EXTERNAL commissions = 0');
  assert(extSrc?.platformRevenue === 10, 'EXTERNAL platform = delivery');

  console.log('\n--- Timeseries / anomalies / CSV ---');
  const ts = computeTimeseries([appOrder], baseFilters({ from: '2026-07-15', to: '2026-07-15' }));
  assert(ts.length === 1 && ts[0].platformRevenue === 22, 'daily timeseries aggregated server-side');

  const unknownPay: Record<string, unknown> = {
    ...appOrder,
    id: 'unk-1',
    paymentMethod: 'weird-xyz',
    payment: { method: 'weird-xyz' },
  };
  const anomalies = detectFinancialAnomalies([unknownPay], baseFilters());
  assert(
    anomalies.some((a) => a.anomalyCode === 'UNKNOWN_PAYMENT_METHOD'),
    'unknown payment → anomaly'
  );

  const empty = computeMetricSnapshot([], baseFilters({ from: '2099-01-01', to: '2099-01-02' }));
  assert(empty.platformRevenue === 0 && empty.orderCount === 0, 'empty range → zeros');

  const csv = toCsv(['a', 'b'], [[1, 2]]);
  assert(csv.charCodeAt(0) === 0xfeff, 'CSV UTF-8 BOM');
  assert(csv.includes('a,b'), 'CSV headers');

  console.log('\n--- Summary contract ---');
  const summary = buildFinancialSummary({
    orders: [appOrder, cancelled, extOrder],
    filters: baseFilters(),
  });
  assert(summary.current.platformRevenue === 32, 'summary platform revenue');
  assert(summary.revenueBreakdown.grossPlatformRevenue === 32, 'breakdown matches');
  assert(typeof summary.revenueBreakdown.netPlatformRevenueNote === 'string', 'refund limitation noted');
  assert(Array.isArray(summary.comparison), 'comparison array present');
}

runUnitTests();
console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
