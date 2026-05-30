#!/usr/bin/env npx tsx
/**
 * Platform fee Phase 1 — local verification (no server, no DB).
 * Run: pnpm --filter mock-api verify:platform-fee
 */

import {
  computePlatformFee,
  computeMarketplaceDisplayPricing,
  displayMarketplaceUnitPrice,
  enrichProductDisplayPricing,
  resolvePlatformFeeConfig,
  type PlatformFeeConfig,
  type TenantPlatformFeeOverride,
} from '../src/platform-fee.js';
import { parseMarketBrandingColumn, serializeMarketBrandingColumn } from '../src/market-branding-storage.js';

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

function approx(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.001;
}

const marketDefault: PlatformFeeConfig = {
  enabled: true,
  model: 'HYBRID',
  percentage: 10,
  fixedPerOrder: 0,
  fixedPerItem: 0,
  minFee: 2,
  maxFee: 50,
};

console.log('\n=== Platform Fee Phase 1 Verification ===\n');

console.log('1. Feature flag OFF — matches legacy customer total');
{
  const r = computePlatformFee({
    itemsSubtotal: 100,
    discountAmount: 0,
    itemCount: 3,
    deliveryFee: 15,
    marketFeeConfig: { enabled: true, model: 'PERCENTAGE', percentage: 99 },
    featureFlagEnabled: false,
  });
  assert(r.platformFee === 0, 'platformFee = 0');
  assert(r.appliedConfigSource === 'DISABLED', 'source = DISABLED');
  assert(approx(r.customerTotal, 115), 'customerTotal = 100 + 15 = 115 (legacy)');
  assert(approx(r.merchantPayout, 100), 'merchantPayout = items subtotal');
}

console.log('\n2. 10% fee on 100₪ after 20₪ coupon → fee base 80₪, fee 8₪');
{
  const r = computePlatformFee({
    itemsSubtotal: 100,
    discountAmount: 20,
    itemCount: 2,
    deliveryFee: 10,
    marketFeeConfig: { enabled: true, model: 'PERCENTAGE', percentage: 10 },
    featureFlagEnabled: true,
  });
  assert(approx(r.feeBase, 80), 'feeBase = 80');
  assert(approx(r.platformFee, 8), 'platformFee = 8');
  assert(approx(r.customerTotal, 98), 'customerTotal = 80 + 10 + 8 = 98');
  assert(approx(r.merchantPayout, 80), 'merchantPayout = 80');
}

console.log('\n3. Delivery fee excluded from percentage base');
{
  const r = computePlatformFee({
    itemsSubtotal: 50,
    discountAmount: 0,
    itemCount: 1,
    deliveryFee: 100,
    marketFeeConfig: { enabled: true, model: 'PERCENTAGE', percentage: 10 },
    featureFlagEnabled: true,
  });
  assert(approx(r.platformFee, 5), 'platformFee = 10% of 50 items, not 150');
  assert(approx(r.customerTotal, 155), 'customerTotal = 50 + 100 + 5');
}

console.log('\n4. Min / max caps (hybrid market default)');
{
  const low = computePlatformFee({
    itemsSubtotal: 10,
    discountAmount: 0,
    itemCount: 1,
    deliveryFee: 0,
    marketFeeConfig: marketDefault,
    featureFlagEnabled: true,
  });
  assert(approx(low.platformFee, 2), 'min cap: 10% of 10 = 1 → min 2');

  const high = computePlatformFee({
    itemsSubtotal: 1000,
    discountAmount: 0,
    itemCount: 1,
    deliveryFee: 0,
    marketFeeConfig: marketDefault,
    featureFlagEnabled: true,
  });
  assert(approx(high.platformFee, 50), 'max cap: 10% of 1000 = 100 → max 50');
}

console.log('\n5. Fixed per order');
{
  const r = computePlatformFee({
    itemsSubtotal: 200,
    discountAmount: 0,
    itemCount: 5,
    deliveryFee: 12,
    marketFeeConfig: { enabled: true, model: 'FIXED_ORDER', fixedPerOrder: 7 },
    featureFlagEnabled: true,
  });
  assert(approx(r.platformFee, 7), 'platformFee = 7 fixed');
  assert(r.feeType === 'FIXED_ORDER', 'feeType = FIXED_ORDER');
  assert(approx(r.customerTotal, 219), 'customerTotal = 200 + 12 + 7');
}

console.log('\n6. Fixed per item');
{
  const r = computePlatformFee({
    itemsSubtotal: 60,
    discountAmount: 0,
    itemCount: 4,
    deliveryFee: 5,
    marketFeeConfig: { enabled: true, model: 'FIXED_ITEM', fixedPerItem: 1.5 },
    featureFlagEnabled: true,
  });
  assert(approx(r.platformFee, 6), 'platformFee = 1.5 × 4 = 6');
  assert(r.feeType === 'FIXED_ITEM', 'feeType = FIXED_ITEM');
}

console.log('\n7. Tenant override beats market default');
{
  const tenantOverride: TenantPlatformFeeOverride = {
    useMarketDefault: false,
    enabled: true,
    model: 'PERCENTAGE',
    percentage: 5,
  };
  const resolved = resolvePlatformFeeConfig(marketDefault, tenantOverride);
  assert(resolved.source === 'TENANT', 'resolve: TENANT wins');

  const r = computePlatformFee({
    itemsSubtotal: 100,
    discountAmount: 0,
    itemCount: 1,
    deliveryFee: 0,
    marketFeeConfig: marketDefault,
    tenantFeeOverride: tenantOverride,
    featureFlagEnabled: true,
  });
  assert(r.appliedConfigSource === 'TENANT', 'appliedConfigSource = TENANT');
  assert(approx(r.platformFee, 5), '5% tenant override, not 10% market');
}

console.log('\n8. Tenant explicit disable (useMarketDefault: false, enabled: false)');
{
  const r = computePlatformFee({
    itemsSubtotal: 100,
    discountAmount: 0,
    itemCount: 1,
    deliveryFee: 10,
    marketFeeConfig: marketDefault,
    tenantFeeOverride: { useMarketDefault: false, enabled: false },
    featureFlagEnabled: true,
  });
  assert(r.platformFee === 0, 'fee disabled for store');
  assert(approx(r.customerTotal, 110), 'legacy total when store exempt');
}

console.log('\n9. Flag ON but no config enabled → legacy totals');
{
  const r = computePlatformFee({
    itemsSubtotal: 80,
    discountAmount: 5,
    itemCount: 2,
    deliveryFee: 8,
    featureFlagEnabled: true,
  });
  assert(r.platformFee === 0, 'no config → fee 0');
  assert(approx(r.customerTotal, 83), 'customerTotal = 75 + 8 = 83');
}

console.log('\n10. Catalog display unit price — 5% market');
{
  process.env.PLATFORM_FEE_ENABLED = 'true';
  const ctx = { marketFeeConfig: { enabled: true, model: 'PERCENTAGE' as const, percentage: 5 } };
  const unit = displayMarketplaceUnitPrice(100, ctx);
  assert(approx(unit, 105), 'display unit = 105 for base 100 @ 5%');
  const enriched = enrichProductDisplayPricing({ basePrice: 100 }, ctx);
  assert(approx(enriched.displayPrice, 105), 'enriched displayPrice = 105');
}

console.log('\n11. Cart display allocation — fixed order ₪3 on two lines');
{
  process.env.PLATFORM_FEE_ENABLED = 'true';
  const ctx = {
    marketFeeConfig: { enabled: true, model: 'FIXED_ORDER' as const, fixedPerOrder: 3 },
  };
  const r = computeMarketplaceDisplayPricing(
    [
      { baseAmount: 60, quantity: 1, itemCount: 1 },
      { baseAmount: 40, quantity: 1, itemCount: 1 },
    ],
    ctx
  );
  assert(approx(r.displayMerchandiseTotal, 103), 'display merchandise = 100 + 3');
  assert(approx(r.lines[0]!.displayAmount + r.lines[1]!.displayAmount, 103), 'lines sum to display total');
  assert(approx(r.platformFee, 3), 'platform fee = 3');
  assert(approx(r.merchantPayout, 100), 'merchant payout = 100');
}

console.log('\n12. Flag OFF — display equals base');
{
  process.env.PLATFORM_FEE_ENABLED = 'false';
  const ctx = { marketFeeConfig: { enabled: true, model: 'PERCENTAGE' as const, percentage: 5 } };
  const enriched = enrichProductDisplayPricing({ basePrice: 50 }, ctx);
  assert(approx(enriched.displayPrice, 50), 'displayPrice equals base when flag off');
}

console.log('\n13. Tenant CUSTOM FIXED_ITEM ₪5 — catalog unit price');
{
  process.env.PLATFORM_FEE_ENABLED = 'true';
  const ctx = {
    tenantFeeOverride: {
      useMarketDefault: false,
      enabled: true,
      model: 'FIXED_ITEM' as const,
      fixedPerItem: 5,
    },
    featureFlagEnabled: true,
  };
  const enriched = enrichProductDisplayPricing({ basePrice: 60 }, ctx);
  assert(approx(enriched.displayPrice, 65), 'displayPrice = base + fixedPerItem for pizza-style item');
  const small = enrichProductDisplayPricing({ basePrice: 25 }, ctx);
  assert(approx(small.displayPrice, 30), 'displayPrice = 25 + 5');
}

console.log('\n14. Market platformFeeConfig branding JSON round-trip');
{
  const market = {
    branding: { primaryColor: '#D97706' },
    platformFeeConfig: { enabled: true, model: 'FIXED_ITEM' as const, fixedPerItem: 5 },
  };
  const raw = serializeMarketBrandingColumn(market);
  assert(raw != null, 'serialized branding not null');
  const parsed = parseMarketBrandingColumn(raw);
  assert(parsed.branding?.primaryColor === '#D97706', 'branding primaryColor preserved');
  assert(parsed.platformFeeConfig?.fixedPerItem === 5, 'platformFeeConfig fixedPerItem preserved');
  assert(parsed.platformFeeConfig?.model === 'FIXED_ITEM', 'platformFeeConfig model preserved');
  assert(
    (parsed.branding as Record<string, unknown> | undefined)?.platformFeeConfig === undefined,
    'platformFeeConfig not leaked into branding object'
  );
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
