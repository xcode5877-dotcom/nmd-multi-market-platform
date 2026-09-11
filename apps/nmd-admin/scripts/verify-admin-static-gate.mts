#!/usr/bin/env npx tsx
/**
 * Fails if production Admin dist is missing order ops, Home Builder, or driver hours.
 * Run after: VITE_MOCK_API_URL=https://nmd.marketing/api pnpm --filter nmd-admin build
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const assets = resolve(process.cwd(), 'dist/assets');
const files = readdirSync(assets).filter((f) => f.endsWith('.js'));
const read = (pred: (n: string) => boolean) => {
  const name = files.find(pred);
  if (!name) throw new Error(`missing asset matching ${pred}`);
  return readFileSync(resolve(assets, name), 'utf8');
};

let passed = 0;
const assert = (c: boolean, m: string) => {
  if (!c) throw new Error(m);
  passed += 1;
  console.log('  ✓', m);
};

console.log('verify-admin-static-gate');
const md = read((n) => n.startsWith('MarketDetailPage-'));
const ds = read((n) => n.startsWith('DriverStatementPage-'));
const hb = read((n) => n.startsWith('HomePageBuilderPage-'));
const api = read((n) => n.startsWith('api-'));

assert(md.includes('وقت الطلب'), 'order time visible');
assert(md.includes('إدارة الطلب') && md.includes('REMOVE_ITEM') && md.includes('إضافة منتج'), 'order product actions visible');
assert(ds.includes('durationLabel') && ds.includes('ساعات العمل'), 'driver hours statement UI');
assert(ds.includes('الحالة المحاسبية') || ds.includes('accountingLabel'), 'accounting status column');
assert(hb.includes('hydrate'), 'home builder hydration preserved');
assert(api.includes('nmd-access-token') && api.includes('Authorization'), 'upload/auth token client present');
assert(!api.includes('No token found in localStorage'), 'no legacy localStorage token error string');
assert(api.includes('https://nmd.marketing/api') || api.includes('/api'), 'API base configured');
console.log(`\n${passed} passed`);
