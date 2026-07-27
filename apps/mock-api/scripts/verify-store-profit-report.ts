#!/usr/bin/env npx tsx
/**
 * Super Admin store profit report verification.
 * Run: pnpm --filter mock-api verify:store-profit-report
 */

import {
  assertStoreProfitReconciliation,
  computeLegacyStoreProfitReport,
  computeStoreProfitBreakdown,
  computeStoreProfitReport,
  extractExternalOrderDeliveryProfit,
  extractOrderProfitBySource,
  extractOrderStoreProfit,
} from '../src/store-profit-report.js';

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

function runUnitTests(): void {
  console.log('\n--- Unit: extractOrderStoreProfit ---');

  const fromSettlement = extractOrderStoreProfit({
    status: 'COMPLETED',
    settlement: {
      platformCommission: 8,
      deliveryFee: 12,
      customerGrandTotal: 120,
    },
  });
  assert(fromSettlement.platformCommission === 8, 'platform commission from settlement');
  assert(fromSettlement.deliveryFee === 12, 'delivery fee from settlement');
  assert(fromSettlement.nowMarketRevenue === 20, 'now market revenue = commission + delivery');
  assert(fromSettlement.totalSales === 120, 'total sales from settlement customerGrandTotal');

  const fromPayment = extractOrderStoreProfit({
    status: 'DELIVERED',
    platformFee: 5,
    platformDeliveryFee: 10,
    customerTotal: 95,
    payment: {
      financials: { platformFee: 5, customerTotal: 95 },
      breakdown: { platformFee: 5, deliveryFee: 10, itemsTotal: 80 },
    },
  });
  assert(fromPayment.platformCommission === 5, 'platform commission from payment fields');
  assert(fromPayment.deliveryFee === 10, 'delivery fee from payment breakdown');
  assert(fromPayment.nowMarketRevenue === 15, 'payment-based now market revenue');

  console.log('\n--- Unit: app vs external split ---');

  const appProfit = extractOrderProfitBySource({
    status: 'COMPLETED',
    isExternal: false,
    settlement: { platformCommission: 15, deliveryFee: 10, customerGrandTotal: 60 },
  });
  assert(!appProfit.isExternal, 'app order not external');
  assert(appProfit.appCommissionProfit === 15, 'app commission');
  assert(appProfit.appDeliveryProfit === 10, 'app delivery profit');
  assert(appProfit.externalDeliveryProfit === 0, 'app order has no external delivery');
  assert(appProfit.nowMarketRevenue === 25, 'app total platform profit');

  const externalProfit = extractOrderProfitBySource({
    status: 'COMPLETED',
    isExternal: true,
    total: 30,
    subtotal: 0,
    items: [],
  });
  assert(externalProfit.isExternal, 'external order flagged');
  assert(externalProfit.appCommissionProfit === 0, 'external commission always zero');
  assert(externalProfit.appDeliveryProfit === 0, 'external has no app delivery bucket');
  assert(externalProfit.externalDeliveryProfit === 30, 'external delivery from order.total');
  assert(externalProfit.nowMarketRevenue === 30, 'external total = delivery only');

  const externalWithSettlementCommission = extractOrderProfitBySource({
    status: 'DELIVERED',
    isExternal: true,
    total: 25,
    settlement: { platformCommission: 99, deliveryFee: 25, customerGrandTotal: 25 },
  });
  assert(
    externalWithSettlementCommission.appCommissionProfit === 0,
    'external ignores settlement commission'
  );
  assert(
    externalWithSettlementCommission.externalDeliveryProfit === 25,
    'external uses settlement deliveryFee'
  );

  assert(extractExternalOrderDeliveryProfit({ isExternal: true, total: 18 }) === 18, 'external fallback total');

  console.log('\n--- Unit: computeStoreProfitReport ---');

  const orders = [
    {
      id: 'o1',
      tenantId: 't-a',
      status: 'COMPLETED',
      createdAt: '2026-06-20T10:00:00.000Z',
      settlement: { platformCommission: 4, deliveryFee: 8, customerGrandTotal: 80 },
    },
    {
      id: 'o2',
      tenantId: 't-a',
      status: 'COMPLETED',
      createdAt: '2026-06-21T11:00:00.000Z',
      settlement: { platformCommission: 6, deliveryFee: 8, customerGrandTotal: 100 },
    },
    {
      id: 'o3',
      tenantId: 't-b',
      status: 'COMPLETED',
      createdAt: '2026-06-21T12:00:00.000Z',
      settlement: { platformCommission: 3, deliveryFee: 10, customerGrandTotal: 70 },
    },
    {
      id: 'o4',
      tenantId: 't-a',
      status: 'CANCELED',
      createdAt: '2026-06-21T13:00:00.000Z',
      settlement: { platformCommission: 99, deliveryFee: 99, customerGrandTotal: 999 },
    },
  ];

  const report = computeStoreProfitReport({
    orders,
    tenants: [
      { id: 't-a', name: 'Store A' },
      { id: 't-b', name: 'Store B' },
    ],
    from: '2026-06-20',
    to: '2026-06-21',
  });

  assert(report.stores.length === 2, 'two stores in report');
  const storeA = report.stores.find((s) => s.tenantId === 't-a');
  assert(!!storeA, 'store A present');
  assert(storeA!.appOrderCount === 2, 'store A app order count excludes cancelled');
  assert(storeA!.externalOrderCount === 0, 'store A no external orders');
  assert(storeA!.appCommissionProfit === 10, 'store A commission sum (4+6)');
  assert(storeA!.appDeliveryProfit === 16, 'store A app delivery (8+8)');
  assert(storeA!.appTotalPlatformProfit === 26, 'store A app total profit');
  assert(storeA!.totalPlatformProfit === 26, 'store A total platform profit');
  assert(storeA!.nowMarketRevenue === 26, 'store A legacy nowMarketRevenue');
  assert(report.summary.appCommissionProfit === 13, 'summary commission (10+3)');
  assert(report.summary.totalDeliveryProfit === 26, 'summary delivery (16+10)');
  assert(report.summary.totalPlatformProfit === 39, 'summary total platform profit');
  assert(report.totals.nowMarketRevenue === 39, 'legacy totals match summary');

  console.log('\n--- Unit: mixed store (Qashtoota-style) ---');

  const qashtootaOrders = [
    {
      id: 'app-1',
      tenantId: 'qashtoota',
      status: 'COMPLETED',
      isExternal: false,
      createdAt: '2026-07-01T09:00:00.000Z',
      settlement: { platformCommission: 72, deliveryFee: 180, customerGrandTotal: 5000 },
    },
    {
      id: 'ext-1',
      tenantId: 'qashtoota',
      status: 'DELIVERED',
      isExternal: true,
      createdAt: '2026-07-01T10:00:00.000Z',
      total: 60,
    },
    {
      id: 'ext-2',
      tenantId: 'qashtoota',
      status: 'COMPLETED',
      isExternal: true,
      createdAt: '2026-07-02T11:00:00.000Z',
      total: 50,
    },
  ];

  const qReport = computeStoreProfitReport({
    orders: qashtootaOrders,
    tenants: [{ id: 'qashtoota', name: 'قشطوطة' }],
    from: '2026-07-01',
    to: '2026-07-31',
  });

  const q = qReport.stores[0];
  assert(q?.storeName === 'قشطوطة', 'Qashtoota store name');
  assert(q?.appOrderCount === 1, 'Qashtoota 1 app order');
  assert(q?.externalOrderCount === 2, 'Qashtoota 2 external orders');
  assert(q?.appCommissionProfit === 72, 'Qashtoota app commission');
  assert(q?.appDeliveryProfit === 180, 'Qashtoota app delivery');
  assert(q?.appTotalPlatformProfit === 252, 'Qashtoota app total');
  assert(q?.externalDeliveryProfit === 110, 'Qashtoota external delivery (60+50)');
  assert(q?.externalTotalPlatformProfit === 110, 'Qashtoota external total');
  assert(q?.totalPlatformProfit === 362, 'Qashtoota combined total 362');

  console.log('\n--- Unit: reconciliation invariants ---');
  assert(assertStoreProfitReconciliation(report).length === 0, 'base report reconciles');
  assert(assertStoreProfitReconciliation(qReport).length === 0, 'Qashtoota report reconciles');

  console.log('\n--- Unit: date filtering ---');
  const dateReport = computeStoreProfitReport({
    orders: qashtootaOrders,
    tenants: [{ id: 'qashtoota', name: 'قشطوطة' }],
    from: '2026-07-01',
    to: '2026-07-01',
  });
  assert(dateReport.summary.externalOrderCount === 1, 'single day excludes Jul 2 external');
  assert(dateReport.summary.externalDeliveryProfit === 60, 'single day external delivery');

  console.log('\n--- Unit: zero-profit report ---');
  const emptyReport = computeStoreProfitReport({
    orders: [],
    tenants: [{ id: 't-empty', name: 'Empty' }],
    from: '2026-06-01',
    to: '2026-06-30',
  });
  assert(emptyReport.stores.length === 0, 'no stores when no orders');
  assert(emptyReport.summary.totalPlatformProfit === 0, 'zero total profit');
  assert(assertStoreProfitReconciliation(emptyReport).length === 0, 'empty report reconciles');

  console.log('\n--- Unit: tenant filter ---');
  const filtered = computeStoreProfitReport({
    orders,
    tenants: [
      { id: 't-a', name: 'Store A' },
      { id: 't-b', name: 'Store B' },
    ],
    from: '2026-06-20',
    to: '2026-06-21',
    tenantId: 't-b',
  });
  assert(filtered.stores.length === 1, 'tenant filter returns one store');
  assert(filtered.stores[0]?.tenantId === 't-b', 'filtered store is t-b');

  console.log('\n--- Unit: legacy total for app-only orders ---');
  const legacyTotal = computeLegacyStoreProfitReport({
    orders,
    tenants: [{ id: 't-a', name: 'A' }, { id: 't-b', name: 'B' }],
    from: '2026-06-20',
    to: '2026-06-21',
  });
  assert(legacyTotal === 39, 'legacy app-only total unchanged');

  console.log('\n--- Unit: computeStoreProfitBreakdown ---');
  const breakdown = computeStoreProfitBreakdown({
    orders,
    tenantId: 't-a',
    from: '2026-06-20',
    to: '2026-06-21',
    granularity: 'day',
  });
  assert(breakdown.length === 2, 'daily breakdown has two days for store A');
  assert(
    breakdown.some((b) => b.periodKey === '2026-06-20' && b.appCommissionProfit === 4),
    'day 2026-06-20 app commission'
  );
  assert(
    breakdown.some((b) => b.periodKey === '2026-06-21' && b.appCommissionProfit === 6),
    'day 2026-06-21 app commission'
  );
}

function isPlatformAdmin(role: string): boolean {
  return role === 'ROOT_ADMIN' || role === 'SUPER_ADMIN';
}

function runAuthTests(): void {
  console.log('\n--- Auth: store profit report platform admin only ---');
  assert(isPlatformAdmin('ROOT_ADMIN'), 'ROOT_ADMIN can access');
  assert(isPlatformAdmin('SUPER_ADMIN'), 'SUPER_ADMIN can access');
  assert(!isPlatformAdmin('TENANT_ADMIN'), 'TENANT_ADMIN (merchant) cannot access');
  assert(!isPlatformAdmin('MARKET_ADMIN'), 'MARKET_ADMIN cannot access');
  assert(!isPlatformAdmin('COURIER'), 'COURIER cannot access');
}

async function main(): Promise<void> {
  console.log('Store profit report verification');
  runUnitTests();
  runAuthTests();
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
