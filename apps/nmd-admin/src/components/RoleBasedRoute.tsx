import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';
const api = new MockApiClient();

/** Renders children for ROOT_ADMIN; redirects MARKET_ADMIN to /markets/:marketId/tenants, TENANT_ADMIN to /tenant. Used for /tenants. */
export function RedirectMarketAdminToTenants({ children }: { children: ReactNode }) {
  const { data: me, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.getMe(),
    enabled: !!MOCK_API_URL,
  });

  if (!MOCK_API_URL) return <>{children}</>;
  if (isLoading || !me) return <div className="p-8 text-gray-500">جاري التحميل...</div>;
  if (me.role === 'TENANT_ADMIN') return <Navigate to="/tenant" replace />;
  if (me.role === 'MARKET_ADMIN' && me.marketId) {
    return <Navigate to={`/markets/${me.marketId}/tenants`} replace />;
  }
  return <>{children}</>;
}

/** Renders children for ROOT_ADMIN only; redirects MARKET_ADMIN to their market, TENANT_ADMIN to /tenant. Used for /audit, etc. */
export function RootOnlyRoute({ children }: { children: ReactNode }) {
  const { data: me, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.getMe(),
    enabled: !!MOCK_API_URL,
  });

  if (!MOCK_API_URL) return <>{children}</>;
  if (isLoading || !me) return <div className="p-8 text-gray-500">جاري التحميل...</div>;
  if (me.role === 'TENANT_ADMIN') return <Navigate to="/tenant" replace />;
  if (me.role === 'MARKET_ADMIN' && me.marketId) {
    return <Navigate to={`/markets/${me.marketId}`} replace />;
  }
  return <>{children}</>;
}

/** Renders MarketsPage for ROOT_ADMIN; redirects MARKET_ADMIN to their market, TENANT_ADMIN to /tenant. */
export function MarketsOrRedirect({ children }: { children: ReactNode }) {
  const { data: me, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.getMe(),
    enabled: !!MOCK_API_URL,
  });

  if (!MOCK_API_URL) return <>{children}</>;
  if (isLoading || !me) return <div className="p-8 text-gray-500">جاري التحميل...</div>;
  if (me.role === 'TENANT_ADMIN') return <Navigate to="/tenant" replace />;
  if (me.role === 'MARKET_ADMIN' && me.marketId) {
    return <Navigate to={`/markets/${me.marketId}`} replace />;
  }
  return <>{children}</>;
}

/**
 * Index route redirect:
 * - TENANT_ADMIN -> /tenant
 * - MARKET_ADMIN -> /markets/:marketId
 * - ROOT_ADMIN -> /markets
 */
export function IndexOrRedirect() {
  const { data: me, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.getMe(),
    enabled: !!MOCK_API_URL,
  });

  if (!MOCK_API_URL) return <Navigate to="/markets" replace />;
  if (isLoading || !me) return <div className="p-8 text-gray-500">جاري التحميل...</div>;
  if (me.role === 'TENANT_ADMIN') return <Navigate to="/tenant" replace />;
  if (me.role === 'MARKET_ADMIN' && me.marketId) {
    return <Navigate to={`/markets/${me.marketId}`} replace />;
  }
  return <Navigate to="/markets" replace />;
}
