/** Role constants for NMD OS Admin */
export const ROLE = {
  ROOT_ADMIN: 'ROOT_ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
  MARKET_ADMIN: 'MARKET_ADMIN',
  TENANT_ADMIN: 'TENANT_ADMIN',
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export {
  canViewModule,
  canAccessRoute,
  canEditField,
  isPlatformSuperAdmin,
  isMarketAdminRole,
  isTenantAdminRole,
  getSafeDashboardRoute,
} from '@nmd/core';
