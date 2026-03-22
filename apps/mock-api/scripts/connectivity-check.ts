#!/usr/bin/env npx tsx
/**
 * Final connectivity check: Backend → Database and optional API health.
 * Run: cd apps/mock-api && API_BASE_URL=https://nmd.marketing/api DATABASE_URL=... pnpm run connectivity-check
 */
const API_BASE = (process.env.API_BASE_URL || process.env.VITE_MOCK_API_URL || '').replace(/\/$/, '');
const DATABASE_URL = process.env.DATABASE_URL;

async function checkApi(): Promise<boolean> {
  if (!API_BASE) {
    console.log('API: SKIP (no API_BASE_URL / VITE_MOCK_API_URL)');
    return true;
  }
  try {
    const res = await fetch(`${API_BASE}/health`, { method: 'GET' });
    const data = (await res.json()) as { ok?: boolean };
    const ok = res.ok && data.ok === true;
    console.log(ok ? `API: OK ${API_BASE}/health` : `API: FAIL ${API_BASE}/health (${res.status})`);
    return ok;
  } catch (e) {
    console.log('API: FAIL', e instanceof Error ? e.message : e);
    return false;
  }
}

async function checkDb(): Promise<boolean> {
  if (!DATABASE_URL) {
    console.log('DB: SKIP (no DATABASE_URL)');
    return true;
  }
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    console.log('DB: OK (PostgreSQL connection)');
    return true;
  } catch (e) {
    console.log('DB: FAIL', e instanceof Error ? e.message : e);
    return false;
  }
}

async function main() {
  console.log('Connectivity check (Backend ↔ Database)\n');
  const apiOk = await checkApi();
  const dbOk = await checkDb();
  const ok = apiOk && dbOk;
  console.log(ok ? '\nAll checks passed.' : '\nOne or more checks failed.');
  process.exit(ok ? 0 : 1);
}

main();
