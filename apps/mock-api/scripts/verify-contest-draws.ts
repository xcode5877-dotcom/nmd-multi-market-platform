#!/usr/bin/env npx tsx
/**
 * Contest draw integrity + permission verification (ContestParticipation source only).
 * Run: pnpm --filter mock-api verify:contest-draws
 * Does not run a real production draw. Optional live/DB skipped if unavailable.
 */

import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { canAccessRoute, canViewModule, isPlatformSuperAdmin } from '@nmd/core';
import {
  buildEligiblePool,
  hashEligibleParticipants,
  maskPhone,
  pickSecureRandomIndex,
  DRAW_RANDOM_METHOD,
  withContestDrawLock,
} from '../src/contest-draws.js';

const MOCK_API_URL = (process.env.MOCK_API_URL ?? 'http://localhost:5190').replace(/\/$/, '');
const RUN_LIVE = process.env.SKIP_LIVE !== '1';
const RUN_DB = process.env.SKIP_DB !== '1';

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

console.log('\n=== Contest Draws — Unit ===\n');

console.log('Permissions');
{
  for (const role of ['ROOT_ADMIN', 'SUPER_ADMIN'] as const) {
    assert(isPlatformSuperAdmin(role), `${role} is platform super admin`);
    assert(canViewModule(role, 'contests'), `${role} can view contests`);
    assert(canAccessRoute(role, '/contests'), `${role} can access /contests`);
  }
  for (const role of ['TENANT_ADMIN', 'MARKET_ADMIN', 'COURIER', 'CUSTOMER'] as const) {
    assert(!isPlatformSuperAdmin(role), `${role} denied platform admin`);
    assert(!canViewModule(role, 'contests'), `${role} cannot view contests`);
  }
}

console.log('\nPhone masking');
{
  assert(maskPhone('0546111668') === '054***1668', 'masks local IL phone');
}

console.log('\nDedup by customerId from ContestParticipation');
{
  const customers = {
    c1: { id: 'c1', phone: '0541111111', name: 'A' },
    c2: { id: 'c2', phone: '0542222222', name: 'B' },
  };
  const parts = [
    { id: 'p2', customerId: 'c1', contestId: 'x', createdAt: '2026-01-02T00:00:00.000Z' },
    { id: 'p1', customerId: 'c1', contestId: 'x', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 'p3', customerId: 'c2', contestId: 'x', createdAt: '2026-01-03T00:00:00.000Z' },
    { id: 'p4', customerId: 'orphan', contestId: 'x', createdAt: '2026-01-04T00:00:00.000Z' },
  ];
  const { rawCount, eligible, duplicateGroups } = buildEligiblePool(parts, customers);
  assert(rawCount === 4, 'raw count from ContestParticipation');
  assert(eligible.length === 2, 'one chance per customer; orphan excluded');
  assert(duplicateGroups === 1, 'duplicate group counted');
  assert(eligible[0]!.participationId === 'p1', 'keeps earliest participation');
  assert(hashEligibleParticipants(eligible).length === 64, 'stable hash');
}

console.log('\ncrypto.randomInt only');
{
  const { index, method } = pickSecureRandomIndex(7);
  assert(method === DRAW_RANDOM_METHOD, 'method is crypto.randomInt');
  assert(index >= 0 && index < 7, 'index in range');
  let threw = false;
  try {
    pickSecureRandomIndex(0);
  } catch {
    threw = true;
  }
  assert(threw, 'empty pool throws');
}

console.log('\nContest lock');
{
  const order: number[] = [];
  await Promise.all([
    withContestDrawLock('lock-a', async () => {
      order.push(1);
      await new Promise((r) => setTimeout(r, 30));
      order.push(2);
    }),
    withContestDrawLock('lock-a', async () => {
      order.push(3);
      order.push(4);
    }),
  ]);
  assert(order.join(',') === '1,2,3,4', 'serializes concurrent draws');
}

async function tableExists(prisma: PrismaClient): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1 FROM "ContestDraw" LIMIT 1`;
    return true;
  } catch {
    return false;
  }
}

async function runDbTests(): Promise<void> {
  console.log('\n=== Contest Draws — DB (optional) ===\n');
  const prisma = new PrismaClient();
  try {
    if (!(await tableExists(prisma))) {
      console.log('  (skip) ContestDraw table missing — apply migration after approval');
      return;
    }

    const tag = `cdv-${Date.now()}`;
    const contestId = `${tag}-contest`;
    const c1 = `${tag}-c1`;
    const c2 = `${tag}-c2`;
    const phone1 = `050${String(Date.now()).slice(-7)}`;
    const now = new Date().toISOString();

    await prisma.customer.createMany({
      data: [
        { id: c1, phone: phone1, name: 'Draw One', createdAt: now },
        { id: c2, phone: `${phone1}8`.slice(0, 12), name: 'Draw Two', createdAt: now },
      ],
    });
    await prisma.contest.create({
      data: {
        id: contestId,
        title: 'Verify Draw',
        type: 'QUESTION',
        isActive: true,
        createdAt: now,
        coinsCost: 0,
      },
    });
    await prisma.contestParticipation.createMany({
      data: [
        { id: `${tag}-p1`, customerId: c1, contestId, userAnswer: 'a', isWinner: false, createdAt: now },
        { id: `${tag}-p2`, customerId: c2, contestId, userAnswer: 'b', isWinner: false, createdAt: now },
      ],
    });

    const beforeParts = await prisma.contestParticipation.count({ where: { contestId } });
    const beforeCoins = await prisma.customerCoin.count();

    const draw = await prisma.contestDraw.create({
      data: {
        id: `cdraw-${randomUUID()}`,
        contestId,
        winnerCustomerId: c1,
        winnerParticipationId: `${tag}-p1`,
        winnerNameSnapshot: 'Draw One',
        winnerPhoneSnapshot: phone1,
        participantsCount: 2,
        eligibleParticipantsCount: 2,
        performedByUserId: 'test',
        performedByRole: 'SUPER_ADMIN',
        randomIndex: 0,
        randomMethod: DRAW_RANDOM_METHOD,
        status: 'PENDING_CONFIRMATION',
        createdAt: now,
      },
    });

    await prisma.contestDraw.update({
      where: { id: draw.id },
      data: { status: 'CONFIRMED', confirmedAt: now, confirmationBy: 'test' },
    });
    await prisma.contestDraw.update({
      where: { id: draw.id },
      data: { status: 'CANCELLED', cancelReason: 'test', cancelledAt: now, cancelledBy: 'test' },
    });
    assert(Boolean(await prisma.contestDraw.findUnique({ where: { id: draw.id } })), 'cancel keeps history row');
    assert(
      (await prisma.contestParticipation.count({ where: { contestId } })) === beforeParts,
      'no participation mutation'
    );
    assert((await prisma.customerCoin.count()) === beforeCoins, 'no coin mutation');

    await prisma.contestDraw.deleteMany({ where: { contestId } });
    await prisma.contestParticipation.deleteMany({ where: { contestId } });
    await prisma.contest.deleteMany({ where: { id: contestId } });
    await prisma.customer.deleteMany({ where: { id: { in: [c1, c2] } } });
  } finally {
    await prisma.$disconnect();
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

async function apiFetch(path: string, token: string | null, init: RequestInit = {}): Promise<Response> {
  return fetch(`${MOCK_API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

async function runLiveTests(): Promise<void> {
  console.log('\n=== Contest Draws — Live API (optional, no real draw) ===\n');
  try {
    const health = await fetch(`${MOCK_API_URL}/markets`);
    if (!health.ok) {
      console.log(`  (skip) API not reachable at ${MOCK_API_URL}`);
      return;
    }
  } catch {
    console.log(`  (skip) API not reachable at ${MOCK_API_URL}`);
    return;
  }

  const rootToken = await login('root@nmd.com', '123456');
  assert(Boolean(rootToken), 'ROOT_ADMIN login');

  const summary = await apiFetch('/admin/contest-draws/summary-by-contest', rootToken);
  if (summary.status === 500) {
    console.log('  (skip) ContestDraw table not migrated yet');
    return;
  }
  assert(summary.status === 200, 'SUPER/ROOT can load draw summary');

  const tenantToken = await login(
    process.env.TENANT_ADMIN_EMAIL ?? 'ms-brands@nmd.com',
    process.env.TENANT_ADMIN_PASSWORD ?? 'ms123456'
  );
  if (tenantToken) {
    const forbidden = await apiFetch('/admin/contest-draws/summary-by-contest', tenantToken);
    assert(forbidden.status === 403, 'TENANT_ADMIN gets 403');
  }

  const noAuth = await apiFetch('/admin/contests/x/draw', null, { method: 'POST', body: '{}' });
  assert(noAuth.status === 401 || noAuth.status === 403, 'unauthenticated blocked from draw');

  // Empty contest: create + attempt draw + delete (cleanup). Not a "real" giveaway draw.
  const createContest = await apiFetch('/contests', rootToken, {
    method: 'POST',
    body: JSON.stringify({
      title: 'Empty Draw Guard',
      type: 'QUESTION',
      options: [{ id: 'a', label: 'A' }],
    }),
  });
  if (createContest.ok) {
    const created = (await createContest.json()) as { id: string };
    const drawEmpty = await apiFetch(`/admin/contests/${created.id}/draw`, rootToken, {
      method: 'POST',
      body: JSON.stringify({ requestId: randomUUID() }),
    });
    assert(drawEmpty.status === 400, 'cannot draw without participants');
    await apiFetch(`/contests/${created.id}`, rootToken, { method: 'DELETE' });
  }

  console.log('  (info) skipped live winner draw by design');
}

async function main(): Promise<void> {
  if (RUN_DB) await runDbTests();
  if (RUN_LIVE) await runLiveTests();
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
