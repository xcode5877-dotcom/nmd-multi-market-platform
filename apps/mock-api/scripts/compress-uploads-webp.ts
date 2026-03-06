/**
 * One-time script: compress ALL images in uploads/ and uploads/banners/ to WebP (quality 75),
 * then update data.json and market-config.json so all /uploads/ URLs use .webp (no broken refs).
 *
 * Usage (from repo root or apps/mock-api):
 *   cd apps/mock-api && pnpm exec tsx scripts/compress-uploads-webp.ts
 *   UPLOADS_DIR=/app/uploads DATA_FILE=/data/data.json pnpm exec tsx scripts/compress-uploads-webp.ts
 */

import { readdirSync, readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { join, resolve, dirname, basename } from 'path';
import sharp from 'sharp';

const WEBP_QUALITY = 75;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i;

function getUploadsDir(): string {
  const envDir = process.env.UPLOADS_DIR;
  if (envDir) return resolve(envDir);
  const cwd = process.cwd();
  const dataUploads = join(cwd, 'data', 'uploads');
  if (existsSync(dataUploads)) return resolve(dataUploads);
  const pkgMock = join(cwd, '..', '..', 'packages', 'mock', 'uploads');
  return resolve(pkgMock);
}

/** Single source of truth: only update ONE data file so we never overwrite with an older copy. */
function getDataFilePaths(): string[] {
  const env = process.env.DATA_FILE;
  if (env) return [resolve(env)];
  const cwd = process.cwd();
  // Canonical path: apps/mock-api/data.json (Docker mounts this file; do not write to data/data.json here)
  const canonical = join(cwd, 'data.json');
  return existsSync(canonical) ? [canonical] : [];
}

function getMarketConfigPath(): string {
  const env = process.env.MARKET_CONFIG_FILE;
  if (env) return resolve(env);
  return join(process.cwd(), 'market-config.json');
}

async function convertToWebP(inputPath: string, outputPath: string): Promise<void> {
  await sharp(inputPath)
    .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toFile(outputPath);
}

/** Replace in JSON only URLs for files we actually converted (so placeholder refs are not broken). */
function updateJsonUploadUrls(content: string, converted: { from: string; to: string }[]): string {
  let out = content;
  for (const { from, to } of converted) {
    // Replace the exact old filename with the new one when it appears in /uploads/ URLs
    const escapedFrom = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`(/uploads/[^"]*?)${escapedFrom}(")`, 'g'), `$1${to}$2`);
  }
  return out;
}

async function main(): Promise<void> {
  const UPLOADS_DIR = getUploadsDir();
  const UPLOADS_BANNERS_DIR = join(UPLOADS_DIR, 'banners');
  const dataPaths = getDataFilePaths();
  const marketConfigPath = getMarketConfigPath();

  console.log('[compress-uploads-webp] UPLOADS_DIR:', UPLOADS_DIR);
  console.log('[compress-uploads-webp] DATA_FILE(s):', dataPaths);
  console.log('[compress-uploads-webp] MARKET_CONFIG:', marketConfigPath);

  if (!existsSync(UPLOADS_DIR)) {
    console.warn('[compress-uploads-webp] No uploads dir found, nothing to do.');
    return;
  }
  if (!existsSync(UPLOADS_BANNERS_DIR)) mkdirSync(UPLOADS_BANNERS_DIR, { recursive: true });

  const dirs = [UPLOADS_DIR, UPLOADS_BANNERS_DIR];
  const converted: { from: string; to: string }[] = [];

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir).filter((f) => IMAGE_EXT.test(f));
    for (const file of files) {
      const ext = (file.match(/\.([^.]+)$/)?.[1] ?? '').toLowerCase();
      if (ext === 'webp') continue; // already webp
      const inputPath = join(dir, file);
      const base = basename(file, ext ? `.${ext}` : '');
      const webpName = `${base}.webp`;
      const outputPath = join(dir, webpName);
      try {
        await convertToWebP(inputPath, outputPath);
        unlinkSync(inputPath);
        converted.push({ from: file, to: webpName });
        console.log('[compress-uploads-webp]', file, '->', webpName);
      } catch (err) {
        console.error('[compress-uploads-webp] Failed', file, err);
      }
    }
  }

  if (converted.length === 0) {
    console.log('[compress-uploads-webp] No images converted (none found or already webp).');
  } else {
    console.log('[compress-uploads-webp] Converted', converted.length, 'files.');
  }

  // Update data.json only for converted filenames (keeps placeholder URLs intact)
  for (const dataPath of dataPaths) {
    const raw = readFileSync(dataPath, 'utf-8');
    const updated = updateJsonUploadUrls(raw, converted);
    if (updated !== raw) {
      writeFileSync(dataPath, updated, 'utf-8');
      console.log('[compress-uploads-webp] Updated', dataPath);
    }
  }
  if (dataPaths.length === 0) console.warn('[compress-uploads-webp] No DATA_FILE found.');

  if (existsSync(marketConfigPath)) {
    const raw = readFileSync(marketConfigPath, 'utf-8');
    const updated = updateJsonUploadUrls(raw, converted);
    if (updated !== raw) {
      writeFileSync(marketConfigPath, updated, 'utf-8');
      console.log('[compress-uploads-webp] Updated', marketConfigPath);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
