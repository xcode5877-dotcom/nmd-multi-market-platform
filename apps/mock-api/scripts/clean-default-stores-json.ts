#!/usr/bin/env npx tsx
/**
 * Remove default/placeholder stores (مخبز دبورية, إلكترونيات دبورية) from data.json
 * so the JSON becomes the recovered source of truth without deleted stores.
 *
 * Usage:
 *   cd apps/mock-api && pnpm exec tsx scripts/clean-default-stores-json.ts
 *   SEED_JSON_PATH=/data/data.json pnpm exec tsx scripts/clean-default-stores-json.ts
 *
 * Reads from SEED_JSON_PATH or apps/mock-api/data/data.json, writes back after backup.
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'fs';
import { join } from 'path';

const DEFAULT_STORE_IDS = ['store-dab-bakery', 'store-dab-electronics'];

const dataDir = join(process.cwd(), 'data');
const defaultPath = join(dataDir, 'data.json');

function main() {
  const inputPath = process.env.SEED_JSON_PATH || defaultPath;
  if (!existsSync(inputPath)) {
    console.error('File not found:', inputPath);
    process.exit(1);
  }

  const raw = readFileSync(inputPath, 'utf-8');
  const data = JSON.parse(raw) as {
    markets?: Array<{
      id: string;
      tenantIds?: string[];
      stores?: unknown[];
    }>;
    tenants?: Array<{ id: string }>;
    catalog?: Record<string, unknown>;
    delivery?: Record<string, unknown>;
    deliveryZones?: Record<string, unknown>;
    auditEvents?: Array<{ entityId?: string }>;
  };

  const toRemove = new Set(DEFAULT_STORE_IDS);
  let changed = false;

  // tenants
  if (Array.isArray(data.tenants)) {
    const before = data.tenants.length;
    data.tenants = data.tenants.filter((t) => !toRemove.has(t.id));
    if (data.tenants.length !== before) changed = true;
  }

  // markets: tenantIds and stores
  if (Array.isArray(data.markets)) {
    for (const m of data.markets) {
      if (Array.isArray(m.tenantIds)) {
        const before = m.tenantIds.length;
        m.tenantIds = m.tenantIds.filter((id) => !toRemove.has(id));
        if (m.tenantIds.length !== before) changed = true;
      }
      if (Array.isArray(m.stores)) {
        const before = m.stores.length;
        m.stores = m.stores.filter((s: { id?: string }) => !toRemove.has(s.id ?? ''));
        if (m.stores.length !== before) changed = true;
      }
    }
  }

  // catalog
  if (data.catalog && typeof data.catalog === 'object') {
    for (const id of toRemove) {
      if (id in data.catalog) {
        delete data.catalog[id];
        changed = true;
      }
    }
  }

  // delivery
  if (data.delivery && typeof data.delivery === 'object') {
    for (const id of toRemove) {
      if (id in data.delivery) {
        delete data.delivery[id];
        changed = true;
      }
    }
  }

  // deliveryZones
  if (data.deliveryZones && typeof data.deliveryZones === 'object') {
    for (const id of toRemove) {
      if (id in data.deliveryZones) {
        delete data.deliveryZones[id];
        changed = true;
      }
    }
  }

  // auditEvents
  if (Array.isArray(data.auditEvents)) {
    const before = data.auditEvents.length;
    data.auditEvents = data.auditEvents.filter((e) => !toRemove.has(e.entityId ?? ''));
    if (data.auditEvents.length !== before) changed = true;
  }

  if (!changed) {
    console.log('No default stores found in JSON; file unchanged.');
    return;
  }

  const backupPath = inputPath + '.bak.' + Date.now();
  copyFileSync(inputPath, backupPath);
  console.log('Backup written to', backupPath);

  writeFileSync(inputPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log('Removed', DEFAULT_STORE_IDS.join(', '), 'from', inputPath);
}

main();
