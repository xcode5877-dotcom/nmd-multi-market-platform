import type { PrismaClient } from '@prisma/client';

export type ContestDeleteOutcome = 'deleted' | 'archived';

export type ContestArchiveReason = 'draws' | 'participants' | 'results';

export class ContestNotFoundError extends Error {
  constructor() {
    super('Contest not found');
    this.name = 'ContestNotFoundError';
  }
}

export class ContestClosedError extends Error {
  readonly code = 'CONTEST_INACTIVE' as const;

  constructor(message = 'Contest not found or inactive') {
    super(message);
    this.name = 'ContestClosedError';
  }
}

type ContestRow = {
  id: string;
  isActive: boolean;
  correctAnswer: string | null;
  finalScoreA: number | null;
  finalScoreB: number | null;
};

/** Reject new customer participation or promotional draws on archived contests. */
export function assertContestOpenForMutation(
  contest: { isActive: boolean } | null | undefined,
): asserts contest is { isActive: true } {
  if (!contest?.isActive) {
    throw new ContestClosedError();
  }
}

export function contestHasHistoricalDependencies(
  contest: Pick<ContestRow, 'correctAnswer' | 'finalScoreA' | 'finalScoreB'>,
  counts: { draws: number; participations: number },
): { hasHistory: boolean; reason?: ContestArchiveReason } {
  if (counts.draws > 0) return { hasHistory: true, reason: 'draws' };
  if (counts.participations > 0) return { hasHistory: true, reason: 'participants' };
  const hasResults =
    (contest.correctAnswer != null && contest.correctAnswer.trim() !== '') ||
    (contest.finalScoreA != null && contest.finalScoreB != null);
  if (hasResults) return { hasHistory: true, reason: 'results' };
  return { hasHistory: false };
}

/**
 * Archives contests with any historical dependency; hard-deletes only empty drafts.
 * Row lock prevents concurrent participation/draw from racing a delete into a partial state.
 */
export async function deleteOrArchiveContest(
  prisma: PrismaClient,
  contestId: string,
): Promise<{ outcome: ContestDeleteOutcome; reason?: ContestArchiveReason }> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Contest" WHERE id = ${contestId} FOR UPDATE`;

    const existing = await tx.contest.findUnique({ where: { id: contestId } });
    if (!existing) throw new ContestNotFoundError();

    const [drawCount, participationCount] = await Promise.all([
      tx.contestDraw.count({ where: { contestId } }),
      tx.contestParticipation.count({ where: { contestId } }),
    ]);

    const { hasHistory, reason } = contestHasHistoricalDependencies(existing, {
      draws: drawCount,
      participations: participationCount,
    });

    if (hasHistory) {
      await tx.contest.update({
        where: { id: contestId },
        data: { isActive: false },
      });
      return { outcome: 'archived' as const, reason };
    }

    await tx.contest.delete({ where: { id: contestId } });
    return { outcome: 'deleted' as const };
  });
}

export function contestDeleteUserMessage(
  outcome: ContestDeleteOutcome,
  reason?: ContestArchiveReason,
): string {
  if (outcome === 'deleted') {
    return 'تم حذف المسابقة';
  }
  switch (reason) {
    case 'draws':
      return 'تم أرشفة المسابقة لوجود سجل سحوبات. السجل محفوظ ولا يمكن الحذف النهائي.';
    case 'participants':
      return 'تم أرشفة المسابقة لوجود مشاركات. السجل محفوظ ولا يمكن الحذف النهائي.';
    case 'results':
      return 'تم أرشفة المسابقة لوجود نتائج مسجّلة. السجل محفوظ ولا يمكن الحذف النهائي.';
    default:
      return 'تم أرشفة المسابقة. السجل محفوظ ولا يمكن الحذف النهائي.';
  }
}
