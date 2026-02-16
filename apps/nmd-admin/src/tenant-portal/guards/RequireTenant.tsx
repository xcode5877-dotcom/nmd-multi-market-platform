import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { TenantProvider, useTenant } from '../contexts/TenantContext';
import { ROLE } from '../../rbac';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

/**
 * Guards tenant portal routes. Only TENANT_ADMIN with tenantId can access.
 * Uses token-based tenant resolution (tenantId from /auth/me); ignores URL query param.
 */
function RequireTenantInner({ children }: { children: ReactNode }) {
  const { me, isLoading } = useTenant();

  if (!MOCK_API_URL) return <>{children}</>;
  if (isLoading || !me) return <div className="p-8 text-gray-500">جاري التحميل...</div>;

  if (me.role === ROLE.MARKET_ADMIN && me.marketId) {
    return <Navigate to={`/markets/${me.marketId}`} replace />;
  }
  if (me.role === ROLE.ROOT_ADMIN) {
    return <Navigate to="/markets" replace />;
  }
  if (me.role === ROLE.TENANT_ADMIN) {
    if (!me.tenantId) {
      return (
        <div className="p-8 max-w-md">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
            <h2 className="text-lg font-semibold mb-2">رمز غير صالح</h2>
            <p className="text-sm">لا يوجد مستأجر مرتبط بحسابك. تواصل مع المسؤول.</p>
          </div>
        </div>
      );
    }
    return <>{children}</>;
  }

  return <Navigate to="/" replace />;
}

export function RequireTenant({ children }: { children: ReactNode }) {
  return (
    <TenantProvider>
      <RequireTenantInner>{children}</RequireTenantInner>
    </TenantProvider>
  );
}
