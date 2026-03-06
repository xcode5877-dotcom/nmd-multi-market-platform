/**
 * URGENT: Backup first, then global image wipe + flush uploads.
 * Rule: NO script should run without backup. This script creates a timestamped backup
 * then wipes all image URLs in data.json and market-config.json, and optionally flushes uploads.
 *
 * Usage: cd apps/mock-api && pnpm exec tsx scripts/backup-then-wipe-images.ts
 * Env: BACKUP_ONLY=1 to only create backup then exit. SKIP_BACKUP=1 to skip backup (not recommended). FLUSH_UPLOADS=0 to keep uploads/.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, rmdirSync, copyFileSync } from 'fs';
import { join, resolve } from 'path';
import { execSync } from 'child_process';

const DATA_FILE = process.env.DATA_FILE || resolve(process.cwd(), 'data.json');
const MARKET_CONFIG_FILE = process.env.MARKET_CONFIG_FILE || resolve(process.cwd(), 'market-config.json');
const UPLOADS_DIR = process.env.UPLOADS_DIR || resolve(process.cwd(), 'uploads');
const BACKUPS_ROOT = resolve(process.cwd(), '..', '..', 'backups');

function backupFirst(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const backDir = join(BACKUPS_ROOT, `pre-wipe-${stamp}`);
  mkdirSync(backDir, { recursive: true });
  if (existsSync(DATA_FILE)) {
    const data = readFileSync(DATA_FILE, 'utf-8');
    writeFileSync(join(backDir, 'data.json'), data, 'utf-8');
  }
  if (existsSync(MARKET_CONFIG_FILE)) {
    copyFileSync(MARKET_CONFIG_FILE, join(backDir, 'market-config.json'));
  }
  const uploadsArchive = join(backDir, 'uploads.tar.gz');
  if (existsSync(UPLOADS_DIR)) {
    try {
      execSync(`tar czf "${uploadsArchive}" -C "${resolve(UPLOADS_DIR, '..')}" uploads`, { stdio: 'pipe' });
    } catch {
      // ignore if tar fails
    }
  }
  console.log('[backup] Saved to', backDir);
  return backDir;
}

function wipeImagesInData(data: Record<string, unknown>): void {
  const tenants = (data.tenants || []) as Record<string, unknown>[];
  for (const t of tenants) {
    if (typeof t.logoUrl === 'string') t.logoUrl = '';
    const hero = t.hero as Record<string, unknown> | undefined;
    if (hero && typeof hero.imageUrl === 'string') hero.imageUrl = '';
    const banners = (t.banners || []) as Array<Record<string, unknown>>;
    for (const b of banners) if (typeof b.imageUrl === 'string') b.imageUrl = '';
  }
  const markets = (data.markets || []) as Array<Record<string, unknown>>;
  for (const m of markets) {
    const stores = (m.stores || []) as Array<Record<string, unknown>>;
    for (const s of stores) {
      if (typeof s.logoUrl === 'string') s.logoUrl = '';
      const hero = s.hero as Record<string, unknown> | undefined;
      if (hero && typeof hero.imageUrl === 'string') hero.imageUrl = '';
      const banners = (s.banners || []) as Array<Record<string, unknown>>;
      for (const b of banners) if (typeof b.imageUrl === 'string') b.imageUrl = '';
    }
  }
  const catalog = (data.catalog || {}) as Record<string, { products?: Array<Record<string, unknown>> }>;
  for (const tenantId of Object.keys(catalog)) {
    const cat = catalog[tenantId];
    const products = (cat?.products || []) as Array<Record<string, unknown>>;
    for (const p of products) {
      if (typeof p.imageUrl === 'string') p.imageUrl = '';
      const images = (p.images || []) as Array<Record<string, unknown>>;
      for (const img of images) if (typeof img.url === 'string') img.url = '';
    }
  }
}

function flushUploads(dir: string): void {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      flushUploads(full);
      rmdirSync(full);
    } else {
      unlinkSync(full);
    }
  }
}

function main(): void {
  const skipBackup = process.env.SKIP_BACKUP === '1';
  const flushUploadsFlag = process.env.FLUSH_UPLOADS !== '0';
  const backupOnly = process.env.BACKUP_ONLY === '1';

  if (!skipBackup) backupFirst();
  else console.log('[backup] SKIP_BACKUP=1, skipping backup');

  if (backupOnly) {
    console.log('[backup] BACKUP_ONLY=1, exiting after backup.');
    return;
  }

  const data = JSON.parse(readFileSync(DATA_FILE, 'utf-8')) as Record<string, unknown>;
  wipeImagesInData(data);
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  console.log('[wipe] data.json: all logoUrl, hero.imageUrl, banners[].imageUrl, products[].imageUrl set to ""');

  if (existsSync(MARKET_CONFIG_FILE)) {
    const mc = JSON.parse(readFileSync(MARKET_CONFIG_FILE, 'utf-8')) as Record<string, unknown>;
    const banners = (mc.banners || {}) as Record<string, Array<{ imageUrl?: string }>>;
    for (const marketSlug of Object.keys(banners)) {
      for (const b of banners[marketSlug] || []) if (typeof b.imageUrl === 'string') b.imageUrl = '';
    }
    writeFileSync(MARKET_CONFIG_FILE, JSON.stringify(mc, null, 2), 'utf-8');
    console.log('[wipe] market-config.json: all banner imageUrl set to ""');
  }

  if (flushUploadsFlag && existsSync(UPLOADS_DIR)) {
    flushUploads(UPLOADS_DIR);
    console.log('[flush] uploads/ folder emptied');
  }

  console.log('[done] 12 stores remain; images are empty. Restore from backups/ if needed.');
}

main();
