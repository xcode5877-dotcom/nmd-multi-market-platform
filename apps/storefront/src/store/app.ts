import { create } from 'zustand';
import type { TenantStoreType, StoreMode } from '@nmd/core';

interface AppState {
  tenantId: string | null;
  tenantSlug: string | null;
  tenantName: string | null;
  tenantType: TenantStoreType | null;
  storeType: StoreMode | null;
  setTenant: (id: string | null, slug?: string | null, name?: string | null, type?: TenantStoreType | null, storeType?: StoreMode | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  tenantId: null,
  tenantSlug: null,
  tenantName: null,
  tenantType: null,
  storeType: null,
  setTenant: (id, slug, name, type, storeType) =>
    set({ tenantId: id, tenantSlug: slug ?? null, tenantName: name ?? null, tenantType: type ?? null, storeType: storeType ?? null }),
}));
