#!/usr/bin/env npx tsx
/**
 * Driver Payroll Phase 2 verification.
 * Run: pnpm --filter mock-api verify:courier-payroll-phase2
 */

import { prisma } from '../src/db.js';
import { postCourierEarningsIfEligible } from '../src/courier-payroll.js';
import {
  buildSettlementPayslipHtml,
  payslipContainsRequiredFields,
} from '../src/courier-payroll-payslip.js';
import {
  computeOutstandingBalance,
  createPayrollSettlement,
  getDriverPayrollStatement,
  previewPayrollSettlement,
} from '../src/courier-payroll-settlement.js';

const TEST_COURIER = process.env.COURIER_ID ?? 'courier-payroll-p2-test';
const TEST_MARKET = process.env.MARKET_ID ?? 'market-dabburiyya';

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
  await prisma.courierPayrollSettlement.deleteMany({ where: { courierId: TEST_COURIER } });
  await prisma.courierEarningsLedger.deleteMany({ where: { courierId: TEST_COURIER } });
  await prisma.courierPayrollConfig.deleteMany({ where: { courierId: TEST_COURIER } });
  await prisma.driverPayrollAudit.deleteMany({ where: { courierId: TEST_COURIER } });
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
      name: 'Payroll P2 Test',
      isActive: true,
      isOnline: false,
      capacity: 1,
    },
  });
}

async function runTests(): Promise<void> {
  await cleanup();
  await ensureTestCourier();

  console.log('\n--- Null courier protection ---');
  const orderId = `p2-order-${Date.now()}`;
  await postCourierEarningsIfEligible({
    id: orderId,
    status: 'COMPLETED',
    courierId: null,
    fulfillmentType: 'DELIVERY',
    payment: { breakdown: { itemsTotal: 100, deliveryFee: 12 } },
  });
  await postCourierEarningsIfEligible({
    id: `${orderId}-2`,
    status: 'COMPLETED',
    courierId: '',
    fulfillmentType: 'DELIVERY',
    payment: { breakdown: { itemsTotal: 100, deliveryFee: 12 } },
  });
  const nullLedger = await prisma.courierEarningsLedger.count({
    where: { referenceId: { in: [orderId, `${orderId}-2`] } },
  });
  assert(nullLedger === 0, 'no ledger when courierId is null or empty');

  console.log('\n--- Settlement creation ---');
  const earnOrderId = `p2-earn-${Date.now()}`;
  await postCourierEarningsIfEligible({
    id: earnOrderId,
    status: 'COMPLETED',
    courierId: TEST_COURIER,
    marketId: TEST_MARKET,
    fulfillmentType: 'DELIVERY',
    payment: { breakdown: { itemsTotal: 200, deliveryFee: 20 } },
  });

  const today = new Date().toISOString().slice(0, 10);
  const beforeOutstanding = await computeOutstandingBalance(TEST_COURIER);
  assert(beforeOutstanding > 0, 'outstanding balance positive before settlement');

  const preview = await previewPayrollSettlement(TEST_COURIER, today, today);
  assert(preview.netAmount > 0, 'preview shows net amount');

  const { settlement, outstandingBalance } = await createPayrollSettlement({
    courierId: TEST_COURIER,
    marketId: TEST_MARKET,
    periodStart: today,
    periodEnd: today,
    notes: 'Phase 2 test',
    createdBy: 'admin-test',
  });
  assert(settlement.netAmount === preview.netAmount, 'settlement net matches preview');
  assert(outstandingBalance < beforeOutstanding, 'outstanding reduced after settlement');

  const ledgerAfter = await prisma.courierEarningsLedger.count({ where: { courierId: TEST_COURIER } });
  assert(ledgerAfter >= 2, 'ledger rows unchanged after settlement');

  console.log('\n--- Driver statement ---');
  const statement = await getDriverPayrollStatement(TEST_COURIER);
  assert(statement.earnings.length >= 2, 'statement includes earnings');
  assert(statement.settlements.length >= 1, 'statement includes settlements');
  assert(typeof statement.outstandingBalance === 'number', 'statement has outstanding');

  console.log('\n--- PDF / payslip HTML ---');
  const html = buildSettlementPayslipHtml(settlement, { name: 'Payroll P2 Test', phone: '0500000000' });
  assert(payslipContainsRequiredFields(html, settlement), 'payslip HTML has required fields');
  assert(html.includes('dir="rtl"'), 'payslip is RTL');
  assert(html.includes('طباعة'), 'payslip has print button');
}

async function main(): Promise<void> {
  console.log('verify-courier-payroll-phase2');
  await runTests();
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
