/**
 * Contest giveaway draws — Super Admin only.
 * Source: ContestParticipation by contestId (deduped by customerId).
 * Winner: crypto.randomInt on the server. Never mutates coins, rewards, orders, or participations.
 */

import { createHash, randomInt, randomUUID } from 'node:crypto';
import type express from 'express';
import type { PrismaClient } from '@prisma/client';
import { isPlatformSuperAdmin } from '@nmd/core';

export const DRAW_ALGORITHM_VERSION = 'contest-draw-v1';
export const DRAW_RANDOM_METHOD = 'crypto.randomInt';

export type DrawStatus = 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'CANCELLED';

export type EligibleParticipant = {
  participationId: string;
  customerId: string;
  name: string;
  phone: string;
  joinedAt: string;
  duplicateCount: number;
  eligible: boolean;
};

type ParticipationRow = {
  id: string;
  customerId: string;
  contestId: string;
  createdAt: string;
};

type CustomerLite = { id: string; phone: string; name: string | null };

const contestDrawLocks = new Map<string, Promise<unknown>>();

export async function withContestDrawLock<T>(contestId: string, fn: () => Promise<T>): Promise<T> {
  const prev = contestDrawLocks.get(contestId) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  const held = prev.then(() => gate);
  contestDrawLocks.set(
    contestId,
    held.catch(() => undefined).then(() => undefined)
  );
  await prev.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
  }
}

export function maskPhone(phone: string | undefined | null): string {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length < 7) {
    const raw = String(phone ?? '').trim();
    if (raw.length < 4) return '***';
    return `${raw.slice(0, 2)}***${raw.slice(-2)}`;
  }
  const local = digits.startsWith('972') && digits.length >= 10 ? `0${digits.slice(3)}` : digits;
  if (local.length < 7) return `${local.slice(0, 2)}***${local.slice(-2)}`;
  return `${local.slice(0, 3)}***${local.slice(-4)}`;
}

export function hashEligibleParticipants(eligible: EligibleParticipant[]): string {
  return createHash('sha256')
    .update(eligible.map((p) => `${p.customerId}:${p.participationId}`).join('|'))
    .digest('hex');
}

/** One chance per customerId; keep earliest participation; stable sort for draw pool. */
export function buildEligiblePool(
  participations: ParticipationRow[],
  customersById: Record<string, CustomerLite | undefined>
): { rawCount: number; eligible: EligibleParticipant[]; display: EligibleParticipant[]; duplicateGroups: number } {
  const byCustomer = new Map<string, ParticipationRow[]>();
  for (const p of participations) {
    const list = byCustomer.get(p.customerId) ?? [];
    list.push(p);
    byCustomer.set(p.customerId, list);
  }

  let duplicateGroups = 0;
  const display: EligibleParticipant[] = [];

  for (const [customerId, rows] of byCustomer) {
    if (rows.length > 1) duplicateGroups += 1;
    rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    const primary = rows[0]!;
    const customer = customersById[customerId];
    const phone = customer?.phone?.trim() ?? '';
    const name = customer?.name?.trim() || 'مشارك';
    const eligible = Boolean(customer && phone);
    display.push({
      participationId: primary.id,
      customerId,
      name,
      phone,
      joinedAt: primary.createdAt,
      duplicateCount: rows.length,
      eligible,
    });
  }

  display.sort((a, b) => b.joinedAt.localeCompare(a.joinedAt));

  const eligible = [...display]
    .filter((p) => p.eligible)
    .sort((a, b) => a.customerId.localeCompare(b.customerId) || a.participationId.localeCompare(b.participationId));

  return { rawCount: participations.length, eligible, display, duplicateGroups };
}

export function pickSecureRandomIndex(length: number): { index: number; method: string } {
  if (length <= 0) throw new Error('EMPTY_POOL');
  return { index: randomInt(0, length), method: DRAW_RANDOM_METHOD };
}

export function drawToJson(d: {
  id: string;
  contestId: string;
  winnerCustomerId: string;
  winnerParticipationId: string;
  winnerNameSnapshot: string;
  winnerPhoneSnapshot: string;
  participantsCount: number;
  eligibleParticipantsCount: number;
  performedByUserId: string;
  performedByRole: string;
  randomIndex: number;
  randomMethod: string;
  status: string;
  createdAt: string;
  confirmedAt: string | null;
  confirmationBy: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  metadata: string | null;
  contest?: { id: string; title: string; bannerImageUrl: string | null } | null;
}) {
  let meta: Record<string, unknown> | null = null;
  if (d.metadata) {
    try {
      meta = JSON.parse(d.metadata) as Record<string, unknown>;
    } catch {
      meta = null;
    }
  }
  return {
    id: d.id,
    contestId: d.contestId,
    contestTitle: d.contest?.title,
    contestBannerImageUrl: d.contest?.bannerImageUrl ?? undefined,
    winnerCustomerId: d.winnerCustomerId,
    winnerParticipationId: d.winnerParticipationId,
    winnerName: d.winnerNameSnapshot,
    winnerPhone: d.winnerPhoneSnapshot,
    winnerPhoneMasked: maskPhone(d.winnerPhoneSnapshot),
    participantsCount: d.participantsCount,
    eligibleParticipantsCount: d.eligibleParticipantsCount,
    performedBy: d.performedByUserId,
    performedByUserId: d.performedByUserId,
    performedByRole: d.performedByRole,
    randomIndex: d.randomIndex,
    randomMethod: d.randomMethod,
    status: d.status as DrawStatus,
    createdAt: d.createdAt,
    confirmedAt: d.confirmedAt ?? undefined,
    confirmationBy: d.confirmationBy ?? undefined,
    cancellationReason: d.cancelReason ?? undefined,
    cancelReason: d.cancelReason ?? undefined,
    cancelledAt: d.cancelledAt ?? undefined,
    cancelledBy: d.cancelledBy ?? undefined,
    metadata: meta,
  };
}

function requireDrawAdmin(req: express.Request, res: express.Response): boolean {
  const user = req.user as { role?: string } | undefined;
  if (!user || !isPlatformSuperAdmin(user.role)) {
    res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
    return false;
  }
  return true;
}

function actor(req: express.Request): { userId: string; role: string } {
  const user = req.user as { id?: string; role?: string };
  return { userId: String(user?.id ?? ''), role: String(user?.role ?? '') };
}

export type ContestDrawDeps = {
  prisma: PrismaClient;
};

async function loadEligibleForContest(prisma: PrismaClient, contestId: string) {
  const contest = await prisma.contest.findUnique({ where: { id: contestId } });
  if (!contest) {
    const err = new Error('CONTEST_NOT_FOUND') as Error & { code: string };
    err.code = 'CONTEST_NOT_FOUND';
    throw err;
  }
  const list = await prisma.contestParticipation.findMany({
    where: { contestId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, customerId: true, contestId: true, createdAt: true },
  });
  const customerIds = [...new Set(list.map((p) => p.customerId))];
  const customers =
    customerIds.length > 0
      ? await prisma.customer.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, phone: true, name: true },
        })
      : [];
  const customersById = Object.fromEntries(customers.map((c) => [c.id, c]));
  const pool = buildEligiblePool(list, customersById);
  return { contest, ...pool };
}

async function performDraw(
  deps: ContestDrawDeps,
  contestId: string,
  performedBy: { userId: string; role: string },
  opts: { requestId?: string; allowRedraw?: boolean; redrawReason?: string }
) {
  const { prisma } = deps;
  return withContestDrawLock(contestId, async () => {
    if (!opts.allowRedraw) {
      const existingConfirmed = await prisma.contestDraw.findFirst({
        where: { contestId, status: 'CONFIRMED' },
      });
      if (existingConfirmed) {
        const err = new Error('DRAW_ALREADY_CONFIRMED') as Error & { code: string; drawId: string };
        err.code = 'DRAW_ALREADY_CONFIRMED';
        err.drawId = existingConfirmed.id;
        throw err;
      }
      const pending = await prisma.contestDraw.findFirst({
        where: { contestId, status: 'PENDING_CONFIRMATION' },
      });
      if (pending) {
        const err = new Error('DRAW_PENDING') as Error & { code: string; drawId: string };
        err.code = 'DRAW_PENDING';
        err.drawId = pending.id;
        throw err;
      }
    }

    const { contest, rawCount, eligible, duplicateGroups } = await loadEligibleForContest(prisma, contestId);
    if (eligible.length === 0) {
      const err = new Error('NO_ELIGIBLE_PARTICIPANTS') as Error & { code: string };
      err.code = 'NO_ELIGIBLE_PARTICIPANTS';
      throw err;
    }

    const requestId = opts.requestId?.trim() || randomUUID();
    if (opts.requestId) {
      const prior = await prisma.contestDraw.findFirst({
        where: { contestId, metadata: { contains: `"requestId":"${requestId}"` } },
      });
      if (prior) return { draw: prior, contest, idempotent: true as const };
    }

    const { index, method } = pickSecureRandomIndex(eligible.length);
    const winner = eligible[index]!;
    const now = new Date().toISOString();
    const participantsHash = hashEligibleParticipants(eligible);

    const draw = await prisma.$transaction(async (tx) => {
      if (opts.allowRedraw) {
        const open = await tx.contestDraw.findMany({
          where: { contestId, status: { in: ['PENDING_CONFIRMATION', 'CONFIRMED'] } },
        });
        for (const d of open) {
          await tx.contestDraw.update({
            where: { id: d.id },
            data: {
              status: 'CANCELLED',
              cancelReason: opts.redrawReason || 'redraw',
              cancelledAt: now,
              cancelledBy: performedBy.userId,
            },
          });
        }
      } else {
        const raceConfirmed = await tx.contestDraw.findFirst({
          where: { contestId, status: 'CONFIRMED' },
        });
        if (raceConfirmed) {
          const err = new Error('DRAW_ALREADY_CONFIRMED') as Error & { code: string; drawId: string };
          err.code = 'DRAW_ALREADY_CONFIRMED';
          err.drawId = raceConfirmed.id;
          throw err;
        }
        const racePending = await tx.contestDraw.findFirst({
          where: { contestId, status: 'PENDING_CONFIRMATION' },
        });
        if (racePending) {
          const err = new Error('DRAW_PENDING') as Error & { code: string; drawId: string };
          err.code = 'DRAW_PENDING';
          err.drawId = racePending.id;
          throw err;
        }
      }

      return tx.contestDraw.create({
        data: {
          id: `cdraw-${randomUUID()}`,
          contestId,
          winnerCustomerId: winner.customerId,
          winnerParticipationId: winner.participationId,
          winnerNameSnapshot: winner.name,
          winnerPhoneSnapshot: winner.phone,
          participantsCount: rawCount,
          eligibleParticipantsCount: eligible.length,
          performedByUserId: performedBy.userId,
          performedByRole: performedBy.role,
          randomIndex: index,
          randomMethod: method,
          status: 'PENDING_CONFIRMATION',
          createdAt: now,
          metadata: JSON.stringify({
            participantsHash,
            requestId,
            serverTimestamp: now,
            algorithmVersion: DRAW_ALGORITHM_VERSION,
            duplicateGroups,
            redraw: Boolean(opts.allowRedraw),
            redrawReason: opts.redrawReason || undefined,
          }),
        },
      });
    });

    return {
      draw,
      contest,
      idempotent: false as const,
      winner,
      eligibleNames: eligible.map((e) => e.name),
    };
  });
}

export function registerContestDrawRoutes(app: express.Express, deps: ContestDrawDeps): void {
  const { prisma } = deps;

  app.get('/admin/contests/:contestId/draw-participants', async (req, res, next) => {
    try {
      if (!requireDrawAdmin(req, res)) return;
      const contestId = String(req.params.contestId);
      const data = await loadEligibleForContest(prisma, contestId);
      res.json({
        contest: {
          id: data.contest.id,
          title: data.contest.title,
          bannerImageUrl: data.contest.bannerImageUrl ?? undefined,
        },
        rawParticipantsCount: data.rawCount,
        uniqueParticipantsCount: data.display.length,
        eligibleCount: data.eligible.length,
        duplicateGroups: data.duplicateGroups,
        participants: data.display.map((p) => ({
          participationId: p.participationId,
          customerId: p.customerId,
          name: p.name,
          phone: p.phone,
          phoneMasked: maskPhone(p.phone),
          joinedAt: p.joinedAt,
          duplicateCount: p.duplicateCount,
          eligible: p.eligible,
        })),
      });
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === 'CONTEST_NOT_FOUND' || err.message === 'CONTEST_NOT_FOUND') {
        return res.status(404).json({ error: 'Contest not found', code: 'CONTEST_NOT_FOUND' });
      }
      next(e);
    }
  });

  app.post('/admin/contests/:contestId/draw', async (req, res, next) => {
    try {
      if (!requireDrawAdmin(req, res)) return;
      const contestId = String(req.params.contestId);
      const body = (req.body ?? {}) as { requestId?: string; idempotencyKey?: string };
      const requestId =
        (typeof body.requestId === 'string' && body.requestId) ||
        (typeof body.idempotencyKey === 'string' && body.idempotencyKey) ||
        (typeof req.headers['idempotency-key'] === 'string' ? req.headers['idempotency-key'] : undefined);

      const result = await performDraw(deps, contestId, actor(req), { requestId });
      res.status(result.idempotent ? 200 : 201).json({
        ...drawToJson({ ...result.draw, contest: result.contest }),
        idempotent: result.idempotent,
        eligibleNames: 'eligibleNames' in result ? result.eligibleNames : undefined,
      });
    } catch (e) {
      const err = e as Error & { code?: string; drawId?: string };
      if (err.code === 'CONTEST_NOT_FOUND') {
        return res.status(404).json({ error: 'Contest not found', code: 'CONTEST_NOT_FOUND' });
      }
      if (err.code === 'NO_ELIGIBLE_PARTICIPANTS') {
        return res.status(400).json({ error: 'No eligible participants', code: 'NO_ELIGIBLE_PARTICIPANTS' });
      }
      if (err.code === 'DRAW_ALREADY_CONFIRMED') {
        return res.status(409).json({
          error: 'A confirmed draw already exists',
          code: 'DRAW_ALREADY_CONFIRMED',
          drawId: err.drawId,
        });
      }
      if (err.code === 'DRAW_PENDING') {
        return res.status(409).json({
          error: 'A draw is pending confirmation',
          code: 'DRAW_PENDING',
          drawId: err.drawId,
        });
      }
      next(e);
    }
  });

  app.post('/admin/contests/:contestId/redraw', async (req, res, next) => {
    try {
      if (!requireDrawAdmin(req, res)) return;
      const contestId = String(req.params.contestId);
      const body = (req.body ?? {}) as { reason?: string; requestId?: string };
      const reason = String(body.reason ?? '').trim();
      if (reason.length < 3) {
        return res.status(400).json({ error: 'reason required', code: 'REASON_REQUIRED' });
      }
      const result = await performDraw(deps, contestId, actor(req), {
        requestId: body.requestId,
        allowRedraw: true,
        redrawReason: reason,
      });
      res.status(201).json({
        ...drawToJson({ ...result.draw, contest: result.contest }),
        eligibleNames: 'eligibleNames' in result ? result.eligibleNames : undefined,
      });
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === 'NO_ELIGIBLE_PARTICIPANTS') {
        return res.status(400).json({ error: 'No eligible participants', code: 'NO_ELIGIBLE_PARTICIPANTS' });
      }
      if (err.code === 'CONTEST_NOT_FOUND') {
        return res.status(404).json({ error: 'Contest not found', code: 'CONTEST_NOT_FOUND' });
      }
      next(e);
    }
  });

  app.post('/admin/contest-draws/:drawId/confirm', async (req, res, next) => {
    try {
      if (!requireDrawAdmin(req, res)) return;
      const drawId = String(req.params.drawId);
      const { userId } = actor(req);
      const draw = await prisma.contestDraw.findUnique({
        where: { id: drawId },
        include: { contest: { select: { id: true, title: true, bannerImageUrl: true } } },
      });
      if (!draw) return res.status(404).json({ error: 'Draw not found', code: 'DRAW_NOT_FOUND' });
      if (draw.status === 'CONFIRMED') {
        return res.json({ ...drawToJson(draw), alreadyConfirmed: true });
      }
      if (draw.status === 'CANCELLED') {
        return res.status(409).json({ error: 'Draw was cancelled', code: 'DRAW_CANCELLED' });
      }

      const otherConfirmed = await prisma.contestDraw.findFirst({
        where: { contestId: draw.contestId, status: 'CONFIRMED', NOT: { id: drawId } },
      });
      if (otherConfirmed) {
        return res.status(409).json({
          error: 'Another draw is already confirmed for this contest',
          code: 'DRAW_ALREADY_CONFIRMED',
          drawId: otherConfirmed.id,
        });
      }

      const now = new Date().toISOString();
      const updated = await prisma.contestDraw.update({
        where: { id: drawId },
        data: {
          status: 'CONFIRMED',
          confirmedAt: now,
          confirmationBy: userId,
        },
        include: { contest: { select: { id: true, title: true, bannerImageUrl: true } } },
      });
      res.json(drawToJson(updated));
    } catch (e) {
      next(e);
    }
  });

  app.post('/admin/contest-draws/:drawId/cancel', async (req, res, next) => {
    try {
      if (!requireDrawAdmin(req, res)) return;
      const drawId = String(req.params.drawId);
      const body = (req.body ?? {}) as { reason?: string };
      const reason = String(body.reason ?? '').trim();
      if (reason.length < 3) {
        return res.status(400).json({ error: 'reason required', code: 'REASON_REQUIRED' });
      }
      const draw = await prisma.contestDraw.findUnique({
        where: { id: drawId },
        include: { contest: { select: { id: true, title: true, bannerImageUrl: true } } },
      });
      if (!draw) return res.status(404).json({ error: 'Draw not found', code: 'DRAW_NOT_FOUND' });
      if (draw.status === 'CANCELLED') {
        return res.json({ ...drawToJson(draw), alreadyCancelled: true });
      }
      const now = new Date().toISOString();
      const updated = await prisma.contestDraw.update({
        where: { id: drawId },
        data: {
          status: 'CANCELLED',
          cancelReason: reason,
          cancelledAt: now,
          cancelledBy: actor(req).userId,
        },
        include: { contest: { select: { id: true, title: true, bannerImageUrl: true } } },
      });
      res.json(drawToJson(updated));
    } catch (e) {
      next(e);
    }
  });

  app.get('/admin/contest-draws', async (req, res, next) => {
    try {
      if (!requireDrawAdmin(req, res)) return;
      const contestId = typeof req.query.contestId === 'string' ? req.query.contestId.trim() : '';
      const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
      const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

      const rows = await prisma.contestDraw.findMany({
        where: {
          ...(contestId ? { contestId } : {}),
          ...(status ? { status } : {}),
        },
        include: { contest: { select: { id: true, title: true, bannerImageUrl: true } } },
        orderBy: { createdAt: 'desc' },
        take: 500,
      });

      let mapped = rows.map((d) => drawToJson(d));
      if (q) {
        mapped = mapped.filter(
          (d) =>
            d.winnerName.toLowerCase().includes(q) ||
            d.winnerPhone.includes(q) ||
            (d.contestTitle ?? '').toLowerCase().includes(q)
        );
      }
      res.json({ draws: mapped });
    } catch (e) {
      next(e);
    }
  });

  /** Latest draw summary per contest (for Contests page actions). */
  app.get('/admin/contest-draws/summary-by-contest', async (req, res, next) => {
    try {
      if (!requireDrawAdmin(req, res)) return;
      const draws = await prisma.contestDraw.findMany({ orderBy: { createdAt: 'desc' } });
      const byContest: Record<
        string,
        { hasConfirmedDraw: boolean; latest: ReturnType<typeof drawToJson> | null }
      > = {};
      for (const d of draws) {
        if (!byContest[d.contestId]) {
          byContest[d.contestId] = {
            hasConfirmedDraw: false,
            latest: drawToJson(d),
          };
        }
        if (d.status === 'CONFIRMED') byContest[d.contestId]!.hasConfirmedDraw = true;
      }
      res.json({ byContest });
    } catch (e) {
      next(e);
    }
  });

  app.get('/admin/contest-draws/:drawId', async (req, res, next) => {
    try {
      if (!requireDrawAdmin(req, res)) return;
      const draw = await prisma.contestDraw.findUnique({
        where: { id: String(req.params.drawId) },
        include: { contest: { select: { id: true, title: true, bannerImageUrl: true } } },
      });
      if (!draw) return res.status(404).json({ error: 'Draw not found', code: 'DRAW_NOT_FOUND' });
      res.json(drawToJson(draw));
    } catch (e) {
      next(e);
    }
  });
}
