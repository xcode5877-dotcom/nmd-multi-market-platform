/**
 * Focused Measurement V2 write-validation checks (no DB / no HTTP).
 * Run: pnpm --filter @nmd/core exec node --import tsx ../../apps/mock-api/scripts/verify-measurement-max-required.mjs
 * Or after build: node apps/mock-api/scripts/verify-measurement-max-required.mjs
 */
import {
  normalizeAndValidateMeasurementForWrite,
  validateMeasurementConfiguration,
} from '@nmd/core';

let failed = 0;
function check(cond, label) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    console.error(`  ✗ ${label}`);
    failed += 1;
  }
}

console.log('maximumQuantity required for WEIGHT/VOLUME writes');

{
  const missing = validateMeasurementConfiguration({
    measurementType: 'WEIGHT',
    baseUnitCode: 'kg',
    displayUnitCode: 'g',
    quantityStep: '0.25',
    minimumQuantity: '0.25',
  });
  check(!missing.ok, 'WEIGHT without max fails');
  check(missing.error?.details?.field === 'maximumQuantity', 'details.field = maximumQuantity');
}

{
  const ok = validateMeasurementConfiguration({
    measurementType: 'WEIGHT',
    baseUnitCode: 'kg',
    displayUnitCode: 'g',
    quantityStep: '0.25',
    minimumQuantity: '0.25',
    maximumQuantity: '1',
  });
  check(ok.ok === true && ok.config.maximumQuantity === '1', 'WEIGHT with max ok');
}

{
  const piece = validateMeasurementConfiguration({
    measurementType: 'PIECE',
    baseUnitCode: 'piece',
    displayUnitCode: 'piece',
    quantityStep: '1',
    minimumQuantity: '1',
  });
  check(piece.ok === true && piece.config.maximumQuantity === null, 'PIECE may omit max');
}

{
  const legacyMissing = normalizeAndValidateMeasurementForWrite({
    isWeightBased: true,
    unitName: 'غرام',
    quantityStep: 0.25,
  });
  check(!legacyMissing.ok, 'legacy WEIGHT triad without max rejected on write');
}

{
  const legacyOk = normalizeAndValidateMeasurementForWrite({
    isWeightBased: true,
    unitName: 'جرام',
    quantityStep: 0.25,
    minimumQuantity: 0.25,
    maximumQuantity: 1,
  });
  check(
    legacyOk.ok === true &&
      legacyOk.config.displayUnitCode === 'g' &&
      legacyOk.config.maximumQuantity === '1',
    'legacy جرام + max → display g'
  );
}

{
  const gharam = normalizeAndValidateMeasurementForWrite({
    measurementType: 'WEIGHT',
    baseUnitCode: 'kg',
    displayUnitCode: 'g',
    quantityStep: '0.25',
    minimumQuantity: '0.25',
    maximumQuantity: '1',
    unitName: 'غرام',
  });
  check(gharam.ok === true && gharam.api.displayUnitCode === 'g', 'غرام write preserves g');
}

if (failed > 0) {
  console.error(`\nFAILED: ${failed}`);
  process.exit(1);
}
console.log('\nAll max-required checks passed');
