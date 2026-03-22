/**
 * Platform super admin roles that can manage delivery zones and see delivery settings.
 * Must match backend (ROOT_ADMIN / SUPER_ADMIN).
 */
export function isPlatformAdmin(role: string | undefined): boolean {
  return role === 'ROOT_ADMIN' || role === 'SUPER_ADMIN';
}

/** Strictly Super Admin (hard delete orders, etc.). Must match backend. */
export function isSuperAdmin(role: string | undefined): boolean {
  return role === 'SUPER_ADMIN';
}
