/**
 * Decimal-safe helpers for measurement quantities (max 3 decimal places).
 * Uses integer milli-units (×1000) to avoid floating-point artefacts.
 */

const SCALE = 1000;

export function parseMeasurementDecimalStrict(
  value: unknown
): { ok: true; milli: number; normalized: string } | { ok: false; reason: string } {
  if (value == null || value === '') return { ok: false, reason: 'missing' };

  let s: string;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { ok: false, reason: 'not_finite' };
    // Detect excessive precision via scaled integer check
    const milli = Math.round(value * SCALE);
    if (Math.abs(milli / SCALE - value) > 1e-9) return { ok: false, reason: 'too_many_decimals' };
    return { ok: true, milli, normalized: milliToNormalizedString(milli) };
  }

  s = String(value).trim();
  if (!s) return { ok: false, reason: 'empty' };
  if (!/^-?\d+(\.\d+)?$/.test(s)) return { ok: false, reason: 'invalid_format' };

  const fracMatch = s.match(/^-?\d+\.(\d+)$/);
  if (fracMatch && fracMatch[1].length > 3) return { ok: false, reason: 'too_many_decimals' };

  const n = Number(s);
  if (!Number.isFinite(n)) return { ok: false, reason: 'not_finite' };
  const milli = Math.round(n * SCALE);
  return { ok: true, milli, normalized: milliToNormalizedString(milli) };
}

/** Normalize Prisma Decimal / unknown to string without rejecting. Falls back to "1". */
export function coerceMeasurementDecimalString(value: unknown, fallback = '1'): string {
  const parsed = parseMeasurementDecimalStrict(value);
  if (parsed.ok) return parsed.normalized;
  if (value != null && typeof (value as { toString?: () => string }).toString === 'function') {
    const again = parseMeasurementDecimalStrict(String(value));
    if (again.ok) return again.normalized;
  }
  return fallback;
}

export function milliToNormalizedString(milli: number): string {
  const neg = milli < 0;
  const abs = Math.abs(milli);
  const whole = Math.floor(abs / SCALE);
  const frac = abs % SCALE;
  if (frac === 0) return `${neg ? '-' : ''}${whole}`;
  const fracStr = String(frac).padStart(3, '0').replace(/0+$/, '');
  return `${neg ? '-' : ''}${whole}.${fracStr}`;
}

export function milliToNumber(milli: number): number {
  return milli / SCALE;
}

export function isIntegerMilli(milli: number): boolean {
  return milli % SCALE === 0;
}

/** Convert base-unit milli to display milli (g/ml = ×1000). */
export function baseMilliToDisplayMilli(
  baseMilli: number,
  baseUnitCode: string,
  displayUnitCode: string
): number {
  if (baseUnitCode === 'kg' && displayUnitCode === 'g') return baseMilli * 1000;
  if (baseUnitCode === 'l' && displayUnitCode === 'ml') return baseMilli * 1000;
  return baseMilli;
}
