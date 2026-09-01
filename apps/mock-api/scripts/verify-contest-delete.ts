#!/usr/bin/env npx tsx
/**
 * Contest delete/archive lifecycle verification.
 * Run: pnpm --filter mock-api verify:contest-delete
 */

import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { canAccessRoute, isPlatformSuperAdmin } from '@nmd/core';
import {
  ContestClosedError,
  ContestNotFoundError,
  assertContestOpenForMutation,
  contestHasHistoricalDependencies,
  deleteOrArchiveContest,
} from '../src/contest-lifecycle.js';
import { performDraw } from '../src/contest-draws.js';

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

console.log('\n=== Contest Delete — dependency rules (unit) ===\n');
{
  const empty = contestHasHistoricalDependencies(
    { correctAnswer: null, finalScoreA: null, finalScoreB: null },
    { draws: 0, participations: 0 },
  );
  assert(!empty.hasHistory, 'empty contest has no historical dependencies');

  const withParts = contestHasHistoricalDependencies(
    { correctAnswer: null, finalScoreA: null, finalScoreB: null },
    { draws: 0, participations: 3 },
  );
  assert(withParts.hasHistory && withParts.reason === 'participants', 'participants imply history');

  const withResults = contestHasHistoricalDependencies(
    { correctAnswer: 'opt-a', finalScoreA: null, finalScoreB: null },
    { draws: 0, participations: 0 },
  );
  assert(withResults.hasHistory && withResults.reason === 'results', 'entered results imply history');
}

async function main(): Promise<void> {
  if (!RUN_DB) {
    console.log('\n(skip) DB tests — SKIP_DB=1\n');
    process.exit(failed > 0 ? 1 : 0);
  }

  const prisma = new PrismaClient();
  const tag = `verify-del-${randomUUID().slice(0, 8)}`;
  const draftId = `${tag}-draft`;
  const participantsId = `${tag}-parts`;
  const archivedId = `${tag}-archived`;
  const customerId = `${tag}-cust`;
  const now = new Date().toISOString();

  const cleanup = async () => {
    await prisma.contestDraw.deleteMany({
      where: { contestId: { in: [archivedId, participantsId] } },
    }).catch(() => undefined);
    await prisma.contestParticipation.deleteMany({
      where: { contestId: { in: [draftId, archivedId, participantsId] } },
    }).catch(() => undefined);
    await prisma.contest.deleteMany({
      where: { id: { in: [draftId, archivedId, participantsId] } },
    }).catch(() => undefined);
    await prisma.customer.deleteMany({ where: { id: customerId } }).catch(() => undefined);
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
    assert(draftResult.outcome === 'deleted', 'empty draft is hard-deleted');
    assert((await prisma.contest.findUnique({ where: { id: draftId } })) == null, 'draft row removed');

    await prisma.contest.create({
      data: {
        id: participantsId,
        title: 'Contest with participants only',
        type: 'QUESTION',
        isActive: true,
        createdAt: now,
      },
    });
    await prisma.customer.create({
      data: { id: customerId, phone: '0546111999', name: 'Verify User', createdAt: now },
    });
    await prisma.contestParticipation.create({
      data: {
        id: `${tag}-cp`,
        contestId: participantsId,
        customerId,
        userAnswer: 'a',
        createdAt: now,
      },
    });

    const partResult = await deleteOrArchiveContest(prisma, participantsId);
    assert(partResult.outcome === 'archived' && partResult.reason === 'participants', 'participants-only contest archived');
    const partRow = await prisma.contest.findUnique({ where: { id: participantsId } });
    assert(partRow != null && partRow.isActive === false, 'participants contest archived not deleted');
    const partCount = await prisma.contestParticipation.count({ where: { contestId: participantsId } });
    assert(partCount === 1, 'participation rows survive archive');

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
        winnerCustomerId: customerId,
        winnerParticipationId: `${tag}-cp2`,
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
    assert(archiveResult.outcome === 'archived' && archiveResult.reason === 'draws', 'draw contest archived');
    assert((await prisma.contestDraw.count({ where: { contestId: archivedId } })) === 1, 'draw audit preserved');

    console.log('\n=== Contest Archive — mutation guards ===\n');

    let closed = false;
    try {
      assertContestOpenForMutation(partRow);
    } catch (e) {
      closed = e instanceof ContestClosedError;
    }
    assert(closed, 'archived contest rejected for new customer/draw mutations');

    let drawBlocked = false;
    try {
      await performDraw({ prisma }, participantsId, { userId: 'admin', role: 'SUPER_ADMIN' }, {});
    } catch (e) {
      drawBlocked = (e as { code?: string }).code === 'CONTEST_INACTIVE';
    }
    assert(drawBlocked, 'new draw blocked on archived contest');

    const activeList = await prisma.contest.findFirst({
      where: { id: participantsId, isActive: true },
    });
    assert(activeList == null, 'archived contest excluded from active customer query');

    const adminParticipants = await prisma.contestParticipation.count({
      where: { contestId: participantsId },
    });
    assert(adminParticipants === 1, 'authorized historical participation access preserved');

    let notFound = false;
    try {
      await deleteOrArchiveContest(prisma, `${tag}-missing`);
    } catch (e) {
      notFound = e instanceof ContestNotFoundError;
    }
    assert(notFound, 'missing contest throws ContestNotFoundError');

    console.log('\n=== Contest Delete — archive vs late participation race ===\n');

    const raceId = `${tag}-race`;
    const raceCust = `${tag}-race-cust`;
    await prisma.contest.create({
      data: { id: raceId, title: 'Race', type: 'QUESTION', isActive: true, createdAt: now },
    });
    await prisma.customer.create({
      data: { id: raceCust, phone: '0546222333', name: 'Race', createdAt: now },
    });
    await prisma.contestParticipation.create({
      data: {
        id: `${tag}-race-cp`,
        contestId: raceId,
        customerId: raceCust,
        userAnswer: 'x',
        createdAt: now,
      },
    });

    await deleteOrArchiveContest(prisma, raceId);
    const raceRow = await prisma.contest.findUnique({ where: { id: raceId } });
    assert(raceRow != null && !raceRow.isActive, 'race contest archived under lock');
    assert(
      (await prisma.contestParticipation.count({ where: { contestId: raceId } })) === 1,
      'race archive does not delete participations',
    );

    await prisma.contestParticipation.deleteMany({ where: { contestId: raceId } });
    await prisma.contest.deleteMany({ where: { id: raceId } });
    await prisma.customer.deleteMany({ where: { id: raceCust } });
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
