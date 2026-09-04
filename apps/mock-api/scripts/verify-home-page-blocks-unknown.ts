/**
 * Verify home page block coerce preserves unknown types (fixtures only).
 */
import assert from 'node:assert/strict';
import {
  coerceHomePageBlockList,
  validateHomePageBlocks,
  type HomePageBlock,
} from '../src/market-config.ts';

const mixed = coerceHomePageBlockList([
  {
    id: 'a',
    type: 'HERO_BANNERS',
    title: 'Hero',
    visible: true,
    sortOrder: 0,
    config: {},
  },
  {
    id: 'b',
    type: 'FUTURE_CAROUSEL',
    title: 'Future',
    visible: true,
    sortOrder: 1,
    config: { x: 1 },
  },
]);

assert.equal(mixed.length, 2);
assert.equal(mixed[0].type, 'HERO_BANNERS');
assert.equal(mixed[1].type, 'FUTURE_CAROUSEL', 'unknown type must not become STORE_SECTION');
assert.deepEqual(mixed[1].config, { x: 1 });

const errs = validateHomePageBlocks(mixed as HomePageBlock[]);
assert.equal(errs.length, 0, 'unknown types must not fail validation');

console.log('PASS coerce preserves unknown types + validation');
