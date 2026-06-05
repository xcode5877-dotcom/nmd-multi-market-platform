#!/usr/bin/env npx tsx
/**
 * Settlement + markup exemption verification (no server, no DB for pricing tests).
 * Ledger/DB tests skipped when DATABASE_URL unavailable.
 * Run: pnpm --filter mock-api verify:settlement
 */

import {
  computeMarketplaceDisplayPricing,
  displayMarketplaceUnitPrice,
  ceilShekel,
  isPlatformFeeEnabled,
} from '../src/platform-fee.js';
import {
  buildSettlementSnapshot,
  classifySettlement,
  computeOrderSettlementEconomics,
} from '../src/settlement.js';

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

process.env.PLATFORM_FEE_ENABLED = 'true';

const ctx = {
  marketFeeConfig: { enabled: true, model: 'PERCENTAGE' as const, percentage: 10 },
  featureFlagEnabled: true,
};

console.log('\n=== Settlement & Markup Verification ===\n');

console.log('1. ceilShekel rounds up to whole shekel');
{
  assert(ceilShekel(27.1) === 28, '27.1 → 28');
  assert(ceilShekel(27) === 27, '27 → 27');
}

console.log('\n2. Taxable product 100₪ @ 10% → display 110');
{
  const unit = displayMarketplaceUnitPrice(100, ctx, false);
  assert(unit === 110, `display unit = 110 (got ${unit})`);
}

console.log('\n3. Exempt category — no markup');
{
  const unit = displayMarketplaceUnitPrice(25, ctx, true);
  assert(unit === 25, `exempt base 25 stays 25 (got ${unit})`);
}

console.log('\n4. Mixed order: pizza 90 + cola 10 (exempt)');
{
  const r = computeMarketplaceDisplayPricing(
    [
      { baseAmount: 90, quantity: 1, markupExempt: false },
      { baseAmount: 10, quantity: 1, markupExempt: true },
    ],
    ctx
  );
  assert(r.merchantPayout === 100, 'merchant payout = 100');
  assert(r.lines[0]!.displayAmount === 99, 'pizza display 99 (90+10% ceil)');
  assert(r.lines[1]!.displayAmount === 10, 'cola display 10');
  assert(r.displayMerchandiseTotal === 109, 'customer merchandise = 109');
  assert(r.platformFee === 9, 'platform fee = 9');
}

console.log('\n5. Settlement class — pickup cash');
{
  assert(classifySettlement('PICKUP', 'CASH') === 'PICKUP_CASH', 'PICKUP_CASH');
  assert(classifySettlement('DELIVERY', 'CASH') === 'DELIVERY_CASH', 'DELIVERY_CASH');
  assert(classifySettlement('DELIVERY', 'CARD') === 'ONLINE_PLATFORM', 'ONLINE_PLATFORM');
}

console.log('\n6. Pickup snapshot — store debt = commission');
{
  const snap = buildSettlementSnapshot({
    settlementClass: 'PICKUP_CASH',
    merchantBaseSubtotal: 100,
    platformCommission: 10,
    deliveryFee: 0,
    customerGrandTotal: 110,
    merchantPayout: 100,
  });
  assert(snap.pickupCommissionDebt === 10, 'pickup debt 10');
  assert(snap.deliveryCommissionCollected === 0, 'no delivery collected');
  assert(snap.merchantLiability === 0, 'no merchant liability');
}

console.log('\n7. Delivery snapshot — no store debt');
{
  const snap = buildSettlementSnapshot({
    settlementClass: 'DELIVERY_CASH',
    merchantBaseSubtotal: 100,
    platformCommission: 10,
    deliveryFee: 15,
    customerGrandTotal: 125,
    merchantPayout: 100,
  });
  assert(snap.pickupCommissionDebt === 0, 'pickup debt 0');
  assert(snap.deliveryCommissionCollected === 10, 'delivery commission collected 10');
}

console.log('\n8. Online snapshot — merchant liability');
{
  const snap = buildSettlementSnapshot({
    settlementClass: 'ONLINE_PLATFORM',
    merchantBaseSubtotal: 100,
    platformCommission: 10,
    deliveryFee: 15,
    customerGrandTotal: 125,
    merchantPayout: 100,
  });
  assert(snap.merchantLiability === 100, 'merchant liability 100');
  assert(snap.pickupCommissionDebt === 0, 'no pickup debt');
}

console.log('\n9. Order economics from stored platformFee fields');
{
  const econ = computeOrderSettlementEconomics(
    {
      platformFee: 8,
      merchantPayout: 80,
      merchantAmount: 80,
      customerTotal: 98,
      total: 98,
      delivery: { fee: 10 },
      items: [{ totalPrice: 80, quantity: 1 }],
    },
    ctx,
    new Map(),
    new Map()
  );
  assert(econ.platformCommission === 8, 'commission 8');
  assert(econ.merchantPayout === 80, 'payout 80');
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
console.log(`PLATFORM_FEE_ENABLED=${isPlatformFeeEnabled()}`);
process.exit(failed > 0 ? 1 : 0);
