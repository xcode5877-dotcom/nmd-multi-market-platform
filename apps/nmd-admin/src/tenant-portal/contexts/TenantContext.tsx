import { createContext, useContext, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import { useAuth } from '../../contexts/AuthContext';

const api = new MockApiClient();
const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

export interface TenantContextValue {
  me: { id: string; email: string; role: string; tenantId?: string; marketId?: string } | null;
  tenantId: string | null;
  tenant: { id: string; slug?: string; name?: string } | null;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextValue | null>(null);

/**
 * Provides tenant from token only. Ignores URL query param.
 * Bootstrap: read tenantId from /auth/me (token claims) -> fetch GET /tenants/by-id/:tenantId with Authorization.
 */
export function TenantProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['me', token],
    queryFn: () => api.getMe(),
    enabled: !!MOCK_API_URL && !!token,
  });

  const tenantId = me?.tenantId ?? null;

  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ['tenant-by-id', tenantId],
    queryFn: () => api.getTenantById(tenantId!),
    enabled: !!MOCK_API_URL && !!tenantId,
  });

  const value: TenantContextValue = {
    me: me ?? null,
    tenantId,
    tenant: tenant ? { id: tenant.id, slug: tenant.slug, name: tenant.name } : null,
    isLoading: meLoading || tenantLoading,
  };

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}

/** Returns tenant context when inside TenantProvider, else null. Use when component is used in both tenant portal and market routes. */
export function useTenantOptional(): TenantContextValue | null {
  return useContext(TenantContext);
}
