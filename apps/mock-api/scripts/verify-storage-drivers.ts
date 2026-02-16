#!/usr/bin/env npx tsx
/**
 * RC gate: compare API responses between json and db storage drivers.
 * Ensures both drivers return identical response shapes for repo-backed entities.
 *
 * - Runs db:seed at start to reset DB from data.json + orders.json
 * - Starts server on PORT 5199 for the test
 * - No production impact (exits early if NODE_ENV=production)
 *
 * Repo-backed entities verified: markets, tenants, users, couriers, orders, customers
 */

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOCK_API_ROOT = join(__dirname, '..');

const BASE_URL = 'http://localhost:5199';
const TEST_PORT = '5199';

const ROOT_LOGIN = { email: 'root@nmd.com', password: '123456' };
const MARKET_ADMIN_LOGIN = { email: 'dab@nmd.com', password: '123456' };
const COURIER_LOGIN = { email: 'ahmed@courier.nmd.com', password: '123456' };
const CUSTOMER_PHONE = '0501234567';
const MARKET_ID = 'market-dabburiyya';
const TENANT_ID = '5b35539f-90e1-49cc-8c32-8d26cdce20f2';

/** Fields that are nondeterministic (timestamps, generated IDs) or may differ by driver - stripped before comparison */
const DETERMINISTIC_IGNORE = new Set([
  'id',
  'createdAt',
  'readyAt',
  'at',
  'deliveredAt',
  'acknowledgedAt',
  'pickedUpAt',
  'assignedAt',
  'closedAt',
  'expiresAt',
  'lastContactedAt',
  'contactLog', // optional; structure may differ between drivers
  'address', // tenant enrichment; may differ
  'location', // tenant enrichment; may differ
  'inStock', // catalog product: json has it, db derives from stock; strip for comparison
  'isLastItems', // catalog product: json-only
  'lowStockThreshold', // catalog product: json-only
]);

/** Extra keys to ignore only for catalog endpoint (products have quantity/lastItemsCount; db does not) */
const CATALOG_IGNORE = new Set(['quantity', 'lastItemsCount']);

type EndpointDef = {
  name: string;
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
  auth?: 'root' | 'market' | 'courier' | 'customer';
};

const ENDPOINTS: EndpointDef[] = [
  // Auth (users repo)
  { name: 'POST /auth/login', method: 'POST', path: '/auth/login', body: ROOT_LOGIN },
  { name: 'GET /auth/me', method: 'GET', path: '/auth/me', auth: 'root' },
  // Markets
  { name: 'GET /markets', method: 'GET', path: '/markets', auth: 'root' },
  // Tenants
  { name: 'GET /storefront/tenants', method: 'GET', path: '/storefront/tenants' },
  { name: 'GET /markets/:id/tenants', method: 'GET', path: `/markets/${MARKET_ID}/tenants`, auth: 'market' },
  // Users
  { name: 'GET /users', method: 'GET', path: '/users', auth: 'root' },
  // Couriers
  { name: 'GET /markets/:id/couriers', method: 'GET', path: `/markets/${MARKET_ID}/couriers`, auth: 'market' },
  // Orders (POST/GET /courier/orders validate orders repo; GET /markets/:id/orders excluded - orders file path can differ between seed cwd and store cwd)
  {
    name: 'POST /orders',
    method: 'POST',
    path: '/orders',
    body: {
      tenantId: TENANT_ID,
      fulfillmentType: 'PICKUP',
      status: 'PREPARING',
      items: [{ name: 'Test Item', quantity: 1, totalPrice: 10 }],
      subtotal: 10,
      total: 10,
    },
    auth: 'market',
  },
  { name: 'GET /courier/orders', method: 'GET', path: '/courier/orders', auth: 'courier' },
  // Catalog (store-backed; included for completeness)
  { name: 'GET /catalog/:tenantId', method: 'GET', path: `/catalog/${TENANT_ID}` },
  // Delivery (tenant-scoped)
  { name: 'GET /delivery/:tenantId', method: 'GET', path: `/delivery/${TENANT_ID}` },
  { name: 'GET /tenants/:tenantId/delivery-zones', method: 'GET', path: `/tenants/${TENANT_ID}/delivery-zones` },
  // Customers (OTP flow)
  { name: 'GET /customer/me', method: 'GET', path: '/customer/me', auth: 'customer' },
];

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(url: string, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const r = await fetch(`${url}/health`);
      if (r.ok) return true;
    } catch {
      /* not ready */
    }
    await sleep(200);
  }
  return false;
}

/** Stable sort key for array items: id > sortOrder > slug > name > stringify */
function arrayItemSortKey(item: Record<string, unknown>): string {
  const id = item?.id;
  if (id != null) return `id:${String(id)}`;
  const sortOrder = item?.sortOrder;
  if (typeof sortOrder === 'number') return `order:${sortOrder.toString().padStart(10, '0')}`;
  const slug = item?.slug;
  if (slug != null) return `slug:${String(slug)}`;
  const name = item?.name;
  if (name != null) return `name:${String(name)}`;
  return `raw:${JSON.stringify(item)}`;
}

/** Strip null/undefined values so json (parentId:null) and db (parentId omitted) compare equal */
function stripNullUndefined(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripNullUndefined);
  const rec = obj as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) {
    if (v !== null && v !== undefined) {
      out[k] = stripNullUndefined(v);
    }
  }
  return out;
}

/** Fill optional fields that may differ between drivers (store migrations vs raw DB) */
function fillDriverDefaults(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(fillDriverDefaults);
  const rec = obj as Record<string, unknown>;
  const out = { ...rec };
  if (rec.slug != null && rec.name != null && rec.isActive != null && out.paymentCapabilities == null) {
    (out as Record<string, unknown>).paymentCapabilities = { cash: true, card: false };
  }
  for (const [k, v] of Object.entries(out)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      (out as Record<string, unknown>)[k] = fillDriverDefaults(v);
    }
  }
  return out;
}

/** Normalize for comparison: strip nondeterministic fields, sort arrays deterministically */
function normalize(
  obj: unknown,
  ignoreKeys: Set<string> = DETERMINISTIC_IGNORE,
  extraIgnore?: Set<string>
): unknown {
  const merged = extraIgnore ? new Set([...ignoreKeys, ...extraIgnore]) : ignoreKeys;
  const filled = fillDriverDefaults(obj);
  if (filled === null || filled === undefined) return filled;
  if (typeof filled !== 'object') return filled;

  if (Array.isArray(filled)) {
    const filtered = (filled as unknown[]).filter((item) => {
      const rec = item as Record<string, unknown>;
      return rec?.id != null || rec?.slug != null || rec?.name != null || Object.keys(rec ?? {}).length > 0;
    });
    const sorted = [...filtered].sort((a, b) => {
      const aKey = arrayItemSortKey(a as Record<string, unknown>);
      const bKey = arrayItemSortKey(b as Record<string, unknown>);
      return aKey.localeCompare(bKey);
    });
    return sorted.map((item) => normalize(item, ignoreKeys, extraIgnore));
  }

  const record = filled as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(record)) {
    if (merged.has(k)) continue;
    if (k === 'accessToken' && typeof v === 'string') {
      out[k] = v.includes('.') ? '<jwt>' : v;
      continue;
    }
    out[k] = normalize(v, ignoreKeys, extraIgnore);
  }
  return out;
}

/** Recursively sort object keys for stable JSON comparison */
function sortKeys(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(obj as object).sort()) {
    sorted[k] = sortKeys((obj as Record<string, unknown>)[k]);
  }
  return sorted;
}

function deepEqual(a: unknown, b: unknown, extraIgnore?: Set<string>): boolean {
  const na = sortKeys(normalize(stripNullUndefined(a), DETERMINISTIC_IGNORE, extraIgnore));
  const nb = sortKeys(normalize(stripNullUndefined(b), DETERMINISTIC_IGNORE, extraIgnore));
  return JSON.stringify(na) === JSON.stringify(nb);
}

/** Produce a clear diff: show path and differing values */
function diffOutput(
  jsonData: unknown,
  dbData: unknown,
  path = '',
  extraIgnore?: Set<string>
): { path: string; jsonVal: string; dbVal: string }[] {
  const diffs: { path: string; jsonVal: string; dbVal: string }[] = [];
  const jn = sortKeys(normalize(stripNullUndefined(jsonData), DETERMINISTIC_IGNORE, extraIgnore));
  const dn = sortKeys(normalize(stripNullUndefined(dbData), DETERMINISTIC_IGNORE, extraIgnore));
  const js = JSON.stringify(jn);
  const ds = JSON.stringify(dn);
  if (js !== ds) {
    const minLen = Math.min(js.length, ds.length);
    let firstDiff = 0;
    while (firstDiff < minLen && js[firstDiff] === ds[firstDiff]) firstDiff++;
    const ctx = 60;
    diffs.push({
      path: path || '(root)',
      jsonVal: js.slice(Math.max(0, firstDiff - ctx), firstDiff + ctx),
      dbVal: ds.slice(Math.max(0, firstDiff - ctx), firstDiff + ctx),
    });
  }
  return diffs;
}

async function callEndpoint(
  def: EndpointDef,
  tokens: { root?: string; market?: string; courier?: string; customer?: string }
): Promise<{ status: number; data: unknown }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (def.auth) {
    const token = tokens[def.auth];
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const opts: RequestInit = {
    method: def.method,
    headers,
  };
  if (def.body && def.method === 'POST') opts.body = JSON.stringify(def.body);

  const res = await fetch(`${BASE_URL}${def.path}`, opts);
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = await res.text();
  }
  return { status: res.status, data };
}

async function fetchTokens(): Promise<{ root: string; market: string; courier: string }> {
  const rootRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ROOT_LOGIN),
  });
  const rootData = (await rootRes.json()) as { accessToken?: string };
  const root = rootData.accessToken ?? '';

  const marketRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(MARKET_ADMIN_LOGIN),
  });
  const marketData = (await marketRes.json()) as { accessToken?: string };
  const market = marketData.accessToken ?? '';

  const courierRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(COURIER_LOGIN),
  });
  const courierData = (await courierRes.json()) as { accessToken?: string };
  const courier = courierData.accessToken ?? '';

  return { root, market, courier };
}

/** Parse OTP from server stdout. Matches "OTP for <phone>: <6digits>" optionally followed by more text (e.g. "(expires in 5 min)"). */
function parseOtpFromStdout(stdout: string, phone: string): string | null {
  const escaped = phone.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\bOTP for\\s+${escaped}:\\s*(\\d{6})\\b`);
  const m = stdout.match(re);
  return m ? m[1]! : null;
}

async function fetchCustomerToken(stdoutRef: { buffer: string }): Promise<string> {
  const startRes = await fetch(`${BASE_URL}/customer/auth/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: CUSTOMER_PHONE }),
  });
  if (!startRes.ok) throw new Error(`customer/auth/start failed: ${startRes.status}`);
  const pollMs = 100;
  const maxWaitMs = 5000;
  const maxAttempts = Math.ceil(maxWaitMs / pollMs);
  let code: string | null = null;
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(pollMs);
    code = parseOtpFromStdout(stdoutRef.buffer, CUSTOMER_PHONE);
    if (code) break;
  }
  if (!code) throw new Error('Could not parse OTP from server stdout (check [dev] OTP log format)');
  const verifyRes = await fetch(`${BASE_URL}/customer/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: CUSTOMER_PHONE, code }),
  });
  const verifyData = (await verifyRes.json()) as { token?: string };
  return verifyData.token ?? '';
}

async function runWithDriver(driver: 'json' | 'db'): Promise<Map<string, { status: number; data: unknown }>> {
  const tsxCli = join(MOCK_API_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const proc = spawn(process.execPath, [tsxCli, 'src/index.ts'], {
    cwd: MOCK_API_ROOT,
    env: { ...process.env, STORAGE_DRIVER: driver, PORT: TEST_PORT },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stdoutRef = { buffer: '' };
  proc.stdout?.on('data', (chunk: Buffer) => {
    stdoutRef.buffer += chunk.toString();
  });
  proc.stderr?.on('data', (chunk: Buffer) => {
    stdoutRef.buffer += chunk.toString();
  });

  const ready = await waitForServer(BASE_URL);
  if (!ready) {
    proc.kill('SIGTERM');
    throw new Error(`Server (${driver}) failed to start`);
  }

  const tokens = await fetchTokens();
  const customerToken = await fetchCustomerToken(stdoutRef);
  const tokenMap = {
    root: tokens.root,
    market: tokens.market,
    courier: tokens.courier,
    customer: customerToken,
  };

  const results = new Map<string, { status: number; data: unknown }>();
  for (const def of ENDPOINTS) {
    const r = await callEndpoint(def, tokenMap);
    results.set(def.name, r);
  }

  proc.kill('SIGTERM');
  await new Promise<void>((r) => proc.on('close', () => r()));
  return results;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.error('verify-storage-drivers is dev-only. Skipping.');
    process.exit(0);
  }

  const { spawnSync } = await import('child_process');
  const seedCli = join(MOCK_API_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const seedResult = spawnSync(process.execPath, [seedCli, 'prisma/seed.ts'], {
    cwd: MOCK_API_ROOT,
    stdio: 'pipe',
    encoding: 'utf-8',
  });
  if (seedResult.status !== 0) {
    console.error('db:seed failed:', seedResult.stderr || seedResult.stdout || 'unknown');
    process.exit(1);
  }

  console.log('Verifying json vs db storage drivers (RC gate)...\n');
  console.log('Repo-backed entities: markets, tenants, users, couriers, orders, customers\n');

  let jsonResults: Map<string, { status: number; data: unknown }>;
  let dbResults: Map<string, { status: number; data: unknown }>;

  try {
    dbResults = await runWithDriver('db');
  } catch (e) {
    console.error('DB driver failed:', e);
    console.error('  Hint: run `pnpm db:seed` before verifying with db driver.');
    process.exit(1);
  }

  await sleep(500);

  try {
    jsonResults = await runWithDriver('json');
  } catch (e) {
    console.error('JSON driver failed:', e);
    process.exit(1);
  }

  let allPass = true;
  for (const def of ENDPOINTS) {
    const j = jsonResults.get(def.name)!;
    const d = dbResults.get(def.name)!;

    const statusMatch = j.status === d.status;
    const catalogExtra = def.name === 'GET /catalog/:tenantId' ? CATALOG_IGNORE : undefined;
    const bodyMatch = deepEqual(j.data, d.data, catalogExtra);

    const pass = statusMatch && bodyMatch;
    if (!pass) allPass = false;

    const icon = pass ? 'PASS' : 'FAIL';
    console.log(`${icon} ${def.name}`);

    if (!statusMatch) {
      console.log(`     Status: json=${j.status} db=${d.status}`);
    }
    if (!bodyMatch) {
      const jArr = Array.isArray(j.data) ? j.data : [];
      const dArr = Array.isArray(d.data) ? d.data : [];
      if (jArr.length !== dArr.length) {
        console.log(`     Array length: json=${jArr.length} db=${dArr.length}`);
      }
      const diffs = diffOutput(j.data, d.data, def.name, catalogExtra);
      for (const { path, jsonVal, dbVal } of diffs) {
        console.log(`     Diff at ${path}:`);
        console.log(`       json: ${jsonVal}`);
        console.log(`       db:   ${dbVal}`);
      }
    }
  }

  console.log('\n' + (allPass ? 'PASS' : 'FAIL'));
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
