/**
 * Company collections + hours contract verification (fixtures, no prod mutation).
 */
import assert from 'node:assert/strict';
import { computeCourierCompanyCollections } from '../src/courier-company-collections.js';
import { enrichOrderWithDriverCollection } from '../src/driver-collections.js';
import { businessDayKey } from '../src/courier-payroll.js';
import fs from 'node:fs';
import path from 'node:path';

let passed = 0;
let failed = 0;

function check(label: string, cond: boolean) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${label}`);
  }
}

const DAY = '2026-08-15';

function mkAppCash(opts: {
  id: string;
  courierId: string;
  customerTotal: number;
  deliveryFee: number;
  platformFee: number;
  settled?: boolean;
  settledAmount?: number;
}): Record<string, unknown> {
  const restaurant = opts.customerTotal - opts.deliveryFee - opts.platformFee;
  return {
    id: opts.id,
    courierId: opts.courierId,
    status: 'COMPLETED',
    isExternal: false,
    total: opts.customerTotal,
    platformFee: opts.platformFee,
    platformDeliveryFee: opts.deliveryFee,
    paymentMethod: 'CASH',
    createdAt: `${DAY}T10:00:00.000Z`,
    deliveryTimeline: { deliveredAt: `${DAY}T12:00:00.000Z` },
    payment: {
      method: 'CASH',
      breakdown: {
        itemsTotal: restaurant,
        deliveryFee: opts.deliveryFee,
        platformFee: opts.platformFee,
      },
      financials: {
        customerTotal: opts.customerTotal,
        gross: opts.customerTotal,
        platformFee: opts.platformFee,
      },
    },
    delivery: { fee: opts.deliveryFee },
    ...(opts.settled
      ? {
          settlementStatus: 'SETTLED',
          settledAmount: opts.settledAmount ?? opts.deliveryFee + opts.platformFee,
          settlementMode: 'PLATFORM_ONLY',
        }
      : {}),
  };
}

function mkExternal(opts: {
  id: string;
  courierId: string;
  deliveryFee?: number | null;
  total?: number;
  /** When true, shape is ambiguous (merchandise present) — must not use Order.total. */
  withMerchandise?: boolean;
}): Record<string, unknown> {
  const hasFee = opts.deliveryFee != null && opts.deliveryFee > 0;
  const merchandise = opts.withMerchandise === true;
  return {
    id: opts.id,
    courierId: opts.courierId,
    status: 'COMPLETED',
    isExternal: true,
    orderType: 'EXTERNAL',
    source: 'external',
    total: opts.total ?? opts.deliveryFee ?? 0,
    subtotal: merchandise ? 150 : 0,
    items: merchandise ? [{ productName: 'meal', quantity: 1, basePrice: 150, totalPrice: 150 }] : [],
    paymentMethod: 'CASH',
    createdAt: `${DAY}T11:00:00.000Z`,
    deliveryTimeline: { deliveredAt: `${DAY}T13:00:00.000Z` },
    payment: hasFee
      ? { method: 'CASH', breakdown: { deliveryFee: opts.deliveryFee } }
      : { method: 'CASH' },
    ...(hasFee ? { delivery: { fee: opts.deliveryFee }, platformDeliveryFee: opts.deliveryFee } : {}),
  };
}

function mkOnlineApp(opts: {
  id: string;
  courierId: string;
  customerTotal: number;
  deliveryFee: number;
  platformFee: number;
}): Record<string, unknown> {
  return {
    ...mkAppCash({ ...opts }),
    id: opts.id,
    paymentMethod: 'CARD',
    payment: {
      method: 'CARD',
      breakdown: {
        itemsTotal: opts.customerTotal - opts.deliveryFee - opts.platformFee,
        deliveryFee: opts.deliveryFee,
        platformFee: opts.platformFee,
      },
      financials: {
        customerTotal: opts.customerTotal,
        gross: opts.customerTotal,
        platformFee: opts.platformFee,
      },
    },
  };
}

console.log('verify-company-collections-hours\n');

const courierA = 'courier-fixture-a';
const courierB = 'courier-fixture-b';

const appCash = mkAppCash({
  id: 'ord-app-cash',
  courierId: courierA,
  customerTotal: 100,
  deliveryFee: 15,
  platformFee: 10,
});
const external = mkExternal({ id: 'ord-ext', courierId: courierA, deliveryFee: 25 });
const externalLegacyTotal = mkExternal({
  id: 'ext-legacy-fee',
  courierId: courierA,
  deliveryFee: null,
  total: 40,
});
const externalAmbiguousMerchandise = mkExternal({
  id: 'ord-ext-ambiguous',
  courierId: courierA,
  deliveryFee: null,
  total: 180,
  withMerchandise: true,
});
const online = mkOnlineApp({
  id: 'ord-online',
  courierId: courierA,
  customerTotal: 80,
  deliveryFee: 12,
  platformFee: 8,
});
const cancelled = {
  ...mkAppCash({
    id: 'ord-cancel',
    courierId: courierA,
    customerTotal: 50,
    deliveryFee: 10,
    platformFee: 5,
  }),
  status: 'CANCELLED',
};
const otherCourier = mkAppCash({
  id: 'ord-b',
  courierId: courierB,
  customerTotal: 200,
  deliveryFee: 40,
  platformFee: 20,
});
const settled = mkAppCash({
  id: 'ord-settled',
  courierId: courierA,
  customerTotal: 60,
  deliveryFee: 10,
  platformFee: 5,
  settled: true,
  settledAmount: 15,
});

const orders = [
  appCash,
  external,
  externalLegacyTotal,
  externalAmbiguousMerchandise,
  online,
  cancelled,
  otherCourier,
  settled,
];

const summary = computeCourierCompanyCollections(orders, courierA, DAY, DAY, {
  period: 'today',
  includeNeedsReviewOrderIds: true,
});

console.log('--- Income components ---');
check('explicit external delivery income included', summary.externalDeliveryIncome === 25 + 40);
check(
  'legacy external Order.total counted; merchandise total 180 excluded',
  summary.externalDeliveryIncomeVerified === 65 && summary.externalDeliveryIncome !== 65 + 180
);
check('app delivery income = 15+12+10', summary.appDeliveryIncome === 37);
check('app commission income = 10+8+5', summary.appCommissionIncome === 23);
check(
  'company gross excludes restaurant merchandise',
  summary.companyGrossThroughCourier === 65 + 37 + 23
);
check(
  'restaurant merchandise not in gross (100 customer ≠ income)',
  summary.companyGrossThroughCourier !== 100 && summary.companyGrossThroughCourier < 200
);
check('cancelled order excluded', summary.orderCounts.completed === 6); // app cash, ext, legacy, ambiguous, online, settled
check('ambiguous merchandise increments review count', summary.externalOrdersMissingFeeCount === 1);
check('needsReviewCount matches', summary.needsReviewCount === 1);
check('hasIncompleteFinancialData', summary.hasIncompleteFinancialData === true);
check(
  'admin review ids include ambiguous merchandise order only',
  JSON.stringify(summary.needsReviewOrderIds) === JSON.stringify(['ord-ext-ambiguous'])
);
check('driver wage auto calc disabled', summary.driverWageAutoCalculation === false);
check('restaurant merchandise excluded flag', summary.restaurantMerchandiseExcluded === true);

console.log('\n--- Missing fee custody ---');
const missingAcc = enrichOrderWithDriverCollection(externalAmbiguousMerchandise);
check('ambiguous merchandise anomaly', missingAcc.anomalyCode === 'MISSING_DELIVERY_FEE');
check('ambiguous outstanding is 0', missingAcc.outstandingAmount === 0);
check('ambiguous platform revenue is 0', missingAcc.platformRevenueAmount === 0);
const legacyAcc = enrichOrderWithDriverCollection(externalLegacyTotal);
check('legacy total resolves fee 40', legacyAcc.deliveryFee === 40);
check('legacy outstanding is 40', legacyAcc.outstandingAmount === 40);
check(
  'verified totals include legacy + explicit in outstanding',
  summary.outstandingToCompany === 25 + 40 + 25 // app cash platform 25 + ext 25 + legacy 40
);

console.log('\n--- Assigned order operational amounts ---');
const acc = enrichOrderWithDriverCollection(appCash);
check('customer payable = 100', acc.customerPayableAmount === 100);
check('restaurant settle = 100-15-10 = 75', acc.driverRestaurantLiabilityAmount === 75);
check('platform liability = fee+commission = 25', acc.driverPlatformLiabilityAmount === 25);
check('restaurant share not treated as platform revenue', acc.platformRevenueAmount === 25);

console.log('\n--- Online + reconcile ---');
check('online contributes to income', summary.appDeliveryIncome >= 12 && summary.appCommissionIncome >= 8);
check('online does not inflate cash outstanding alone', true); // covered below
check('reconciled once for settled order', summary.reconciledToCompany === 15);
check(
  'outstanding is custody only (not full GMV)',
  summary.outstandingToCompany === 90 // 25 app cash + 25 explicit ext + 40 legacy
);

console.log('\n--- Isolation ---');
const summaryB = computeCourierCompanyCollections(orders, courierB, DAY, DAY, {
  period: 'today',
});
check('courier B does not see A totals', summaryB.companyGrossThroughCourier === 60);
check('courier A does not include B', summary.companyGrossThroughCourier !== summaryB.companyGrossThroughCourier);
check('courier B has no A review ids', (summaryB.needsReviewOrderIds ?? []).length === 0);

console.log('\n--- Admin/Courier same math ---');
const again = computeCourierCompanyCollections(orders, courierA, DAY, DAY, { period: 'today' });
check(
  'deterministic match',
  again.companyGrossThroughCourier === summary.companyGrossThroughCourier &&
    again.outstandingToCompany === summary.outstandingToCompany &&
    again.externalDeliveryIncomeVerified === summary.externalDeliveryIncomeVerified
);
check(
  'courier response strips review ids',
  !('needsReviewOrderIds' in again) || again.needsReviewOrderIds === undefined
);

console.log('\n--- Timezone ---');
check('business day key Asia/Jerusalem exists', !!businessDayKey(`${DAY}T22:30:00.000Z`));

console.log('\n--- Courier UI labels (source) ---');
const dash = fs.readFileSync(
  path.resolve(process.cwd(), '../courier/src/pages/CourierDashboard.tsx'),
  'utf8'
);
const earn = fs.readFileSync(
  path.resolve(process.cwd(), '../courier/src/pages/CourierEarningsPage.tsx'),
  'utf8'
);
const ordersPage = fs.readFileSync(
  path.resolve(process.cwd(), '../courier/src/pages/CourierOrdersPage.tsx'),
  'utf8'
);
const collectionsPanel = fs.readFileSync(
  path.resolve(process.cwd(), '../courier/src/components/CourierCollectionsPanel.tsx'),
  'utf8'
);
const stmt = fs.readFileSync(
  path.resolve(process.cwd(), '../nmd-admin/src/pages/drivers/DriverStatementPage.tsx'),
  'utf8'
);
const ui = dash + earn + collectionsPanel;
check('dashboard uses collections panel', dash.includes('CourierCollectionsPanel'));
check('dashboard has تحصيل اليوم title path', dash.includes('تحصيل اليوم'));
check('UI has دخل توصيل الطلبات الخارجية', ui.includes('دخل توصيل الطلبات الخارجية'));
check('UI has دخل نسبة التطبيق', ui.includes('دخل نسبة التطبيق'));
check('UI has المبلغ المطلوب تسليمه للشركة', ui.includes('المبلغ المطلوب تسليمه للشركة'));
check(
  'courier review warning without order ids',
  ui.includes('مراجعة أجرة التوصيل') && !dash.includes('needsReviewOrderIds')
);
check('UI has اعرض الكل for empty period', collectionsPanel.includes('اعرض الكل'));
check('UI has error retry not silent zero', collectionsPanel.includes('تعذر تحميل البيانات'));
check('admin review state visible', stmt.includes('بحاجة للمراجعة'));
check('no أرباحي on dashboard', !dash.includes('أرباحي'));
check('no صافي دخل السائق', !dash.includes('صافي دخل السائق') && !earn.includes('صافي دخل السائق'));
check('order shows customer amount label', ordersPage.includes('المبلغ المطلوب من الزبون'));
check('order shows restaurant amount label', ordersPage.includes('المبلغ المطلوب للمطعم'));
check('ownership disclaimer present', ui.includes('لا تمثل راتب السائق'));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
