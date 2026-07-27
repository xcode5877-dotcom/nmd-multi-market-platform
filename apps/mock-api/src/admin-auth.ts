/**
 * Express auth helpers for admin API hardening.
 * Permission rules live in @nmd/core — this module applies them to requests.
 */

import type express from 'express';
import {
  filterTenantPatchForRole,
  stripProtectedCategoryFields,
  isPlatformSuperAdmin,
  isTenantAdminRole,
  isMarketAdminRole,
} from '@nmd/core';

export function isPlatformAdminRole(role: string | undefined): boolean {
  return isPlatformSuperAdmin(role);
}

/**
 * Shared storefront routes where an optional customer JWT is valid.
 * Method-sensitive: mutating admin routes (PUT catalog, PATCH tenants, etc.) are excluded.
 */
const CUSTOMER_ALLOWED_SHARED_ROUTES: { method: string; path: RegExp }[] = [
  /** Checkout — attach customerId on order create. */
  { method: 'POST', path: /^\/orders$/ },
  /** Coupon validation at checkout. */
  { method: 'GET', path: /^\/coupons\/validate$/ },
  /** Rewards catalog (browse). Redeem uses POST /customer/rewards/:id/redeem. */
  { method: 'GET', path: /^\/rewards$/ },
  { method: 'GET', path: /^\/rewards\/[^/]+$/ },
  /** Public market / catalog browse used by customer app. */
  { method: 'GET', path: /^\/catalog\/[^/]+$/ },
  { method: 'GET', path: /^\/markets$/ },
  { method: 'GET', path: /^\/markets\/by-slug\/[^/]+$/ },
  { method: 'GET', path: /^\/markets\/by-slug\/[^/]+\/banners$/ },
  { method: 'GET', path: /^\/markets\/by-slug\/[^/]+\/layout$/ },
  { method: 'GET', path: /^\/markets\/by-slug\/[^/]+\/feed-campaigns$/ },
  { method: 'GET', path: /^\/markets\/by-slug\/[^/]+\/modifier-icons$/ },
  { method: 'GET', path: /^\/markets\/by-slug\/[^/]+\/home-page-blocks$/ },
  { method: 'GET', path: /^\/markets\/by-slug\/[^/]+\/home-feed-settings$/ },
  { method: 'GET', path: /^\/markets\/[^/]+\/tenants$/ },
  { method: 'GET', path: /^\/delivery\/[^/]+$/ },
  { method: 'GET', path: /^\/tenants\/by-id\/[^/]+$/ },
  { method: 'GET', path: /^\/tenants\/by-slug\/[^/]+$/ },
  { method: 'GET', path: /^\/tenants\/[^/]+\/delivery-zones$/ },
  { method: 'GET', path: /^\/config\/payment-methods$/ },
  { method: 'GET', path: /^\/storefront\/tenants$/ },
  { method: 'GET', path: /^\/pillars$/ },
  { method: 'GET', path: /^\/sub-categories$/ },
  { method: 'GET', path: /^\/app-config$/ },
  { method: 'GET', path: /^\/config\/support$/ },
  { method: 'POST', path: /^\/analytics\/support$/ },
  { method: 'GET', path: /^\/campaigns$/ },
  { method: 'GET', path: /^\/contest\/active$/ },
  { method: 'GET', path: /^\/contest\/me$/ },
  { method: 'GET', path: /^\/lucky-wheel\/prizes$/ },
  { method: 'GET', path: /^\/global-categories$/ },
  { method: 'GET', path: /^\/categories$/ },
  { method: 'GET', path: /^\/public\/delivery-towns$/ },
  { method: 'GET', path: /^\/public\/orders\/[^/]+$/ },
];

export function isCustomerAllowedSharedRoute(method: string, path: string): boolean {
  const m = method.toUpperCase();
  return CUSTOMER_ALLOWED_SHARED_ROUTES.some((r) => r.method === m && r.path.test(path));
}

/** Block customer JWT from non-customer admin routes. */
export function rejectCustomerOnAdminRoutes(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const customer = (req as express.Request & { customer?: { id?: string } }).customer;
  if (!customer) {
    next();
    return;
  }
  if (req.path.startsWith('/customer/')) {
    next();
    return;
  }
  if (isCustomerAllowedSharedRoute(req.method, req.path)) {
    next();
    return;
  }
  res.status(403).json({ error: 'Forbidden: customer token cannot access admin APIs' });
}

type AuthUser = { role?: string; tenantId?: string; marketId?: string };

export function assertCatalogTenantAccess(
  user: AuthUser | undefined,
  tenantId: string,
  tenantMarketId: string | undefined,
  res: express.Response
): user is AuthUser {
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  if (isPlatformSuperAdmin(user.role)) return true;
  if (isTenantAdminRole(user.role)) {
    if (user.tenantId !== tenantId) {
      res.status(403).json({ error: 'Forbidden: tenant scope' });
      return false;
    }
    return true;
  }
  if (isMarketAdminRole(user.role)) {
    if (!user.marketId || tenantMarketId !== user.marketId) {
      res.status(403).json({ error: 'Forbidden: market scope' });
      return false;
    }
    return true;
  }
  res.status(403).json({ error: 'Forbidden' });
  return false;
}

export function sanitizeCatalogPayloadForRole<T extends { categories?: Array<{ markupExempt?: boolean; id?: string }> }>(
  role: string | undefined,
  incoming: T,
  existing: T
): T {
  if (!incoming.categories) return incoming;
  return {
    ...incoming,
    categories: stripProtectedCategoryFields(role, incoming.categories, existing.categories ?? []),
  };
}

export function applyTenantPatchRoleFilter(
  role: string | undefined,
  rawUpdates: Record<string, unknown>
): Record<string, unknown> {
  if (isPlatformSuperAdmin(role)) return rawUpdates;
  const filtered = filterTenantPatchForRole(role, rawUpdates);
  if (isTenantAdminRole(role) || isMarketAdminRole(role)) {
    delete filtered.financialConfig;
    delete filtered.platformFee;
    delete filtered.enabled;
  }
  return filtered;
}
