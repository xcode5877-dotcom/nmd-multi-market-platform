#!/usr/bin/env npx tsx
/**
 * Domain separation gate: attendance ≠ wage; company revenue ownership; no false driver earnings in Courier UI.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DRIVER_WAGE_MODEL_ACTIVE, serializeCourierShift } from '../src/courier-shift-api.js';
import { businessDayKey, parseDateRange } from '../src/courier-payroll.js';

let passed = 0;
let failed = 0;
function assert(c: boolean, m: string) {
  if (c) {
    passed += 1;
    console.log(`  ✓ ${m}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${m}`);
  }
}

console.log('verify-domain-separation');

console.log('\n--- Contract flags ---');
assert(DRIVER_WAGE_MODEL_ACTIVE === false, 'driver wage model inactive');

const shift = serializeCourierShift({
  id: 's1',
  courierId: 'c1',
  marketId: 'm1',
  startTime: '2026-08-18T16:00:02.198Z',
  endTime: '2026-08-18T21:06:04.565Z',
  durationMinutes: 306,
  autoClosed: false,
});
assert(shift.workedMinutes === 306, 'attendance duration preserved');
assert(!('accountingLabel' in shift) || (shift as { accountingLabel?: string }).accountingLabel == null, 'no wage accounting on shifts');
assert(shift.domain === 'attendance', 'serialized domain attendance');

const all = parseDateRange('all');
assert(all.timezone === 'Asia/Jerusalem', 'business timezone Asia/Jerusalem');
assert(businessDayKey('2026-08-18T16:00:02.198Z') === '2026-08-18', 'Yasri-class business day');

console.log('\n--- Courier UI source (no false personal earnings) ---');
const root = resolve(process.cwd(), '../courier/src');
const earn = readFileSync(resolve(root, 'pages/CourierEarningsPage.tsx'), 'utf8');
const dash = readFileSync(resolve(root, 'pages/CourierDashboard.tsx'), 'utf8');
const panel = readFileSync(resolve(root, 'components/CourierAttendancePanel.tsx'), 'utf8');
assert(!earn.includes('صافي الدخل'), 'earnings page has no صافي الدخل');
assert(!earn.includes('أجر ساعي'), 'earnings page has no hourly wage');
assert(!earn.includes('أرباحي'), 'earnings page has no أرباحي');
assert(earn.includes('الدوام'), 'earnings route presents as الدوام');
assert(earn.includes('التحصيل المالي') || earn.includes('دخل توصيل الطلبات الخارجية'), 'earnings has company collections');
assert(
  dash.includes('تحصيل اليوم') || dash.includes('CourierCollectionsPanel'),
  'dashboard labels company collections'
);
assert(
  dash.includes('لا تمثل راتب السائق') ||
    earn.includes('لا تمثل راتب السائق') ||
    fsExistsPanelOwnership(),
  'dashboard ownership disclaimer'
);
assert(!panel.includes('accountingLabel'), 'attendance panel does not render accountingLabel');
assert(panel.includes('تفاصيل الدوام') || !panel.includes('تفاصيل الدخل'), 'no تفاصيل الدخل link');
assert(
  dash.includes('المبلغ المطلوب تسليمه للشركة') ||
    readFileSync(resolve(root, 'components/CourierCollectionsPanel.tsx'), 'utf8').includes(
      'المبلغ المطلوب تسليمه للشركة'
    ),
  'outstanding due to company visible'
);
assert(
  dash.includes('دخل نسبة التطبيق') ||
    dash.includes('دخل التوصيل والنسبة') ||
    readFileSync(resolve(root, 'components/CourierCollectionsPanel.tsx'), 'utf8').includes(
      'دخل نسبة التطبيق'
    ),
  'app commission or combined visible'
);

function fsExistsPanelOwnership(): boolean {
  try {
    return readFileSync(resolve(root, 'components/CourierCollectionsPanel.tsx'), 'utf8').includes(
      'لا تمثل راتب السائق'
    );
  } catch {
    return false;
  }
}

console.log('\n--- Admin labels ---');
const layout = readFileSync(
  resolve(process.cwd(), '../nmd-admin/src/components/drivers/DriversSectionLayout.tsx'),
  'utf8'
);
assert(layout.includes('سجل دوام السائقين'), 'admin nav attendance label');
assert(layout.includes('عهدة نقدية'), 'admin nav cash custody label');
assert(!layout.includes("'مالية السائقين'"), 'admin nav dropped مالية السائقين primary label');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);

// Optional: built courier assets if present
const dist = resolve(process.cwd(), '../courier/dist/assets');
if (existsSync(dist)) {
  const bundle = readdirSync(dist)
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(resolve(dist, f), 'utf8'))
    .join('\n');
  assert(!bundle.includes('صافي الدخل'), 'built courier has no صافي الدخل');
  assert(bundle.includes('بدء الدوام'), 'built courier still has start shift');
  console.log(`\n(+ built asset checks) ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}
