#!/usr/bin/env npx tsx
/**
 * Contest delete/archive lifecycle verification.
 * Run: pnpm --filter mock-api verify:contest-delete
 */

import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { canAccessRoute, isPlatformSuperAdmin } from '@nmd/core';
import {
  ContestNotFoundError,
  deleteOrArchiveContest,
} from '../src/contest-lifecycle.js';

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

console.log('\n=== Contest Delete — Permissions ===\n');
for (const role of ['ROOT_ADMIN', 'SUPER_ADMIN'] as const) {
  assert(isPlatformSuperAdmin(role), `${role} is platform super admin`);
  assert(canAccessRoute(role, '/contests'), `${role} can access /contests`);
}
for (const role of ['TENANT_ADMIN', 'CUSTOMER'] as const) {
  assert(!isPlatformSuperAdmin(role), `${role} denied platform admin`);
}

async function main(): Promise<void> {
  if (!RUN_DB) {
    console.log('\n(skip) DB tests — SKIP_DB=1\n');
    process.exit(failed > 0 ? 1 : 0);
  }

  const prisma = new PrismaClient();
  const tag = `verify-del-${randomUUID().slice(0, 8)}`;
  const draftId = `${tag}-draft`;
  const archivedId = `${tag}-archived`;
  const now = new Date().toISOString();

  const cleanup = async () => {
    await prisma.contestDraw.deleteMany({ where: { contestId: archivedId } }).catch(() => undefined);
    await prisma.contestParticipation.deleteMany({
      where: { contestId: { in: [draftId, archivedId] } },
    }).catch(() => undefined);
    await prisma.contest.deleteMany({ where: { id: { in: [draftId, archivedId] } } }).catch(() => undefined);
  };

  try {
  await cleanup();

  console.log('\n=== Contest Delete — DB lifecycle ===\n');

  await prisma.contest.create({
    data: {
      id: draftId,
      title: 'Draft contest',
      type: 'QUESTION',
      isActive: true,
      createdAt: now,
    },
  });

  const draftResult = await deleteOrArchiveContest(prisma, draftId);
  assert(draftResult.outcome === 'deleted', 'draft contest without draws is hard-deleted');
  const draftGone = await prisma.contest.findUnique({ where: { id: draftId } });
  assert(draftGone == null, 'draft contest row removed');

  await prisma.contest.create({
    data: {
      id: archivedId,
      title: 'Contest with draw history',
      type: 'QUESTION',
      isActive: true,
      createdAt: now,
    },
  });

  await prisma.contestDraw.create({
    data: {
      id: `${tag}-draw`,
      contestId: archivedId,
      winnerCustomerId: 'cust-verify',
      winnerParticipationId: 'part-verify',
      winnerNameSnapshot: 'Test',
      winnerPhoneSnapshot: '050***0000',
      participantsCount: 1,
      eligibleParticipantsCount: 1,
      performedByUserId: 'admin-verify',
      performedByRole: 'SUPER_ADMIN',
      randomIndex: 0,
      randomMethod: 'crypto.randomInt',
      status: 'CONFIRMED',
      createdAt: now,
    },
  });

  const archiveResult = await deleteOrArchiveContest(prisma, archivedId);
  assert(archiveResult.outcome === 'archived', 'contest with draws is archived not deleted');
  const archivedRow = await prisma.contest.findUnique({ where: { id: archivedId } });
  assert(archivedRow != null && archivedRow.isActive === false, 'archived contest remains with isActive=false');
  const drawStill = await prisma.contestDraw.count({ where: { contestId: archivedId } });
  assert(drawStill === 1, 'draw audit row preserved');

  const activeList = await prisma.contest.findFirst({
    where: { id: archivedId, isActive: true },
  });
  assert(activeList == null, 'archived contest excluded from active customer query');

  let notFound = false;
  try {
    await deleteOrArchiveContest(prisma, `${tag}-missing`);
  } catch (e) {
    notFound = e instanceof ContestNotFoundError;
  }
  assert(notFound, 'missing contest throws ContestNotFoundError');

  } finally {
    await cleanup();
    await prisma.$disconnect();
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
