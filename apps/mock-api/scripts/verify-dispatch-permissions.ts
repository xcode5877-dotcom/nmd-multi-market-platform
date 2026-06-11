#!/usr/bin/env npx tsx
/**
 * Dispatch-only permission verification (Phase 1).
 * Run: pnpm --filter mock-api verify:dispatch-permissions
 * Optional live API: MOCK_API_URL=http://localhost:5190 pnpm --filter mock-api verify:dispatch-permissions
 *
 * Live env overrides:
 *   COURIER_EMAIL (default ahmed@courier.nmd.com)
 *   COURIER_PASSWORD (default 123456)
 *   MARKET_ADMIN_EMAIL (default dab@nmd.com)
 *   MARKET_ADMIN_PASSWORD (default 123456789)
 *   TENANT_ADMIN_EMAIL (default ms-brands@nmd.com)
 *   TENANT_ADMIN_PASSWORD (default ms123456)
 */

const MOCK_API_URL = (process.env.MOCK_API_URL ?? 'http://localhost:5190').replace(/\/$/, '');
const RUN_LIVE = process.env.SKIP_LIVE !== '1';
const API_KEY = process.env.API_KEY ?? process.env.VITE_API_KEY ?? 'dev-api-key';

const COURIER_EMAIL = process.env.COURIER_EMAIL ?? 'ahmed@courier.nmd.com';
const COURIER_PASSWORD = process.env.COURIER_PASSWORD ?? '123456';
const MARKET_ADMIN_EMAIL = process.env.MARKET_ADMIN_EMAIL ?? 'dab@nmd.com';
const MARKET_ADMIN_PASSWORD = process.env.MARKET_ADMIN_PASSWORD ?? '123456';
const TENANT_ADMIN_EMAIL = process.env.TENANT_ADMIN_EMAIL ?? 'ms-brands@nmd.com';
const TENANT_ADMIN_PASSWORD = process.env.TENANT_ADMIN_PASSWORD ?? 'ms123456';

const MARKET_ID = process.env.MARKET_ID ?? 'market-dabburiyya';
const OTHER_MARKET_ID = process.env.OTHER_MARKET_ID ?? 'market-iksal';
const COURIER_ID = process.env.COURIER_ID ?? 'courier-50971b77-4811-49e8-825b-78bd84041782';
const TEST_TENANT_ID = process.env.TEST_TENANT_ID ?? '5b35539f-90e1-49cc-8c32-8d26cdce20f2';

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

async function courierFetch(path: string, token: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${MOCK_API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'x-api-key': API_KEY,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

async function findUnassignedDeliveryOrder(marketToken: string): Promise<string | null> {
  const queueRes = await apiFetch(`/markets/${MARKET_ID}/dispatch/queue`, marketToken);
  if (!queueRes.ok) return null;
  const queue = (await queueRes.json()) as { id?: string }[];
  return queue[0]?.id ?? null;
}

async function findAssignedOrderForCourier(courierToken: string): Promise<{ id: string; otherCourierOrderId?: string } | null> {
  const res = await courierFetch('/courier/orders', courierToken);
  if (!res.ok) return null;
  const orders = (await res.json()) as { id?: string; courierId?: string }[];
  const assigned = orders.find((o) => o.id);
  if (!assigned?.id) return null;
  return { id: assigned.id };
}

console.log('\n=== Dispatch Permissions — Live API ===\n');

async function runLiveTests(): Promise<void> {
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

  const courierToken = await login(COURIER_EMAIL, COURIER_PASSWORD);
  const marketToken = await login(MARKET_ADMIN_EMAIL, MARKET_ADMIN_PASSWORD);
  const marketOtherToken = await login('iksal@nmd.com', '123456');
  const tenantToken = await login(TENANT_ADMIN_EMAIL, TENANT_ADMIN_PASSWORD);

  assert(!!courierToken, `COURIER can login (${COURIER_EMAIL})`);
  assert(!!marketToken, `MARKET_ADMIN can login (${MARKET_ADMIN_EMAIL})`);

  if (!courierToken) {
    console.log('\n=== Results: skipped (no courier token) ===\n');
    return;
  }

  // 1. COURIER GET /courier/orders returns assigned only (array, no unassigned without courierId in response)
  const myOrdersRes = await courierFetch('/courier/orders', courierToken);
  assert(myOrdersRes.status === 200, 'COURIER GET /courier/orders returns 200');
  if (myOrdersRes.ok) {
    const myOrders = (await myOrdersRes.json()) as { courierId?: string }[];
    assert(Array.isArray(myOrders), 'COURIER orders response is array');
    const allAssignedToSelf = myOrders.every((o) => o.courierId === COURIER_ID || o.courierId != null);
    assert(allAssignedToSelf || myOrders.length === 0, 'COURIER orders are assigned deliveries only');
  }

  // 2. COURIER GET /courier/orders/available → 403 DISPATCH_ONLY
  const availableRes = await courierFetch('/courier/orders/available', courierToken);
  assert(availableRes.status === 403, 'COURIER GET /courier/orders/available returns 403');
  if (availableRes.status === 403) {
    const body = (await availableRes.json()) as { error?: string };
    assert(body.error === 'DISPATCH_ONLY', 'available endpoint returns DISPATCH_ONLY code');
  }

  // 3. COURIER POST accept → 403 DISPATCH_ONLY
  const fakeOrderId = '00000000-0000-0000-0000-000000000001';
  const acceptRes = await courierFetch(`/courier/orders/${fakeOrderId}/accept`, courierToken, { method: 'POST' });
  assert(acceptRes.status === 403, 'COURIER POST /courier/orders/:id/accept returns 403');
  if (acceptRes.status === 403) {
    const body = (await acceptRes.json()) as { error?: string };
    assert(body.error === 'DISPATCH_ONLY', 'accept endpoint returns DISPATCH_ONLY code');
  }

  // 4. COURIER POST external-orders → 403 DISPATCH_ONLY
  const extRes = await courierFetch('/courier/external-orders', courierToken, {
    method: 'POST',
    body: JSON.stringify({
      tenantId: 'other',
      manualStoreName: 'Test Store',
      externalDestination: 'Test',
      deliveryFee: 10,
    }),
  });
  assert(extRes.status === 403, 'COURIER POST /courier/external-orders returns 403');
  if (extRes.status === 403) {
    const body = (await extRes.json()) as { error?: string };
    assert(body.error === 'DISPATCH_ONLY', 'external-orders returns DISPATCH_ONLY code');
  }

  if (marketToken) {
    const unassignedId = await findUnassignedDeliveryOrder(marketToken);
    const testOrderId = unassignedId ?? fakeOrderId;

    // 5. MARKET_ADMIN can assign for own market (or 404 if no order)
    const assignRes = await apiFetch(`/markets/${MARKET_ID}/orders/${testOrderId}/assign-courier`, marketToken, {
      method: 'POST',
      body: JSON.stringify({ courierId: COURIER_ID }),
    });
    assert(
      assignRes.status === 200 || assignRes.status === 404 || assignRes.status === 409,
      'MARKET_ADMIN assign own market: 200/404/409 (not 403)'
    );
    assert(assignRes.status !== 403, 'MARKET_ADMIN can assign for own market (not forbidden)');

    // 6. MARKET_ADMIN cannot assign for other market
    if (marketOtherToken) {
      const crossAssign = await apiFetch(`/markets/${OTHER_MARKET_ID}/orders/${testOrderId}/assign-courier`, marketToken, {
        method: 'POST',
        body: JSON.stringify({ courierId: COURIER_ID }),
      });
      assert(crossAssign.status === 403, 'MARKET_ADMIN cannot assign for other market');
    }

    // 7. TENANT_ADMIN cannot assign
    if (tenantToken) {
      const tenantAssign = await apiFetch(`/markets/${MARKET_ID}/orders/${testOrderId}/assign-courier`, tenantToken, {
        method: 'POST',
        body: JSON.stringify({ courierId: COURIER_ID }),
      });
      assert(tenantAssign.status === 403, 'TENANT_ADMIN cannot assign courier');
    }

    // 8. COURIER cannot call admin assign
    const courierAssign = await courierFetch(`/markets/${MARKET_ID}/orders/${testOrderId}/assign-courier`, courierToken, {
      method: 'POST',
      body: JSON.stringify({ courierId: COURIER_ID }),
    });
    assert(courierAssign.status === 403, 'COURIER cannot call admin assign endpoint');
  }

  // 9. CUSTOMER cannot call admin assign
  const customerLogin = await fetch(`${MOCK_API_URL}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '0501234567', code: '1234' }),
  }).catch(() => null);
  if (customerLogin?.ok) {
    const cust = (await customerLogin.json()) as { token?: string };
    if (cust.token) {
      const customerAssign = await apiFetch(`/markets/${MARKET_ID}/orders/${fakeOrderId}/assign-courier`, cust.token, {
        method: 'POST',
        body: JSON.stringify({ courierId: COURIER_ID }),
      });
      assert(customerAssign.status === 403, 'CUSTOMER cannot call admin assign endpoint');
    }
  } else {
    console.log('  (skip) customer OTP login unavailable');
  }

  // 10–11. Status updates: assigned courier can update; unassigned order blocked
  const assigned = await findAssignedOrderForCourier(courierToken);
  if (assigned?.id) {
    const statusOk = await courierFetch(`/courier/orders/${assigned.id}/status`, courierToken, {
      method: 'POST',
      body: JSON.stringify({ action: 'ACKNOWLEDGE' }),
    });
    assert(
      statusOk.status === 200 || statusOk.status === 409 || statusOk.status === 400,
      'Assigned courier can POST status (200/409/400, not 403)'
    );
    assert(statusOk.status !== 403, 'Assigned courier not forbidden on own order status');
  } else {
    console.log('  (skip) no assigned order for courier status test');
  }

  const statusBlocked = await courierFetch(`/courier/orders/${fakeOrderId}/status`, courierToken, {
    method: 'POST',
    body: JSON.stringify({ action: 'ACKNOWLEDGE' }),
  });
  assert(statusBlocked.status === 403 || statusBlocked.status === 404, 'Unassigned/unknown order status blocked (403/404)');

  // 12–16. Market Admin external order creation
  if (marketToken) {
    let tenantIdForExt = TEST_TENANT_ID;
    const tenantsRes = await apiFetch(`/markets/${MARKET_ID}/tenants`, marketToken);
    if (tenantsRes.ok) {
      const marketTenants = (await tenantsRes.json()) as { id?: string }[];
      if (marketTenants[0]?.id) tenantIdForExt = marketTenants[0].id!;
    }

    const createExt = await apiFetch(`/markets/${MARKET_ID}/external-orders`, marketToken, {
      method: 'POST',
      body: JSON.stringify({
        tenantId: tenantIdForExt,
        customerName: 'Dispatch Verify Customer',
        customerPhone: '0509999888',
        deliveryAddress: 'Verify Address',
        notes: 'verify-dispatch-permissions',
        deliveryFee: 30,
        courierId: COURIER_ID,
      }),
    });
    assert(createExt.status === 201, 'MARKET_ADMIN can create external order');
    let extOrderId = '';
    if (createExt.ok) {
      const created = (await createExt.json()) as { id?: string; isExternal?: boolean; status?: string; courierId?: string };
      extOrderId = created.id ?? '';
      assert(created.isExternal === true, 'external order has isExternal=true');
      assert(created.status === 'READY', 'external order is READY (not auto-completed)');
      assert(created.courierId === COURIER_ID, 'external order assigned courier at create');
    }

    if (extOrderId && courierToken) {
      const courierOrdersRes = await courierFetch('/courier/orders', courierToken);
      if (courierOrdersRes.ok) {
        const list = (await courierOrdersRes.json()) as { id?: string }[];
        assert(list.some((o) => o.id === extOrderId), 'courier sees assigned external order');
      }
    }

    if (tenantToken) {
      const tenantExt = await apiFetch(`/markets/${MARKET_ID}/external-orders`, tenantToken, {
        method: 'POST',
        body: JSON.stringify({
          manualStoreName: 'Blocked Store',
          customerName: 'X',
          customerPhone: '0500000000',
          deliveryAddress: 'X',
          deliveryFee: 10,
        }),
      });
      assert(tenantExt.status === 403, 'TENANT_ADMIN cannot create external order');
    }

    const customerExtLogin = await fetch(`${MOCK_API_URL}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '0501234567', code: '1234' }),
    }).catch(() => null);
    if (customerExtLogin?.ok) {
      const cust = (await customerExtLogin.json()) as { token?: string };
      if (cust.token) {
        const customerExt = await apiFetch(`/markets/${MARKET_ID}/external-orders`, cust.token, {
          method: 'POST',
          body: JSON.stringify({
            manualStoreName: 'Blocked',
            customerName: 'X',
            customerPhone: '0500000000',
            deliveryAddress: 'X',
            deliveryFee: 10,
          }),
        });
        assert(customerExt.status === 403, 'CUSTOMER cannot create external order');
      }
    }
  }
}

if (RUN_LIVE) {
  await runLiveTests();
} else {
  console.log('  (skip) SKIP_LIVE=1');
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
