/**
 * API serialization for CourierShift records (worked duration + accounting status).
 */

import { formatWorkedDurationAr, resolveShiftWorkedMinutes } from '@nmd/core';
import { BUSINESS_TIMEZONE, businessDayKey, MAX_SHIFT_MINUTES } from './courier-payroll.js';
import { prisma } from './db.js';

export type CourierShiftRow = {
  id: string;
  courierId: string;
  marketId: string;
  startTime: string;
  endTime: string | null;
  durationMinutes: number | null;
  autoClosed: boolean;
  createdAt?: string;
};

export type AccountingStatus = 'UNACCOUNTED' | 'SETTLED' | 'UNKNOWN';

export const ACCOUNTING_STATUS_LABELS_AR: Record<AccountingStatus, string> = {
  UNACCOUNTED: 'غير محتسبة',
  SETTLED: 'تمت التسوية',
  UNKNOWN: 'بحاجة للمراجعة',
};

/** Current business contract: no active driver wage/payroll model. */
export const DRIVER_WAGE_MODEL_ACTIVE = false;

function roundHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

/**
 * Period-level settlements are historical ledger artifacts.
 * Not used as driver-wage "accounted" status while DRIVER_WAGE_MODEL_ACTIVE is false.
 */
export function deriveShiftAccountingStatus(
  shift: { startTime: string; endTime: string | null },
  settlements: { periodStart: string; periodEnd: string }[],
  resolvedStatus: string
): AccountingStatus {
  if (resolvedStatus === 'ACTIVE' || resolvedStatus === 'INVALID_RANGE' || resolvedStatus === 'MISSING_START') {
    return 'UNKNOWN';
  }
  const day = businessDayKey(shift.startTime);
  if (!day) return 'UNKNOWN';
  const hit = settlements.some((s) => day >= s.periodStart && day <= s.periodEnd);
  return hit ? 'SETTLED' : 'UNACCOUNTED';
}

export function serializeCourierShift(
  shift: CourierShiftRow,
  opts?: {
    nowMs?: number;
    settlements?: { periodStart: string; periodEnd: string }[];
    /** When false (default), omit wage-accounting labels — attendance-only contract. */
    includeAccounting?: boolean;
  }
) {
  const nowMs = opts?.nowMs ?? Date.now();
  const resolved = resolveShiftWorkedMinutes({
    startTime: shift.startTime,
    endTime: shift.endTime,
    durationMinutes: shift.durationMinutes,
    nowMs,
    maxMinutes: MAX_SHIFT_MINUTES,
  });
  const active = resolved.status === 'ACTIVE';
  const includeAccounting = opts?.includeAccounting === true && DRIVER_WAGE_MODEL_ACTIVE;
  const accountingStatus = includeAccounting
    ? deriveShiftAccountingStatus(shift, opts?.settlements ?? [], resolved.status)
    : undefined;
  return {
    id: shift.id,
    courierId: shift.courierId,
    marketId: shift.marketId,
    startTime: shift.startTime,
    endTime: shift.endTime,
    durationMinutes: shift.durationMinutes,
    autoClosed: shift.autoClosed,
    workedMinutes: resolved.workedMinutes,
    hours: resolved.workedMinutes != null ? roundHours(resolved.workedMinutes) : null,
    status: resolved.status,
    durationLabel: formatWorkedDurationAr(resolved.workedMinutes, {
      active,
      invalid: resolved.status === 'INVALID_RANGE',
      incomplete: resolved.status === 'MISSING_START',
    }),
    ...(includeAccounting && accountingStatus
      ? {
          accountingStatus,
          accountingLabel: ACCOUNTING_STATUS_LABELS_AR[accountingStatus],
        }
      : {}),
    timezone: BUSINESS_TIMEZONE,
    domain: 'attendance' as const,
  };
}

export function serializeCourierShiftStatementRow(
  shift: CourierShiftRow,
  opts?: {
    nowMs?: number;
    settlements?: { periodStart: string; periodEnd: string }[];
    includeAccounting?: boolean;
  }
) {
  const base = serializeCourierShift(shift, opts);
  return {
    id: base.id,
    date: businessDayKey(shift.startTime) || shift.startTime.slice(0, 10),
    startTime: base.startTime,
    endTime: base.endTime,
    workedMinutes: base.workedMinutes,
    hours: base.hours,
    status: base.status,
    durationLabel: base.durationLabel,
    autoClosed: base.autoClosed,
    timezone: base.timezone,
    domain: 'attendance' as const,
    ...('accountingStatus' in base
      ? {
          accountingStatus: (base as { accountingStatus?: string }).accountingStatus,
          accountingLabel: (base as { accountingLabel?: string }).accountingLabel,
        }
      : {}),
  };
}

export async function loadCourierSettlementsForAccounting(courierId: string) {
  return prisma.courierPayrollSettlement.findMany({
    where: { courierId },
    select: { periodStart: true, periodEnd: true },
  });
}
