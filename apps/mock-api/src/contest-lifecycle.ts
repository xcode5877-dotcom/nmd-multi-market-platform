import type { PrismaClient } from '@prisma/client';

export type ContestDeleteOutcome = 'deleted' | 'archived';

export class ContestNotFoundError extends Error {
  constructor() {
    super('Contest not found');
    this.name = 'ContestNotFoundError';
  }
}

/**
 * Deletes disposable contests or archives contests linked to draw audit history.
 * ContestDraw rows are permanent (onDelete: Restrict); participations cascade on hard delete.
 */
export async function deleteOrArchiveContest(
  prisma: PrismaClient,
  contestId: string,
): Promise<{ outcome: ContestDeleteOutcome }> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.contest.findUnique({ where: { id: contestId } });
    if (!existing) throw new ContestNotFoundError();

    const drawCount = await tx.contestDraw.count({ where: { contestId } });
    if (drawCount > 0) {
      await tx.contest.update({
        where: { id: contestId },
        data: { isActive: false },
      });
      return { outcome: 'archived' as const };
    }

    await tx.contest.delete({ where: { id: contestId } });
    return { outcome: 'deleted' as const };
  });
}

export function contestDeleteUserMessage(outcome: ContestDeleteOutcome): string {
  if (outcome === 'archived') {
    return 'تم أرشفة المسابقة لوجود سجل سحوبات مرتبط. السجل محفوظ ولا يمكن الحذف النهائي.';
  }
  return 'تم حذف المسابقة';
}
