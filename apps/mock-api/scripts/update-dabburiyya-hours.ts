#!/usr/bin/env npx tsx
/**
 * One-off: set open/close times so dabburiyya and specific stores are not "Always Closed".
 * - All tenants in market-dabburiyya: openTime 00:00, closeTime 23:59.
 * - Buffalo28 and Shaghaf (by name/slug): closeTime 23:59.
 *
 * Usage (from repo root):
 *   DATA_FILE=data/data.json pnpm exec tsx apps/mock-api/scripts/update-dabburiyya-hours.ts
 * Or from apps/mock-api:
 *   DATA_FILE=../../data/data.json pnpm exec tsx scripts/update-dabburiyya-hours.ts
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DATA_FILE =
  process.env.DATA_FILE ||
  join(process.cwd(), 'data', 'data.json');

interface TenantLike {
  id?: string;
  slug?: string;
  name?: string;
  marketId?: string;
  openTime?: string;
  closeTime?: string;
}

function isBuffaloOrShaghaf(t: TenantLike): boolean {
  const slug = (t.slug ?? '').toLowerCase();
  const name = (t.name ?? '');
  const nameUpper = name.toUpperCase();
  return (
    slug === 'buffalo' ||
    nameUpper.includes('BUFFALO28') ||
    name.includes('Shaghaf') ||
    name.includes('شغف')
  );
}

function main() {
  const raw = readFileSync(DATA_FILE, 'utf-8');
  const data = JSON.parse(raw) as { tenants?: TenantLike[] };
  const tenants = data.tenants ?? [];
  let dab = 0;
  let buffaloShaghaf = 0;

  for (const t of tenants) {
    if (t.marketId === 'market-dabburiyya') {
      (t as { openTime: string }).openTime = '00:00';
      (t as { closeTime: string }).closeTime = '23:59';
      dab++;
    }
    if (isBuffaloOrShaghaf(t)) {
      (t as { closeTime: string }).closeTime = '23:59';
      buffaloShaghaf++;
    }
  }

  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  console.log('Updated', dab, 'tenant(s) in market-dabburiyya (openTime 00:00, closeTime 23:59).');
  console.log('Updated closeTime to 23:59 for', buffaloShaghaf, 'Buffalo28/Shaghaf tenant(s).');
}

main();
