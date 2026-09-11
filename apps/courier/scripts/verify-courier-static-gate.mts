#!/usr/bin/env npx tsx
/**
 * Courier production dist integrity + optional live browser smoke.
 * Build with: VITE_API_BASE_URL=https://nmd.marketing/api pnpm --filter courier build
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const assetsDir = resolve(dist, 'assets');
let passed = 0;
const assert = (c: boolean, m: string) => {
  if (!c) throw new Error(m);
  passed += 1;
  console.log('  ✓', m);
};

console.log('verify-courier-static-gate');
assert(existsSync(resolve(dist, 'index.html')), 'index.html exists');
const html = readFileSync(resolve(dist, 'index.html'), 'utf8');
assert(html.includes('/courier/assets/'), 'index references /courier/assets/');
const assetRefs = [...html.matchAll(/(?:src|href)="(\/courier\/assets\/[^"]+)"/g)].map((m) => m[1]);
assert(assetRefs.length >= 1, 'at least one asset reference');
for (const ref of assetRefs) {
  const file = resolve(dist, ref.replace('/courier/', ''));
  assert(existsSync(file), `asset exists: ${ref}`);
}
const jsFiles = readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
assert(jsFiles.length >= 1, 'js chunks present');
const bundle = jsFiles.map((f) => readFileSync(resolve(assetsDir, f), 'utf8')).join('\n');
assert(bundle.includes('https://nmd.marketing/api') || bundle.includes('"/api"') || bundle.includes("'/api'"), 'API base baked or /api fallback');
assert(bundle.includes('بدء الدوام') || bundle.includes('غير مفعّل'), 'shift start UI strings present');
assert(bundle.includes('basename') || bundle.includes('/courier'), 'router base path present');
console.log(`\n${passed} passed (static)`);

const live = process.env.COURIER_SMOKE_URL;
if (live) {
  const puppeteer = await import('puppeteer').catch(() => null);
  if (!puppeteer) {
    console.log('puppeteer unavailable — skip live smoke');
    process.exit(0);
  }
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  const errors: string[] = [];
  const failedNet: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('response', (res) => {
    const u = res.url();
    if (u.includes('/courier/') && (u.endsWith('.js') || u.endsWith('.css')) && res.status() >= 400) {
      failedNet.push(`${res.status()} ${u}`);
    }
  });
  await page.goto(live, { waitUntil: 'networkidle2', timeout: 60000 });
  const text = await page.evaluate(() => document.body?.innerText ?? '');
  const rootHtml = await page.evaluate(() => document.querySelector('#root')?.innerHTML ?? '');
  await browser.close();
  assert(rootHtml.trim().length > 0, 'React root not empty');
  assert(/NMD|Courier|تسجيل|دخول|بريد|كلمة/i.test(text), 'login/courier UI text visible');
  assert(failedNet.length === 0, `no failed courier assets (${failedNet.join(', ') || 'ok'})`);
  assert(!errors.some((e) => /Failed to fetch dynamically imported module|MIME|Unexpected token </i.test(e)), 'no fatal asset MIME/import errors');
  console.log(`\n${passed} passed (incl. live smoke)`);
  console.log('console_errors=', errors.slice(0, 5));
}
