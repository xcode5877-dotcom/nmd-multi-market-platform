export type Role = 'OWNER' | 'MANAGER' | 'STAFF';

export const ROLE_PERMISSIONS: Record<Role, { catalog: 'read' | 'write'; orders: 'read' | 'write'; campaigns: 'read' | 'write'; settings: 'read' | 'write' }> = {
  OWNER: { catalog: 'write', orders: 'write', campaigns: 'write', settings: 'write' },
  MANAGER: { catalog: 'write', orders: 'write', campaigns: 'write', settings: 'read' },
  STAFF: { catalog: 'read', orders: 'write', campaigns: 'read', settings: 'read' },
};

export interface StaffUser {
  id: string;
  tenantId: string;
  name: string;
  phone?: string;
  email?: string;
  role: Role;
  createdAt: string;
}
