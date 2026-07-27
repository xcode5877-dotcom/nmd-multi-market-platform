import { isPlatformSuperAdmin, isMarketAdminRole, isTenantAdminRole } from './admin-permissions';
import type { CustomerRiskLevel } from '../types/customer-trust';

/** View full trust profile (notes, history, audit). Platform admins only. */
export function canViewCustomerTrustFull(role: string | undefined): boolean {
  return isPlatformSuperAdmin(role);
}

/** Add incidents (managers may add; merchants cannot). */
export function canAddCustomerTrustIncident(role: string | undefined): boolean {
  return isPlatformSuperAdmin(role) || isMarketAdminRole(role);
}

/**
 * Change risk level / flags.
 * Spec: only ROOT_ADMIN may change risk and block COD.
 */
export function canChangeCustomerRisk(role: string | undefined): boolean {
  return role === 'ROOT_ADMIN';
}

/** Resolve incidents — ROOT_ADMIN only. */
export function canResolveCustomerTrustIncident(role: string | undefined): boolean {
  return role === 'ROOT_ADMIN';
}

/** Block / re-enable cash on delivery — ROOT_ADMIN only. */
export function canBlockCustomerCod(role: string | undefined): boolean {
  return role === 'ROOT_ADMIN';
}

/**
 * Escalate to BLOCKED_COD requires explicit ROOT_ADMIN authority.
 * SUPER_ADMIN / MARKET_ADMIN may suggest via incidents but cannot apply BLOCKED_COD.
 */
export function canEscalateToBlockedCod(role: string | undefined): boolean {
  return role === 'ROOT_ADMIN';
}

/** Merchant-safe operational summary on orders (no notes/history). */
export function canViewCustomerTrustOperational(role: string | undefined): boolean {
  return (
    isPlatformSuperAdmin(role) ||
    isMarketAdminRole(role) ||
    isTenantAdminRole(role)
  );
}

/** Mark order customer as phone-confirmed (merchant or admin). */
export function canConfirmCustomerTrustOrder(role: string | undefined): boolean {
  return canViewCustomerTrustOperational(role);
}

export function assertCanApplyRiskLevel(
  role: string | undefined,
  riskLevel: CustomerRiskLevel,
): { ok: true } | { ok: false; error: string } {
  if (!canChangeCustomerRisk(role)) {
    return { ok: false, error: 'Forbidden: only ROOT_ADMIN may change risk level' };
  }
  if (riskLevel === 'BLOCKED_COD' && !canEscalateToBlockedCod(role)) {
    return { ok: false, error: 'Forbidden: only ROOT_ADMIN may set BLOCKED_COD' };
  }
  return { ok: true };
}
