#!/usr/bin/env npx tsx
/**
 * Clean slate: keep 11 stores (tenants + settings) but wipe products, collections, banners, and image URLs.
 * Usage: cd apps/mock-api && pnpm exec tsx scripts/clean-slate-data.ts
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const DATA_PATH = join(process.cwd(), 'data.json');

function main() {
  const raw = readFileSync(DATA_PATH, 'utf-8');
  const data = JSON.parse(raw) as {
    markets?: Array<{ stores?: Array<Record<string, unknown>>; [k: string]: unknown }>;
    tenants?: Array<Record<string, unknown>>;
    catalog?: Record<string, { categories?: unknown[]; products?: unknown[]; optionGroups?: unknown[] }>;
    [k: string]: unknown;
  };

  const placeholder = '';

  // Tenants: keep slug, name, businessType, storeType, type, etc.; wipe banners, collections, logoUrl, hero.imageUrl
  if (Array.isArray(data.tenants)) {
    data.tenants = data.tenants.map((t) => {
      const out = { ...t };
      out.banners = [];
      out.collections = [];
      out.logoUrl = placeholder;
      if (out.hero && typeof out.hero === 'object') {
        out.hero = { ...(out.hero as Record<string, unknown>), imageUrl: placeholder };
      }
      return out;
    });
  }

  // Markets: each market.stores[] — same wipe
  if (Array.isArray(data.markets)) {
    data.markets = data.markets.map((m) => {
      const out = { ...m };
      if (Array.isArray(out.stores)) {
        out.stores = out.stores.map((s) => {
          const so = { ...s };
          so.banners = [];
          so.collections = [];
          so.logoUrl = placeholder;
          if (so.hero && typeof so.hero === 'object') {
            so.hero = { ...(so.hero as Record<string, unknown>), imageUrl: placeholder };
          }
          return so;
        });
      }
      return out;
    });
  }

  // Catalog: empty products, categories, optionGroups per tenant
  if (data.catalog && typeof data.catalog === 'object') {
    for (const tenantId of Object.keys(data.catalog)) {
      data.catalog[tenantId] = {
        categories: [],
        products: [],
        optionGroups: [],
      };
    }
  }

  writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
  console.log('Clean slate applied:', data.tenants?.length ?? 0, 'tenants; catalog wiped; image URLs cleared.');
}

main();
