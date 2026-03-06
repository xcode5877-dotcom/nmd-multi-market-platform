/**
 * Audit-to-tenant sync + bulk WebP image fix + asset validation.
 *
 * 1. Scan auditEvents for entity===tenant; for each unique entityId, take the latest "after" snapshot.
 * 2. Add any missing tenant to tenants[] (same id as in logs).
 * 3. Ensure market.tenantIds includes all tenants that belong to that market.
 * 4. Ensure catalog[tenantId] exists for every tenant (empty if missing).
 * 5. Bulk fix: any /uploads/ URL ending in .jpg .jpeg .png .gif → .webp in the whole file.
 * 6. Validate: for each tenant, check logo/hero/banner files exist in uploads/ or uploads/banners/.
 *
 * Usage: cd apps/mock-api && pnpm exec tsx scripts/sync-audit-tenants-and-images.ts
 */

import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';

const DATA_FILE = process.env.DATA_FILE || resolve(process.cwd(), 'data.json');
function getUploadsDir(): string {
  if (process.env.UPLOADS_DIR) return resolve(process.env.UPLOADS_DIR);
  const cwd = process.cwd();
  const dataUploads = join(cwd, 'data', 'uploads');
  if (existsSync(dataUploads)) return resolve(dataUploads);
  return resolve(join(cwd, 'uploads'));
}
const UPLOADS_DIR = getUploadsDir();
const UPLOADS_BANNERS = join(UPLOADS_DIR, 'banners');

type Tenant = Record<string, unknown>;
type Market = { id: string; tenantIds?: string[]; [k: string]: unknown };
type Data = {
  markets?: Market[];
  tenants?: Tenant[];
  auditEvents?: Array<{ entity?: string; entityId?: string; at?: string; after?: Tenant; before?: Tenant }>;
  catalog?: Record<string, { categories?: unknown[]; products?: unknown[]; optionGroups?: unknown[]; optionItems?: unknown[] }>;
  [k: string]: unknown;
};

function loadData(): Data {
  const raw = readFileSync(DATA_FILE, 'utf-8');
  return JSON.parse(raw) as Data;
}

function saveData(data: Data): void {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/** Build map: tenantId -> latest "after" snapshot from audit (by "at" desc). */
function tenantsFromAudit(data: Data): Map<string, Tenant> {
  const map = new Map<string, Tenant>();
  const events = (data.auditEvents || []).filter((e) => e.entity === 'tenant' && e.entityId && e.after);
  events.sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime());
  for (const e of events) {
    const id = e.entityId!;
    if (!map.has(id)) map.set(id, { ...e.after } as Tenant);
  }
  return map;
}

/** Remove audit-only fields; ensure slug is valid. */
function cleanTenant(t: Tenant): Tenant {
  const out = { ...t };
  delete (out as Record<string, unknown>)._meta;
  const slug = (out.slug as string) || '';
  if (!slug || slug === '-') {
    const name = (out.name as string) || '';
    out.slug = (name.replace(/\s+/g, '-').replace(/[^\w\u0600-\u06FF-]/g, '') || (out.id as string) || 'store').toLowerCase().slice(0, 50);
  }
  return out;
}

/** Ensure catalog entry exists for tenantId. */
function ensureCatalog(data: Data, tenantId: string): void {
  if (!data.catalog) data.catalog = {};
  if (!data.catalog[tenantId]) {
    data.catalog[tenantId] = { categories: [], products: [], optionGroups: [], optionItems: [] };
  }
}

/** Extract filename from URL (e.g. .../uploads/foo.webp -> foo.webp, .../uploads/banners/bar.webp -> banners/bar.webp). */
function urlToRelativePath(url: string): string | null {
  const m = url.match(/\/uploads\/(.+)$/);
  return m ? m[1] : null;
}

/** Replace in raw string: /uploads/... .(jpg|jpeg|png|gif) -> .webp (only uploads URLs). */
function bulkWebpReplace(raw: string): string {
  return raw.replace(
    /(https?:\/\/[^"]*?\/uploads\/[^"]*?)\.(jpe?g|png|gif)"/gi,
    (_, prefix) => `${prefix}.webp"`
  );
}

function main(): void {
  console.log('[sync] DATA_FILE:', DATA_FILE);
  console.log('[sync] UPLOADS_DIR:', UPLOADS_DIR);

  let raw = readFileSync(DATA_FILE, 'utf-8');
  const data = JSON.parse(raw) as Data;

  const auditTenants = tenantsFromAudit(data);
  const currentIds = new Set((data.tenants || []).map((t) => t.id as string));
  const missing = [...auditTenants.keys()].filter((id) => !currentIds.has(id));

  console.log('[sync] Unique tenants in audit:', auditTenants.size);
  console.log('[sync] Current tenants:', (data.tenants || []).length);
  console.log('[sync] Missing from tenants (will restore):', missing.length, missing);

  if (!data.tenants) data.tenants = [];
  for (const id of missing) {
    const snapshot = auditTenants.get(id);
    if (!snapshot || !snapshot.id) continue;
    const cleaned = cleanTenant(snapshot);
    data.tenants.push(cleaned);
    ensureCatalog(data, id);
    const marketId = snapshot.marketId as string | undefined;
    if (marketId) {
      const market = (data.markets || []).find((m) => m.id === marketId);
      if (market) {
        const ids = (market.tenantIds || []) as string[];
        if (!ids.includes(id)) ids.push(id);
        market.tenantIds = ids;
      }
    }
    console.log('[sync] Restored tenant:', (cleaned.name as string) || id, 'id=', id);
  }

  let outStr = JSON.stringify(data, null, 2);
  const beforeReplace = (outStr.match(/\.(jpe?g|png|gif)"/gi) || []).length;
  outStr = bulkWebpReplace(outStr);
  const afterReplace = (outStr.match(/\.(jpe?g|png|gif)"/gi) || []).length;
  console.log('[sync] Bulk WebP: old ext count before', beforeReplace, 'after', afterReplace);

  writeFileSync(DATA_FILE, outStr, 'utf-8');

  const marketConfigPath = resolve(process.cwd(), 'market-config.json');
  if (existsSync(marketConfigPath)) {
    let mcRaw = readFileSync(marketConfigPath, 'utf-8');
    const mcBefore = (mcRaw.match(/\.(jpe?g|png|gif)"/gi) || []).length;
    mcRaw = bulkWebpReplace(mcRaw);
    if (mcBefore > 0) writeFileSync(marketConfigPath, mcRaw, 'utf-8');
  }

  const dataAfter = JSON.parse(outStr) as Data;
  const tenants = (dataAfter.tenants || []) as Tenant[];
  const missingAssets: string[] = [];
  for (const t of tenants) {
    const urls: string[] = [];
    if (t.logoUrl && typeof t.logoUrl === 'string') urls.push(t.logoUrl as string);
    const hero = t.hero as { imageUrl?: string } | undefined;
    if (hero?.imageUrl) urls.push(hero.imageUrl);
    const banners = (t.banners || []) as Array<{ imageUrl?: string }>;
    for (const b of banners) if (b.imageUrl) urls.push(b.imageUrl);
    for (const url of urls) {
      const rel = urlToRelativePath(url);
      if (!rel) continue;
      const full = join(UPLOADS_DIR, rel);
      if (!existsSync(full)) missingAssets.push(`${t.name as string} (${t.id}): ${rel}`);
    }
  }
  const dataUploadsDir = resolve(process.cwd(), 'data', 'uploads');
  let copied = 0;
  for (const msg of missingAssets) {
    const rel = msg.split(': ')[1];
    if (!rel) continue;
    const fromPath = join(dataUploadsDir, rel);
    const toPath = join(UPLOADS_DIR, rel);
    if (existsSync(fromPath) && !existsSync(toPath)) {
      const toDir = dirname(toPath);
      if (!existsSync(toDir)) mkdirSync(toDir, { recursive: true });
      copyFileSync(fromPath, toPath);
      copied++;
    }
  }
  if (copied > 0) console.log('[sync] Copied', copied, 'missing assets from data/uploads to uploads/');
  if (missingAssets.length > 0) {
    const stillMissing = missingAssets.filter((m) => {
      const rel = m.split(': ')[1];
      return rel && !existsSync(join(UPLOADS_DIR, rel)) && !existsSync(join(dataUploadsDir, rel!));
    });
    console.log('[sync] Missing asset files (logo/hero/banner):', stillMissing.length, '(after copy)');
    stillMissing.slice(0, 15).forEach((s) => console.log('  -', s));
    if (stillMissing.length > 15) console.log('  ... and', stillMissing.length - 15, 'more');
  } else {
    console.log('[sync] All tenant assets present in uploads/');
  }

  console.log('[sync] Done. Tenants count:', (dataAfter.tenants || []).length);
}

main();
