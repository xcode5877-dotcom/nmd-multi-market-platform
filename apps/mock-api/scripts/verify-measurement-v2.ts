#!/usr/bin/env npx tsx
/**
 * Measurement V2 Phase A + A.1 verification.
 * Run: pnpm --filter mock-api verify:measurement-v2
 *
 * Set SKIP_HTTP_MEASUREMENT=1 to skip HTTP smoke (repo tests still run).
 */
import 'dotenv/config';
import { spawn, type ChildProcess } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import {
  formatQuantity,
  InvalidMeasurementConfigError,
  normalizeAndValidateMeasurementForWrite,
  normalizeCatalogProductsForWrite,
  resolveProductMeasurementForRead,
} from '@nmd/core';

let passed = 0;
let failed = 0;

function check(condition: boolean, message: string): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${message}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${message}`);
  }
}

console.log('\n=== Measurement V2 — Unit (A + A.1) ===\n');

console.log('Read defaults (resolveProductMeasurementForRead)');
{
  const m = resolveProductMeasurementForRead({});
  check(m.measurementType === 'PIECE' && m.baseUnitCode === 'piece', 'read default PIECE');
  check(m.quantityStep === '1' && m.measurementVersion === 1, 'read default step/version');
}

console.log('\nExact quantity formatting (never misrepresent)');
{
  const cases: Array<{ q: string; base: 'kg' | 'l' | 'piece'; display: 'kg' | 'g' | 'l' | 'ml' | 'piece'; prec?: number | null; expect: string }> = [
    { q: '1', base: 'kg', display: 'kg', expect: '1 كغم' },
    { q: '1.000', base: 'kg', display: 'kg', expect: '1 كغم' },
    { q: '0.5', base: 'kg', display: 'kg', prec: 0, expect: '0.5 كغم' },
    { q: '0.500', base: 'kg', display: 'kg', prec: 0, expect: '0.5 كغم' },
    { q: '0.25', base: 'kg', display: 'kg', prec: 1, expect: '0.25 كغم' },
    { q: '0.250', base: 'kg', display: 'kg', prec: 1, expect: '0.25 كغم' },
    { q: '0.333', base: 'kg', display: 'kg', prec: 2, expect: '0.333 كغم' },
    { q: '0.25', base: 'kg', display: 'g', expect: '250 غرام' },
    { q: '0.250', base: 'kg', display: 'g', expect: '250 غرام' },
    { q: '0.333', base: 'l', display: 'ml', expect: '333 مل' },
    { q: '2', base: 'piece', display: 'piece', expect: '2 حبة' },
  ];
  for (const c of cases) {
    const out = formatQuantity({
      quantityBase: c.q,
      baseUnitCode: c.base,
      displayUnitCode: c.display,
      displayPrecision: c.prec ?? null,
    });
    check(out === c.expect, `${c.q} ${c.base}/${c.display} prec=${c.prec ?? 'null'} → ${out}`);
  }
  // Forbidden misrepresentation
  const bad = formatQuantity({ quantityBase: '0.5', baseUnitCode: 'kg', displayUnitCode: 'kg', displayPrecision: 0 });
  check(bad !== '1 كغم' && bad !== '0 كغم' && bad === '0.5 كغم', '0.5 kg + prec 0 must not show 1 or 0');
  const src = '0.333';
  formatQuantity({ quantityBase: src, baseUnitCode: 'kg', displayUnitCode: 'kg', displayPrecision: 2 });
  check(src === '0.333', 'formatQuantity does not mutate source');
}

console.log('\nStrict write vs permissive read');
{
  const invalid = normalizeAndValidateMeasurementForWrite({
    measurementType: 'WEIGHT',
    baseUnitCode: 'l',
    displayUnitCode: 'l',
    quantityStep: '0.5',
    minimumQuantity: '0.5',
  });
  check(!invalid.ok && invalid.error.code === 'INVALID_MEASUREMENT_CONFIG', 'write rejects WEIGHT+l');

  // Read resolver must not be used as write validator: soft-ish read of incomplete data still defaults,
  // but write of explicit invalid fails.
  const pieceHalf = normalizeAndValidateMeasurementForWrite({
    measurementType: 'PIECE',
    baseUnitCode: 'piece',
    displayUnitCode: 'piece',
    quantityStep: '0.5',
    minimumQuantity: '0.5',
  });
  check(!pieceHalf.ok, 'write rejects PIECE step 0.5');

  const mismatch = normalizeAndValidateMeasurementForWrite({
    measurementType: 'PACKAGE',
    baseUnitCode: 'pack',
    displayUnitCode: 'box',
    quantityStep: '1',
    minimumQuantity: '1',
  });
  check(!mismatch.ok, 'write rejects PACKAGE display mismatch');

  const legacyOk = normalizeAndValidateMeasurementForWrite({
    isWeightBased: true,
    unitName: 'غرام',
    quantityStep: 0.25,
  });
  check(legacyOk.ok === true, 'legacy valid write accepted');
  if (legacyOk.ok) {
    check(
      legacyOk.config.measurementType === 'WEIGHT' &&
        legacyOk.config.baseUnitCode === 'kg' &&
        legacyOk.config.displayUnitCode === 'g' &&
        legacyOk.config.quantityStep === '0.25',
      'legacy normalized to WEIGHT/kg/g/0.25'
    );
  }

  const missing = normalizeAndValidateMeasurementForWrite({ name: 'Tomato', basePrice: 7 });
  check(missing.ok === true && missing.config.measurementType === 'PIECE', 'missing fields → PIECE');

  try {
    normalizeCatalogProductsForWrite([
      { id: 'ok', name: 'A', measurementType: 'PIECE', baseUnitCode: 'piece', displayUnitCode: 'piece', quantityStep: '1', minimumQuantity: '1' },
      { id: 'bad', name: 'B', measurementType: 'WEIGHT', baseUnitCode: 'l', displayUnitCode: 'l', quantityStep: '0.5', minimumQuantity: '0.5' },
    ]);
    check(false, 'normalizeCatalogProductsForWrite should throw');
  } catch (e) {
    check(e instanceof InvalidMeasurementConfigError, 'throws InvalidMeasurementConfigError');
    check((e as InvalidMeasurementConfigError).productId === 'bad', 'error includes productId');
  }
}

console.log('\nLegacy unit maps (read)');
{
  for (const [unit, display] of [
    ['كيلو', 'kg'],
    ['كغم', 'kg'],
    ['غرام', 'g'],
    ['جرام', 'g'],
    ['جم', 'g'],
    ['لتر', 'l'],
    ['مل', 'ml'],
  ] as const) {
    const m = resolveProductMeasurementForRead({ isWeightBased: true, unitName: unit, quantityStep: 0.5 });
    check(m.displayUnitCode === display, `read legacy ${unit} → display ${display}`);
  }
}

async function repoAtomicityTests(): Promise<void> {
  console.log('\n=== Repository fail-closed / atomicity ===\n');
  const { prisma } = await import('../src/db.js');
  const { createDbCatalogRepo } = await import('../src/repos/db-repos.js');
  const catalogRepo = createDbCatalogRepo();
  const tenantId = `meas-a1-${Date.now()}`;
  const goodId = `${tenantId}-good`;
  const badId = `${tenantId}-bad`;

  try {
    await prisma.tenant.create({
      data: {
        id: tenantId,
        slug: tenantId,
        name: 'Meas A1 Test',
        logoUrl: '',
        primaryColor: '#000',
        secondaryColor: '#fff',
        fontFamily: 'inherit',
        radiusScale: 1,
        layoutStyle: 'default',
        enabled: true,
        createdAt: new Date().toISOString(),
        supportsWeightSelling: false,
      },
    });

    // Seed valid catalog
    await catalogRepo.setCatalog(tenantId, {
      categories: [{ id: 'c1', tenantId, name: 'Cat', slug: 'cat', sortOrder: 0 }],
      products: [
        {
          id: goodId,
          tenantId,
          categoryId: 'c1',
          name: 'Good Weighted',
          slug: 'good',
          type: 'SIMPLE',
          basePrice: 40,
          currency: 'ILS',
          isAvailable: true,
          measurementType: 'WEIGHT',
          baseUnitCode: 'kg',
          displayUnitCode: 'g',
          quantityStep: '0.25',
          minimumQuantity: '0.25',
          maximumQuantity: '10',
          priceBasis: 'PER_BASE_UNIT',
          measurementVersion: 1,
          displayPrecision: 0,
        },
      ],
      optionGroups: [],
      optionItems: [],
    });

    const before = await catalogRepo.getCatalog(tenantId);
    const beforeProd = (before.products as Record<string, unknown>[]).find((p) => p.id === goodId);
    check(beforeProd?.quantityStep === '0.25' && beforeProd?.baseUnitCode === 'kg', 'seed WEIGHT persisted');

    // 1) WEIGHT + base l fails
    let threw = false;
    try {
      await catalogRepo.setCatalog(tenantId, {
        categories: before.categories as [],
        products: [
          {
            ...beforeProd,
            measurementType: 'WEIGHT',
            baseUnitCode: 'l',
            displayUnitCode: 'l',
          },
        ],
        optionGroups: [],
        optionItems: [],
      });
    } catch (e) {
      threw = e instanceof InvalidMeasurementConfigError;
    }
    check(threw, '1. direct repo WEIGHT+l throws');

    // 2) PIECE + step 0.5 fails
    threw = false;
    try {
      await catalogRepo.setCatalog(tenantId, {
        categories: before.categories as [],
        products: [
          {
            id: badId,
            tenantId,
            categoryId: 'c1',
            name: 'Bad Piece',
            slug: 'bad-piece',
            type: 'SIMPLE',
            basePrice: 5,
            currency: 'ILS',
            isAvailable: true,
            measurementType: 'PIECE',
            baseUnitCode: 'piece',
            displayUnitCode: 'piece',
            quantityStep: '0.5',
            minimumQuantity: '0.5',
          },
        ],
        optionGroups: [],
        optionItems: [],
      });
    } catch (e) {
      threw = e instanceof InvalidMeasurementConfigError;
    }
    check(threw, '2. direct repo PIECE step 0.5 throws');

    // 3) invalid display/base pair
    threw = false;
    try {
      await catalogRepo.setCatalog(tenantId, {
        categories: before.categories as [],
        products: [
          {
            ...beforeProd,
            measurementType: 'PACKAGE',
            baseUnitCode: 'pack',
            displayUnitCode: 'box',
            quantityStep: '1',
            minimumQuantity: '1',
          },
        ],
        optionGroups: [],
        optionItems: [],
      });
    } catch (e) {
      threw = e instanceof InvalidMeasurementConfigError;
    }
    check(threw, '3. direct repo PACKAGE mismatch throws');

    // 4) catalog unchanged after rejects
    const afterReject = await catalogRepo.getCatalog(tenantId);
    const still = (afterReject.products as Record<string, unknown>[]).find((p) => p.id === goodId);
    check(
      still?.quantityStep === '0.25' &&
        still?.baseUnitCode === 'kg' &&
        still?.displayUnitCode === 'g' &&
        still?.basePrice === 40,
      '4. existing catalog unchanged after rejected writes'
    );
    check(
      (afterReject.products as unknown[]).length === 1 &&
        !(afterReject.products as Record<string, unknown>[]).some((p) => p.id === badId),
      '4b. bad product not inserted'
    );

    // 5) legacy valid input persists authoritative fields
    await catalogRepo.setCatalog(tenantId, {
      categories: [{ id: 'c1', tenantId, name: 'Cat', slug: 'cat', sortOrder: 0 }],
      products: [
        {
          id: `${tenantId}-legacy`,
          tenantId,
          categoryId: 'c1',
          name: 'Legacy Weight',
          slug: 'legacy',
          type: 'SIMPLE',
          basePrice: 12,
          currency: 'ILS',
          isAvailable: true,
          isWeightBased: true,
          unitName: 'كغم',
          quantityStep: 0.5,
        },
      ],
      optionGroups: [],
      optionItems: [],
    });
    const legacyLoaded = (await catalogRepo.getCatalog(tenantId)).products as Record<string, unknown>[];
    const leg = legacyLoaded[0];
    check(
      leg?.measurementType === 'WEIGHT' &&
        leg?.baseUnitCode === 'kg' &&
        leg?.displayUnitCode === 'kg' &&
        leg?.quantityStep === '0.5' &&
        leg?.isWeightBased === true,
      '5. legacy valid → authoritative persisted'
    );

    // 6) missing measurement → PIECE
    await catalogRepo.setCatalog(tenantId, {
      categories: [{ id: 'c1', tenantId, name: 'Cat', slug: 'cat', sortOrder: 0 }],
      products: [
        {
          id: `${tenantId}-piece`,
          tenantId,
          categoryId: 'c1',
          name: 'Plain',
          slug: 'plain',
          type: 'SIMPLE',
          basePrice: 7,
          currency: 'ILS',
          isAvailable: true,
        },
      ],
      optionGroups: [],
      optionItems: [],
    });
    const plain = ((await catalogRepo.getCatalog(tenantId)).products as Record<string, unknown>[])[0];
    check(plain?.measurementType === 'PIECE' && plain?.quantityStep === '1', '6. missing → PIECE defaults');

    // Full-catalog PUT preserves V2 fields on untouched products
    await catalogRepo.setCatalog(tenantId, {
      categories: [{ id: 'c1', tenantId, name: 'Cat', slug: 'cat', sortOrder: 0 }],
      products: [
        {
          id: 'p-weight',
          tenantId,
          categoryId: 'c1',
          name: 'W',
          slug: 'w',
          type: 'SIMPLE',
          basePrice: 40,
          currency: 'ILS',
          isAvailable: true,
          measurementType: 'WEIGHT',
          baseUnitCode: 'kg',
          displayUnitCode: 'g',
          quantityStep: '0.25',
          minimumQuantity: '0.25',
          priceBasis: 'PER_BASE_UNIT',
          measurementVersion: 1,
        },
        {
          id: 'p-piece',
          tenantId,
          categoryId: 'c1',
          name: 'P',
          slug: 'p',
          type: 'SIMPLE',
          basePrice: 7,
          currency: 'ILS',
          isAvailable: true,
        },
      ],
      optionGroups: [],
      optionItems: [],
    });
    const multi = await catalogRepo.getCatalog(tenantId);
    // "Edit" only piece product name via full replace, keep weight product fields from GET
    const products = (multi.products as Record<string, unknown>[]).map((p) =>
      p.id === 'p-piece' ? { ...p, name: 'P-edited', basePrice: 8 } : p
    );
    await catalogRepo.setCatalog(tenantId, {
      categories: multi.categories as [],
      products,
      optionGroups: [],
      optionItems: [],
    });
    const preserved = ((await catalogRepo.getCatalog(tenantId)).products as Record<string, unknown>[]).find(
      (p) => p.id === 'p-weight'
    );
    check(
      preserved?.quantityStep === '0.25' &&
        preserved?.displayUnitCode === 'g' &&
        preserved?.measurementType === 'WEIGHT',
      'full-catalog PUT preserves untouched Measurement V2 product'
    );
    const edited = ((await catalogRepo.getCatalog(tenantId)).products as Record<string, unknown>[]).find(
      (p) => p.id === 'p-piece'
    );
    check(edited?.name === 'P-edited' && edited?.measurementType === 'PIECE', 'piece edit succeeds without 400');
  } finally {
    await prisma.catalogProduct.deleteMany({ where: { tenantId } });
    await prisma.catalogCategory.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => undefined);
  }
}

async function httpSmoke(): Promise<void> {
  if (process.env.SKIP_HTTP_MEASUREMENT === '1') {
    console.log('\n(Skipping HTTP smoke: SKIP_HTTP_MEASUREMENT=1)\n');
    return;
  }
  console.log('\n=== HTTP catalog smoke (disposable tenant) ===\n');

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const MOCK_API_ROOT = join(__dirname, '..');
  const PORT = String(5300 + Math.floor(Math.random() * 200));
  const BASE = `http://127.0.0.1:${PORT}`;
  const tenantId = `meas-http-${Date.now()}`;

  const { prisma } = await import('../src/db.js');
  await prisma.tenant.create({
    data: {
      id: tenantId,
      slug: tenantId,
      name: 'Meas HTTP Test',
      logoUrl: '',
      primaryColor: '#000',
      secondaryColor: '#fff',
      fontFamily: 'inherit',
      radiusScale: 1,
      layoutStyle: 'default',
      enabled: true,
      createdAt: new Date().toISOString(),
      supportsWeightSelling: true,
    },
  });

  let child: ChildProcess | null = null;
  const childLogs: string[] = [];
  try {
    child = spawn('npx', ['tsx', 'src/index.ts'], {
      cwd: MOCK_API_ROOT,
      env: {
        ...process.env,
        PORT,
        STORAGE_DRIVER: 'db',
        NODE_ENV: 'development',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const onChunk = (buf: Buffer) => {
      const s = buf.toString();
      childLogs.push(s);
      if (process.env.DEBUG_MEASUREMENT_HTTP === '1') process.stderr.write(s);
    };
    child.stdout?.on('data', onChunk);
    child.stderr?.on('data', onChunk);

    await waitForHealth(BASE, 60000);

    const loginRes = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'root@nmd.com', password: '123456' }),
    });
    check(loginRes.ok, `root login HTTP ${loginRes.status}`);
    const loginJson = (await loginRes.json()) as { token?: string; accessToken?: string };
    const token = loginJson.token ?? loginJson.accessToken;
    check(!!token, 'got auth token');
    if (!token) return;

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Emergency-Reason': 'measurement-v2-a1-verify',
    };

    const productId = `${tenantId}-w`;
    const validPut = {
      categories: [{ id: 'c1', tenantId, name: 'Cat', slug: 'cat', sortOrder: 0 }],
      products: [
        {
          id: productId,
          tenantId,
          categoryId: 'c1',
          name: 'HTTP Weight',
          slug: 'http-weight',
          type: 'SIMPLE',
          basePrice: 40,
          currency: 'ILS',
          isAvailable: true,
          measurementType: 'WEIGHT',
          baseUnitCode: 'kg',
          displayUnitCode: 'g',
          quantityStep: '0.25',
          minimumQuantity: '0.25',
          priceBasis: 'PER_BASE_UNIT',
          measurementVersion: 1,
        },
      ],
      optionGroups: [],
      optionItems: [],
    };

    const putRes = await fetch(`${BASE}/catalog/${tenantId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(validPut),
    });
    check(putRes.ok, `PUT valid WEIGHT HTTP ${putRes.status}`);

    const getRes = await fetch(`${BASE}/catalog/${tenantId}`);
    check(getRes.ok, `GET catalog HTTP ${getRes.status}`);
    const got = (await getRes.json()) as { products?: Record<string, unknown>[] };
    const p = (got.products ?? []).find((x) => x.id === productId);
    check(typeof p?.quantityStep === 'string' && p?.quantityStep === '0.25', 'GET quantityStep string');
    check(p?.baseUnitCode === 'kg' && p?.displayUnitCode === 'g', 'GET lowercase unit codes');
    check(p?.isWeightBased === true && p?.unitName === 'غرام', 'GET dual-emit');
    check(typeof p?.basePrice === 'number' && p?.basePrice === 40, 'GET basePrice number');

    // Invalid PUT
    const invalidPut = {
      ...validPut,
      products: [
        {
          ...validPut.products[0],
          baseUnitCode: 'l',
          displayUnitCode: 'l',
        },
      ],
    };
    const badRes = await fetch(`${BASE}/catalog/${tenantId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(invalidPut),
    });
    const badBody = (await badRes.json()) as { code?: string };
    check(badRes.status === 400, `invalid PUT HTTP 400 (got ${badRes.status})`);
    check(badBody.code === 'INVALID_MEASUREMENT_CONFIG', 'invalid PUT code');

    const getAfter = await fetch(`${BASE}/catalog/${tenantId}`);
    const after = (await getAfter.json()) as { products?: Record<string, unknown>[] };
    const still = (after.products ?? []).find((x) => x.id === productId);
    check(still?.baseUnitCode === 'kg' && still?.quantityStep === '0.25', 'product unchanged after invalid PUT');

    // Legacy-only valid payload
    const legacyPut = {
      categories: validPut.categories,
      products: [
        {
          id: `${tenantId}-leg`,
          tenantId,
          categoryId: 'c1',
          name: 'Legacy HTTP',
          slug: 'legacy-http',
          type: 'SIMPLE',
          basePrice: 10,
          currency: 'ILS',
          isAvailable: true,
          isWeightBased: true,
          unitName: 'كيلو',
          quantityStep: 0.5,
        },
      ],
      optionGroups: [],
      optionItems: [],
    };
    const legRes = await fetch(`${BASE}/catalog/${tenantId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(legacyPut),
    });
    check(legRes.ok, `legacy PUT HTTP ${legRes.status}`);
    const legGet = await fetch(`${BASE}/catalog/${tenantId}`);
    const legCat = (await legGet.json()) as { products?: Record<string, unknown>[] };
    const legP = (legCat.products ?? [])[0];
    check(
      legP?.measurementType === 'WEIGHT' && legP?.baseUnitCode === 'kg' && legP?.quantityStep === '0.5',
      'legacy PUT persisted authoritative fields'
    );

    // Old-client PIECE update (Merchant Admin–like)
    const piecePut = {
      categories: validPut.categories,
      products: [
        {
          id: `${tenantId}-piece`,
          tenantId,
          categoryId: 'c1',
          name: 'Falafel',
          slug: 'falafel',
          type: 'SIMPLE',
          basePrice: 12,
          currency: 'ILS',
          isAvailable: true,
          isWeightBased: false,
          unitName: 'حبة',
          quantityStep: 1,
        },
      ],
      optionGroups: [],
      optionItems: [],
    };
    const pieceRes = await fetch(`${BASE}/catalog/${tenantId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(piecePut),
    });
    check(pieceRes.ok, `legacy PIECE PUT HTTP ${pieceRes.status}`);
  } finally {
    if (child) {
      try {
        child.kill('SIGKILL');
      } catch {
        /* ignore */
      }
      // Ensure we don't hang waiting on the child event loop
      child.unref?.();
    }
    await prisma.catalogProduct.deleteMany({ where: { tenantId } });
    await prisma.catalogCategory.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => undefined);
  }
}

async function waitForHealth(base: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  let lastErr = '';
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${base}/health`);
      if (r.ok) return;
      lastErr = `HTTP ${r.status}`;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Server health timeout at ${base} (${lastErr})`);
}

function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
  if (!existsSync(envPath)) return '';
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    if (line.startsWith('DATABASE_URL=')) {
      return line.slice('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
    }
  }
  return '';
}

function reportDbTarget(): void {
  console.log('\n=== Database target (sanitized) ===\n');
  const raw = resolveDatabaseUrl();
  try {
    const u = new URL(raw);
    const host = u.hostname;
    const port = u.port || '5432';
    const db = u.pathname.replace(/^\//, '');
    const isLocal =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === 'postgres' ||
      host.endsWith('.local');
    console.log(`  host: ${host}`);
    console.log(`  port: ${port}`);
    console.log(`  database: ${db}`);
    console.log(`  environment: ${isLocal ? 'local/dev (Docker Compose postgres on this machine)' : 'NON-LOCAL — REVIEW'}`);
    console.log(
      `  Phase A prisma migrate deploy: ${isLocal ? 'confirmed local/dev — not a remote production host' : 'WARNING: verify manually'}`
    );
    check(isLocal && !!db, 'migrate target is local/dev host');
  } catch {
    check(false, 'could not parse DATABASE_URL');
  }
}

(async () => {
  reportDbTarget();
  try {
    await repoAtomicityTests();
  } catch (err) {
    failed += 1;
    console.error('  ✗ repo tests failed:', err instanceof Error ? err.message : err);
  }
  try {
    await httpSmoke();
  } catch (err) {
    failed += 1;
    console.error('  ✗ HTTP smoke failed:', err instanceof Error ? err.message : err);
    if (err instanceof Error && err.stack) console.error(err.stack.split('\n').slice(0, 4).join('\n'));
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  try {
    const { prisma } = await import('../src/db.js');
    await prisma.$disconnect();
  } catch {
    /* ignore */
  }
  process.exit(failed > 0 ? 1 : 0);
})();
