#!/usr/bin/env npx tsx
/**
 * Unit tests for driver shift duration helpers.
 * Run: pnpm --filter @nmd/core exec tsx scripts/verify-shift-duration.ts
 */

import {
  formatWorkedDurationAr,
  resolveShiftWorkedMinutes,
} from '../src/utils/shift-duration.ts';

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

const t0 = Date.parse('2026-01-01T10:00:00.000Z');
const t8h = t0 + 8 * 60 * 60_000;
const t7h30 = t0 + 7.5 * 60 * 60_000;
const t45m = t0 + 45 * 60_000;
const overnightEnd = Date.parse('2026-01-02T06:15:00.000Z');
const overnightStart = Date.parse('2026-01-01T22:30:00.000Z');

console.log('verify-shift-duration');

const eightHour = resolveShiftWorkedMinutes({
  startTime: new Date(t0).toISOString(),
  endTime: new Date(t8h).toISOString(),
});
assert(eightHour.status === 'COMPLETED' && eightHour.workedMinutes === 480, 'completed 8-hour shift');

const hm = resolveShiftWorkedMinutes({
  startTime: new Date(t0).toISOString(),
  endTime: new Date(t7h30).toISOString(),
});
assert(hm.workedMinutes === 450, 'shift with hours and minutes (7h30)');

const short = resolveShiftWorkedMinutes({
  startTime: new Date(t0).toISOString(),
  endTime: new Date(t45m).toISOString(),
});
assert(short.workedMinutes === 45, 'shift shorter than one hour');

const overnight = resolveShiftWorkedMinutes({
  startTime: new Date(overnightStart).toISOString(),
  endTime: new Date(overnightEnd).toISOString(),
});
assert(overnight.workedMinutes === 7 * 60 + 45, 'overnight shift');

const active = resolveShiftWorkedMinutes({
  startTime: new Date(t0).toISOString(),
  endTime: null,
  nowMs: t0 + 90 * 60_000,
});
assert(active.status === 'ACTIVE' && active.workedMinutes === 90, 'active shift without end time');

const missingStart = resolveShiftWorkedMinutes({ startTime: null, endTime: new Date(t8h).toISOString() });
assert(missingStart.status === 'MISSING_START' && missingStart.workedMinutes == null, 'missing start time');

const invalid = resolveShiftWorkedMinutes({
  startTime: new Date(t8h).toISOString(),
  endTime: new Date(t0).toISOString(),
});
assert(invalid.status === 'INVALID_RANGE' && invalid.workedMinutes == null, 'invalid end-before-start');

const legacy = resolveShiftWorkedMinutes({
  startTime: new Date(t0).toISOString(),
  endTime: new Date(t8h).toISOString(),
  durationMinutes: null,
});
assert(legacy.workedMinutes === 480, 'legacy completed: compute from timestamps when durationMinutes null');

const prefersTimestamps = resolveShiftWorkedMinutes({
  startTime: new Date(t0).toISOString(),
  endTime: new Date(t8h).toISOString(),
  durationMinutes: 999,
});
assert(prefersTimestamps.workedMinutes === 480, 'timestamps authoritative over stored durationMinutes');

const sameDayA = resolveShiftWorkedMinutes({
  startTime: '2026-03-10T08:00:00.000Z',
  endTime: '2026-03-10T12:00:00.000Z',
});
const sameDayB = resolveShiftWorkedMinutes({
  startTime: '2026-03-10T14:00:00.000Z',
  endTime: '2026-03-10T16:30:00.000Z',
});
assert(sameDayA.workedMinutes === 240 && sameDayB.workedMinutes === 150, 'multiple shifts on the same date');

// Display timezone must not change elapsed duration (same UTC instants).
const israelDisplayStart = new Date('2026-01-01T22:30:00.000Z');
const israelDisplayEnd = new Date('2026-01-02T06:15:00.000Z');
const fromUtc = resolveShiftWorkedMinutes({
  startTime: israelDisplayStart.toISOString(),
  endTime: israelDisplayEnd.toISOString(),
});
const fromLocalStrings = resolveShiftWorkedMinutes({
  startTime: israelDisplayStart.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }),
  endTime: israelDisplayEnd.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }),
});
// Local string parse is environment-dependent; assert ISO path is stable regardless of TZ display.
assert(fromUtc.workedMinutes === 465, 'timezone display does not change UTC elapsed duration');
void fromLocalStrings;

assert(formatWorkedDurationAr(45) === '45 دقيقة', 'Arabic format under one hour');
assert(formatWorkedDurationAr(480) === '8 ساعات', 'Arabic format exact hours');
assert(formatWorkedDurationAr(450) === '7 ساعات و30 دقيقة', 'Arabic format hours and minutes');
assert(formatWorkedDurationAr(null, { active: true }) === 'قيد الدوام الآن', 'active label without zero hours');
assert(formatWorkedDurationAr(30, { active: true }).includes('قيد الدوام الآن'), 'active with elapsed includes status');
assert(formatWorkedDurationAr(null, { invalid: true }) === 'مدة غير صالحة', 'invalid label');
assert(!formatWorkedDurationAr(null, { active: true }).includes('0'), 'active does not show 0 ساعات');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
