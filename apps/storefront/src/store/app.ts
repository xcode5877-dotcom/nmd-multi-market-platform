import { create } from 'zustand';
import type { TenantStoreType, StoreMode } from '@nmd/core';

interface AppState {
  tenantId: string | null;
  tenantSlug: string | null;
  tenantName: string | null;
  tenantType: TenantStoreType | null;
  storeType: StoreMode | null;
  /** Market group id (e.g. market-dabburiyya) for multi-store cart rule */
  marketId: string | null;
  setTenant: (id: string | null, slug?: string | null, name?: string | null, type?: TenantStoreType | null, storeType?: StoreMode | null, marketId?: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  tenantId: null,
  tenantSlug: null,
  tenantName: null,
  tenantType: null,
  storeType: null,
  marketId: null,
  setTenant: (id, slug, name, type, storeType, marketId) =>
    set({ tenantId: id, tenantSlug: slug ?? null, tenantName: name ?? null, tenantType: type ?? null, storeType: storeType ?? null, marketId: marketId ?? null }),
}));
