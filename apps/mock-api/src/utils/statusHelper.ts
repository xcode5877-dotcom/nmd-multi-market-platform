/**
 * Server-side operational status helper.
 * Uses Asia/Jerusalem timezone to avoid VPS server-local time issues.
 */

export type OperationalStatus = 'open' | 'closed' | 'busy';

type DayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

interface DayHours {
  open: string;
  close: string;
  isClosedDay: boolean;
}

interface TenantLike {
  operationalStatus?: OperationalStatus;
  businessHours?: Partial<Record<DayKey, DayHours>>;
}

const STORE_TIMEZONE = 'Asia/Jerusalem';
const DAY_ORDER: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const WEEKDAY_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function getNowInStoreTz(): { dayIdx: number; hour: number; minute: number } {
  const now = new Date();
  const tz = { timeZone: STORE_TIMEZONE };
  const dayStr = new Intl.DateTimeFormat('en-US', { ...tz, weekday: 'short' }).format(now);
  const dayIdx = WEEKDAY_MAP[dayStr] ?? 0;
  const timeStr = new Intl.DateTimeFormat('en-CA', { ...tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const [hour, minute] = timeStr.split(':').map(Number);
  return { dayIdx, hour: hour ?? 0, minute: minute ?? 0 };
}

/**
 * Resolve effective operational status from tenant.
 * 1. If operationalStatus is set (manual override), use it.
 * 2. Else compute from businessHours using store timezone (Asia/Jerusalem).
 */
export function getOperationalStatus(tenant: TenantLike): OperationalStatus {
  if (tenant.operationalStatus) return tenant.operationalStatus;
  const hours = tenant.businessHours;
  if (!hours || Object.keys(hours).length === 0) return 'open';
  const { dayIdx, hour, minute } = getNowInStoreTz();
  const dayKey = DAY_ORDER[dayIdx] as DayKey;
  const day = hours[dayKey];
  if (!day || day.isClosedDay) return 'closed';
  const [openH, openM] = (day.open || '00:00').split(':').map(Number);
  const [closeH, closeM] = (day.close || '23:59').split(':').map(Number);
  const nowMin = hour * 60 + minute;
  const openMin = openH * 60 + openM;
  const closeMin = closeH * 60 + closeM;
  if (nowMin >= openMin && nowMin < closeMin) return 'open';
  return 'closed';
}

/**
 * Whether the store is open (accepting orders from schedule + override).
 */
export function isStoreOpen(tenant: TenantLike): boolean {
  return getOperationalStatus(tenant) === 'open';
}
