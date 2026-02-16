import type { TenantBranding } from './types';

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
