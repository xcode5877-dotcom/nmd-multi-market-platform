import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { resolveTenantFromUrl, setLastTenant } from '@nmd/core';

interface AdminTenantState {
  tenantId: string | null;
  setTenantId: (id: string | null) => void;
}

export const useAdminTenantStore = create<AdminTenantState>()(
  persist(
    (set) => ({
      tenantId: null,
      setTenantId: (id) => set({ tenantId: id }),
    }),
    { name: 'nmd-admin-tenant' }
  )
);

export function getInitialTenant(): string | null {
  return resolveTenantFromUrl();
}

export function persistAdminTenant(slugOrId: string): void {
  setLastTenant(slugOrId);
}
