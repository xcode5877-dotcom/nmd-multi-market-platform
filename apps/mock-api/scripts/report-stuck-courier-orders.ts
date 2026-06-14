#!/usr/bin/env npx tsx
/**
 * Dry-run report: orders stuck at OUT_FOR_DELIVERY + IN_PROGRESS for >24h.
 * Does NOT repair automatically. Pass --apply to persist fixes (optional).
 *
 * Run: pnpm --filter mock-api report:stuck-courier-orders
 * Apply: pnpm --filter mock-api report:stuck-courier-orders -- --apply
 */

import { prisma } from '../src/db.js';

const APPLY = process.argv.includes('--apply');
const HOURS_STALE = 24;
const cutoff = new Date(Date.now() - HOURS_STALE * 60 * 60 * 1000).toISOString();

type StuckRow = {
  id: string;
  status: string | null;
  delivery_status: string | null;
  courierId: string | null;
  createdAt: string | null;
  age_hours: number;
};

async function main(): Promise<void> {
  console.log('report-stuck-courier-orders (dry-run)');
  console.log(`Cutoff: orders with activity before ${cutoff} (${HOURS_STALE}h ago)\n`);

  const rows = await prisma.$queryRaw<StuckRow[]>`
    SELECT
      o.id,
      o.status,
      o.payload::json->>'deliveryStatus' AS delivery_status,
      o."courierId",
      o."createdAt",
      ROUND(EXTRACT(EPOCH FROM (NOW() - o."createdAt"::timestamptz)) / 3600)::int AS age_hours
    FROM "Order" o
    WHERE o."fulfillmentType" = 'DELIVERY'
      AND o.status = 'OUT_FOR_DELIVERY'
      AND COALESCE(o.payload::json->>'deliveryStatus', '') = 'IN_PROGRESS'
      AND o."createdAt" < ${cutoff}
    ORDER BY o."createdAt" ASC
  `;

  if (rows.length === 0) {
    console.log('No stuck orders found (OUT_FOR_DELIVERY + IN_PROGRESS, older than 24h).');
    return;
  }

  console.log(`Found ${rows.length} stuck order(s) eligible for repair:\n`);
  console.log('orderId | status | deliveryStatus | courierId | createdAt | age_hours');
  console.log('-'.repeat(100));
  for (const r of rows) {
    console.log(
      `${r.id} | ${r.status ?? ''} | ${r.delivery_status ?? ''} | ${r.courierId ?? '(none)'} | ${r.createdAt ?? ''} | ${r.age_hours ?? '?'}`
    );
  }

  console.log('\nProposed repair for each:');
  console.log('  status → COMPLETED');
  console.log('  deliveryStatus → DELIVERED');
  console.log('  deliveryTimeline.deliveredAt → now');

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to persist repairs.');
    return;
  }

  const now = new Date().toISOString();
  let repaired = 0;
  for (const r of rows) {
    const existing = await prisma.order.findUnique({ where: { id: r.id } });
    if (!existing) continue;
    let payload: Record<string, unknown> = {};
    try {
      payload = existing.payload ? (JSON.parse(existing.payload) as Record<string, unknown>) : {};
    } catch {
      payload = {};
    }
    let timeline: Record<string, unknown> = {};
    try {
      timeline = existing.deliveryTimeline
        ? (JSON.parse(existing.deliveryTimeline) as Record<string, unknown>)
        : (payload.deliveryTimeline as Record<string, unknown>) ?? {};
    } catch {
      timeline = {};
    }
    timeline.deliveredAt = timeline.deliveredAt ?? now;
    payload.deliveryStatus = 'DELIVERED';
    payload.deliveryTimeline = timeline;
    payload.deliveredAt = now;
    await prisma.order.update({
      where: { id: r.id },
      data: {
        status: 'COMPLETED',
        deliveryTimeline: JSON.stringify(timeline),
        payload: JSON.stringify(payload),
      },
    });
    repaired += 1;
    console.log(`  ✓ repaired ${r.id}`);
  }
  console.log(`\nRepaired ${repaired} order(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
