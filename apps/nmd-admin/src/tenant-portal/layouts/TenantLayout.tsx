import { useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useTenant } from '../contexts/TenantContext';
import { useNativeBridge } from '../../contexts/NativeBridgeContext';
import StoreStatusToggle from '../../components/StoreStatusToggle';
import { LayoutDashboard, Package, MapPin, ShoppingCart, Users, Settings, Shield } from 'lucide-react';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

const tenantNavItems = [
  { to: '/tenant', end: true, label: 'الرئيسية', icon: LayoutDashboard },
  { to: '/tenant/products', end: false, label: 'المنتجات', icon: Package },
  { to: '/tenant/delivery-zones', end: false, label: 'مناطق التوصيل', icon: MapPin },
  { to: '/tenant/orders', end: false, label: 'الطلبات', icon: ShoppingCart },
  { to: '/tenant/customers', end: false, label: 'العملاء', icon: Users },
  { to: '/tenant/settings/delivery', end: false, label: 'التوصيل', icon: Settings },
  { to: '/tenant/account/security', end: false, label: 'الأمان', icon: Shield },
];

/**
 * Tenant portal layout. Uses token-based tenant from TenantContext.
 * When isNativeApp (UA NMD-Native-App): bottom nav only, no web headers, native push triggers.
 */
export default function TenantLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryTenant = searchParams.get('tenant');
  const search = location.search;
  const { tenant } = useTenant();
  const { isNativeApp } = useNativeBridge();

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

  useEffect(() => {
    if (isNativeApp && typeof window !== 'undefined' && window.__NMD_NATIVE_REGISTER_PUSH__) {
      window.__NMD_NATIVE_REGISTER_PUSH__();
    }
  }, [isNativeApp]);

  return (
    <div className={`tenant-portal ${isNativeApp ? 'native-app-layout' : ''}`}>
      {tenant?.id && (
        <div className="mb-4">
          <StoreStatusToggle
            tenantId={tenant.id}
            currentStatus={tenant.operationalStatus ?? 'open'}
            emphasizeClosed
            variant="full"
          />
        </div>
      )}
      {!isNativeApp && (
        <nav className="flex gap-2 mb-6 border-b border-gray-200 pb-2">
          {tenantNavItems.map(({ to, end, label }) => (
            <NavLink
              key={to}
              to={`${to}${search}`}
              end={end}
              className={({ isActive }) => `px-3 py-1.5 text-sm rounded ${isActive ? 'bg-primary/10 text-primary' : 'text-gray-600 hover:text-gray-900'}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      )}
      <div className={isNativeApp ? 'pb-24' : ''}>
        <Outlet />
      </div>
      {isNativeApp && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-white border-t border-gray-200 py-2 safe-area-pb"
          role="navigation"
          aria-label="القائمة الرئيسية"
        >
          {tenantNavItems.map(({ to, end, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={`${to}${search}`}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2 py-1 min-w-0 flex-1 text-[10px] rounded-lg transition-colors ${isActive ? 'text-primary bg-primary/10' : 'text-gray-500'}`
              }
            >
              <Icon className="w-5 h-5 shrink-0" aria-hidden />
              <span className="truncate w-full text-center">{label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
