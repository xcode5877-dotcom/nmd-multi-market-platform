import { create } from 'zustand';
import type { TenantStoreType } from '@nmd/core';

interface AppState {
  tenantId: string | null;
  tenantSlug: string | null;
  tenantName: string | null;
  tenantType: TenantStoreType | null;
  setTenant: (id: string | null, slug?: string | null, name?: string | null, type?: TenantStoreType | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  tenantId: null,
  tenantSlug: null,
  tenantName: null,
  tenantType: null,
  setTenant: (id, slug, name, type) =>
    set({ tenantId: id, tenantSlug: slug ?? null, tenantName: name ?? null, tenantType: type ?? null }),
}));
