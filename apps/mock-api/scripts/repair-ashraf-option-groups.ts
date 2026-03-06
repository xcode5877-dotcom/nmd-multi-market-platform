#!/usr/bin/env npx tsx
/**
 * Data repair: ensure all option groups in Ashraf's catalog have tenantId set.
 * Ashraf = pizzaashrf@nmd.com, tenantId 1cc59722-3687-45a1-9121-e7a608fba225.
 *
 * Usage:
 *   cd apps/mock-api && pnpm exec tsx scripts/repair-ashraf-option-groups.ts
 *   DATA_FILE=/path/to/data.json pnpm exec tsx scripts/repair-ashraf-option-groups.ts
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { join } from 'path';

const ASHRAF_TENANT_ID = '1cc59722-3687-45a1-9121-e7a608fba225';

const defaultPath = join(process.cwd(), 'data.json');

interface OptionGroupLike {
  id: string;
  name?: string;
  tenantId?: string;
  ownerId?: string;
  [k: string]: unknown;
}

interface TenantCatalog {
  categories?: unknown[];
  products?: unknown[];
  optionGroups?: OptionGroupLike[];
  optionItems?: unknown[];
}

function main() {
  const inputPath = process.env.DATA_FILE || defaultPath;
  if (!existsSync(inputPath)) {
    console.error('File not found:', inputPath);
    process.exit(1);
  }

  const raw = readFileSync(inputPath, 'utf-8');
  const data = JSON.parse(raw) as { catalog?: Record<string, TenantCatalog> };

  const catalog = data.catalog ?? {};
  const ashrafCatalog = catalog[ASHRAF_TENANT_ID];
  if (!ashrafCatalog) {
    console.log('Ashraf catalog not found for', ASHRAF_TENANT_ID);
    process.exit(0);
  }

  const groups = ashrafCatalog.optionGroups ?? [];
  let repaired = 0;
  for (const g of groups) {
    if (!g.tenantId) {
      (g as OptionGroupLike).tenantId = ASHRAF_TENANT_ID;
      repaired++;
      console.log('Set tenantId on option group:', g.name ?? g.id);
    }
  }

  if (repaired === 0) {
    console.log('No option groups needed repair (all already have tenantId).');
    process.exit(0);
  }

  const backupPath = `${inputPath}.bak-${Date.now()}`;
  copyFileSync(inputPath, backupPath);
  console.log('Backup written to', backupPath);

  writeFileSync(inputPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log('Repaired', repaired, 'option groups; data.json updated.');
}

main();
