#!/usr/bin/env npx tsx
/**
 * Remove the "orders" key from data.json so it can never re-seed the DB on startup.
 * Run from repo root: DATA_FILE=./apps/mock-api/data.json pnpm exec tsx apps/mock-api/scripts/strip-orders-from-data-json.ts
 * Or from apps/mock-api: pnpm exec tsx scripts/strip-orders-from-data-json.ts
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const DATA_FILE = process.env.DATA_FILE || join(process.cwd(), 'data.json');

function main() {
  if (!existsSync(DATA_FILE)) {
    console.log('File not found:', DATA_FILE);
    process.exit(0);
  }
  const raw = readFileSync(DATA_FILE, 'utf-8');
  const data = JSON.parse(raw) as Record<string, unknown>;
  if (!('orders' in data)) {
    console.log('No "orders" key in', DATA_FILE);
    process.exit(0);
  }
  delete data.orders;
  data.orders = [];
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  console.log('Stripped "orders" from', DATA_FILE, '(set to []). Zombie reseed from this file disabled.');
}

main();
