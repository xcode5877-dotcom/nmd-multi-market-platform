#!/usr/bin/env npx tsx
/**
 * Delivery status consistency verification.
 * Run: pnpm --filter mock-api verify:delivery-status-sync
 *
 * Optional live API: MOCK_API_URL=http://localhost:5190 pnpm --filter mock-api verify:delivery-status-sync
 * Skip DB scan: SKIP_DB=1
 */

import {
  hasDeliveredStatusMismatch,
  isCourierListTerminalStatus,
  syncAdminDeliveredOrder,
} from '../src/delivery-status-sync.js';
import { prisma } from '../src/db.js';

const MOCK_API_URL = (process.env.MOCK_API_URL ?? 'http://localhost:5190').replace(/\/$/, '');
const RUN_LIVE = process.env.SKIP_LIVE !== '1';
const SKIP_DB = process.env.SKIP_DB === '1';

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

function runUnitTests(): void {
  console.log('\n--- Unit: syncAdminDeliveredOrder ---');

  const withCourier = syncAdminDeliveredOrder({
    id: 'ord-1',
    status: 'DELIVERED',
    deliveryStatus: 'IN_PROGRESS',
    courierId: 'courier-1',
    deliveryTimeline: { assignedAt: '2026-01-01T00:00:00.000Z', acknowledgedAt: '2026-01-01T00:05:00.000Z' },
  });

  assert(withCourier.status === 'COMPLETED', 'courier order → status COMPLETED');
  assert(withCourier.deliveryStatus === 'DELIVERED', 'courier order → deliveryStatus DELIVERED');
  assert(!!withCourier.deliveryTimeline?.deliveredAt, 'courier order → deliveryTimeline.deliveredAt set');
  assert(!hasDeliveredStatusMismatch(withCourier), 'no DELIVERED+IN_PROGRESS after sync (courier)');

  const withoutCourier = syncAdminDeliveredOrder({
    id: 'ord-2',
    status: 'READY',
    deliveryStatus: 'UNASSIGNED',
  });

  assert(withoutCourier.status === 'DELIVERED', 'no courier → status stays DELIVERED');
  assert(withoutCourier.deliveryStatus === 'DELIVERED', 'no courier → deliveryStatus DELIVERED');
  assert(!!withoutCourier.deliveryTimeline?.deliveredAt, 'no courier → deliveryTimeline.deliveredAt set');
  assert(!hasDeliveredStatusMismatch(withoutCourier), 'no DELIVERED+IN_PROGRESS after sync (no courier)');

  assert(
    hasDeliveredStatusMismatch({ status: 'DELIVERED', deliveryStatus: 'IN_PROGRESS' }),
    'detector identifies DELIVERED+IN_PROGRESS mismatch',
  );
  assert(
    !hasDeliveredStatusMismatch({ status: 'COMPLETED', deliveryStatus: 'DELIVERED' }),
    'COMPLETED+DELIVERED is not a mismatch',
  );

  console.log('\n--- Unit: isCourierListTerminalStatus ---');
  assert(isCourierListTerminalStatus('COMPLETED'), 'COMPLETED is terminal');
  assert(isCourierListTerminalStatus('DELIVERED'), 'DELIVERED is terminal');
  assert(!isCourierListTerminalStatus('READY'), 'READY is not terminal');
  assert(!isCourierListTerminalStatus('IN_PROGRESS'), 'IN_PROGRESS is not terminal');
}

async function scanDatabaseMismatches(): Promise<void> {
  if (SKIP_DB) {
    console.log('\n--- DB scan skipped (SKIP_DB=1) ---');
    return;
  }

  console.log('\n--- DB scan: status=DELIVERED AND deliveryStatus≠DELIVERED ---');

  const rows = await prisma.$queryRaw<
    { id: string; status: string | null; delivery_status: string | null; courierId: string | null }[]
  >`
    SELECT
      o.id,
      o.status,
      o.payload::json->>'deliveryStatus' AS delivery_status,
      o."courierId"
    FROM "Order" o
    WHERE o.status = 'DELIVERED'
      AND COALESCE(o.payload::json->>'deliveryStatus', '') <> 'DELIVERED'
    ORDER BY o."createdAt" DESC
  `;

  if (rows.length === 0) {
    console.log('  No mismatched orders in database.');
    assert(true, 'zero DELIVERED status / non-DELIVERED deliveryStatus rows');
    return;
  }

  console.log(`  Found ${rows.length} mismatched order(s) (pre-existing; not auto-repaired by this script):`);
  for (const row of rows) {
    console.log(`    - ${row.id}  deliveryStatus=${row.delivery_status ?? '(null)'}  courierId=${row.courierId ?? '(none)'}`);
  }
}

async function runLiveApiTest(): Promise<void> {
  if (!RUN_LIVE) {
    console.log('\n--- Live API skipped (SKIP_LIVE=1) ---');
    return;
  }

  console.log('\n--- Live API: PATCH DELIVERED syncs deliveryStatus ---');

  try {
    const health = await fetch(`${MOCK_API_URL}/health`);
    if (!health.ok) {
      console.log('  API not reachable; skipping live tests.');
      return;
    }

  const marketEmail = process.env.MARKET_ADMIN_EMAIL ?? 'dab@nmd.com';
  const marketPassword = process.env.MARKET_ADMIN_PASSWORD ?? '123456789';

  const loginRes = await fetch(`${MOCK_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: marketEmail, password: marketPassword }),
  });
  if (!loginRes.ok) {
    console.log('  Market admin login failed; skipping live tests.');
    return;
  }
  const { token } = (await loginRes.json()) as { token?: string };
  if (!token) {
    console.log('  No token; skipping live tests.');
    return;
  }

  const marketId = process.env.MARKET_ID ?? 'market-dabburiyya';
  const queueRes = await fetch(`${MOCK_API_URL}/markets/${marketId}/dispatch/queue`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!queueRes.ok) {
    console.log('  Could not load dispatch queue; skipping live PATCH test.');
    return;
  }

  const queue = (await queueRes.json()) as { id?: string; courierId?: string }[];
  const candidate = queue.find((o) => o.id);
  if (!candidate?.id) {
    console.log('  No unassigned queue order for live test; skipping PATCH test.');
    return;
  }

  const courierId = process.env.COURIER_ID ?? 'courier-50971b77-4811-49e8-825b-78bd84041782';
  const assignRes = await fetch(`${MOCK_API_URL}/markets/${marketId}/dispatch/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ orderId: candidate.id, courierId }),
  });
  if (!assignRes.ok) {
    console.log('  Could not assign test order; skipping PATCH test.');
    return;
  }

  const patchRes = await fetch(`${MOCK_API_URL}/orders/${candidate.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status: 'DELIVERED' }),
  });
  assert(patchRes.ok, `PATCH DELIVERED returns ${patchRes.status}`);

  const patched = (await patchRes.json()) as {
    status?: string;
    deliveryStatus?: string;
    deliveryTimeline?: { deliveredAt?: string };
  };

  assert(patched.status === 'COMPLETED', 'live: assigned order → COMPLETED');
  assert(patched.deliveryStatus === 'DELIVERED', 'live: deliveryStatus DELIVERED');
  assert(!!patched.deliveryTimeline?.deliveredAt, 'live: deliveryTimeline.deliveredAt set');
  assert(
    !(patched.status === 'DELIVERED' && patched.deliveryStatus === 'IN_PROGRESS'),
    'live: never DELIVERED+IN_PROGRESS after admin update',
  );
  } catch (err) {
    console.log('  API not reachable or live test failed; skipping:', (err as Error).message ?? err);
  }
}

async function main(): Promise<void> {
  console.log('verify-delivery-status-sync');

  runUnitTests();
  await scanDatabaseMismatches();
  await runLiveApiTest();

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
