/**
 * Verifies Driver Collections V2 accounting (no server required).
 *
 * External: food 200 + delivery 10 → collection 10
 * App: food 200 + delivery 10 + commission 12 → collection 22
 */
import assert from 'node:assert/strict';
import {
  aggregateDriverCollections,
  computeDriverCollectionAmount,
  createDriverCollectionSettlement,
  enrichOrderWithDriverCollection,
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
    payment: { breakdown: { itemsTotal: 0, deliveryFee: 10 }, financials: { customerTotal: 10 } },
    createdAt: '2026-07-26T10:00:00.000Z',
    ...overrides,
  };
}

function appOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'app-1',
    courierId: 'c1',
    status: 'COMPLETED',
    isExternal: false,
    total: 222,
    platformFee: 12,
    delivery: { fee: 10 },
    payment: {
      breakdown: { itemsTotal: 200, deliveryFee: 10, platformFee: 12 },
      financials: { customerTotal: 222, platformFee: 12, gross: 222 },
    },
    createdAt: '2026-07-26T11:00:00.000Z',
    ...overrides,
  };
}

function run() {
  const ext = computeDriverCollectionAmount(externalOrder());
  assert.equal(ext.deliveryFee, 10);
  assert.equal(ext.platformCommission, 0);
  assert.equal(ext.driverCollectionAmount, 10);
  assert.ok(ext.driverCollectionAmount !== 200);

  const app = computeDriverCollectionAmount(appOrder());
  assert.equal(app.deliveryFee, 10);
  assert.equal(app.platformCommission, 12);
  assert.equal(app.driverCollectionAmount, 22);
  assert.equal(app.orderTotal, 222);
  assert.equal(app.restaurantShare, 200);

  const refunded = computeDriverCollectionAmount(
    appOrder({ id: 'app-refund', status: 'REFUNDED' })
  );
  assert.equal(refunded.driverCollectionAmount, 0);

  const cancelled = computeDriverCollectionAmount(
    externalOrder({ id: 'ext-cancel', status: 'CANCELLED' })
  );
  assert.equal(cancelled.driverCollectionAmount, 0);

  const multi = [externalOrder(), appOrder({ id: 'app-2' }), appOrder({ id: 'app-3', platformFee: 12 })];
  const [summary] = aggregateDriverCollections(
    multi,
    [{ id: 'c1', name: 'Ahmed' }],
    { filters: {}, today: '2026-07-26' }
  );
  assert.equal(summary.completedOrders, 3);
  assert.equal(summary.externalOrders, 1);
  assert.equal(summary.appOrders, 2);
  assert.equal(summary.deliveryFeesTotal, 30);
  assert.equal(summary.platformCommissionTotal, 24);
  assert.equal(summary.driverCollectionTotal, 54);
  assert.equal(
    summary.driverCollectionTotal,
    summary.deliveryFeesTotal + summary.platformCommissionTotal
  );

  // Settlement flow (store append) — uses in-memory store
  const pendingOrders = [
    externalOrder({ id: 'settle-ext' }),
    appOrder({ id: 'settle-app' }),
  ];
  return createDriverCollectionSettlement({
    courierId: 'c1',
    orders: pendingOrders,
    settledBy: 'admin-1',
    settlementReference: 'REF-1',
    settlementNotes: 'Morning handover',
    shiftLabel: 'Morning',
  }).then(({ settlement, updatedOrders }) => {
    assert.equal(settlement.status, 'SETTLED');
    assert.equal(settlement.amount, 32);
    assert.equal(settlement.ordersCount, 2);
    assert.equal(settlement.settledBy, 'admin-1');
    assert.equal(settlement.settlementReference, 'REF-1');
    assert.ok(settlement.settledAt);

    for (const o of updatedOrders) {
      const meta = readOrderSettlementMeta(o);
      assert.equal(meta.settlementStatus, 'SETTLED');
      assert.equal(meta.settlementId, settlement.id);
    }

    const after = enrichOrderWithDriverCollection(updatedOrders[0]);
    assert.equal(after.settlementStatus, 'SETTLED');

    // History preserved: second settle on already-settled should find no pending
    return createDriverCollectionSettlement({
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
  }).then(() => {
    console.log('verify-driver-collections: OK');
  });
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
