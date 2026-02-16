import { createContext, useContext } from 'react';
import type { TenantStoreType } from '@nmd/core';

interface AdminContextValue {
  tenantId: string;
  /** Store type: FOOD = CUSTOM only; CLOTHING = SIZE/COLOR/CUSTOM; GENERAL = all. Controlled by Super Admin. */
  tenantType?: TenantStoreType;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdminContext() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('AdminContext required');
  return ctx;
}

export const AdminProvider = AdminContext.Provider;
