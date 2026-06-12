#!/usr/bin/env npx tsx
/**
 * Driver Payroll Phase 1 / 1.5 verification.
 * Run: pnpm --filter mock-api verify:courier-payroll
 */

import { prisma } from '../src/db.js';
import { syncAdminDeliveredOrder } from '../src/delivery-status-sync.js';
import {
  addBonus,
  approveExpense,
  autoCloseStaleShifts,
  computeEarningsSummary,
  computeWorkedMinutes,
  endShift,
  extractOrderEarningsBase,
  getActiveShift,
  MAX_SHIFT_MINUTES,
  postCourierEarningsIfEligible,
  resolveOrderCommissionPercent,
  setTenantDriverCommissionOverride,
  startShift,
} from '../src/courier-payroll.js';

const TEST_COURIER = process.env.COURIER_ID ?? 'courier-payroll-test';
const TEST_MARKET = process.env.MARKET_ID ?? 'market-dabburiyya';
const TEST_TENANT_A = 'tenant-payroll-test-a';
const TEST_TENANT_B = 'tenant-payroll-test-b';

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

async function cleanup(): Promise<void> {
  await prisma.courierEarningsLedger.deleteMany({ where: { courierId: TEST_COURIER } });
  await prisma.courierShift.deleteMany({ where: { courierId: TEST_COURIER } });
  await prisma.courierExpense.deleteMany({ where: { courierId: TEST_COURIER } });
  await prisma.driverPayrollAudit.deleteMany({ where: { courierId: TEST_COURIER } });
  await prisma.courierPayrollConfig.deleteMany({ where: { courierId: TEST_COURIER } });
  await prisma.courierTenantCommissionOverride.deleteMany({
    where: { OR: [{ tenantId: TEST_TENANT_A }, { tenantId: TEST_TENANT_B }] },
  });
  await prisma.tenantDriverCommissionOverride.deleteMany({
    where: { OR: [{ tenantId: TEST_TENANT_A }, { tenantId: TEST_TENANT_B }] },
  });
}

async function ensureTestCourier(): Promise<void> {
  const existing = await prisma.courier.findUnique({ where: { id: TEST_COURIER } });
  if (existing) return;
  await prisma.courier.create({
    data: {
      id: TEST_COURIER,
      scopeType: 'MARKET',
      scopeId: TEST_MARKET,
      marketId: TEST_MARKET,
      name: 'Payroll Test Driver',
      isActive: true,
      isOnline: false,
      capacity: 1,
    },
  });
}

function runUnitTests(): void {
  console.log('\n--- Unit: extractOrderEarningsBase ---');
  const base = extractOrderEarningsBase({
    payment: { breakdown: { itemsTotal: 100, deliveryFee: 12 } },
    delivery: { fee: 12 },
  });
  assert(base.deliveryFee === 12, 'delivery fee from breakdown');
  assert(base.subtotalWithoutDelivery === 100, 'subtotal without delivery');
}

async function runIntegrationTests(): Promise<void> {
  console.log('\n--- Integration: shifts ---');
  await cleanup();
  await ensureTestCourier();

  const shift1 = await startShift(TEST_COURIER, TEST_MARKET);
  assert(!!shift1.id, 'start shift creates record');
  assert(shift1.endTime == null, 'active shift has no endTime');

  let threw = false;
  try {
    await startShift(TEST_COURIER, TEST_MARKET);
  } catch (e) {
    threw = (e as Error & { code?: string }).code === 'ACTIVE_SHIFT_EXISTS';
  }
  assert(threw, 'prevent double shift start');

  const ended = await endShift(TEST_COURIER);
  assert(ended.endTime != null, 'end shift sets endTime');
  assert((ended.durationMinutes ?? 0) >= 0, 'durationMinutes computed');

  threw = false;
  try {
    await endShift(TEST_COURIER);
  } catch (e) {
    threw = (e as Error & { code?: string }).code === 'NO_ACTIVE_SHIFT';
  }
  assert(threw, 'cannot end shift when none active');

  console.log('\n--- Integration: shift auto-close 16h ---');
  const staleStart = new Date(Date.now() - 17 * 60 * 60_000).toISOString();
  await prisma.courierShift.create({
    data: {
      id: `cshift-stale-${Date.now()}`,
      courierId: TEST_COURIER,
      marketId: TEST_MARKET,
      startTime: staleStart,
      createdAt: staleStart,
    },
  });
  const { closed } = await autoCloseStaleShifts(TEST_COURIER);
  assert(closed?.autoClosed === true, 'stale shift auto-closed');
  assert(closed?.durationMinutes === MAX_SHIFT_MINUTES, 'auto-close caps at 16h');
  const minutes = await computeWorkedMinutes(TEST_COURIER, staleStart.slice(0, 10), new Date().toISOString().slice(0, 10));
  assert(minutes <= MAX_SHIFT_MINUTES, 'worked minutes capped at 16h per stale shift');

  console.log('\n--- Integration: delivery earnings + commission ---');
  const orderId = `test-order-${Date.now()}`;
  const baseOrder = {
    id: orderId,
    status: 'COMPLETED',
    courierId: TEST_COURIER,
    marketId: TEST_MARKET,
    tenantId: TEST_TENANT_A,
    fulfillmentType: 'DELIVERY',
    payment: { breakdown: { itemsTotal: 100, deliveryFee: 12 } },
  };

  await postCourierEarningsIfEligible(baseOrder);

  const ledger = await prisma.courierEarningsLedger.findMany({
    where: { courierId: TEST_COURIER, referenceId: orderId },
  });
  const deliveryEntry = ledger.find((e) => e.type === 'DELIVERY_FEE');
  const commissionEntry = ledger.find((e) => e.type === 'ORDER_COMMISSION');
  assert(deliveryEntry?.amount === 12, 'delivery earnings = delivery fee (100% share)');
  assert(commissionEntry?.amount === 5, 'commission = 100 × 5% = 5');

  await postCourierEarningsIfEligible(baseOrder);
  const ledgerCount = await prisma.courierEarningsLedger.count({
    where: { courierId: TEST_COURIER, referenceId: orderId },
  });
  assert(ledgerCount === 2, 'completing same order twice does not double ledger');

  await postCourierEarningsIfEligible({
    ...baseOrder,
    status: 'DELIVERED',
    deliveryStatus: 'DELIVERED',
  });
  const afterFinishAttempt = await prisma.courierEarningsLedger.count({
    where: { courierId: TEST_COURIER, referenceId: orderId },
  });
  assert(afterFinishAttempt === 2, 'COMPLETED -> FINISH path does not double ledger');

  const adminSynced = syncAdminDeliveredOrder({
    ...baseOrder,
    status: 'DELIVERED',
    deliveryStatus: 'IN_PROGRESS',
  });
  await postCourierEarningsIfEligible(adminSynced);
  const afterAdminSync = await prisma.courierEarningsLedger.count({
    where: { courierId: TEST_COURIER, referenceId: orderId },
  });
  assert(afterAdminSync === 2, 'admin delivered sync does not double ledger');

  console.log('\n--- Integration: tenant commission override ---');
  await setTenantDriverCommissionOverride(TEST_TENANT_B, 7);
  const pctTenant = await resolveOrderCommissionPercent(TEST_COURIER, TEST_TENANT_B);
  assert(pctTenant === 7, 'tenant-wide override (7%) beats courier default');

  await setTenantDriverCommissionOverride(TEST_TENANT_A, 0);
  const pctZero = await resolveOrderCommissionPercent(TEST_COURIER, TEST_TENANT_A);
  assert(pctZero === 0, 'tenant override can be 0% (Qashtota-style)');

  const orderAshraf = `test-order-ashraf-${Date.now()}`;
  await setTenantDriverCommissionOverride(TEST_TENANT_A, 5);
  await setTenantDriverCommissionOverride(TEST_TENANT_A, 7, TEST_COURIER);
  await postCourierEarningsIfEligible({
    id: orderAshraf,
    status: 'COMPLETED',
    courierId: TEST_COURIER,
    tenantId: TEST_TENANT_A,
    marketId: TEST_MARKET,
    fulfillmentType: 'DELIVERY',
    payment: { breakdown: { itemsTotal: 100, deliveryFee: 10 } },
  });
  const ashrafCommission = await prisma.courierEarningsLedger.findFirst({
    where: { courierId: TEST_COURIER, referenceId: orderAshraf, type: 'ORDER_COMMISSION' },
  });
  assert(ashrafCommission?.amount === 7, 'per-courier tenant override (7%) beats tenant-wide (5%)');

  console.log('\n--- Integration: bonus + expense approval ---');
  await addBonus({ courierId: TEST_COURIER, amount: 50, reason: 'Test bonus' });
  await addBonus({ courierId: TEST_COURIER, amount: 25, reason: 'Second bonus' });
  const bonusRows = await prisma.courierEarningsLedger.findMany({
    where: { courierId: TEST_COURIER, type: 'BONUS' },
  });
  assert(bonusRows.length >= 2, 'bonus entries can repeat');

  const expenseId = `cexp-test-${Date.now()}`;
  await prisma.courierExpense.create({
    data: {
      id: expenseId,
      courierId: TEST_COURIER,
      marketId: TEST_MARKET,
      category: 'FUEL',
      amount: 30,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    },
  });
  await approveExpense(expenseId, 'admin-test');
  const approved = await prisma.courierExpense.findUnique({ where: { id: expenseId } });
  assert(approved?.status === 'APPROVED', 'expense approved');
  const expenseLedger = await prisma.courierEarningsLedger.findFirst({
    where: { courierId: TEST_COURIER, type: 'EXPENSE', referenceId: expenseId },
  });
  assert(expenseLedger?.amount === -30, 'approved expense creates negative ledger entry');

  const today = new Date().toISOString().slice(0, 10);
  const summary = await computeEarningsSummary(TEST_COURIER, today, today);
  assert(summary.deliveryEarnings >= 22, 'summary includes delivery earnings');
  assert(summary.commissionEarnings >= 5, 'summary includes commission');
  assert(summary.bonuses >= 75, 'summary includes bonuses');
  assert(summary.expenses >= 30, 'summary includes approved expenses');

  const audits = await prisma.driverPayrollAudit.count({ where: { courierId: TEST_COURIER } });
  assert(audits >= 4, 'audit events recorded');

  const active = await getActiveShift(TEST_COURIER);
  assert(active == null, 'no active shift after auto-close');
}

async function main(): Promise<void> {
  console.log('verify-courier-payroll');
  runUnitTests();
  await runIntegrationTests();
  await cleanup();
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
