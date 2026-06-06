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
