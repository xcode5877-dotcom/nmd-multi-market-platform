/**
 * Focused Home Builder regression checks (fixtures only — no production I/O).
 * Run: node --experimental-strip-types apps/nmd-admin/scripts/verify-home-builder-load.mts
 * or via pnpm exec tsx if available.
 */
import assert from 'node:assert/strict';
import {
  canSaveHomeBuilderLayout,
  isHomeBuilderDirty,
  shouldApplyHomeBuilderServerBlocks,
  shouldConfirmEmptyHomeBuilderSave,
} from '../src/lib/homeBuilderHydration.ts';
import {
  homePageBlocksSnapshotKey,
  normalizeHomePageBlocksList,
  toHomePageBlocksSavePayload,
  validateHomePageBlocksClient,
  type HomePageBlock,
} from '../src/types/homePageBlock.ts';

const dabburiyyaFixture: unknown[] = [
  {
    id: 'block_1787562235059_f3i2',
    type: 'HERO_BANNERS',
    title: 'سلايدر البانرات',
    visible: true,
    sortOrder: 0,
    config: {},
  },
  {
    id: 'block_1787562240502_648u',
    type: 'PILLARS',
    title: 'الأقسام الرئيسية',
    visible: true,
    sortOrder: 1,
    config: {},
  },
  {
    id: 'block_1787562247195_ojg9',
    type: 'STORE_SECTION',
    title: 'اكلات منوعة',
    visible: true,
    sortOrder: 2,
    config: { source: 'LAYOUT_SECTION', layoutSectionId: 'mixed', layout: 'HORIZONTAL', limit: 12 },
  },
  {
    id: 'block_future_x',
    type: 'FUTURE_CAROUSEL',
    title: 'بلوك جديد',
    visible: true,
    sortOrder: 3,
    config: { cool: true },
  },
  {
    id: 'broken_no_type',
    title: 'broken',
    visible: true,
    sortOrder: 99,
    config: {},
  },
];

function testHydrateSavedBlocks() {
  const blocks = normalizeHomePageBlocksList(dabburiyyaFixture);
  assert.equal(blocks.length, 4, 'known + unknown kept; malformed dropped');
  assert.equal(blocks[0].id, 'block_1787562235059_f3i2');
  assert.equal(blocks[3].type, 'FUTURE_CAROUSEL');
  assert.equal(blocks[3].isUnknownType, true);
  assert.deepEqual(
    blocks.map((b) => b.id),
    [
      'block_1787562235059_f3i2',
      'block_1787562240502_648u',
      'block_1787562247195_ojg9',
      'block_future_x',
    ],
  );
}

function testInitialDirtyDoesNotBlockHydration() {
  // Reproduce the bug: empty working vs empty serverKey looked dirty forever.
  const working: HomePageBlock[] = [];
  const serverKey = '';
  const buggyDirty = homePageBlocksSnapshotKey(working) !== serverKey;
  assert.equal(buggyDirty, true, 'precondition: legacy comparison is true before hydrate');

  const fixedDirty = isHomeBuilderDirty(working, serverKey, false);
  assert.equal(fixedDirty, false, 'not dirty until hydrated');

  assert.equal(
    shouldApplyHomeBuilderServerBlocks({
      querySuccess: true,
      marketSlug: 'dabburiyya',
      hydratedSlug: null,
      isDirty: fixedDirty,
    }),
    true,
  );
}

function testRefreshKeepsCleanHydration() {
  const blocks = normalizeHomePageBlocksList(dabburiyyaFixture);
  const key = homePageBlocksSnapshotKey(blocks);
  assert.equal(isHomeBuilderDirty(blocks, key, true), false);
  assert.equal(
    shouldApplyHomeBuilderServerBlocks({
      querySuccess: true,
      marketSlug: 'dabburiyya',
      hydratedSlug: 'dabburiyya',
      isDirty: false,
    }),
    true,
    'manual refresh can re-apply server blocks when not dirty',
  );
}

function testDirtyBlocksOverwrite() {
  assert.equal(
    shouldApplyHomeBuilderServerBlocks({
      querySuccess: true,
      marketSlug: 'dabburiyya',
      hydratedSlug: 'dabburiyya',
      isDirty: true,
    }),
    false,
  );
}

function testMarketSwitchIsolation() {
  assert.equal(
    shouldApplyHomeBuilderServerBlocks({
      querySuccess: true,
      marketSlug: 'iksal',
      hydratedSlug: 'dabburiyya',
      isDirty: true,
    }),
    true,
    'new market always hydrates even if previous market was dirty',
  );
}

function testSaveRefetchRoundTrip() {
  const loaded = normalizeHomePageBlocksList(dabburiyyaFixture);
  const payload = toHomePageBlocksSavePayload(loaded);
  assert.equal(payload.length, 4);
  assert.equal(payload[3].type, 'FUTURE_CAROUSEL');
  assert.ok(!('isUnknownType' in payload[3]));
  const again = normalizeHomePageBlocksList(payload);
  assert.deepEqual(
    again.map((b) => ({ id: b.id, type: b.type, visible: b.visible })),
    loaded.map((b) => ({ id: b.id, type: b.type, visible: b.visible })),
  );
}

function testApiFailureCannotSave() {
  assert.equal(
    canSaveHomeBuilderLayout({
      hydrated: false,
      isDirty: true,
      savePending: false,
      validationErrorCount: 0,
    }),
    false,
  );
}

function testLegitimateEmptyDistinct() {
  assert.equal(
    shouldConfirmEmptyHomeBuilderSave({ hydrated: true, blockCount: 0 }),
    true,
  );
  assert.equal(
    shouldConfirmEmptyHomeBuilderSave({ hydrated: false, blockCount: 0 }),
    false,
    'unhydrated empty must not be treated as intentional empty save',
  );
}

function testUnknownDoesNotBlockValidation() {
  const blocks = normalizeHomePageBlocksList(dabburiyyaFixture);
  const errs = validateHomePageBlocksClient(blocks);
  assert.equal(errs.length, 0);
}

function testNonArrayPayloadIsEmptyNotCrash() {
  assert.deepEqual(normalizeHomePageBlocksList(undefined), []);
  assert.deepEqual(normalizeHomePageBlocksList({ blocks: [] }), []);
  assert.deepEqual(normalizeHomePageBlocksList(null), []);
}

const tests = [
  ['hydrate saved blocks', testHydrateSavedBlocks],
  ['initial dirty bug fixed', testInitialDirtyDoesNotBlockHydration],
  ['refresh retains clean hydration', testRefreshKeepsCleanHydration],
  ['dirty blocks overwrite', testDirtyBlocksOverwrite],
  ['market switch isolation', testMarketSwitchIsolation],
  ['save/refetch round-trip', testSaveRefetchRoundTrip],
  ['API failure cannot save', testApiFailureCannotSave],
  ['empty save confirmation', testLegitimateEmptyDistinct],
  ['unknown block validation', testUnknownDoesNotBlockValidation],
  ['non-array payload', testNonArrayPayloadIsEmptyNotCrash],
] as const;

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(e);
  }
}
if (failed > 0) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log(`\n${tests.length} passed`);
