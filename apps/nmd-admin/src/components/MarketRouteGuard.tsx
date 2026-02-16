import { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import ForbiddenPage from '../pages/ForbiddenPage';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';
const api = new MockApiClient();

/**
 * Guards market-scoped routes. MARKET_ADMIN can access only when route marketId === auth.marketId.
 * ROOT_ADMIN can access any market. TENANT_ADMIN cannot access; redirect to /tenant.
 * Shows 403 Forbidden page when access denied.
 */
export function MarketRouteGuard({ children }: { children: ReactNode }) {
  const { id: routeMarketId } = useParams<{ id: string }>();

  const { data: me, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.getMe(),
    enabled: !!MOCK_API_URL && !!routeMarketId,
  });

  if (!MOCK_API_URL || !routeMarketId) return <>{children}</>;
  if (isLoading || !me) return <div className="p-8 text-gray-500">جاري التحميل...</div>;

  if (me.role === 'TENANT_ADMIN') return <Navigate to="/tenant" replace />;
  if (me.role === 'ROOT_ADMIN') return <>{children}</>;
  if (me.role === 'MARKET_ADMIN' && me.marketId && routeMarketId !== me.marketId) {
    return <ForbiddenPage />;
  }

  return <>{children}</>;
}
