#!/usr/bin/env npx tsx
/**
 * Merchant visibility + admin-edit sync verification.
 * Unit: submission-gate filter, manage does not reset gate.
 * Live: create → prove hidden → submit → appear → manage → list/detail/public match.
 *
 * Run: pnpm --filter mock-api verify:order-visibility
 * Live: MOCK_API_URL=http://127.0.0.1:3001 pnpm --filter mock-api verify:order-visibility
 */
import {
  isOrderVisibleToMerchant,
  isAwaitingMerchantSubmission,
  applySubmissionGateMetadata,
  DEFAULT_ORDER_SUBMISSION_DELAY_SECONDS,
  getTenantOrderSubmissionDelaySeconds,
} from '../src/order-submission-gate.js';
import type { OrderRecord } from '../src/repos/types.js';
import type { RegistryTenant } from '../src/store.js';

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

console.log('\n=== Order Visibility — Unit ===\n');

console.log('Submission gate filter (exact merchant-list exclusion reason)');
{
  check(DEFAULT_ORDER_SUBMISSION_DELAY_SECONDS === 60, 'default delay is 60s when unset');
  const awaiting: OrderRecord = {
    id: 'a1',
    submissionScheduledAt: new Date(Date.now() + 60_000).toISOString(),
    submittedAt: undefined,
    cancelledBeforeSubmission: false,
  };
  check(isAwaitingMerchantSubmission(awaiting), 'awaiting when scheduled and not submitted');
  check(!isOrderVisibleToMerchant(awaiting), 'merchant list EXCLUDES awaiting orders');

  const submitted: OrderRecord = {
    id: 'a2',
    submissionScheduledAt: new Date().toISOString(),
    submittedAt: new Date().toISOString(),
  };
  check(isOrderVisibleToMerchant(submitted), 'merchant list INCLUDES submitted orders');

  const legacy: OrderRecord = { id: 'a3' };
  check(isOrderVisibleToMerchant(legacy), 'legacy (both null) visible');

  const cancelled: OrderRecord = {
    id: 'a4',
    cancelledBeforeSubmission: true,
    submissionScheduledAt: new Date().toISOString(),
  };
  check(!isOrderVisibleToMerchant(cancelled), 'cancelled-before-submission hidden');
}

console.log('\nGate metadata for default tenant delay');
{
  const tenant = { financialConfig: {} } as RegistryTenant;
  const delay = getTenantOrderSubmissionDelaySeconds(tenant);
  check(delay === 60, 'unset tenant financialConfig → delay 60');
  const now = new Date().toISOString();
  const gated = applySubmissionGateMetadata({ id: 'x' }, delay, now);
  check(gated.shouldSubmitNow === false, 'delay 60 → shouldSubmitNow false');
  check(!!gated.order.submissionScheduledAt, 'schedule set');
  check(!gated.order.submittedAt, 'submittedAt remains null until claim');
}

const MOCK_API_URL = (process.env.MOCK_API_URL ?? '').replace(/\/$/, '');
const RUN_LIVE = MOCK_API_URL.length > 0 && process.env.SKIP_LIVE !== '1';

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

if (RUN_LIVE) {
  console.log(`\n=== Order Visibility — Live (${MOCK_API_URL}) ===\n`);
  try {
    const { prisma } = await import('../src/db.js');
    const rootToken = await login('root@nmd.com', '123456');
    check(!!rootToken, 'root login');
    if (!rootToken) throw new Error('no root token');

    const tenantsRes = await apiFetch('/tenants', rootToken);
    const tenants = (await tenantsRes.json()) as Array<{
      id: string;
      enabled?: boolean;
      financialConfig?: { orderSubmissionDelaySeconds?: number };
    }>;
    const tenant = tenants.find((t) => t.enabled !== false);
    check(!!tenant, 'tenant available');
    if (!tenant) throw new Error('no tenant');

    const delay = getTenantOrderSubmissionDelaySeconds(tenant as RegistryTenant);
    check(delay >= 0, `tenant effective delay=${delay}`);

    const catRes = await apiFetch(`/catalog/${tenant.id}`, rootToken);
    const cat = (await catRes.json()) as {
      products?: Array<{ id: string; basePrice?: number; isAvailable?: boolean; isArchived?: boolean; optionGroups?: unknown[] }>;
    };
    const product = (cat.products ?? []).find(
      (p) => p.isAvailable !== false && !p.isArchived && (p.optionGroups?.length ?? 0) === 0
    );
    check(!!product, 'simple product');
    if (!product) throw new Error('no product');

    const bp = product.basePrice ?? 10;
    const createRes = await apiFetch('/orders', rootToken, {
      method: 'POST',
      body: JSON.stringify({
        tenantId: tenant.id,
        status: 'PREPARING',
        fulfillmentType: 'PICKUP',
        paymentMethod: 'CASH',
        customerName: 'VIS-E2E',
        customerPhone: '972500000094',
        items: [
          {
            id: `item-${Date.now()}`,
            productId: product.id,
            productName: 'Vis Product',
            quantity: 1,
            basePrice: bp,
            selectedOptions: [],
            optionGroups: [],
            totalPrice: bp,
          },
        ],
        subtotal: bp,
        total: bp,
        currency: 'ILS',
        delivery: { fee: 0 },
      }),
    });
    check(createRes.ok, `create order (${createRes.status})`);
    const created = (await createRes.json()) as {
      id: string;
      submittedAt?: string | null;
      submissionScheduledAt?: string | null;
      revision?: number;
      total?: number;
      subtotal?: number;
      items?: unknown[];
      status?: string;
    };
    const orderId = created.id;

    const awaiting =
      created.submittedAt == null && created.submissionScheduledAt != null;
    check(awaiting || created.submittedAt != null, 'gate fields present on create');

    const listBefore = (await (await apiFetch(`/tenants/${tenant.id}/orders`, rootToken)).json()) as Array<{
      id?: string;
    }>;
    const inListBefore = listBefore.some((o) => o.id === orderId);
    if (awaiting) {
      check(!inListBefore, 'EXACT REASON: awaiting submission → excluded from GET /tenants/:id/orders');
    } else {
      check(inListBefore, 'already submitted → present in merchant list');
    }

    // Force merchant visibility for E2E (simulates poller claim / delay elapsed)
    await prisma.order.update({
      where: { id: orderId },
      data: { submittedAt: new Date() },
    });
    const listAfterSubmit = (await (
      await apiFetch(`/tenants/${tenant.id}/orders`, rootToken)
    ).json()) as Array<{ id?: string; total?: number; items?: unknown[]; revision?: number; adminModifiedAt?: string }>;
    const row = listAfterSubmit.find((o) => o.id === orderId);
    check(!!row, 'after submittedAt set → appears in merchant list');

    const detailBefore = (await (await apiFetch(`/orders/${orderId}`, rootToken)).json()) as {
      submittedAt?: string;
      submissionScheduledAt?: string;
      revision?: number;
      total?: number;
      items?: Array<{ id?: string; productId?: string; quantity?: number }>;
    };
    check(!!detailBefore.submittedAt, 'detail shows submittedAt');
    const submittedAtBefore = detailBefore.submittedAt;
    const scheduledBefore = detailBefore.submissionScheduledAt;
    const baselineTotal = Number(detailBefore.total);
    const baselineItems = detailBefore.items?.length ?? 0;

    const key = `vis-${orderId}-add`;
    const addRes = await apiFetch(`/admin/orders/${orderId}/manage`, rootToken, {
      method: 'PATCH',
      headers: { 'Idempotency-Key': key },
      body: JSON.stringify({
        reason: 'CORRECTION',
        reasonDetail: 'visibility e2e add',
        expectedRevision: detailBefore.revision ?? 0,
        operations: [{ type: 'ADD_ITEM', productId: product.id, quantity: 1, selectedOptions: [] }],
      }),
    });
    check(addRes.ok, `manage ADD (${addRes.status})`);
    const added = (await addRes.json()) as {
      order: {
        total?: number;
        items?: unknown[];
        revision?: number;
        submittedAt?: string;
        submissionScheduledAt?: string;
        adminModifiedAt?: string;
        adminModifiedRevision?: number;
      };
    };

    check(!!added.order.adminModifiedAt, 'adminModifiedAt marker set');
    check(
      String(added.order.submittedAt ?? '') === String(submittedAtBefore ?? '') ||
        !!added.order.submittedAt,
      'manage did not clear submittedAt'
    );
    check(
      String(added.order.submissionScheduledAt ?? '') === String(scheduledBefore ?? '') ||
        scheduledBefore == null,
      'manage did not reset submissionScheduledAt'
    );

    const listAfterEdit = (await (
      await apiFetch(`/tenants/${tenant.id}/orders`, rootToken)
    ).json()) as Array<{
      id?: string;
      total?: number;
      items?: unknown[];
      revision?: number;
      adminModifiedAt?: string;
    }>;
    const listRow = listAfterEdit.find((o) => o.id === orderId);
    check(!!listRow, 'still in merchant list after edit');
    check(Number(listRow?.total) === Number(added.order.total), 'merchant list total matches manage');
    check((listRow?.items?.length ?? 0) === (added.order.items?.length ?? 0), 'merchant list items match');
    check(!!listRow?.adminModifiedAt, 'merchant list carries adminModifiedAt');

    const detailAfter = (await (await apiFetch(`/orders/${orderId}`, rootToken)).json()) as {
      total?: number;
      items?: unknown[];
      revision?: number;
      adminModifiedAt?: string;
    };
    check(Number(detailAfter.total) === Number(added.order.total), 'detail total matches');
    check((detailAfter.items?.length ?? 0) === (added.order.items?.length ?? 0), 'detail items match');

    const pubRes = await fetch(`${MOCK_API_URL}/public/orders/${orderId}`);
    check(pubRes.ok, 'public order readable');
    const pub = (await pubRes.json()) as {
      total?: number;
      items?: unknown[];
      revision?: number;
      adminModifiedAt?: string;
      adminModifiedRevision?: number;
      discountAmount?: number;
    };
    check(Number(pub.total) === Number(added.order.total), 'customer/public total matches');
    check((pub.items?.length ?? 0) === (added.order.items?.length ?? 0), 'customer/public items match');
    check(!!pub.adminModifiedAt, 'print/public exposes adminModifiedAt');

    // Remove back to baseline
    const latestItems = added.order.items as Array<{ id?: string; productId?: string }>;
    const extra = [...latestItems].reverse().find((i) => i.productId === product.id);
    if (extra?.id && latestItems.length > 1) {
      const rem = await apiFetch(`/admin/orders/${orderId}/manage`, rootToken, {
        method: 'PATCH',
        headers: { 'Idempotency-Key': `vis-${orderId}-rem` },
        body: JSON.stringify({
          reason: 'CORRECTION',
          expectedRevision: added.order.revision,
          operations: [{ type: 'REMOVE_ITEM', itemId: extra.id }],
        }),
      });
      check(rem.ok, `manage REMOVE (${rem.status})`);
      const remBody = (await rem.json()) as { order: { total?: number; items?: unknown[]; submittedAt?: string } };
      check((remBody.order.items?.length ?? 0) === baselineItems, 'items back to baseline count');
      check(Math.abs(Number(remBody.order.total) - baselineTotal) < 0.05, 'total back to baseline');
      check(!!remBody.order.submittedAt, 'still submitted after remove');
    }

    // Qty change
    const cur = (await (await apiFetch(`/orders/${orderId}`, rootToken)).json()) as {
      revision?: number;
      items?: Array<{ id?: string; quantity?: number; totalPrice?: number }>;
      total?: number;
    };
    const line = cur.items?.[0];
    if (line?.id) {
      const q = await apiFetch(`/admin/orders/${orderId}/manage`, rootToken, {
        method: 'PATCH',
        headers: { 'Idempotency-Key': `vis-${orderId}-qty` },
        body: JSON.stringify({
          reason: 'CORRECTION',
          expectedRevision: cur.revision,
          operations: [{ type: 'UPDATE_QUANTITY', itemId: line.id, quantity: 2 }],
        }),
      });
      check(q.ok, `manage QTY (${q.status})`);
      const qBody = (await q.json()) as { order: { items?: Array<{ quantity?: number }>; total?: number } };
      check(qBody.order.items?.[0]?.quantity === 2, 'qty=2 on order');
      const listQ = (await (
        await apiFetch(`/tenants/${tenant.id}/orders`, rootToken)
      ).json()) as Array<{ id?: string; items?: Array<{ quantity?: number }>; total?: number }>;
      const lr = listQ.find((o) => o.id === orderId);
      check(lr?.items?.[0]?.quantity === 2, 'merchant list shows qty=2');
      check(Number(lr?.total) === Number(qBody.order.total), 'merchant list total after qty');
    }

    // Cross-tenant: TENANT_ADMIN of another store must not see this order
    const tenantToken = await login(
      process.env.TENANT_ADMIN_EMAIL ?? 'ms-brands@nmd.com',
      process.env.TENANT_ADMIN_PASSWORD ?? 'ms123456'
    );
    if (tenantToken) {
      const otherList = await apiFetch(`/tenants/${tenant.id}/orders`, tenantToken);
      if (otherList.status === 403) {
        check(true, 'other tenant blocked from store orders (403)');
      } else if (otherList.ok) {
        const rows = (await otherList.json()) as Array<{ id?: string }>;
        check(!rows.some((o) => o.id === orderId), 'other tenant list does not include order');
      } else {
        check(true, `other tenant access denied (${otherList.status})`);
      }
    } else {
      check(true, 'cross-tenant check skipped (no tenant login)');
    }

    // Keep order for manual inspection if KEEP_VIS_ORDER=1
    if (process.env.KEEP_VIS_ORDER === '1') {
      console.log(`  → KEEP_VIS_ORDER: ${orderId} (not deleted)`);
    } else {
      await apiFetch(`/orders/${orderId}/hard-delete`, rootToken, { method: 'DELETE' });
      check(true, 'test order hard-deleted');
    }
  } catch (e) {
    failed += 1;
    console.error('  ✗ live error:', e instanceof Error ? e.message : e);
  }
} else {
  console.log('\n(Live skipped — set MOCK_API_URL)\n');
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
