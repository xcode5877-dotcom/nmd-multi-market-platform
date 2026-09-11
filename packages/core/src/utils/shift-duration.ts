/**
 * Driver shift worked duration — UTC instant math, Arabic display labels.
 */

export type ShiftDurationStatus =
  | 'ACTIVE'
  | 'COMPLETED'
  | 'MISSING_START'
  | 'INVALID_RANGE'
  | 'INCOMPLETE';

export type ShiftDurationInput = {
  startTime: string | null | undefined;
  endTime?: string | null;
  /** Optional persisted minutes (cache). Timestamps remain authoritative when both ends exist. */
  durationMinutes?: number | null;
  /** Defaults to Date.now() — used for active shifts only. */
  nowMs?: number;
  /** Cap elapsed minutes (e.g. 16h auto-close). Applied to active and completed totals. */
  maxMinutes?: number | null;
};

export type ShiftDurationResult = {
  status: ShiftDurationStatus;
  /** Whole minutes worked, or null when not computable. */
  workedMinutes: number | null;
};

function parseInstantMs(iso: string | null | undefined): number | null {
  if (iso == null || String(iso).trim() === '') return null;
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function capMinutes(raw: number, maxMinutes: number | null | undefined): number {
  const n = Math.max(0, Math.round(raw));
  if (maxMinutes != null && Number.isFinite(maxMinutes) && maxMinutes >= 0) {
    return Math.min(n, Math.round(maxMinutes));
  }
  return n;
}

/**
 * Resolve worked minutes from authoritative timestamps (and optional stored duration).
 */
export function resolveShiftWorkedMinutes(input: ShiftDurationInput): ShiftDurationResult {
  const startMs = parseInstantMs(input.startTime);
  if (startMs == null) {
    return { status: 'MISSING_START', workedMinutes: null };
  }

  const endMs = parseInstantMs(input.endTime ?? null);
  const nowMs = input.nowMs ?? Date.now();
  const maxMinutes = input.maxMinutes ?? null;

  if (endMs == null) {
    // Active: live elapsed only — never persist continuously changing values here.
    const elapsed = capMinutes((nowMs - startMs) / 60_000, maxMinutes);
    return { status: 'ACTIVE', workedMinutes: elapsed };
  }

  if (endMs < startMs) {
    return { status: 'INVALID_RANGE', workedMinutes: null };
  }

  // Authoritative: UTC instant delta. Stored durationMinutes is ignored when both ends exist
  // so display stays consistent with timestamps (including overnight / legacy null duration).
  const fromTimestamps = capMinutes((endMs - startMs) / 60_000, maxMinutes);
  return { status: 'COMPLETED', workedMinutes: fromTimestamps };
}

/**
 * Arabic worked-duration label for admin/driver attendance UI.
 */
export function formatWorkedDurationAr(
  workedMinutes: number | null,
  opts?: { active?: boolean; invalid?: boolean; incomplete?: boolean }
): string {
  if (opts?.invalid) return 'مدة غير صالحة';
  if (opts?.incomplete) return '—';
  if (opts?.active && workedMinutes == null) return 'قيد الدوام الآن';

  if (workedMinutes == null) {
    return opts?.active ? 'قيد الدوام الآن' : '—';
  }

  if (opts?.active) {
    const base = formatMinutesParts(workedMinutes);
    return base === '—' ? 'قيد الدوام الآن' : `${base} · قيد الدوام الآن`;
  }

  return formatMinutesParts(workedMinutes);
}

function formatMinutesParts(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) return '—';
  const minutes = Math.round(totalMinutes);
  if (minutes < 60) {
    return `${minutes} دقيقة`;
  }
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (rem === 0) {
    return `${hours} ساعات`;
  }
  return `${hours} ساعات و${rem} دقيقة`;
}
