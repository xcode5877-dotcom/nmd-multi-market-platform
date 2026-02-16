import { useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useTenant } from '../contexts/TenantContext';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

/**
 * Tenant portal layout. Uses token-based tenant from TenantContext.
 * Ignores ?tenant= for access control. Normalizes URL when query param doesn't match authenticated tenant.
 */
export default function TenantLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryTenant = searchParams.get('tenant');
  const search = location.search;
  const { tenant } = useTenant();

  useEffect(() => {
    if (!MOCK_API_URL || !tenant) return;
    const authSlug = (tenant as { slug?: string }).slug;
    if (!authSlug) return;
    if (queryTenant && queryTenant !== authSlug) {
      const next = new URLSearchParams(searchParams);
      next.set('tenant', authSlug);
      navigate(`/tenant?${next.toString()}`, { replace: true });
    }
  }, [tenant, queryTenant, searchParams, navigate, MOCK_API_URL]);

  return (
    <div className="tenant-portal">
      <nav className="flex gap-2 mb-6 border-b border-gray-200 pb-2">
        <NavLink to={`/tenant${search}`} end className={({ isActive }) => `px-3 py-1.5 text-sm rounded ${isActive ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:text-gray-900'}`}>
          الرئيسية
        </NavLink>
        <NavLink to={`/tenant/products${search}`} className={({ isActive }) => `px-3 py-1.5 text-sm rounded ${isActive ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:text-gray-900'}`}>
          المنتجات
        </NavLink>
        <NavLink to={`/tenant/delivery-zones${search}`} className={({ isActive }) => `px-3 py-1.5 text-sm rounded ${isActive ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:text-gray-900'}`}>
          مناطق التوصيل
        </NavLink>
        <NavLink to={`/tenant/orders${search}`} className={({ isActive }) => `px-3 py-1.5 text-sm rounded ${isActive ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:text-gray-900'}`}>
          الطلبات
        </NavLink>
        <NavLink to={`/tenant/settings/delivery${search}`} className={({ isActive }) => `px-3 py-1.5 text-sm rounded ${isActive ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:text-gray-900'}`}>
          إعدادات التوصيل
        </NavLink>
        <NavLink to={`/tenant/account/security${search}`} className={({ isActive }) => `px-3 py-1.5 text-sm rounded ${isActive ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:text-gray-900'}`}>
          الأمان
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
