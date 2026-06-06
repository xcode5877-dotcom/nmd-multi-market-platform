#!/usr/bin/env npx tsx
/**
 * Admin permission matrix + API hardening verification.
 * Run: pnpm --filter mock-api verify:admin-permissions
 * Optional live API: MOCK_API_URL=http://localhost:5190 pnpm --filter mock-api verify:admin-permissions
 *
 * Live TENANT env overrides:
 *   TENANT_ADMIN_EMAIL (default ms-brands@nmd.com)
 *   TENANT_ADMIN_PASSWORD (default ms123456)
 *   TENANT_ADMIN_TENANT_ID (default 5b35539f-90e1-49cc-8c32-8d26cdce20f2)
 *   OTHER_TENANT_ID — cross-tenant scope test target
 */

import { randomUUID } from 'node:crypto';
import {
  canViewModule,
  canAccessRoute,
  canEditField,
  stripProtectedCategoryFields,
  filterTenantPatchForRole,
  isPlatformSuperAdmin,
} from '@nmd/core';

const MOCK_API_URL = (process.env.MOCK_API_URL ?? 'http://localhost:5190').replace(/\/$/, '');
const RUN_LIVE = process.env.SKIP_LIVE !== '1';
const TENANT_ADMIN_EMAIL = process.env.TENANT_ADMIN_EMAIL ?? 'ms-brands@nmd.com';
const TENANT_ADMIN_PASSWORD = process.env.TENANT_ADMIN_PASSWORD ?? 'ms123456';
const TENANT_ADMIN_TENANT_ID =
  process.env.TENANT_ADMIN_TENANT_ID ?? '5b35539f-90e1-49cc-8c32-8d26cdce20f2';
/** Used for cross-tenant catalog scope tests (must differ from TENANT_ADMIN_TENANT_ID). */
const OTHER_TENANT_ID =
  process.env.OTHER_TENANT_ID ?? '78463821-ccb7-48af-841b-84a18c42abb6';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${message}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${message}`);
  }
}

async function login(email: string, password: string): Promise<string | null> {
  const res = await fetch(`${MOCK_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { token?: string; accessToken?: string };
  return data.token ?? data.accessToken ?? null;
}

async function apiFetch(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${MOCK_API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

console.log('\n=== Admin Permissions — Unit Matrix ===\n');

console.log('TENANT_ADMIN visibility');
{
  const role = 'TENANT_ADMIN';
  assert(canViewModule(role, 'products'), 'can view products');
  assert(canViewModule(role, 'settlementSummary'), 'can view settlement summary');
  assert(!canViewModule(role, 'platformFee'), 'cannot view platform fee module');
  assert(!canViewModule(role, 'drivers'), 'cannot view drivers');
  assert(!canViewModule(role, 'homeBuilder'), 'cannot view home builder');
  assert(!canAccessRoute(role, '/settings'), 'cannot access /settings');
  assert(!canAccessRoute(role, '/drivers'), 'cannot access /drivers');
  assert(canAccessRoute(role, '/catalog/products'), 'can access merchant products');
  assert(!canEditField(role, 'markupExempt'), 'cannot edit markupExempt');
  assert(!canEditField(role, 'platformFee'), 'cannot edit platformFee');
  assert(!canEditField(role, 'commissionType'), 'cannot edit commission');
}

console.log('\nMARKET_ADMIN visibility');
{
  const role = 'MARKET_ADMIN';
  assert(canViewModule(role, 'marketStores'), 'can view market stores');
  assert(canViewModule(role, 'marketOrders'), 'can view market orders');
  assert(!canViewModule(role, 'platformSettings'), 'cannot view platform settings');
  assert(!canViewModule(role, 'platformFees'), 'cannot view platform fees overview');
  assert(!canAccessRoute(role, '/economics'), 'cannot access economics');
  assert(canAccessRoute(role, '/markets/market-dabburiyya/orders'), 'can access market orders route pattern');
}

console.log('\nSUPER/ROOT visibility');
{
  for (const role of ['ROOT_ADMIN', 'SUPER_ADMIN'] as const) {
    assert(canViewModule(role, 'drivers'), `${role} sees drivers`);
    assert(canViewModule(role, 'platformFee'), `${role} sees platform fee`);
    assert(canAccessRoute(role, '/audit'), `${role} accesses audit`);
    assert(canEditField(role, 'markupExempt'), `${role} edits markupExempt`);
  }
}

console.log('\nCatalog / tenant patch sanitization');
{
  const existing = [{ id: 'c1', name: 'Drinks', markupExempt: false }];
  const incoming = [{ id: 'c1', name: 'Drinks', markupExempt: true }];
  const stripped = stripProtectedCategoryFields('TENANT_ADMIN', incoming, existing);
  assert(stripped[0]?.markupExempt === false, 'TENANT_ADMIN markupExempt stripped on save');
  const patch = filterTenantPatchForRole('TENANT_ADMIN', {
    name: 'Store',
    financialConfig: { platformFee: { enabled: true } },
  });
  assert(patch.name === 'Store', 'tenant patch keeps allowed field');
  assert(patch.financialConfig === undefined, 'tenant patch drops financialConfig');
}

async function runLiveTests(): Promise<void> {
  console.log('\n=== Admin Permissions — Live API (optional) ===\n');
  try {
    const health = await fetch(`${MOCK_API_URL}/markets`, { method: 'GET' });
    if (!health.ok) {
      console.log(`  (skip) API not reachable at ${MOCK_API_URL}`);
      return;
    }
  } catch {
    console.log(`  (skip) API not reachable at ${MOCK_API_URL}`);
    return;
  }

  const rootToken = await login('root@nmd.com', '123456');
  const tenantToken = await login(TENANT_ADMIN_EMAIL, TENANT_ADMIN_PASSWORD);
  const marketDab = await login('dab@nmd.com', '123456789');
  const marketIks = await login('iksal@nmd.com', '123456');

  assert(!!rootToken, 'ROOT can login');
  assert(!!tenantToken, `TENANT_ADMIN can login (${TENANT_ADMIN_EMAIL})`);

  const tenantId = TENANT_ADMIN_TENANT_ID;
  const otherTenantId = OTHER_TENANT_ID;

  if (tenantToken && tenantId !== otherTenantId) {
    const verifyCatId = randomUUID();
    const existingRes = await apiFetch(`/catalog/${tenantId}`, tenantToken);
    const existing = existingRes.ok
      ? ((await existingRes.json()) as {
          categories?: unknown[];
          products?: unknown[];
          optionGroups?: unknown[];
        })
      : { categories: [], products: [], optionGroups: [] };
    const catalogOwn = await apiFetch(`/catalog/${tenantId}`, tenantToken, {
      method: 'PUT',
      body: JSON.stringify({
        categories: [
          ...(existing.categories ?? []),
          {
            id: verifyCatId,
            name: 'Perm Verify',
            slug: `perm-verify-${verifyCatId.slice(0, 8)}`,
            markupExempt: true,
          },
        ],
        products: existing.products ?? [],
        optionGroups: existing.optionGroups ?? [],
      }),
    });
    assert(catalogOwn.status === 200 || catalogOwn.status === 404, 'TENANT_ADMIN can PUT own catalog');

    const catalogOther = await apiFetch(`/catalog/${otherTenantId}`, tenantToken, {
      method: 'PUT',
      body: JSON.stringify({ categories: [], products: [], optionGroups: [] }),
    });
    assert(catalogOther.status === 403, 'TENANT_ADMIN cannot PUT other tenant catalog');

    const feePatch = await apiFetch(`/tenants/${tenantId}`, tenantToken, {
      method: 'PATCH',
      body: JSON.stringify({ financialConfig: { commissionValue: 99 } }),
    });
    assert(feePatch.status === 200 || feePatch.status === 404, 'tenant patch accepted for own store');
    if (feePatch.ok) {
      const body = await feePatch.json();
      assert(
        (body as { financialConfig?: { commissionValue?: number } }).financialConfig?.commissionValue !== 99,
        'TENANT_ADMIN cannot persist financialConfig'
      );
    }

    const payments = await apiFetch(`/tenants/${tenantId}/settlement/payments?preset=month`, tenantToken);
    assert(payments.status === 403, 'TENANT_ADMIN cannot list manual settlement payments');

    const summary = await apiFetch(`/tenants/${tenantId}/settlement/summary?preset=month`, tenantToken);
    assert(summary.status === 200, 'TENANT_ADMIN can read settlement summary');
  }

  if (marketDab && marketIks) {
    const own = await apiFetch('/markets/market-dabburiyya/tenants', marketDab);
    const other = await apiFetch('/markets/market-iksal/tenants', marketDab);
    assert(own.status === 200, 'MARKET_ADMIN can access own market tenants');
    assert(other.status === 403, 'MARKET_ADMIN cannot access other market tenants');
  }

  if (rootToken) {
    assert(isPlatformSuperAdmin('ROOT_ADMIN'), 'platform super admin flag');
    const audit = await apiFetch('/audit/events?limit=1', rootToken);
    assert(audit.status === 200 || audit.status === 404, 'ROOT can access sensitive admin API');
  }

  const customerLogin = await fetch(`${MOCK_API_URL}/customer/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '0501234567', code: '1234' }),
  }).catch(() => null);
  if (customerLogin?.ok) {
    const cust = (await customerLogin.json()) as { token?: string };
    if (cust.token) {
      const adminTry = await apiFetch('/users', cust.token);
      assert(adminTry.status === 403, 'CUSTOMER cannot access admin APIs');
    }
  } else {
    console.log('  (skip) customer OTP login unavailable for live test');
  }
}

if (RUN_LIVE) {
  await runLiveTests();
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
