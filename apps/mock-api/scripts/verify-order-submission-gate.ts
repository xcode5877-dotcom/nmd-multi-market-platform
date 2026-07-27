/**
 * Production-hardening verification for order submission gate.
 * Run: pnpm exec tsx scripts/verify-order-submission-gate.ts
 */
import assert from 'node:assert/strict';
import {
  applySubmissionGateMetadata,
  assertGroupEditable,
  getTenantOrderSubmissionDelaySeconds,
  isAwaitingMerchantSubmission,
  isCancelledBeforeMerchantSubmission,
  isCardPaymentPending,
  isOrderVisibleToMerchant,
  normalizeOrderSubmissionDelaySeconds,
  readGateFields,
  summarizeEditingWindow,
  submitOrderToMerchant,
  DEFAULT_ORDER_SUBMISSION_DELAY_SECONDS,
  type MerchantSubmitDeps,
} from '../src/order-submission-gate.js';
import type { RegistryTenant } from '../src/store.js';
import type { OrderRecord, Repos } from '../src/repos/types.js';

function testNormalize() {
  assert.equal(normalizeOrderSubmissionDelaySeconds(90), 90);
  assert.equal(normalizeOrderSubmissionDelaySeconds(0), 0);
  assert.equal(normalizeOrderSubmissionDelaySeconds(45), DEFAULT_ORDER_SUBMISSION_DELAY_SECONDS);
}

function testLegacyVisibility() {
  const legacy: OrderRecord = { id: '1', status: 'PREPARING' };
  assert.equal(isAwaitingMerchantSubmission(legacy), false);
  assert.equal(isOrderVisibleToMerchant(legacy), true);
}

function testAwaiting() {
  const waiting: OrderRecord = {
    id: '2',
    submissionScheduledAt: new Date(Date.now() + 60_000).toISOString(),
    cancelledBeforeSubmission: false,
  };
  assert.equal(isAwaitingMerchantSubmission(waiting), true);
  assert.equal(isOrderVisibleToMerchant(waiting), false);
}

function testCancelled() {
  const cancelled: OrderRecord = {
    id: '4',
    cancelledBeforeSubmission: true,
    submissionScheduledAt: new Date().toISOString(),
  };
  assert.equal(isCancelledBeforeMerchantSubmission(cancelled), true);
  assert.equal(isOrderVisibleToMerchant(cancelled), false);
  assert.equal(isAwaitingMerchantSubmission(cancelled), false);
}

function testGateMetadata() {
  const now = new Date().toISOString();
  const base: OrderRecord = { id: 'o1', orderGroupId: 'g1' };
  const zero = applySubmissionGateMetadata(base, 0, now);
  assert.equal(zero.shouldSubmitNow, true);
  assert.ok(zero.order.submissionScheduledAt);
  assert.equal(zero.order.submittedAt, undefined);

  const delayed = applySubmissionGateMetadata(base, 90, now);
  assert.equal(delayed.shouldSubmitNow, false);
  assert.ok(delayed.order.submissionScheduledAt);
}

function testGroupGuard() {
  const submitted: OrderRecord[] = [
    { id: 'a', orderGroupId: 'g', customerId: 'c', submittedAt: new Date().toISOString(), submissionScheduledAt: new Date().toISOString() },
    { id: 'b', orderGroupId: 'g', customerId: 'c', submissionScheduledAt: new Date(Date.now() + 1000).toISOString() },
  ];
  const g = assertGroupEditable(submitted);
  assert.equal(g.ok, false);
  if (!g.ok) assert.equal(g.code, 'ORDER_ALREADY_SUBMITTED');

  const cancelled: OrderRecord[] = [
    { id: 'a', orderGroupId: 'g', cancelledBeforeSubmission: true, submissionScheduledAt: new Date().toISOString() },
  ];
  const c = assertGroupEditable(cancelled);
  assert.equal(c.ok, false);
  if (!c.ok) assert.equal(c.code, 'ORDER_ALREADY_CANCELLED');
}

function testCardPending() {
  const unpaid: OrderRecord = {
    id: 'c1',
    paymentMethod: 'CARD',
    payment: { method: 'CARD', status: 'PENDING' },
  };
  assert.equal(isCardPaymentPending(unpaid), true);
  const paid: OrderRecord = {
    id: 'c2',
    paymentMethod: 'CARD',
    payment: { method: 'CARD', status: 'CAPTURED' },
  };
  assert.equal(isCardPaymentPending(paid), false);
}

function testSummarizeServerNow() {
  const waiting: OrderRecord[] = [
    {
      id: 'a',
      orderGroupId: 'g',
      submissionScheduledAt: new Date(Date.now() + 90_000).toISOString(),
      revision: 1,
    },
  ];
  const sum = summarizeEditingWindow(waiting);
  assert.equal(sum.status, 'WAITING');
  assert.equal(sum.canEdit, true);
  assert.ok(sum.serverNow);
}

/** JSON-mode atomic claim: second submit does not notify twice. */
async function testJsonClaimIdempotent() {
  process.env.STORAGE_DRIVER = 'json';
  const store = new Map<string, OrderRecord>();
  const order: OrderRecord = {
    id: 'race-1',
    tenantId: 't1',
    orderGroupId: 'g',
    submissionScheduledAt: new Date().toISOString(),
    cancelledBeforeSubmission: false,
    paymentMethod: 'CASH',
    fulfillmentType: 'PICKUP',
    total: 10,
  };
  store.set('race-1', order);

  const repos = {
    orders: {
      findAll: async () => [...store.values()],
      update: async (o: OrderRecord) => {
        store.set(String(o.id), { ...o });
      },
    },
    tenants: {
      findAll: async () => [{ id: 't1', name: 'T' } as RegistryTenant],
    },
    couriers: { findAll: async () => [] },
  } as unknown as Repos;

  let notifyCount = 0;
  const deps: MerchantSubmitDeps = {
    notifyMerchantNewOrder: () => {
      notifyCount += 1;
    },
    sendFCMToTenantForNewOrder: async () => {},
    emitOrderAvailableForMarket: () => {},
  };

  const a = await submitOrderToMerchant('race-1', undefined, repos, deps);
  const b = await submitOrderToMerchant('race-1', undefined, repos, deps);
  assert.equal(a.submitted, true);
  assert.equal(b.submitted, false);
  assert.equal(b.reason, 'ALREADY_SUBMITTED');
  assert.equal(notifyCount, 1);
  assert.ok(readGateFields(store.get('race-1')!).submittedAt);
}

async function main() {
  testNormalize();
  assert.equal(getTenantOrderSubmissionDelaySeconds(undefined), 60);
  testLegacyVisibility();
  testAwaiting();
  testCancelled();
  testGateMetadata();
  testGroupGuard();
  testCardPending();
  testSummarizeServerNow();
  await testJsonClaimIdempotent();
  console.log('verify-order-submission-gate: OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
