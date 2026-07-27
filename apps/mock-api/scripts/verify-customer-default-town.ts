/**
 * Verifies defaultDeliveryTown validation helpers (no server required).
 * Run: pnpm --filter mock-api exec tsx scripts/verify-customer-default-town.ts
 */
import {
  SUPPORTED_DELIVERY_TOWNS,
  isSupportedDeliveryTown,
  matchDeliveryZoneForTown,
} from '../src/delivery-towns.js';

let failed = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failed += 1;
  } else {
    console.log(`OK: ${message}`);
  }
}

assert(SUPPORTED_DELIVERY_TOWNS.length === 9, 'supported towns list has 9 entries');
assert(isSupportedDeliveryTown('دبورية'), 'دبورية is supported');
assert(isSupportedDeliveryTown('إكسال'), 'إكسال is supported');
assert(!isSupportedDeliveryTown('تل أبيب'), 'تل أبيب is rejected');
assert(!isSupportedDeliveryTown(''), 'empty string is rejected');
assert(!isSupportedDeliveryTown(null), 'null is rejected');

const zones = [
  { id: 'z1', name: 'دبورية' },
  { id: 'z2', name: 'إكسال / شرق' },
  { id: 'z3', name: 'شبلي' },
];

const hit = matchDeliveryZoneForTown(zones, 'دبورية');
assert(hit?.id === 'z1', 'matchDeliveryZoneForTown exact match');
const partial = matchDeliveryZoneForTown(zones, 'إكسال');
assert(partial?.id === 'z2', 'matchDeliveryZoneForTown partial match');
const miss = matchDeliveryZoneForTown(zones, 'نابلس');
assert(miss === undefined, 'matchDeliveryZoneForTown unsupported town');

if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log('\nAll customer default town checks passed.');
