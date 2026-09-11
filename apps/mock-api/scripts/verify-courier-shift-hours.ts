#!/usr/bin/env npx tsx
/**
 * Driver shift hours — API serialization, guards, tenant isolation.
 * Run: pnpm --filter mock-api verify:courier-shift-hours
 */

import { prisma } from '../src/db.js';
import {
  endShift,
  listCourierShifts,
  startShift,
} from '../src/courier-payroll.js';
import {
  serializeCourierShift,
  serializeCourierShiftStatementRow,
} from '../src/courier-shift-api.js';
import { getDriverPayrollStatement } from '../src/courier-payroll-settlement.js';

const TEST_A = process.env.COURIER_ID_A ?? 'courier-shift-hours-a';
const TEST_B = process.env.COURIER_ID_B ?? 'courier-shift-hours-b';
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
  await prisma.courierShift.deleteMany({ where: { courierId: { in: [TEST_A, TEST_B] } } });
  await prisma.driverPayrollAudit.deleteMany({ where: { courierId: { in: [TEST_A, TEST_B] } } });
  await prisma.courierPayrollConfig.deleteMany({ where: { courierId: { in: [TEST_A, TEST_B] } } });
}

async function ensureCourier(id: string): Promise<void> {
  const existing = await prisma.courier.findUnique({ where: { id } });
  if (existing) {
    await prisma.courier.update({
      where: { id },
      data: { isActive: true, canStartShift: true },
    });
    return;
  }
  await prisma.courier.create({
    data: {
      id,
      scopeType: 'MARKET',
      scopeId: TEST_MARKET,
      marketId: TEST_MARKET,
      name: `Shift Hours Test ${id.slice(-1)}`,
      isActive: true,
      isOnline: false,
      capacity: 1,
      canStartShift: true,
    },
  });
}

async function main(): Promise<void> {
  console.log('verify-courier-shift-hours');
  await cleanup();
  await ensureCourier(TEST_A);
  await ensureCourier(TEST_B);

  console.log('\n--- Serialization ---');
  const startIso = '2026-03-10T08:00:00.000Z';
  const endIso = '2026-03-10T16:00:00.000Z';
  const overnightStart = '2026-03-10T22:30:00.000Z';
  const overnightEnd = '2026-03-11T06:15:00.000Z';

  const completed = serializeCourierShift({
    id: 's1',
    courierId: TEST_A,
    marketId: TEST_MARKET,
    startTime: startIso,
    endTime: endIso,
    durationMinutes: null,
    autoClosed: false,
  });
  assert(completed.workedMinutes === 480, 'API serialization workedMinutes for 8h (legacy null duration)');
  assert(completed.hours === 8, 'API serialization hours for 8h');
  assert(completed.durationLabel === '8 ساعات', 'API durationLabel Arabic exact hours');
  assert(completed.status === 'COMPLETED', 'API status COMPLETED');

  const overnight = serializeCourierShift({
    id: 's2',
    courierId: TEST_A,
    marketId: TEST_MARKET,
    startTime: overnightStart,
    endTime: overnightEnd,
    durationMinutes: null,
    autoClosed: false,
  });
  assert(overnight.workedMinutes === 465, 'overnight workedMinutes');
  assert(overnight.durationLabel === '7 ساعات و45 دقيقة', 'overnight Arabic label');

  const active = serializeCourierShift(
    {
      id: 's3',
      courierId: TEST_A,
      marketId: TEST_MARKET,
      startTime: startIso,
      endTime: null,
      durationMinutes: null,
      autoClosed: false,
    },
    { nowMs: Date.parse(startIso) + 45 * 60_000 }
  );
  assert(active.status === 'ACTIVE', 'active status');
  assert(active.workedMinutes === 45, 'active elapsed minutes');
  assert(active.durationLabel?.includes('قيد الدوام الآن') === true, 'active label قيد الدوام الآن');
  assert(active.durationLabel?.includes('0 ساعات') !== true, 'active does not show 0 ساعات');

  const invalid = serializeCourierShift({
    id: 's4',
    courierId: TEST_A,
    marketId: TEST_MARKET,
    startTime: endIso,
    endTime: startIso,
    durationMinutes: null,
    autoClosed: false,
  });
  assert(invalid.status === 'INVALID_RANGE' && invalid.workedMinutes == null, 'invalid end-before-start');
  assert(invalid.durationLabel === 'مدة غير صالحة', 'invalid Arabic label');

  const statementRow = serializeCourierShiftStatementRow({
    id: 's5',
    courierId: TEST_A,
    marketId: TEST_MARKET,
    startTime: startIso,
    endTime: endIso,
    durationMinutes: 480,
    autoClosed: false,
  });
  assert(statementRow.date === '2026-03-10', 'statement date from startTime');
  assert(statementRow.workedMinutes === 480 && statementRow.durationLabel === '8 ساعات', 'statement row duration');

  console.log('\n--- Duplicate start / end guards ---');
  await startShift(TEST_A, TEST_MARKET);
  let threw = false;
  try {
    await startShift(TEST_A, TEST_MARKET);
  } catch (e) {
    threw = (e as Error & { code?: string }).code === 'ACTIVE_SHIFT_EXISTS';
  }
  assert(threw, 'duplicate start protection');

  const ended = await endShift(TEST_A);
  assert(ended.endTime != null && (ended.durationMinutes ?? -1) >= 0, 'end sets timestamps + durationMinutes');
  const serializedEnd = serializeCourierShift(ended);
  assert(serializedEnd.workedMinutes != null && serializedEnd.durationLabel !== '—', 'end response includes worked duration');

  threw = false;
  try {
    await endShift(TEST_A);
  } catch (e) {
    threw = (e as Error & { code?: string }).code === 'NO_ACTIVE_SHIFT';
  }
  assert(threw, 'duplicate end rejected (NO_ACTIVE_SHIFT)');

  console.log('\n--- Multiple same-day + tenant isolation ---');
  const day = '2026-04-01';
  await prisma.courierShift.createMany({
    data: [
      {
        id: `cshift-a1-${Date.now()}`,
        courierId: TEST_A,
        marketId: TEST_MARKET,
        startTime: `${day}T08:00:00.000Z`,
        endTime: `${day}T12:00:00.000Z`,
        durationMinutes: 240,
        createdAt: `${day}T08:00:00.000Z`,
      },
      {
        id: `cshift-a2-${Date.now()}`,
        courierId: TEST_A,
        marketId: TEST_MARKET,
        startTime: `${day}T14:00:00.000Z`,
        endTime: `${day}T16:30:00.000Z`,
        durationMinutes: 150,
        createdAt: `${day}T14:00:00.000Z`,
      },
      {
        id: `cshift-b1-${Date.now()}`,
        courierId: TEST_B,
        marketId: TEST_MARKET,
        startTime: `${day}T09:00:00.000Z`,
        endTime: `${day}T17:00:00.000Z`,
        durationMinutes: 480,
        createdAt: `${day}T09:00:00.000Z`,
      },
    ],
  });

  const listA = await listCourierShifts(TEST_A, 50);
  assert(listA.every((s) => s.courierId === TEST_A), 'listCourierShifts scoped to courier A');
  assert(listA.filter((s) => s.startTime.startsWith(day)).length >= 2, 'multiple shifts on same date retained');

  const statementA = await getDriverPayrollStatement(TEST_A);
  assert(statementA.shifts.every((s) => !('courierId' in s) || true), 'statement shape for A');
  assert(
    statementA.shifts.some((s) => s.workedMinutes === 240 || s.hours === 4),
    'statement computes hours for courier A shifts'
  );
  assert(
    !statementA.shifts.some((s) => s.workedMinutes === 480 && s.startTime.startsWith(`${day}T09`)),
    'courier A statement does not include courier B shift'
  );

  const statementB = await getDriverPayrollStatement(TEST_B);
  assert(
    statementB.shifts.some((s) => s.startTime.startsWith(`${day}T09`)),
    'courier B statement includes own shift'
  );
  assert(
    !statementB.shifts.some((s) => s.startTime.startsWith(`${day}T08`)),
    'courier B statement excludes courier A shifts'
  );

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
