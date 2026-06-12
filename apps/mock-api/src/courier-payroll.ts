/**
 * Driver Payroll Phase 1 / 1.5 — tracking only (no payouts).
 * Append-only ledger, shift tracking, expense approval workflow.
 */

import { Prisma } from '@prisma/client';
import { prisma } from './db.js';
import { computeOrderSettlementEconomics } from './settlement.js';

export const LEDGER_TYPES = [
  'DELIVERY_FEE',
  'ORDER_COMMISSION',
  'HOURLY_PAY',
  'BONUS',
  'EXPENSE',
  'ADJUSTMENT',
] as const;

export type LedgerType = (typeof LEDGER_TYPES)[number];

/** Ledger types that must be unique per courierId + referenceId (orderId). */
const ORDER_LEDGER_TYPES: LedgerType[] = ['DELIVERY_FEE', 'ORDER_COMMISSION'];

export const EXPENSE_CATEGORIES = ['FUEL', 'REPAIR', 'CAR_WASH', 'PARKING', 'OTHER'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const PAYROLL_AUDIT_ACTIONS = [
  'SHIFT_STARTED',
  'SHIFT_ENDED',
  'SHIFT_AUTO_CLOSED',
  'BONUS_ADDED',
  'EXPENSE_APPROVED',
  'EXPENSE_REJECTED',
  'SETTLEMENT_CREATED',
] as const;

export type PayrollAuditAction = (typeof PAYROLL_AUDIT_ACTIONS)[number];

export const MAX_SHIFT_HOURS = 16;
export const MAX_SHIFT_MINUTES = MAX_SHIFT_HOURS * 60;
export const SHIFT_AUTO_CLOSE_WARNING = 'تم إغلاق الدوام تلقائياً بعد 16 ساعة';

const ALL_TIME_FROM = '2000-01-01';

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

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export async function appendPayrollAudit(input: {
  courierId?: string;
  userId?: string;
  action: PayrollAuditAction;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.driverPayrollAudit.create({
    data: {
      id: newId('dpa'),
      courierId: input.courierId ?? null,
      userId: input.userId ?? null,
      action: input.action,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      createdAt: nowIso(),
    },
  });
}

export async function getOrCreatePayrollConfig(courierId: string) {
  const existing = await prisma.courierPayrollConfig.findUnique({ where: { courierId } });
  if (existing) return existing;
  const now = nowIso();
  return prisma.courierPayrollConfig.create({
    data: {
      courierId,
      hourlyRate: 35,
      deliveryFeeShare: 100,
      orderCommissionPercent: 5,
      isPayrollEnabled: true,
      updatedAt: now,
    },
  });
}

export async function updatePayrollConfig(
  courierId: string,
  patch: Partial<{
    hourlyRate: number;
    deliveryFeeShare: number;
    orderCommissionPercent: number;
    isPayrollEnabled: boolean;
  }>
) {
  await getOrCreatePayrollConfig(courierId);
  return prisma.courierPayrollConfig.update({
    where: { courierId },
    data: { ...patch, updatedAt: nowIso() },
  });
}

/** Resolve commission %: courier+tenant override → tenant override → courier default. */
export async function resolveOrderCommissionPercent(
  courierId: string,
  tenantId: string | undefined
): Promise<number> {
  const config = await getOrCreatePayrollConfig(courierId);
  if (!tenantId) return config.orderCommissionPercent;

  const perCourier = await prisma.courierTenantCommissionOverride.findUnique({
    where: { tenantId_courierId: { tenantId, courierId } },
  });
  if (perCourier) return perCourier.orderCommissionPercent;

  const tenantWide = await prisma.tenantDriverCommissionOverride.findUnique({
    where: { tenantId },
  });
  if (tenantWide) return tenantWide.orderCommissionPercent;

  return config.orderCommissionPercent;
}

export async function setTenantDriverCommissionOverride(
  tenantId: string,
  orderCommissionPercent: number,
  courierId?: string
) {
  const now = nowIso();
  if (courierId) {
    return prisma.courierTenantCommissionOverride.upsert({
      where: { tenantId_courierId: { tenantId, courierId } },
      create: { tenantId, courierId, orderCommissionPercent, updatedAt: now },
      update: { orderCommissionPercent, updatedAt: now },
    });
  }
  return prisma.tenantDriverCommissionOverride.upsert({
    where: { tenantId },
    create: { tenantId, orderCommissionPercent, updatedAt: now },
    update: { orderCommissionPercent, updatedAt: now },
  });
}

export async function getTenantDriverCommissionOverrides(tenantId: string) {
  const [tenantWide, perCourier] = await Promise.all([
    prisma.tenantDriverCommissionOverride.findUnique({ where: { tenantId } }),
    prisma.courierTenantCommissionOverride.findMany({ where: { tenantId } }),
  ]);
  return { tenantWide, perCourier };
}

function shiftCapEndMs(startTime: string, nowMs: number): number {
  const startMs = new Date(startTime).getTime();
  const capMs = startMs + MAX_SHIFT_MINUTES * 60_000;
  return Math.min(nowMs, capMs);
}

/** Persist auto-close for open shifts exceeding 16h. Returns auto-closed shift if any. */
export async function autoCloseStaleShifts(courierId: string): Promise<{
  closed: Awaited<ReturnType<typeof prisma.courierShift.update>> | null;
}> {
  const open = await prisma.courierShift.findMany({
    where: { courierId, endTime: null },
    orderBy: { startTime: 'asc' },
  });
  const nowMs = Date.now();
  let closed: Awaited<ReturnType<typeof prisma.courierShift.update>> | null = null;

  for (const s of open) {
    const startMs = new Date(s.startTime).getTime();
    const elapsedMin = Math.round((nowMs - startMs) / 60_000);
    if (elapsedMin <= MAX_SHIFT_MINUTES) continue;

    const endTime = new Date(startMs + MAX_SHIFT_MINUTES * 60_000).toISOString();
    closed = await prisma.courierShift.update({
      where: { id: s.id },
      data: {
        endTime,
        durationMinutes: MAX_SHIFT_MINUTES,
        autoClosed: true,
      },
    });
    await appendPayrollAudit({
      courierId,
      action: 'SHIFT_AUTO_CLOSED',
      metadata: { shiftId: s.id, durationMinutes: MAX_SHIFT_MINUTES },
    });
  }

  return { closed };
}

export async function getActiveShift(courierId: string) {
  await autoCloseStaleShifts(courierId);
  return prisma.courierShift.findFirst({
    where: { courierId, endTime: null },
    orderBy: { startTime: 'desc' },
  });
}

/** Recent auto-closed shift (for UI warning), within last 24h. */
export async function getRecentAutoClosedShiftWarning(courierId: string): Promise<string | null> {
  const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const row = await prisma.courierShift.findFirst({
    where: { courierId, autoClosed: true, endTime: { gte: since } },
    orderBy: { endTime: 'desc' },
  });
  return row ? SHIFT_AUTO_CLOSE_WARNING : null;
}

export async function startShift(courierId: string, marketId: string) {
  await autoCloseStaleShifts(courierId);
  const active = await prisma.courierShift.findFirst({
    where: { courierId, endTime: null },
  });
  if (active) {
    const err = new Error('Active shift already exists') as Error & { code?: string };
    err.code = 'ACTIVE_SHIFT_EXISTS';
    throw err;
  }
  const now = nowIso();
  const shift = await prisma.courierShift.create({
    data: {
      id: newId('cshift'),
      courierId,
      marketId,
      startTime: now,
      createdAt: now,
    },
  });
  await appendPayrollAudit({ courierId, action: 'SHIFT_STARTED', metadata: { shiftId: shift.id } });
  return shift;
}

export async function endShift(courierId: string) {
  const active = await prisma.courierShift.findFirst({
    where: { courierId, endTime: null },
    orderBy: { startTime: 'desc' },
  });
  if (!active) {
    const err = new Error('No active shift') as Error & { code?: string };
    err.code = 'NO_ACTIVE_SHIFT';
    throw err;
  }
  const endTime = nowIso();
  const startMs = new Date(active.startTime).getTime();
  const endMs = new Date(endTime).getTime();
  const rawMinutes = Math.max(0, Math.round((endMs - startMs) / 60_000));
  const durationMinutes = Math.min(rawMinutes, MAX_SHIFT_MINUTES);
  const shift = await prisma.courierShift.update({
    where: { id: active.id },
    data: { endTime, durationMinutes, autoClosed: rawMinutes > MAX_SHIFT_MINUTES },
  });
  await appendPayrollAudit({
    courierId,
    action: 'SHIFT_ENDED',
    metadata: { shiftId: shift.id, durationMinutes },
  });
  return shift;
}

async function findOrderLedgerEntry(
  courierId: string,
  type: LedgerType,
  referenceId: string
) {
  return prisma.courierEarningsLedger.findFirst({
    where: { courierId, type, referenceId },
  });
}

/**
 * Idempotent append for order-linked ledger types.
 * DB partial unique index + find-or-create + P2002 fallback.
 */
export async function appendOrderLedgerEntry(input: {
  courierId: string;
  marketId?: string;
  type: 'DELIVERY_FEE' | 'ORDER_COMMISSION';
  amount: number;
  referenceId: string;
  description?: string;
}): Promise<string | null> {
  if (input.amount <= 0) return null;

  const existing = await findOrderLedgerEntry(input.courierId, input.type, input.referenceId);
  if (existing) return existing.id;

  const id = newId('cel');
  try {
    await prisma.courierEarningsLedger.create({
      data: {
        id,
        courierId: input.courierId,
        marketId: input.marketId ?? null,
        type: input.type,
        amount: roundMoney(input.amount),
        referenceId: input.referenceId,
        description: input.description ?? null,
        createdAt: nowIso(),
      },
    });
    return id;
  } catch (err) {
    if (isUniqueViolation(err)) {
      const dup = await findOrderLedgerEntry(input.courierId, input.type, input.referenceId);
      return dup?.id ?? null;
    }
    throw err;
  }
}

export async function appendLedgerEntry(input: {
  courierId: string;
  marketId?: string;
  type: LedgerType;
  amount: number;
  referenceId?: string;
  description?: string;
}): Promise<string> {
  if (ORDER_LEDGER_TYPES.includes(input.type) && input.referenceId) {
    const id = await appendOrderLedgerEntry({
      courierId: input.courierId,
      marketId: input.marketId,
      type: input.type as 'DELIVERY_FEE' | 'ORDER_COMMISSION',
      amount: input.amount,
      referenceId: input.referenceId,
      description: input.description,
    });
    return id ?? newId('cel-skipped');
  }

  const id = newId('cel');
  await prisma.courierEarningsLedger.create({
    data: {
      id,
      courierId: input.courierId,
      marketId: input.marketId ?? null,
      type: input.type,
      amount: roundMoney(input.amount),
      referenceId: input.referenceId ?? null,
      description: input.description ?? null,
      createdAt: nowIso(),
    },
  });
  return id;
}

export function extractOrderEarningsBase(order: Record<string, unknown>): {
  deliveryFee: number;
  subtotalWithoutDelivery: number;
} {
  const payment = order.payment as { breakdown?: Record<string, number> } | undefined;
  const breakdown = payment?.breakdown;
  const deliveryFromBreakdown = Number(breakdown?.deliveryFee);
  const itemsFromBreakdown = Number(breakdown?.itemsTotal);
  const deliveryFromOrder =
    Number((order.delivery as { fee?: number } | undefined)?.fee) ||
    Number(order.platformDeliveryFee) ||
    0;
  const deliveryFee = roundMoney(
    Math.max(0, Number.isFinite(deliveryFromBreakdown) ? deliveryFromBreakdown : deliveryFromOrder)
  );

  if (Number.isFinite(itemsFromBreakdown) && itemsFromBreakdown >= 0) {
    return { deliveryFee, subtotalWithoutDelivery: roundMoney(itemsFromBreakdown) };
  }

  const econ = computeOrderSettlementEconomics(order, {}, new Map(), new Map());
  return {
    deliveryFee: econ.deliveryFee,
    subtotalWithoutDelivery: roundMoney(econ.merchantBaseSubtotal),
  };
}

/** Idempotent: posts DELIVERY_FEE + ORDER_COMMISSION when order is COMPLETED with assigned courier. */
export async function postCourierEarningsIfEligible(order: Record<string, unknown>): Promise<void> {
  const status = String(order.status ?? '').toUpperCase();
  if (status !== 'COMPLETED') return;
  const rawCourierId = order.courierId;
  if (rawCourierId == null || rawCourierId === '') return;
  const courierId = String(rawCourierId).trim();
  if (!courierId) return;
  if (String(order.fulfillmentType ?? '') !== 'DELIVERY') return;

  const config = await getOrCreatePayrollConfig(courierId);
  if (!config.isPayrollEnabled) return;

  const orderId = order.id ? String(order.id) : '';
  if (!orderId) return;

  const tenantId = order.tenantId ? String(order.tenantId) : undefined;
  const marketId = order.marketId ? String(order.marketId) : undefined;
  const { deliveryFee, subtotalWithoutDelivery } = extractOrderEarningsBase(order);

  const deliveryCredit = roundMoney(deliveryFee * (config.deliveryFeeShare / 100));
  await appendOrderLedgerEntry({
    courierId,
    marketId,
    type: 'DELIVERY_FEE',
    amount: deliveryCredit,
    referenceId: orderId,
    description: `Delivery fee share for order ${orderId.slice(0, 8)}`,
  });

  const commissionPercent = await resolveOrderCommissionPercent(courierId, tenantId);
  const commission = roundMoney(subtotalWithoutDelivery * (commissionPercent / 100));
  await appendOrderLedgerEntry({
    courierId,
    marketId,
    type: 'ORDER_COMMISSION',
    amount: commission,
    referenceId: orderId,
    description: `Order commission (${commissionPercent}%) for order ${orderId.slice(0, 8)}`,
  });
}

export function parseDateRange(period?: string, from?: string, to?: string): { from: string; to: string } {
  const today = todayStr();
  if (from && to) return { from, to };
  const p = String(period ?? 'today').toLowerCase();
  if (p === 'week') {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    return { from: start.toISOString().slice(0, 10), to: today };
  }
  if (p === 'month') {
    const d = new Date();
    const fromMonth = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
    return { from: fromMonth, to: today };
  }
  return { from: today, to: today };
}

function inDateRange(iso: string, from: string, to: string): boolean {
  const day = iso.slice(0, 10);
  return day >= from && day <= to;
}

function effectiveShiftMinutes(
  shift: { startTime: string; endTime: string | null; durationMinutes: number | null; autoClosed: boolean },
  from: string,
  to: string,
  nowMs: number
): number {
  const startMs = new Date(shift.startTime).getTime();
  if (!inDateRange(shift.startTime, from, to) && !(shift.endTime && inDateRange(shift.endTime, from, to))) {
    if (shift.endTime) return 0;
    if (!inDateRange(shift.startTime, from, to)) return 0;
  }

  if (shift.durationMinutes != null && shift.endTime) {
    if (inDateRange(shift.startTime, from, to) || inDateRange(shift.endTime, from, to)) {
      return shift.durationMinutes;
    }
    return 0;
  }

  if (!shift.endTime) {
    const day = shift.startTime.slice(0, 10);
    if (day >= from && day <= to) {
      const capEnd = shiftCapEndMs(shift.startTime, nowMs);
      return Math.max(0, Math.round((capEnd - startMs) / 60_000));
    }
  }

  return 0;
}

export async function computeWorkedMinutes(courierId: string, from: string, to: string): Promise<number> {
  await autoCloseStaleShifts(courierId);
  const shifts = await prisma.courierShift.findMany({
    where: { courierId },
    orderBy: { startTime: 'asc' },
  });
  const nowMs = Date.now();
  let total = 0;
  for (const s of shifts) {
    total += effectiveShiftMinutes(s, from, to, nowMs);
  }
  return total;
}

export type EarningsSummary = {
  from: string;
  to: string;
  ordersCount: number;
  deliveryEarnings: number;
  commissionEarnings: number;
  bonuses: number;
  expenses: number;
  hourlyPay: number;
  hoursWorked: number;
  netEarnings: number;
};

export async function computeEarningsSummary(
  courierId: string,
  from: string,
  to: string
): Promise<EarningsSummary> {
  const config = await getOrCreatePayrollConfig(courierId);

  const ledger = await prisma.courierEarningsLedger.findMany({
    where: { courierId },
    orderBy: { createdAt: 'asc' },
  });
  const inRange = ledger.filter((e) => inDateRange(e.createdAt, from, to));

  let deliveryEarnings = 0;
  let commissionEarnings = 0;
  let bonuses = 0;
  let expenses = 0;
  const orderIds = new Set<string>();

  for (const e of inRange) {
    if (e.type === 'DELIVERY_FEE') {
      deliveryEarnings += e.amount;
      if (e.referenceId) orderIds.add(e.referenceId);
    } else if (e.type === 'ORDER_COMMISSION') {
      commissionEarnings += e.amount;
      if (e.referenceId) orderIds.add(e.referenceId);
    } else if (e.type === 'BONUS') bonuses += e.amount;
    else if (e.type === 'EXPENSE') expenses += Math.abs(e.amount);
  }

  const approvedExpenses = await prisma.courierExpense.findMany({
    where: { courierId, status: 'APPROVED' },
  });
  for (const ex of approvedExpenses) {
    if (!inDateRange(ex.createdAt, from, to)) continue;
    const linked = inRange.some((e) => e.type === 'EXPENSE' && e.referenceId === ex.id);
    if (!linked) expenses += ex.amount;
  }

  const minutes = await computeWorkedMinutes(courierId, from, to);
  const hoursWorked = roundMoney(minutes / 60);
  const hourlyPay = roundMoney(hoursWorked * config.hourlyRate);
  const netEarnings = roundMoney(
    hourlyPay + deliveryEarnings + commissionEarnings + bonuses - expenses
  );

  return {
    from,
    to,
    ordersCount: orderIds.size,
    deliveryEarnings: roundMoney(deliveryEarnings),
    commissionEarnings: roundMoney(commissionEarnings),
    bonuses: roundMoney(bonuses),
    expenses: roundMoney(expenses),
    hourlyPay,
    hoursWorked,
    netEarnings,
  };
}

export async function addBonus(input: {
  courierId: string;
  marketId?: string;
  amount: number;
  reason: string;
  userId?: string;
}) {
  const amount = roundMoney(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid bonus amount');
  }
  const id = await appendLedgerEntry({
    courierId: input.courierId,
    marketId: input.marketId,
    type: 'BONUS',
    amount,
    description: input.reason.trim(),
  });
  await appendPayrollAudit({
    courierId: input.courierId,
    userId: input.userId,
    action: 'BONUS_ADDED',
    metadata: { amount, reason: input.reason, ledgerId: id },
  });
  return { id, amount };
}

export async function approveExpense(expenseId: string, userId?: string) {
  const expense = await prisma.courierExpense.findUnique({ where: { id: expenseId } });
  if (!expense) throw new Error('Expense not found');
  if (expense.status === 'APPROVED') return expense;
  if (expense.status === 'REJECTED') throw new Error('Expense already rejected');

  const now = nowIso();
  const updated = await prisma.courierExpense.update({
    where: { id: expenseId },
    data: { status: 'APPROVED', reviewedAt: now, reviewedBy: userId ?? null },
  });

  const existing = await findOrderLedgerEntry(expense.courierId, 'EXPENSE', expenseId);
  if (!existing) {
    await appendLedgerEntry({
      courierId: expense.courierId,
      marketId: expense.marketId,
      type: 'EXPENSE',
      amount: -roundMoney(expense.amount),
      referenceId: expenseId,
      description: `${expense.category}: ${expense.note ?? ''}`.trim(),
    });
  }

  await appendPayrollAudit({
    courierId: expense.courierId,
    userId,
    action: 'EXPENSE_APPROVED',
    metadata: { expenseId, amount: expense.amount },
  });
  return updated;
}

export async function rejectExpense(expenseId: string, userId?: string) {
  const expense = await prisma.courierExpense.findUnique({ where: { id: expenseId } });
  if (!expense) throw new Error('Expense not found');
  if (expense.status === 'REJECTED') return expense;

  const updated = await prisma.courierExpense.update({
    where: { id: expenseId },
    data: { status: 'REJECTED', reviewedAt: nowIso(), reviewedBy: userId ?? null },
  });

  await appendPayrollAudit({
    courierId: expense.courierId,
    userId,
    action: 'EXPENSE_REJECTED',
    metadata: { expenseId, amount: expense.amount },
  });
  return updated;
}
