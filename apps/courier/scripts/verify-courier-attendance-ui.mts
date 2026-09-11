#!/usr/bin/env npx tsx
/**
 * Courier attendance UI + auth gate checks (no embedded API key).
 * Run: pnpm --filter courier exec tsx scripts/verify-courier-attendance-ui.mts
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const assetsDir = resolve(dist, 'assets');
let passed = 0;
const assert = (c: boolean, m: string) => {
  if (!c) throw new Error(m);
  passed += 1;
  console.log('  ✓', m);
};

console.log('verify-courier-attendance-ui');
assert(existsSync(resolve(dist, 'index.html')), 'index.html exists');
const html = readFileSync(resolve(dist, 'index.html'), 'utf8');
assert(html.includes('/courier/assets/'), 'base /courier/assets');
const jsFiles = readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
const bundle = jsFiles.map((f) => readFileSync(resolve(assetsDir, f), 'utf8')).join('\n');
assert(bundle.includes('بدء الدوام'), 'start shift string');
assert(bundle.includes('سجل الدوام'), 'history string');
assert(bundle.includes('بدء الدوام غير مفعّل'), 'blocked message');
assert(bundle.includes('لا توجد ساعات ضمن هذه الفترة'), 'empty period explanation');
assert(bundle.includes('data-attendance-state') || bundle.includes('READY_BLOCKED') || bundle.includes('ACTIVE_SHIFT'), 'attendance states present');
assert(!bundle.includes('x-api-key'), 'no x-api-key in courier assets');
assert(!/getApiKey|VITE_API_KEY/.test(bundle), 'no VITE_API_KEY plumbing');
// hardcoded previous leaked key must not appear
assert(!bundle.includes('c522d724baaaf9a3213dcf17590f0fd8'), 'old leaked API key absent');
assert(bundle.includes('CourierAttendancePanel') || bundle.includes('الدوام'), 'attendance on bundle');
console.log(`\n${passed} passed`);
