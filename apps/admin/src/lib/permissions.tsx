import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { canAccessRoute, getSafeDashboardRoute } from '@nmd/core';
import { MockApiClient } from '@nmd/mock';

const api = new MockApiClient();
const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

/** Merchant admin route guard — redirects unauthorized paths to dashboard. */
export function MerchantPermissionRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { data: me, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.getMe(),
    enabled: !!MOCK_API_URL,
  });

  if (!MOCK_API_URL) return <>{children}</>;
  if (isLoading || !me) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const path = location.pathname || '/';
  if (!canAccessRoute(me.role, path)) {
    return <Navigate to={getSafeDashboardRoute(me.role, 'merchant')} replace />;
  }

  return <>{children}</>;
}

export { canViewModule, canEditField } from '@nmd/core';
