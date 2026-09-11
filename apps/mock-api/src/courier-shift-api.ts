/**
 * API serialization for CourierShift records (worked duration contract).
 */

import { formatWorkedDurationAr, resolveShiftWorkedMinutes } from '@nmd/core';
import { MAX_SHIFT_MINUTES } from './courier-payroll.js';

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

function roundHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

export function serializeCourierShift(shift: CourierShiftRow, nowMs = Date.now()) {
  const resolved = resolveShiftWorkedMinutes({
    startTime: shift.startTime,
    endTime: shift.endTime,
    durationMinutes: shift.durationMinutes,
    nowMs,
    maxMinutes: MAX_SHIFT_MINUTES,
  });
  const active = resolved.status === 'ACTIVE';
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
  };
}

export function serializeCourierShiftStatementRow(shift: CourierShiftRow, nowMs = Date.now()) {
  const base = serializeCourierShift(shift, nowMs);
  return {
    id: base.id,
    date: shift.startTime.slice(0, 10),
    startTime: base.startTime,
    endTime: base.endTime,
    workedMinutes: base.workedMinutes,
    hours: base.hours,
    status: base.status,
    durationLabel: base.durationLabel,
    autoClosed: base.autoClosed,
  };
}
