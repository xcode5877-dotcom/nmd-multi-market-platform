#!/usr/bin/env npx tsx
/**
 * Driver attendance control — permission, accounting labels, period aggregation.
 * Run: pnpm --filter mock-api verify:driver-attendance
 */

import { prisma } from '../src/db.js';
import {
  businessDayKey,
  computeEarningsSummary,
  endShift,
  parseDateRange,
  setCourierCanStartShift,
  startShift,
} from '../src/courier-payroll.js';
import {
  deriveShiftAccountingStatus,
  serializeCourierShift,
} from '../src/courier-shift-api.js';
import { getDriverPayrollStatement } from '../src/courier-payroll-settlement.js';

const TEST_A = process.env.COURIER_ID_ATTEND ?? 'courier-attend-ctrl-a';
const TEST_MARKET = process.env.MARKET_ID ?? 'market-dabburiyya';
const ACTOR = 'user-test-admin-attend';

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
  await prisma.courierShift.deleteMany({ where: { courierId: TEST_A } });
  await prisma.driverPayrollAudit.deleteMany({ where: { courierId: TEST_A } });
  await prisma.courierPayrollSettlement.deleteMany({ where: { courierId: TEST_A } });
  await prisma.courierPayrollConfig.deleteMany({ where: { courierId: TEST_A } });
}

async function ensureCourier(): Promise<void> {
  const existing = await prisma.courier.findUnique({ where: { id: TEST_A } });
  if (existing) {
    await prisma.courier.update({
      where: { id: TEST_A },
      data: { isActive: true, canStartShift: false },
    });
    return;
  }
  await prisma.courier.create({
    data: {
      id: TEST_A,
      scopeType: 'MARKET',
      scopeId: TEST_MARKET,
      marketId: TEST_MARKET,
      name: 'Attendance Control Fixture',
      isActive: true,
      isOnline: false,
      capacity: 1,
      canStartShift: false,
    },
  });
}

async function main(): Promise<void> {
  console.log('verify-driver-attendance');
  await cleanup();
  await ensureCourier();

  console.log('\n--- Shift-start permission ---');
  let code = '';
  try {
    await startShift(TEST_A, TEST_MARKET);
  } catch (e) {
    code = (e as Error & { code?: string }).code ?? '';
  }
  assert(code === 'SHIFT_START_NOT_ALLOWED', 'disallowed courier cannot start');

  await setCourierCanStartShift({ courierId: TEST_A, canStartShift: true, actorUserId: ACTOR });
  const started = await startShift(TEST_A, TEST_MARKET);
  assert(!!started.id && !started.endTime, 'allowed courier can start');

  await setCourierCanStartShift({ courierId: TEST_A, canStartShift: false, actorUserId: ACTOR });
  const ended = await endShift(TEST_A);
  assert(!!ended.endTime, 'disabling permission does not block ending open shift');

  code = '';
  try {
    await startShift(TEST_A, TEST_MARKET);
  } catch (e) {
    code = (e as Error & { code?: string }).code ?? '';
  }
  assert(code === 'SHIFT_START_NOT_ALLOWED', 'after disable, new start blocked');

  const audits = await prisma.driverPayrollAudit.findMany({
    where: { courierId: TEST_A, action: 'SHIFT_START_PERMISSION_CHANGED' },
    orderBy: { createdAt: 'asc' },
  });
  assert(audits.length >= 2, 'permission changes write audit events');
  assert(audits.every((a) => a.userId === ACTOR), 'audit records actor admin id');

  console.log('\n--- Accounting status ---');
  const unaccounted = deriveShiftAccountingStatus(
    { startTime: '2026-08-18T08:00:00.000Z', endTime: '2026-08-18T13:06:00.000Z' },
    [],
    'COMPLETED'
  );
  assert(unaccounted === 'UNACCOUNTED', 'completed shift without settlement is UNACCOUNTED');

  const settled = deriveShiftAccountingStatus(
    { startTime: '2026-08-18T08:00:00.000Z', endTime: '2026-08-18T13:06:00.000Z' },
    [{ periodStart: '2026-08-01', periodEnd: '2026-08-31' }],
    'COMPLETED'
  );
  assert(settled === 'SETTLED', 'shift inside settlement window is SETTLED');

  const activeUnknown = deriveShiftAccountingStatus(
    { startTime: '2026-08-18T08:00:00.000Z', endTime: null },
    [],
    'ACTIVE'
  );
  assert(activeUnknown === 'UNKNOWN', 'active shift accounting is UNKNOWN');

  const labeled = serializeCourierShift({
    id: 's-acc',
    courierId: TEST_A,
    marketId: TEST_MARKET,
    startTime: '2026-08-18T08:00:00.000Z',
    endTime: '2026-08-18T13:06:00.000Z',
    durationMinutes: 306,
    autoClosed: false,
  });
  assert(labeled.accountingLabel === undefined, 'default serialization omits wage accounting labels');
  assert(labeled.workedMinutes === 306, '306 minutes not rounded to zero');
  assert((labeled as { domain?: string }).domain === 'attendance', 'shift domain is attendance');

  console.log('\n--- Mohammad Yasri class: period filter ---');
  // Fixture: August completed shift must appear in "all" and custom Aug window, not Sep week alone.
  await prisma.courierShift.create({
    data: {
      id: `cshift-yasri-class-${Date.now()}`,
      courierId: TEST_A,
      marketId: TEST_MARKET,
      startTime: '2026-08-18T08:00:00.000Z',
      endTime: '2026-08-18T13:06:00.000Z',
      durationMinutes: 306,
      createdAt: '2026-08-18T08:00:00.000Z',
    },
  });

  const day = businessDayKey('2026-08-18T08:00:00.000Z');
  assert(day === '2026-08-18', 'business day key Asia/Jerusalem for Aug shift');

  const allRange = parseDateRange('all');
  const allSummary = await computeEarningsSummary(TEST_A, allRange.from, allRange.to);
  assert(allSummary.hoursWorked >= 5.1, 'all-period includes August hours');

  const augSummary = await computeEarningsSummary(TEST_A, '2026-08-01', '2026-08-31');
  assert(Math.abs(augSummary.hoursWorked - 5.1) < 0.05, 'August custom window ≈ 5.1h');

  const sepSummary = await computeEarningsSummary(TEST_A, '2026-09-01', '2026-09-30');
  assert(sepSummary.hoursWorked === 0, 'September window correctly excludes August shift');

  const statement = await getDriverPayrollStatement(TEST_A);
  assert(
    statement.shifts.some((s) => s.workedMinutes === 306 && !('accountingLabel' in s && (s as { accountingLabel?: string }).accountingLabel)),
    'statement shows non-zero duration without wage accounting label'
  );
  assert((statement.hoursTotalMinutes ?? 0) >= 306, 'statement hoursTotalMinutes includes shift');

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
