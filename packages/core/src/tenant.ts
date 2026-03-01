import type { TenantBranding, Tenant, OperationalStatus, DayKey } from './types';

/**
 * Parse subdomain to extract tenant ID for production.
 * e.g. "acme.nmd-store.com" -> "acme"
 */
export function parseSubdomainTenant(hostname: string): string | null {
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    const subdomain = parts[0];
    if (subdomain && !['www', 'api', 'admin'].includes(subdomain.toLowerCase())) {
      return subdomain;
    }
  }
  return null;
}

/**
 * Resolve tenant ID from URL params (dev) or subdomain (prod)
 */
export function resolveTenantId(
  hostname: string,
  searchParams: URLSearchParams
): string | null {
  const urlTenant = searchParams.get('tenantId');
  if (urlTenant) return urlTenant;
  return parseSubdomainTenant(hostname);
}

export const LAST_TENANT_KEY = 'nmd.lastTenant';

const DAY_ORDER: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** Store timezone for business hours (Israel). Use this to avoid server-local time issues on VPS. */
const STORE_TIMEZONE = 'Asia/Jerusalem';

const WEEKDAY_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/**
 * Get current hour and day-of-week in store timezone (Asia/Jerusalem).
 * Ensures correct status regardless of server or client local timezone.
 */
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
export function getOperationalStatus(tenant: Pick<Tenant, 'operationalStatus' | 'businessHours'>): OperationalStatus {
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
 * For order blocking, also check orderPolicy.
 */
export function isStoreOpen(tenant: Pick<Tenant, 'operationalStatus' | 'businessHours'>): boolean {
  return getOperationalStatus(tenant) === 'open';
}

/**
 * Resolve tenant from URL (dev): ?tenant=slug or fallback to last selected in localStorage
 */
export function resolveTenantFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('tenant');
  if (slug) return slug;
  return localStorage.getItem(LAST_TENANT_KEY);
}

/**
 * Persist last selected tenant for dev
 */
export function setLastTenant(slugOrId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LAST_TENANT_KEY, slugOrId);
}

const LAYOUT_STYLES: Record<TenantBranding['layoutStyle'], { header: string; card: string; section: string; button: string; badge: string }> = {
  minimal: { header: 'flat', card: 'flat', section: 'tight', button: 'square', badge: 'subtle' },
  cozy: { header: 'soft', card: 'soft', section: 'medium', button: 'rounded', badge: 'soft' },
  bold: { header: 'strong', card: 'strong', section: 'spacious', button: 'pill', badge: 'strong' },
  modern: { header: 'clean', card: 'clean', section: 'medium', button: 'rounded', badge: 'clean' },
  default: { header: 'soft', card: 'soft', section: 'medium', button: 'rounded', badge: 'soft' },
  compact: { header: 'flat', card: 'flat', section: 'tight', button: 'square', badge: 'subtle' },
  spacious: { header: 'strong', card: 'strong', section: 'spacious', button: 'pill', badge: 'strong' },
};

/**
 * Convert tenant branding to CSS variables for runtime theming
 */
export function tenantBrandingToCssVars(branding: TenantBranding): Record<string, string> {
  const style = LAYOUT_STYLES[branding.layoutStyle] ?? LAYOUT_STYLES.default;
  return {
    '--color-primary': branding.primaryColor,
    '--color-secondary': branding.secondaryColor,
    '--radius': `${branding.radiusScale * 4}px`,
    '--font': branding.fontFamily,
    '--layout-header': style.header,
    '--layout-card': style.card,
    '--layout-section': style.section,
    '--layout-button': style.button,
    '--layout-badge': style.badge,
  };
}
