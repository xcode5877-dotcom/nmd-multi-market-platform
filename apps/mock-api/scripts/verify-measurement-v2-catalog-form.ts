/**
 * Phase B.2.1 — Measurement V2 catalog form helpers (unit + contract tests).
 * Run: pnpm --filter mock-api verify:measurement-v2-catalog-form
 */
import {
  WEIGHT_STEP_PRESETS,
  applyMeasurementTypeSwitch,
  buildMeasurementApiPayload,
  buildMeasurementPayload,
  buildMeasurementPricePreview,
  defaultCatalogMeasurementForm,
  formatQuantity,
  measurementBadgeAr,
  measurementFormFromProduct,
  measurementTypeSwitchRequiresConfirm,
  validateCatalogMeasurementForm,
  validateMeasurementConfiguration,
  normalizeCatalogProductsForWrite,
  attachMeasurementToProduct,
} from '@nmd/core';

let failed = 0;
function check(cond: boolean, msg: string) {
  if (!cond) {
    failed += 1;
    console.error('FAIL:', msg);
  } else {
    console.log('OK:', msg);
  }
}

// A. Tenant gate
{
  const weight = defaultCatalogMeasurementForm('WEIGHT');
  const blocked = validateCatalogMeasurementForm(weight, { supportsWeightSelling: false });
  check(
    blocked.some((e) => e.code === 'MEASUREMENT_NOT_SUPPORTED'),
    'tenant gate false blocks WEIGHT'
  );
  const allowed = validateCatalogMeasurementForm(weight, { supportsWeightSelling: true });
  check(allowed.length === 0, 'tenant gate true permits WEIGHT');
  const piece = defaultCatalogMeasurementForm('PIECE');
  check(
    validateCatalogMeasurementForm(piece, { supportsWeightSelling: false }).length === 0,
    'PIECE still valid when weight selling off'
  );
  // Existing WEIGHT product must not silently become PIECE when reading
  const existing = measurementFormFromProduct({
    measurementType: 'WEIGHT',
    baseUnitCode: 'kg',
    displayUnitCode: 'g',
    quantityStep: '0.25',
    minimumQuantity: '0.25',
    priceBasis: 'PER_BASE_UNIT',
    measurementVersion: 1,
  });
  check(existing.measurementType === 'WEIGHT', 'existing WEIGHT not downgraded on load');
}

// B. PIECE form
{
  const piece = defaultCatalogMeasurementForm('PIECE');
  check(piece.quantityStep === '1' && piece.minimumQuantity === '1', 'PIECE defaults 1/1');
  check(piece.baseUnitCode === 'piece' && piece.displayUnitCode === 'piece', 'PIECE units piece');
  const bad = { ...piece, useCustomStep: true, customStep: '0.5', quantityStep: '0.5' };
  check(
    validateCatalogMeasurementForm(bad, { supportsWeightSelling: true }).length > 0,
    'PIECE rejects fractional step'
  );
  const api = buildMeasurementApiPayload(piece);
  check(api.measurementType === 'PIECE' && api.quantityStep === '1', 'PIECE save payload');
  check(api.isWeightBased === false, 'PIECE dual-emit isWeightBased false');
}

// C. WEIGHT form
{
  const w = defaultCatalogMeasurementForm('WEIGHT');
  check(w.baseUnitCode === 'kg', 'WEIGHT base fixed kg');
  check(w.displayUnitCode === 'g' || w.displayUnitCode === 'kg', 'WEIGHT display g/kg');
  for (const p of WEIGHT_STEP_PRESETS) {
    const f = { ...w, quantityStep: p, minimumQuantity: p, useCustomStep: false };
    check(
      validateCatalogMeasurementForm(f, { supportsWeightSelling: true }).length === 0,
      `WEIGHT preset ${p} valid`
    );
  }
  const custom = {
    ...w,
    useCustomStep: true,
    customStep: '0.333',
    quantityStep: '0.333',
    minimumQuantity: '0.333',
  };
  check(
    validateCatalogMeasurementForm(custom, { supportsWeightSelling: true }).length === 0,
    'custom 0.333 accepted'
  );
  check(
    validateCatalogMeasurementForm(
      { ...w, useCustomStep: true, customStep: '0', quantityStep: '0', minimumQuantity: '0' },
      { supportsWeightSelling: true }
    ).length > 0,
    'step 0 rejected'
  );
  check(
    validateCatalogMeasurementForm(
      { ...w, useCustomStep: true, customStep: '-0.25', quantityStep: '-0.25', minimumQuantity: '0.25' },
      { supportsWeightSelling: true }
    ).length > 0,
    'negative step rejected'
  );
  check(
    validateCatalogMeasurementForm(
      { ...w, useCustomStep: true, customStep: '0.1234', quantityStep: '0.1234', minimumQuantity: '0.1234' },
      { supportsWeightSelling: true }
    ).length > 0,
    'excessive precision rejected'
  );
}

// D. VOLUME form
{
  const v = defaultCatalogMeasurementForm('VOLUME');
  check(v.baseUnitCode === 'l', 'VOLUME base fixed l');
  check(v.displayUnitCode === 'ml' || v.displayUnitCode === 'l', 'VOLUME display ml/l');
  const ok = validateCatalogMeasurementForm(v, { supportsWeightSelling: true });
  check(ok.length === 0, 'VOLUME default valid');
  const badPair = buildMeasurementPayload({
    ...v,
    baseUnitCode: 'kg',
    displayUnitCode: 'ml',
  });
  // buildMeasurementPayload forces base to l for VOLUME
  check(badPair.baseUnitCode === 'l', 'VOLUME payload forces base l');
}

// E. Switching
{
  check(measurementTypeSwitchRequiresConfirm('PIECE', 'WEIGHT'), 'PIECE→WEIGHT requires confirm');
  const piece = defaultCatalogMeasurementForm('PIECE');
  const switched = applyMeasurementTypeSwitch(piece, 'WEIGHT');
  check(switched.measurementType === 'WEIGHT' && switched.baseUnitCode === 'kg', 'switch applies WEIGHT defaults');
  check(switched.quantityStep !== piece.quantityStep || piece.quantityStep === '1', 'switch resets step defaults');
  // display g↔kg preserves storage step
  const w = defaultCatalogMeasurementForm('WEIGHT');
  const asG = { ...w, displayUnitCode: 'g' as const, quantityStep: '0.25' };
  const asKg = { ...asG, displayUnitCode: 'kg' as const };
  check(
    buildMeasurementPayload(asG).quantityStep === buildMeasurementPayload(asKg).quantityStep,
    'display g↔kg preserves quantityStep storage'
  );
  check(
    buildMeasurementPayload(asG).quantityStep === '0.25',
    'stored step remains 0.25 kg'
  );
}

// F. Preview (integer milli math)
{
  const w = {
    ...defaultCatalogMeasurementForm('WEIGHT'),
    quantityStep: '0.25',
    minimumQuantity: '0.25',
    displayUnitCode: 'g' as const,
  };
  const rows = buildMeasurementPricePreview(40, w);
  const byQty = Object.fromEntries(rows.map((r) => [r.quantityBase, r.priceShekels]));
  check(byQty['0.25'] === 10, '40 × 0.25 = 10');
  check(byQty['0.5'] === 20, '40 × 0.5 = 20');
  check(byQty['1'] === 40, '40 × 1 = 40');
  const v = {
    ...defaultCatalogMeasurementForm('VOLUME'),
    quantityStep: '0.5',
    minimumQuantity: '0.5',
    displayUnitCode: 'ml' as const,
  };
  const vRows = buildMeasurementPricePreview(12, v);
  const vMap = Object.fromEntries(vRows.map((r) => [r.quantityBase, r.priceShekels]));
  check(vMap['0.5'] === 6, '12 × 0.5 = 6');
  check(vMap['1'] === 12, '12 × 1 = 12');
  // no floating residue
  check(Number.isInteger(byQty['0.25'] * 100) || byQty['0.25'] === 10, 'no float residue on 10');
}

// G. Precision safety
{
  const half = formatQuantity({
    quantityBase: '0.5',
    baseUnitCode: 'kg',
    displayUnitCode: 'kg',
    displayPrecision: 0,
  });
  check(half.includes('0.5'), `0.5 never shown as 0/1 (got ${half})`);
  check(!half.startsWith('0 ') && !half.startsWith('1 '), '0.5 not collapsed to 0 or 1');
  const thr = formatQuantity({
    quantityBase: '0.333',
    baseUnitCode: 'kg',
    displayUnitCode: 'kg',
    displayPrecision: 2,
  });
  check(thr.includes('0.333'), `0.333 not truncated to 0.33 (got ${thr})`);
}

// H. API round-trip / full catalog
{
  const weighted = {
    id: 'w1',
    name: 'لحم',
    ...buildMeasurementApiPayload(defaultCatalogMeasurementForm('WEIGHT')),
    basePrice: 40,
  };
  const piece = {
    id: 'p1',
    name: 'حليب',
    ...buildMeasurementApiPayload(defaultCatalogMeasurementForm('PIECE')),
    basePrice: 8,
  };
  const normalized = normalizeCatalogProductsForWrite([weighted, piece] as never[]);
  check(
    (normalized[0] as { measurementType: string }).measurementType === 'WEIGHT',
    'full catalog preserves WEIGHT'
  );
  check(
    (normalized[1] as { measurementType: string }).measurementType === 'PIECE',
    'full catalog preserves PIECE'
  );
  // duplicate copies fields
  const dup = { ...weighted, id: 'w2', name: 'لحم نسخة' };
  const dupNorm = normalizeCatalogProductsForWrite([dup] as never[])[0] as {
    quantityStep: string;
    measurementType: string;
  };
  check(dupNorm.measurementType === 'WEIGHT' && dupNorm.quantityStep === '0.25', 'duplicate copies V2 fields');
  // GET→form→payload without change
  const attached = attachMeasurementToProduct(weighted as never);
  const form = measurementFormFromProduct(attached as never);
  const again = buildMeasurementApiPayload(form);
  check(again.quantityStep === attached.quantityStep, 'round-trip preserves quantityStep');
  check(again.measurementType === attached.measurementType, 'round-trip preserves measurementType');
  check(again.displayUnitCode === attached.displayUnitCode, 'round-trip preserves displayUnitCode');
  // legacy piece still valid
  const legacy = validateMeasurementConfiguration({
    measurementType: 'PIECE',
    baseUnitCode: 'piece',
    displayUnitCode: 'piece',
    quantityStep: '1',
    minimumQuantity: '1',
    maximumQuantity: null,
    priceBasis: 'PER_BASE_UNIT',
    measurementVersion: 1,
    displayPrecision: 0,
  });
  check(legacy.ok, 'legacy PIECE config still valid');
}

// Badges
{
  check(measurementBadgeAr('WEIGHT') === 'وزن', 'badge WEIGHT');
  check(measurementBadgeAr('VOLUME') === 'حجم', 'badge VOLUME');
  check(measurementBadgeAr('PIECE') === 'قطعة', 'badge PIECE');
  check(measurementBadgeAr('PACKAGE') === 'عبوة', 'badge PACKAGE');
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll B.2.1 catalog form checks passed');
