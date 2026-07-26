/**
 * Driver Collections V2 + Cash Reconciliation V3 verification (no server).
 */
import assert from 'node:assert/strict';
import {
  aggregateDriverCollections,
  computeDriverCollectionAmount,
  computeDriverOrderAccounting,
  createDriverCollectionSettlement,
  enrichOrderWithDriverCollection,
  normalizePaymentMethod,
  readOrderSettlementMeta,
} from '../src/driver-collections.js';

function externalOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ext-1',
    courierId: 'c1',
    status: 'COMPLETED',
    isExternal: true,
    orderType: 'EXTERNAL',
    total: 10,
    delivery: { fee: 10 },
    payment: {
      method: 'CASH',
      breakdown: { itemsTotal: 0, deliveryFee: 10 },
      financials: { customerTotal: 10 },
    },
    createdAt: '2026-07-26T10:00:00.000Z',
    ...overrides,
  };
}

function appCodOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'app-cod',
    courierId: 'c1',
    status: 'COMPLETED',
    isExternal: false,
    total: 210,
    platformFee: 12,
    delivery: { fee: 10 },
    payment: {
      method: 'CASH',
      breakdown: { itemsTotal: 188, deliveryFee: 10, platformFee: 12 },
      financials: { customerTotal: 210, platformFee: 12, gross: 210 },
    },
    createdAt: '2026-07-26T11:00:00.000Z',
    ...overrides,
  };
}

function appOnlineOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'app-online',
    courierId: 'c1',
    status: 'COMPLETED',
    isExternal: false,
    total: 210,
    platformFee: 12,
    delivery: { fee: 10 },
    payment: {
      method: 'ONLINE',
      status: 'CAPTURED',
      breakdown: { itemsTotal: 188, deliveryFee: 10, platformFee: 12 },
      financials: { customerTotal: 210, platformFee: 12, gross: 210 },
    },
    createdAt: '2026-07-26T12:00:00.000Z',
    ...overrides,
  };
}

async function run() {
  // --- V2 regression ---
  const extV2 = computeDriverCollectionAmount(externalOrder());
  assert.equal(extV2.driverCollectionAmount, 10);

  const appV2 = computeDriverCollectionAmount(appCodOrder());
  assert.equal(appV2.driverCollectionAmount, 22);

  // 1. External
  const ext = computeDriverOrderAccounting(externalOrder());
  assert.equal(normalizePaymentMethod(externalOrder()), 'EXTERNAL_DELIVERY');
  assert.equal(ext.driverCashInHand, 10);
  assert.equal(ext.driverPlatformLiabilityAmount, 10);
  assert.equal(ext.driverRestaurantLiabilityAmount, 0);
  assert.equal(ext.totalDriverLiability, 10);
  assert.equal(ext.driverCollectionAmount, 10);

  // 2. App COD
  const cod = computeDriverOrderAccounting(appCodOrder());
  assert.equal(cod.normalizedPaymentMethod, 'CASH_ON_DELIVERY');
  assert.equal(cod.customerPayableAmount, 210);
  assert.equal(cod.driverCashInHand, 210);
  assert.equal(cod.driverPlatformLiabilityAmount, 22);
  assert.equal(cod.driverRestaurantLiabilityAmount, 188);
  assert.equal(cod.totalDriverLiability, 210);
  assert.equal(cod.platformRevenueAmount, 22);

  // 3. App online — no fake driver debt
  const online = computeDriverOrderAccounting(appOnlineOrder());
  assert.equal(online.normalizedPaymentMethod, 'ONLINE_PAID');
  assert.equal(online.driverCashInHand, 0);
  assert.equal(online.driverPlatformLiabilityAmount, 0);
  assert.equal(online.driverRestaurantLiabilityAmount, 0);
  assert.equal(online.totalDriverLiability, 0);
  assert.equal(online.platformRevenueAmount, 22); // revenue exists, not owed by driver
  assert.equal(online.driverCollectionAmount, 22);

  // 4. Mixed totals
  const mixed = [
    externalOrder({ id: 'e1' }),
    appCodOrder({ id: 'c1o' }),
    appOnlineOrder({ id: 'o1' }),
  ];
  const [sum] = aggregateDriverCollections(
    mixed,
    [{ id: 'c1', name: 'Ahmed' }],
    { filters: {}, today: '2026-07-26' }
  );
  assert.equal(sum.externalOrders, 1);
  assert.equal(sum.cashOrders, 2); // external + COD
  assert.equal(sum.onlinePaidOrders, 1);
  assert.equal(sum.cashInHandTotal, 220); // 10 + 210
  assert.equal(sum.platformLiabilityTotal, 32); // 10 + 22 + 0
  assert.equal(sum.restaurantLiabilityTotal, 188);
  assert.equal(sum.totalDriverLiability, 220);
  assert.ok(sum.outstandingCollection !== sum.completedOrders); // not using gross count as money

  // 5. PLATFORM_ONLY settlement basis = platform liability
  const codPlat = computeDriverOrderAccounting(appCodOrder(), {
    settlementMode: 'PLATFORM_ONLY',
  });
  assert.equal(codPlat.outstandingAmount, 22);

  // 6. FULL_CASH settlement basis = total liability
  const codFull = computeDriverOrderAccounting(appCodOrder(), {
    settlementMode: 'FULL_CASH',
  });
  assert.equal(codFull.outstandingAmount, 210);

  // 7. Refund before settlement
  const refunded = computeDriverOrderAccounting(
    appCodOrder({ id: 'ref', status: 'REFUNDED' })
  );
  assert.equal(refunded.totalDriverLiability, 0);
  assert.equal(refunded.driverCashInHand, 0);

  // 9. Unknown payment method
  const unknown = computeDriverOrderAccounting(
    appCodOrder({
      id: 'unk',
      payment: { method: 'BITCOIN', financials: { customerTotal: 210 } },
    })
  );
  assert.equal(unknown.normalizedPaymentMethod, 'UNKNOWN');
  assert.equal(unknown.anomalyCode, 'UNKNOWN_PAYMENT_METHOD');
  assert.equal(unknown.blockAutoSettlement, true);

  // 10. Negative restaurant share
  const neg = computeDriverOrderAccounting(
    appCodOrder({
      id: 'neg',
      platformFee: 100,
      delivery: { fee: 50 },
      payment: {
        method: 'CASH',
        financials: { customerTotal: 100, platformFee: 100 },
        breakdown: { deliveryFee: 50, platformFee: 100, itemsTotal: 0 },
      },
    })
  );
  assert.equal(neg.anomalyCode, 'NEGATIVE_RESTAURANT_SHARE');
  assert.equal(neg.blockAutoSettlement, true);

  // 5+11 settle PLATFORM_ONLY + double settle reject
  const pending = [externalOrder({ id: 'settle-ext' }), appCodOrder({ id: 'settle-cod' })];
  const { settlement, updatedOrders } = await createDriverCollectionSettlement({
    courierId: 'c1',
    orders: pending,
    settledBy: 'admin-1',
    settlementMode: 'PLATFORM_ONLY',
    settlementReference: 'REF-V3',
    shiftLabel: 'Morning',
  });
  assert.equal(settlement.settlementMode, 'PLATFORM_ONLY');
  assert.equal(settlement.settlementBasisAmount, 32); // 10+22
  assert.equal(settlement.cashInHandTotal, 220);
  assert.equal(settlement.platformLiabilityTotal, 32);
  assert.equal(settlement.restaurantLiabilityTotal, 188);
  assert.equal(settlement.entryType, 'SETTLEMENT');

  for (const o of updatedOrders) {
    assert.equal(readOrderSettlementMeta(o).settlementStatus, 'SETTLED');
  }

  await createDriverCollectionSettlement({
    courierId: 'c1',
    orders: updatedOrders,
    settledBy: 'admin-1',
  })
    .then(() => {
      throw new Error('expected NO_PENDING_ORDERS');
    })
    .catch((e: Error & { code?: string }) => {
      assert.equal(e.code, 'NO_PENDING_ORDERS');
    });

  // 12. Partial rejected
  await createDriverCollectionSettlement({
    courierId: 'c1',
    orders: [appCodOrder({ id: 'partial-1' })],
    settledBy: 'admin-1',
    settlementMode: 'PLATFORM_ONLY',
    settledAmount: 10,
  })
    .then(() => {
      throw new Error('expected PARTIAL_NOT_SUPPORTED');
    })
    .catch((e: Error & { code?: string }) => {
      assert.equal(e.code, 'PARTIAL_NOT_SUPPORTED');
    });

  // Anomaly blocked from settle
  await createDriverCollectionSettlement({
    courierId: 'c1',
    orders: [
      appCodOrder({
        id: 'blocked',
        payment: { method: 'WEIRD', financials: { customerTotal: 210 } },
      }),
    ],
    settledBy: 'admin-1',
  })
    .then(() => {
      throw new Error('expected ANOMALY_BLOCKED');
    })
    .catch((e: Error & { code?: string }) => {
      assert.equal(e.code, 'ANOMALY_BLOCKED');
    });

  // 14. Gross order total is not outstanding
  const enriched = enrichOrderWithDriverCollection(appCodOrder());
  assert.notEqual(enriched.outstandingAmount, enriched.orderTotal);
  assert.equal(enriched.outstandingAmount, 22);

  // FULL_CASH settle
  const { settlement: fullSettle } = await createDriverCollectionSettlement({
    courierId: 'c1',
    orders: [appCodOrder({ id: 'full-cash-1' })],
    settledBy: 'admin-1',
    settlementMode: 'FULL_CASH',
  });
  assert.equal(fullSettle.settlementBasisAmount, 210);
  assert.equal(fullSettle.settledAmount, 210);

  console.log('verify-driver-collections V3: OK');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
