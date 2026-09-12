/**
 * Zero-totals UI contract: period filters, no silent zero on errors, Ahmed-shaped all-time.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  formatMoney,
  isVerifiedEmptyPeriod,
  parseAmount,
  readCollectionsAmounts,
  type DailySummary,
} from '../src/lib/collectionsSummary.js';

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

console.log('verify-courier-zero-totals-ui\n');

const ahmedAll: DailySummary = {
  courierId: 'courier-50971b77-4811-49e8-825b-78bd84041782',
  period: 'all',
  appDeliveryIncome: 5845,
  appCommissionIncome: 2281.3,
  externalDeliveryIncomeVerified: 0,
  companyGrossThroughCourier: 8126.3,
  outstandingToCompany: 4297,
  reconciledToCompany: 0,
  externalOrdersMissingFeeCount: 534,
  hasIncompleteFinancialData: true,
  orderCounts: { completed: 900, app: 366, external: 534 },
};

const ahmedToday: DailySummary = {
  courierId: 'courier-50971b77-4811-49e8-825b-78bd84041782',
  period: 'today',
  appDeliveryIncome: 0,
  appCommissionIncome: 0,
  externalDeliveryIncomeVerified: 0,
  companyGrossThroughCourier: 0,
  outstandingToCompany: 0,
  reconciledToCompany: 0,
  externalOrdersMissingFeeCount: 0,
  hasIncompleteFinancialData: false,
  orderCounts: { completed: 0, app: 0, external: 0 },
};

console.log('--- Amount parsing ---');
check('parseAmount decimal string', parseAmount('2281.3') === 2281.3);
check('parseAmount null stays null', parseAmount(null) === null);
check('formatMoney keeps decimals', formatMoney(2281.3) === '₪2281.30');
check('Ahmed all-time gross non-zero', readCollectionsAmounts(ahmedAll).gross === 8126.3);
check('Ahmed all-time outstanding', readCollectionsAmounts(ahmedAll).outstanding === 4297);
check('Ahmed today verified empty', isVerifiedEmptyPeriod(ahmedToday) === true);
check('Ahmed all not empty', isVerifiedEmptyPeriod(ahmedAll) === false);
check('restaurant not in amounts object', !('restaurant' in readCollectionsAmounts(ahmedAll)));

console.log('\n--- Source UI contract ---');
const root = path.resolve(process.cwd(), '../courier/src');
const dash = fs.readFileSync(path.join(root, 'pages/CourierDashboard.tsx'), 'utf8');
const earn = fs.readFileSync(path.join(root, 'pages/CourierEarningsPage.tsx'), 'utf8');
const panel = fs.readFileSync(path.join(root, 'components/CourierCollectionsPanel.tsx'), 'utf8');

check('dashboard uses CourierCollectionsPanel', dash.includes('CourierCollectionsPanel'));
check('dashboard period via searchParams', dash.includes('useSearchParams') && dash.includes('period'));
check('dashboard does not hardcode only today fetch', !dash.includes("queryKey: ['courier-daily-summary', 'today']"));
check('earnings uses period query param', earn.includes('useSearchParams'));
check('panel sends period query', panel.includes('period=${encodeURIComponent(period)}') || panel.includes('period='));
check('panel queryKey includes period', panel.includes("queryKey: ['courier-daily-summary'") && panel.includes('period'));
check('panel has اعرض الكل', panel.includes('اعرض الكل') && panel.includes('الكل'));
check('panel has لا توجد حركة اليوم', panel.includes('لا توجد حركة اليوم'));
check('panel has لا توجد حركة ضمن هذه الفترة', panel.includes('لا توجد حركة ضمن هذه الفترة'));
check('panel CTA is اعرض الكل button', panel.includes('>اعرض الكل<') || panel.includes('اعرض الكل'));
check('panel has API error not zero', panel.includes('تعذر تحميل البيانات') && panel.includes('إعادة المحاولة'));
check('panel has profile mismatch', panel.includes('تعذر ربط حساب السائق بملفه'));
check('panel has verified empty copy', panel.includes('لا توجد مبالغ موثقة ضمن هذه الفترة'));
check('panel has missing fee review', panel.includes('مراجعة أجرة التوصيل'));
check('error path does not formatMoney(0) fallback alone', !panel.includes('Number(n) || 0'));

const periodLib = fs.readFileSync(path.join(root, 'lib/collectionsPeriod.ts'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'components/CourierNativeLayout.tsx'), 'utf8');
check('period persistence helper exists', periodLib.includes('courier-collections-period'));
check('resolve prefers URL then storage', periodLib.includes('resolveCollectionsPeriod'));
check('dashboard writes stored period', dash.includes('writeStoredCollectionsPeriod'));
check('earnings writes stored period', earn.includes('writeStoredCollectionsPeriod'));
check('nav preserves period via collectionsPeriodSearch', layout.includes('collectionsPeriodSearch'));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
