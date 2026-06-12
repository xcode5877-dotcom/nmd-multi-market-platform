/**
 * Driver Payroll Phase 2 — settlements, outstanding balance, driver statements.
 */

import { prisma } from './db.js';
import {
  appendPayrollAudit,
  computeEarningsSummary,
  getOrCreatePayrollConfig,
  parseDateRange,
  type EarningsSummary,
} from './courier-payroll.js';

export type SettlementSnapshot = {
  hoursWorked: number;
  hourlyPay: number;
  hourlyRate: number;
  deliveryEarnings: number;
  commissionEarnings: number;
  bonuses: number;
  ordersCount: number;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

const ALL_TIME_FROM = '2000-01-01';

export function summaryToSettlementAmounts(summary: EarningsSummary, hourlyRate: number): {
  grossAmount: number;
  expensesAmount: number;
  netAmount: number;
  snapshot: SettlementSnapshot;
} {
  const grossAmount = roundMoney(
    summary.hourlyPay + summary.deliveryEarnings + summary.commissionEarnings + summary.bonuses
  );
  const expensesAmount = roundMoney(summary.expenses);
  const netAmount = roundMoney(summary.netEarnings);
  return {
    grossAmount,
    expensesAmount,
    netAmount,
    snapshot: {
      hoursWorked: summary.hoursWorked,
      hourlyPay: summary.hourlyPay,
      hourlyRate,
      deliveryEarnings: summary.deliveryEarnings,
      commissionEarnings: summary.commissionEarnings,
      bonuses: summary.bonuses,
      ordersCount: summary.ordersCount,
    },
  };
}

export async function getTotalSettledAmount(courierId: string): Promise<number> {
  const rows = await prisma.courierPayrollSettlement.findMany({
    where: { courierId },
    select: { netAmount: true },
  });
  return roundMoney(rows.reduce((s, r) => s + r.netAmount, 0));
}

/** Lifetime earnings net minus all settlement payouts. */
export async function computeOutstandingBalance(courierId: string): Promise<number> {
  const summary = await computeEarningsSummary(courierId, ALL_TIME_FROM, todayStr());
  const settled = await getTotalSettledAmount(courierId);
  return roundMoney(summary.netEarnings - settled);
}

export async function findOverlappingSettlement(
  courierId: string,
  periodStart: string,
  periodEnd: string,
  excludeId?: string
): Promise<boolean> {
  const rows = await prisma.courierPayrollSettlement.findMany({
    where: {
      courierId,
      periodStart: { lte: periodEnd },
      periodEnd: { gte: periodStart },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    take: 1,
  });
  return rows.length > 0;
}

export async function previewPayrollSettlement(
  courierId: string,
  periodStart: string,
  periodEnd: string
): Promise<EarningsSummary & { grossAmount: number; expensesAmount: number; netAmount: number; hourlyRate: number }> {
  const [summary, config] = await Promise.all([
    computeEarningsSummary(courierId, periodStart, periodEnd),
    getOrCreatePayrollConfig(courierId),
  ]);
  const amounts = summaryToSettlementAmounts(summary, config.hourlyRate);
  return {
    ...summary,
    ...amounts,
    hourlyRate: config.hourlyRate,
  };
}

export async function createPayrollSettlement(input: {
  courierId: string;
  marketId?: string;
  periodStart: string;
  periodEnd: string;
  notes?: string;
  createdBy?: string;
}) {
  const { courierId, periodStart, periodEnd } = input;
  if (periodStart > periodEnd) {
    throw new Error('periodStart must be before periodEnd');
  }

  const overlap = await findOverlappingSettlement(courierId, periodStart, periodEnd);
  if (overlap) {
    const err = new Error('Settlement period overlaps an existing settlement') as Error & { code?: string };
    err.code = 'SETTLEMENT_OVERLAP';
    throw err;
  }

  const preview = await previewPayrollSettlement(courierId, periodStart, periodEnd);
  if (preview.netAmount <= 0 && preview.grossAmount <= 0) {
    const err = new Error('No earnings to settle for this period') as Error & { code?: string };
    err.code = 'NOTHING_TO_SETTLE';
    throw err;
  }

  const id = newId('cps');
  const now = nowIso();
  const row = await prisma.courierPayrollSettlement.create({
    data: {
      id,
      courierId,
      marketId: input.marketId ?? null,
      periodStart,
      periodEnd,
      grossAmount: preview.grossAmount,
      expensesAmount: preview.expensesAmount,
      netAmount: preview.netAmount,
      notes: input.notes?.trim() || null,
      snapshot: JSON.stringify(preview.snapshot),
      createdBy: input.createdBy ?? null,
      createdAt: now,
    },
  });

  await appendPayrollAudit({
    courierId,
    userId: input.createdBy,
    action: 'SETTLEMENT_CREATED',
    metadata: { settlementId: id, periodStart, periodEnd, netAmount: preview.netAmount },
  });

  const outstandingBalance = await computeOutstandingBalance(courierId);
  return { settlement: row, outstandingBalance };
}

export async function listPayrollSettlements(filters: {
  courierId?: string;
  marketId?: string;
  from?: string;
  to?: string;
  limit?: number;
}) {
  const where: {
    courierId?: string;
    marketId?: string;
    createdAt?: { gte?: string; lte?: string };
  } = {};
  if (filters.courierId) where.courierId = filters.courierId;
  if (filters.marketId) where.marketId = filters.marketId;
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = filters.from;
    if (filters.to) where.createdAt.lte = `${filters.to}T23:59:59.999Z`;
  }

  return prisma.courierPayrollSettlement.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: filters.limit ?? 500,
  });
}

export async function getPayrollSettlementById(id: string) {
  return prisma.courierPayrollSettlement.findUnique({ where: { id } });
}

export async function getDriverPayrollStatement(courierId: string) {
  const [config, outstandingBalance, shifts, ledger, expenses, settlements, bonuses] = await Promise.all([
    getOrCreatePayrollConfig(courierId),
    computeOutstandingBalance(courierId),
    prisma.courierShift.findMany({ where: { courierId }, orderBy: { startTime: 'desc' }, take: 200 }),
    prisma.courierEarningsLedger.findMany({
      where: {
        courierId,
        type: { in: ['DELIVERY_FEE', 'ORDER_COMMISSION', 'BONUS', 'ADJUSTMENT'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    prisma.courierExpense.findMany({ where: { courierId }, orderBy: { createdAt: 'desc' }, take: 200 }),
    prisma.courierPayrollSettlement.findMany({ where: { courierId }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.courierEarningsLedger.findMany({
      where: { courierId, type: 'BONUS' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  const totalSettled = await getTotalSettledAmount(courierId);

  return {
    config: {
      hourlyRate: config.hourlyRate,
      deliveryFeeShare: config.deliveryFeeShare,
      orderCommissionPercent: config.orderCommissionPercent,
      isPayrollEnabled: config.isPayrollEnabled,
    },
    outstandingBalance,
    totalSettled,
    shifts: shifts.map((s) => ({
      id: s.id,
      date: s.startTime.slice(0, 10),
      startTime: s.startTime,
      endTime: s.endTime,
      hours: s.durationMinutes != null ? roundMoney(s.durationMinutes / 60) : null,
      autoClosed: s.autoClosed,
    })),
    earnings: ledger.map((e) => ({
      id: e.id,
      date: e.createdAt,
      type: e.type,
      amount: e.amount,
      referenceId: e.referenceId,
      description: e.description,
    })),
    expenses: expenses.map((e) => ({
      id: e.id,
      date: e.createdAt,
      category: e.category,
      amount: e.amount,
      status: e.status,
      note: e.note,
    })),
    bonuses: bonuses.map((b) => ({
      id: b.id,
      date: b.createdAt,
      amount: b.amount,
      description: b.description,
    })),
    settlements: settlements.map((s) => ({
      id: s.id,
      date: s.createdAt,
      periodStart: s.periodStart,
      periodEnd: s.periodEnd,
      grossAmount: s.grossAmount,
      expensesAmount: s.expensesAmount,
      netAmount: s.netAmount,
      notes: s.notes,
    })),
  };
}

export async function computePayrollHistoryTotals(filters: {
  courierId?: string;
  marketId?: string;
  from?: string;
  to?: string;
}) {
  const settlements = await listPayrollSettlements(filters);
  const totalPaid = roundMoney(settlements.reduce((s, r) => s + r.netAmount, 0));

  let outstandingBalance = 0;
  if (filters.courierId) {
    outstandingBalance = await computeOutstandingBalance(filters.courierId);
  } else {
    const couriers = await prisma.courier.findMany({
      where: filters.marketId ? { marketId: filters.marketId } : undefined,
      select: { id: true },
    });
    const balances = await Promise.all(couriers.map((c) => computeOutstandingBalance(c.id)));
    outstandingBalance = roundMoney(balances.reduce((a, b) => a + b, 0));
  }

  return { totalPaid, outstandingBalance, count: settlements.length };
}

export type PlatformPayrollSummary = {
  today: { netTotal: number };
  week: { netTotal: number };
  month: { netTotal: number };
  outstandingBalance: number;
  totalPaid: number;
};

export async function computePlatformPayrollSummary(
  courierIds: string[]
): Promise<PlatformPayrollSummary> {
  const today = parseDateRange('today');
  const week = parseDateRange('week');
  const month = parseDateRange('month');

  let todayNet = 0;
  let weekNet = 0;
  let monthNet = 0;
  let outstanding = 0;
  let totalPaid = 0;

  await Promise.all(
    courierIds.map(async (id) => {
      const [t, w, m, o, settled] = await Promise.all([
        computeEarningsSummary(id, today.from, today.to),
        computeEarningsSummary(id, week.from, week.to),
        computeEarningsSummary(id, month.from, month.to),
        computeOutstandingBalance(id),
        getTotalSettledAmount(id),
      ]);
      todayNet += t.netEarnings;
      weekNet += w.netEarnings;
      monthNet += m.netEarnings;
      outstanding += o;
      totalPaid += settled;
    })
  );

  return {
    today: { netTotal: roundMoney(todayNet) },
    week: { netTotal: roundMoney(weekNet) },
    month: { netTotal: roundMoney(monthNet) },
    outstandingBalance: roundMoney(outstanding),
    totalPaid: roundMoney(totalPaid),
  };
}
