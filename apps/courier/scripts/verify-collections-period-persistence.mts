/**
 * Collections period persistence helper tests (no browser).
 */
import assert from 'node:assert/strict';
import {
  COLLECTIONS_PERIOD_STORAGE_KEY,
  collectionsPeriodSearch,
  parseCollectionsPeriod,
  resolveCollectionsPeriod,
  writeStoredCollectionsPeriod,
} from '../src/lib/collectionsPeriod.js';

const memory = new Map<string, string>();
(globalThis as { localStorage?: Storage }).localStorage = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => {
    memory.set(k, String(v));
  },
  removeItem: (k) => {
    memory.delete(k);
  },
  clear: () => memory.clear(),
  key: () => null,
  get length() {
    return memory.size;
  },
} as Storage;

memory.clear();
assert.equal(parseCollectionsPeriod('all'), 'all');
assert.equal(parseCollectionsPeriod('nope'), null);
assert.equal(resolveCollectionsPeriod(null), 'today');
writeStoredCollectionsPeriod('all');
assert.equal(memory.get(COLLECTIONS_PERIOD_STORAGE_KEY), 'all');
assert.equal(resolveCollectionsPeriod(null), 'all');
assert.equal(resolveCollectionsPeriod('week'), 'week');
assert.equal(collectionsPeriodSearch(''), '?period=all');
assert.equal(collectionsPeriodSearch('?period=month'), '?period=month');
writeStoredCollectionsPeriod('today');
assert.equal(collectionsPeriodSearch(''), '');
console.log('verify-collections-period-persistence: OK');
