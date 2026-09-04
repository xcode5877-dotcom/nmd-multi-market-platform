/**
 * Super Admin order-ops UI integrity checks (fixtures only — no production I/O).
 * Covers timestamp formatting, role/status gates, and wiring presence for
 * remove/add (change) product controls. Does not mutate live orders.
 *
 * Run: node --experimental-strip-types apps/nmd-admin/scripts/verify-order-ops-ui.mts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canManageOrderItems,
  formatDateTimeGregorian,
  formatRelativeTimeAr,
  getOrderManagementBlockReason,
  isOrderManagementEditable,
  isValidOrderManagementReason,
} from '@nmd/core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const adminSrc = join(__dirname, '..', 'src');

let passed = 0;
function check(cond: boolean, name: string) {
  assert.ok(cond, name);
  passed += 1;
  console.log('PASS', name);
}

function testTimestampFormatting() {
  const iso = '2026-09-04T08:15:00.000Z';
  const formatted = formatDateTimeGregorian(iso);
  check(formatted.includes('/'), 'datetime has date separators');
  check(/\d{2}:\d{2}/.test(formatted), 'datetime includes HH:mm');
  check(formatDateTimeGregorian('not-a-date') === '—', 'invalid timestamp falls back to em dash');
  check(formatRelativeTimeAr('not-a-date') === '—', 'invalid relative time falls back');
  const recent = formatRelativeTimeAr(new Date(Date.now() -  thrMinutes(5)).toISOString());
  check(recent.includes('منذ') || recent === 'الآن', 'relative Arabic formatting');
}

function thrMinutes(n: number) {
  return n * 60_000;
}

function testRoleGates() {
  check(canManageOrderItems('ROOT_ADMIN'), 'ROOT_ADMIN can manage items');
  check(canManageOrderItems('SUPER_ADMIN'), 'SUPER_ADMIN can manage items');
  check(!canManageOrderItems('MARKET_ADMIN'), 'MARKET_ADMIN cannot manage items');
  check(!canManageOrderItems('TENANT_ADMIN'), 'TENANT_ADMIN cannot manage items');
  check(!canManageOrderItems('CUSTOMER'), 'CUSTOMER cannot manage items');
  check(!canManageOrderItems(undefined), 'missing role cannot manage items');
}

function testStatusGates() {
  for (const s of ['PENDING', 'CONFIRMED', 'ACCEPTED', 'PREPARING']) {
    check(isOrderManagementEditable(s), `${s} editable`);
    check(getOrderManagementBlockReason(s) === null, `${s} no block reason`);
  }
  for (const s of ['READY', 'OUT_FOR_DELIVERY', 'COMPLETED', 'DELIVERED', 'CANCELLED', 'REJECTED']) {
    check(!isOrderManagementEditable(s), `${s} blocked`);
    check(!!getOrderManagementBlockReason(s), `${s} has block reason`);
  }
  check(isValidOrderManagementReason('CORRECTION'), 'CORRECTION reason valid');
  check(!isValidOrderManagementReason('HACK'), 'invalid reason rejected');
}

function testRemoveReplacePayloadShapes() {
  // Canonical ops used by OrderManagementPanel — remove line + add product (change/replace)
  const removeOp = { type: 'REMOVE_ITEM', itemId: 'item-fixture-1' };
  const addOp = {
    type: 'ADD_ITEM',
    productId: 'prod-fixture-2',
    quantity: 1,
    selectedOptions: [],
  };
  check(removeOp.type === 'REMOVE_ITEM' && !!removeOp.itemId, 'REMOVE_ITEM payload shape');
  check(addOp.type === 'ADD_ITEM' && !!addOp.productId, 'ADD_ITEM (change/replace) payload shape');
  check(isOrderManagementEditable('PENDING'), 'eligible state for remove/add');
  check(!isOrderManagementEditable('COMPLETED'), 'protected state rejects mutation');
}

function testSourceWiring() {
  const panel = readFileSync(join(adminSrc, 'components/orders/OrderManagementPanel.tsx'), 'utf8');
  check(panel.includes('REMOVE_ITEM'), 'panel wires REMOVE_ITEM');
  check(panel.includes('ADD_ITEM'), 'panel wires ADD_ITEM');
  check(panel.includes('إزالة'), 'panel has remove control label');
  check(panel.includes('إضافة منتج'), 'panel has add/change product control');
  check(panel.includes('التعديل غير متاح لهذه الحالة'), 'panel explains ineligible state');
  check(panel.includes('setPending'), 'panel requires confirmation pending state');
  check(panel.includes('api.manageOrder'), 'panel uses canonical manageOrder API');

  const market = readFileSync(join(adminSrc, 'pages/MarketDetailPage.tsx'), 'utf8');
  check(market.includes('OrderManagementPanel'), 'MarketDetail mounts OrderManagementPanel');
  check(market.includes('وقت الطلب'), 'MarketDetail shows order time label');
  check(market.includes('formatDateTimeGregorian'), 'MarketDetail uses datetime formatter');
  check(market.includes('formatRelativeTimeAr'), 'MarketDetail uses relative formatter');
  check(!market.includes('CUSTOMER_RISK_LEVEL'), 'MarketDetail does not pull unrelated trust UI');

  const dispatch = readFileSync(join(adminSrc, 'pages/MarketDispatchPage.tsx'), 'utf8');
  check(dispatch.includes('وقت الطلب'), 'Dispatch shows order time column');
  check(dispatch.includes('formatDateTimeGregorian'), 'Dispatch uses datetime formatter');

  const drawer = readFileSync(join(adminSrc, 'components/orders/OrderPlatformOpsDrawer.tsx'), 'utf8');
  check(drawer.includes('وقت الطلب'), 'Ops drawer shows order time');
  check(drawer.includes('formatDateTimeGregorian'), 'Ops drawer uses datetime formatter');
}

function testHomeBuilderStillPresent() {
  const hb = readFileSync(join(adminSrc, 'pages/HomePageBuilderPage.tsx'), 'utf8');
  check(hb.includes('canSaveHomeBuilderLayout'), 'Home Builder save gate present');
  check(hb.includes('تعذر تحميل ترتيب الصفحة الرئيسية'), 'Home Builder load-error copy present');
  const hyd = readFileSync(join(adminSrc, 'lib/homeBuilderHydration.ts'), 'utf8');
  check(hyd.includes('shouldApplyHomeBuilderServerBlocks'), 'Home Builder hydration helper present');
}

testTimestampFormatting();
testRoleGates();
testStatusGates();
testRemoveReplacePayloadShapes();
testSourceWiring();
testHomeBuilderStillPresent();
console.log(`\nOK ${passed} checks passed`);
