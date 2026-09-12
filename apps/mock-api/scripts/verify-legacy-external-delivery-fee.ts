/**
 * Legacy external delivery-fee contract — fixture verification (no production writes).
 */
import assert from 'node:assert/strict';
import {
  extractVerifiedExternalDeliveryFee,
  isLegacyExternalDeliveryFeeContract,
  resolveExternalDeliveryFee,
  computeDriverOrderAccounting,
  isOrderExternal,
} from '../src/driver-collections.js';
import { computeCourierCompanyCollections } from '../src/courier-company-collections.js';
import { extractExternalOrderDeliveryProfit } from '../src/store-profit-report.js';

let passed = 0;
function check(label: string, cond: boolean) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  passed += 1;
  console.log(`  ✓ ${label}`);
}

console.log('verify-legacy-external-delivery-fee\n');

const legacyPayload = {
  id: 'ext-1777574281840-demo',
  isExternal: true,
  orderType: 'EXTERNAL',
  source: 'external',
  status: 'COMPLETED',
  total: 30,
  subtotal: 0,
  items: [],
  paymentMethod: 'CASH',
  payment: { method: 'CASH', amount: 30 },
};

check('legacy contract detected', isLegacyExternalDeliveryFeeContract(legacyPayload));
const legacyResolved = resolveExternalDeliveryFee(legacyPayload);
check('legacy source LEGACY_EXTERNAL_TOTAL', legacyResolved.deliveryFeeSource === 'LEGACY_EXTERNAL_TOTAL');
check('legacy amount 30', legacyResolved.deliveryFeeAmount === 30);
check('legacy confidence VERIFIED', legacyResolved.confidence === 'VERIFIED');

const withExplicit = {
  ...legacyPayload,
  total: 99,
  platformDeliveryFee: 22,
  delivery: { fee: 22 },
};
const explicit = resolveExternalDeliveryFee(withExplicit);
check('explicit precedes legacy total', explicit.deliveryFeeAmount === 22);
check('explicit source platform', explicit.deliveryFeeSource === 'EXPLICIT_PLATFORM_FIELD');

const merchandise = {
  id: 'ext-bad',
  isExternal: true,
  status: 'COMPLETED',
  total: 180,
  subtotal: 150,
  items: [{ totalPrice: 150 }],
};
check('merchandise not legacy contract', !isLegacyExternalDeliveryFeeContract(merchandise));
check('merchandise stays review', resolveExternalDeliveryFee(merchandise).deliveryFeeAmount == null);

const appOrder = {
  id: 'app-1',
  isExternal: false,
  status: 'COMPLETED',
  total: 100,
  platformDeliveryFee: 15,
};
check('app is not external', !isOrderExternal(appOrder));
check('app never uses total as external fee', extractVerifiedExternalDeliveryFee(appOrder) == null);
check(
  'app extractExternalDeliveryProfit is 0',
  extractExternalOrderDeliveryProfit(appOrder) === 0
);

const cancelled = { ...legacyPayload, status: 'CANCELLED' };
const cancelledAcc = computeDriverOrderAccounting(cancelled);
check('cancelled excluded from liability', cancelledAcc.outstandingAmount === 0);
check('cancelled not countable revenue path', cancelledAcc.platformRevenueAmount === 0);

const ahmedShaped = [
  {
    id: 'ext-a1',
    courierId: 'courier-ahmed',
    isExternal: true,
    orderType: 'EXTERNAL',
    source: 'external',
    status: 'COMPLETED',
    total: 20,
    subtotal: 0,
    items: [],
    paymentMethod: 'CASH',
    createdAt: '2026-08-01T10:00:00.000Z',
    deliveryTimeline: { deliveredAt: '2026-08-01T11:00:00.000Z' },
  },
  {
    id: 'ext-a2',
    courierId: 'courier-ahmed',
    isExternal: true,
    orderType: 'EXTERNAL',
    source: 'external',
    status: 'COMPLETED',
    total: 45,
    subtotal: 0,
    items: [],
    paymentMethod: 'CASH',
    createdAt: '2026-08-02T10:00:00.000Z',
    deliveryTimeline: { deliveredAt: '2026-08-02T11:00:00.000Z' },
  },
  {
    id: 'app-a1',
    courierId: 'courier-ahmed',
    isExternal: false,
    status: 'COMPLETED',
    total: 100,
    platformDeliveryFee: 10,
    platformFee: 5,
    paymentMethod: 'CASH',
    payment: {
      method: 'CASH',
      breakdown: { deliveryFee: 10, platformFee: 5, itemsTotal: 85 },
      financials: { customerTotal: 100 },
    },
    delivery: { fee: 10 },
    createdAt: '2026-08-03T10:00:00.000Z',
    deliveryTimeline: { deliveredAt: '2026-08-03T11:00:00.000Z' },
  },
];

const summary = computeCourierCompanyCollections(
  ahmedShaped,
  'courier-ahmed',
  '2026-08-01',
  '2026-08-31',
  { period: 'month', includeNeedsReviewOrderIds: true }
);
check('Ahmed-shaped external income 65', summary.externalDeliveryIncomeVerified === 65);
check('no missing fees for legacy shape', summary.externalOrdersMissingFeeCount === 0);
check('app delivery separate', summary.appDeliveryIncome === 10);
check('app commission separate', summary.appCommissionIncome === 5);
check('gross = 65+10+5', summary.companyGrossThroughCourier === 80);
check('admin/courier same', summary.outstandingToCompany === 65 + 15);

const zeroSettFee = {
  ...legacyPayload,
  settlement: {
    deliveryFee: 0,
    customerSales: 0,
    merchantBaseSubtotal: 0,
    customerGrandTotal: 0,
  },
};
check(
  'settlement.deliveryFee=0 does not block legacy total',
  resolveExternalDeliveryFee(zeroSettFee).deliveryFeeAmount === 30
);

check('no double count explicit+legacy', resolveExternalDeliveryFee(withExplicit).deliveryFeeAmount === 22);

console.log(`\n${passed} passed`);
