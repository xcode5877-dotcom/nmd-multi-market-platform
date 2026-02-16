import { resolveTenantFromUrl, setLastTenant } from '@nmd/core';

const LEGACY_PATH_PREFIXES = ['p', 'c', 'cart', 'checkout', 'order'];

/** Extract tenant slug from path when using /:tenantSlug/... routes */
export function getTenantSlugFromPath(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0];
  if (!first) return null;
  if (LEGACY_PATH_PREFIXES.includes(first)) return null;
  return first;
}

/** Resolve tenant: path param first, then ?tenant=, then localStorage */
export function getTenantSlugOrId(): string | null {
  if (typeof window === 'undefined') return null;
  const fromPath = getTenantSlugFromPath(window.location.pathname);
  if (fromPath) return fromPath;
  return resolveTenantFromUrl();
}

export function persistTenant(slugOrId: string): void {
  setLastTenant(slugOrId);
}
