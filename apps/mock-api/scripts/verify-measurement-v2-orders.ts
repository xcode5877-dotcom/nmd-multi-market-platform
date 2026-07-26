#!/usr/bin/env npx tsx
/**
 * Measurement V2 Phase B.1 — order quantity, pricing, snapshots, fee units.
 * Run: pnpm --filter mock-api verify:measurement-v2-orders
 *
 * Does not deploy. Does not migrate production.
 */
import {
  buildAuthoritativeLineFields,
  calculateLineSubtotal,
  coerceOrderLineSnapshots,
  feeBillableItemUnits,
  moneyMismatch,
  parseOrderQuantity,
  serializeOrderQuantity,
  snapshotToMeasurement,
  validateQuantityAgainstMeasurement,
  defaultPieceMeasurement,
  type ProductMeasurement,
} from '@nmd/core';
import { resolveAuthoritativeOrderLines, validateExistingLineQuantityChange } from '../src/order-measurement.js';

let passed = 0;
let failed = 0;

function check(cond: boolean, msg: string): void {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${msg}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${msg}`);
  }
}

const weight025: ProductMeasurement = {
  measurementType: 'WEIGHT',
  baseUnitCode: 'kg',
  displayUnitCode: 'g',
  quantityStep: '0.25',
  minimumQuantity: '0.25',
  maximumQuantity: '10',
  priceBasis: 'PER_BASE_UNIT',
  measurementVersion: 1,
  displayPrecision: 0,
};

const volume01: ProductMeasurement = {
  measurementType: 'VOLUME',
  baseUnitCode: 'l',
  displayUnitCode: 'ml',
  quantityStep: '0.1',
  minimumQuantity: '0.1',
  maximumQuantity: null,
  priceBasis: 'PER_BASE_UNIT',
  measurementVersion: 1,
  displayPrecision: null,
};

console.log('\n=== B.1 Quantity parsing ===\n');
{
  for (const [v, ok] of [
    [1, true],
    ['1', true],
    ['0.25', true],
    ['1.500', true],
    [0, false],
    [-1, false],
    [NaN, false],
    [Infinity, false],
    ['1e2', false],
    ['0.1234', false],
    ['999999999', true],
  ] as const) {
    const r = parseOrderQuantity(v as unknown);
    check(r.ok === ok, `parse ${String(v)} → ${r.ok ? r.normalized : r.error.code} (expect ok=${ok})`);
  }
}

console.log('\n=== B.1 PIECE validation ===\n');
{
  const piece = defaultPieceMeasurement();
  check(validateQuantityAgainstMeasurement(1, piece).ok, 'PIECE 1 valid');
  check(validateQuantityAgainstMeasurement(2, piece).ok, 'PIECE 2 valid');
  check(!validateQuantityAgainstMeasurement(0.5, piece).ok, 'PIECE 0.5 invalid');
  check(
    validateQuantityAgainstMeasurement(0.5, piece).ok === false &&
      (validateQuantityAgainstMeasurement(0.5, piece) as { error: { code: string } }).error.code ===
        'FRACTIONAL_PIECE_QUANTITY',
    'PIECE 0.5 → FRACTIONAL_PIECE_QUANTITY'
  );
  check(!validateQuantityAgainstMeasurement(1.5, piece).ok, 'PIECE 1.5 invalid');
}

console.log('\n=== B.1 WEIGHT step 0.25 ===\n');
{
  for (const [q, ok] of [
    ['0.25', true],
    ['0.5', true],
    ['1', true],
    ['1.25', true],
    ['0.3', false],
    ['0.6', false],
    ['0.1', false],
  ] as const) {
    const r = validateQuantityAgainstMeasurement(q, weight025);
    check(r.ok === ok, `WEIGHT ${q} → ${r.ok ? 'ok' : r.error.code}`);
  }
}

console.log('\n=== B.1 VOLUME step 0.1 ===\n');
{
  for (const [q, ok] of [
    ['0.1', true],
    ['0.5', true],
    ['1.2', true],
    ['0.15', false],
  ] as const) {
    const r = validateQuantityAgainstMeasurement(q, volume01);
    check(r.ok === ok, `VOLUME ${q} → ${r.ok ? 'ok' : r.error.code}`);
  }
}

console.log('\n=== B.1 Pricing (agora/milli) ===\n');
{
  check(calculateLineSubtotal(40, '0.25') === 10, '40 × 0.25 = 10');
  check(calculateLineSubtotal(40, '0.5') === 20, '40 × 0.5 = 20');
  check(calculateLineSubtotal(40, '1.5') === 60, '40 × 1.5 = 60');
  check(calculateLineSubtotal(12, '0.5') === 6, '12 × 0.5 = 6');
  check(calculateLineSubtotal(10, '0.333') === 3.33, '10 × 0.333 = 3.33');
  check(moneyMismatch(11, 10) === true, 'mismatch detected');
  check(moneyMismatch(10, 10) === false, 'exact match ok');
}

console.log('\n=== B.1 Fee billable units ===\n');
{
  check(feeBillableItemUnits('PIECE', 3000) === 3, 'PIECE 3 → fee units 3');
  check(feeBillableItemUnits('WEIGHT', 250) === 1, 'WEIGHT 0.25kg → fee units 1 (not floor)');
  check(feeBillableItemUnits('VOLUME', 1500) === 1, 'VOLUME 1.5L → fee units 1');
  check(feeBillableItemUnits('PACKAGE', 2000) === 2, 'PACKAGE 2 → fee units 2');
}

console.log('\n=== B.1 Snapshots ===\n');
{
  const fields = buildAuthoritativeLineFields({
    measurement: weight025,
    quantityMilli: 250,
    basePrice: 40,
    unitPrice: 40,
    lineSubtotal: 10,
  });
  check(fields.quantityDecimal === '0.25', 'snapshot qty decimal');
  check(fields.measurementTypeSnapshot === 'WEIGHT', 'snapshot type');
  check(fields.basePriceSnapshot === 40 && fields.lineSubtotalSnapshot === 10, 'price snapshots');
  check(fields.isWeightBased === true && fields.unitName === 'غرام', 'legacy dual-emit');

  const hist = coerceOrderLineSnapshots({
    productId: 'p1',
    quantity: 2,
    basePrice: 8,
    totalPrice: 16,
  });
  check(hist.measurementTypeSnapshot === 'PIECE', 'historical defaults PIECE');
  check(hist.lineSubtotalSnapshot === 16, 'historical money preserved');
  check(String(hist.quantityDecimal) === '2', 'historical quantityDecimal');

  // Catalog price change must not affect snapshot measurement meaning
  const snapMeas = snapshotToMeasurement({
    measurementTypeSnapshot: fields.measurementTypeSnapshot,
    baseUnitCodeSnapshot: fields.baseUnitCodeSnapshot,
    displayUnitCodeSnapshot: fields.displayUnitCodeSnapshot,
    quantityStepSnapshot: fields.quantityStepSnapshot,
    minimumQuantitySnapshot: fields.minimumQuantitySnapshot,
    maximumQuantitySnapshot: fields.maximumQuantitySnapshot,
    priceBasisSnapshot: fields.priceBasisSnapshot,
    measurementVersionSnapshot: fields.measurementVersionSnapshot,
    displayPrecisionSnapshot: fields.displayPrecisionSnapshot,
  });
  const edit = validateExistingLineQuantityChange(
    { ...fields, productId: 'p1', unitPriceSnapshot: 40 },
    '0.75'
  );
  check(edit.ok === true && edit.ok && edit.lineSubtotal === 30, 'edit existing line uses snapshot price 40×0.75=30');
  check(edit.ok && edit.measurement.quantityStep === snapMeas.quantityStep, 'edit uses snapshot step');
  const badEdit = validateExistingLineQuantityChange(
    { ...fields, productId: 'p1', unitPriceSnapshot: 40 },
    '0.3'
  );
  check(!badEdit.ok && badEdit.error.code === 'QUANTITY_STEP_MISMATCH', 'edit rejects bad step');
}

console.log('\n=== B.1 Authoritative resolve lines ===\n');
{
  const catalog = {
    categories: [{ id: 'c1', tenantId: 't1', name: 'C', slug: 'c', sortOrder: 0 }],
    products: [
      {
        id: 'pw',
        tenantId: 't1',
        categoryId: 'c1',
        name: 'Tomato',
        slug: 'tomato',
        type: 'SIMPLE',
        basePrice: 40,
        currency: 'ILS',
        isAvailable: true,
        measurementType: 'WEIGHT',
        baseUnitCode: 'kg',
        displayUnitCode: 'g',
        quantityStep: '0.25',
        minimumQuantity: '0.25',
        maximumQuantity: '10',
        priceBasis: 'PER_BASE_UNIT',
        measurementVersion: 1,
      },
      {
        id: 'pp',
        tenantId: 't1',
        categoryId: 'c1',
        name: 'Can',
        slug: 'can',
        type: 'SIMPLE',
        basePrice: 8,
        currency: 'ILS',
        isAvailable: true,
      },
      {
        id: 'pstock',
        tenantId: 't1',
        categoryId: 'c1',
        name: 'Tracked Weight',
        slug: 'tw',
        type: 'SIMPLE',
        basePrice: 40,
        currency: 'ILS',
        isAvailable: true,
        stock: 5,
        measurementType: 'WEIGHT',
        baseUnitCode: 'kg',
        displayUnitCode: 'kg',
        quantityStep: '0.5',
        minimumQuantity: '0.5',
        priceBasis: 'PER_BASE_UNIT',
        measurementVersion: 1,
      },
    ],
    optionGroups: [],
    optionItems: [],
  };

  const ok = resolveAuthoritativeOrderLines({
    tenantId: 't1',
    supportsWeightSelling: true,
    catalog: catalog as never,
    clientLines: [
      { productId: 'pw', quantity: '0.25', totalPrice: 999, basePrice: 1 },
      { productId: 'pp', quantity: 2, totalPrice: 1 },
    ],
    endpoint: 'test',
  });
  check(ok.ok === true, 'multi-line resolve ok');
  if (ok.ok) {
    check(ok.subtotal === 10 + 16, `subtotal authoritative ${ok.subtotal}`);
    check(ok.lines[0]!.lineSubtotalSnapshot === 10, 'ignores client totalPrice');
    check(ok.lines[0]!.quantityDecimal === '0.25', 'weight qty decimal');
    check(ok.feeItemCount === 1 + 2, `feeItemCount WEIGHT1+PIECE2=${ok.feeItemCount}`);
  }

  const noWeight = resolveAuthoritativeOrderLines({
    tenantId: 't1',
    supportsWeightSelling: false,
    catalog: catalog as never,
    clientLines: [{ productId: 'pw', quantity: '0.25' }],
    endpoint: 'test',
  });
  check(
    !noWeight.ok && noWeight.body.code === 'MEASUREMENT_NOT_SUPPORTED',
    'WEIGHT blocked without tenant flag'
  );

  const badSecond = resolveAuthoritativeOrderLines({
    tenantId: 't1',
    supportsWeightSelling: true,
    catalog: catalog as never,
    clientLines: [
      { productId: 'pp', quantity: 1 },
      { productId: 'pw', quantity: '0.3' },
    ],
    endpoint: 'test',
  });
  check(!badSecond.ok && badSecond.body.code === 'QUANTITY_STEP_MISMATCH', 'atomic: invalid second line fails all');

  const stockW = resolveAuthoritativeOrderLines({
    tenantId: 't1',
    supportsWeightSelling: true,
    catalog: catalog as never,
    clientLines: [{ productId: 'pstock', quantity: '0.5' }],
    endpoint: 'test',
  });
  check(
    !stockW.ok && stockW.body.code === 'WEIGHTED_STOCK_NOT_SUPPORTED',
    'integer stock + WEIGHT rejected'
  );

  const pieceOnly = resolveAuthoritativeOrderLines({
    tenantId: 't1',
    supportsWeightSelling: false,
    catalog: catalog as never,
    clientLines: [{ productId: 'pp', quantity: 3 }],
    endpoint: 'test',
  });
  check(pieceOnly.ok === true && pieceOnly.ok && pieceOnly.subtotal === 24, 'legacy PIECE 3×8=24');
}

console.log('\n=== B.1 serialize ===\n');
{
  check(serializeOrderQuantity(250) === '0.25', 'serialize 250 milli');
  check(serializeOrderQuantity(1000) === '1', 'serialize 1000 milli');
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
