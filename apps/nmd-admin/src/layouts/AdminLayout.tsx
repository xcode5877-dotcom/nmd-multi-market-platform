import { useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, Building2, Store, FileText, LogOut, Package, MapPin, ShoppingCart, Shield, Settings, FolderTree, ClipboardList, Users } from 'lucide-react';
import { setEmergencyHeaders } from '../api';
import { MockApiClient } from '@nmd/mock';
import { useEmergencyMode } from '../contexts/EmergencyModeContext';
import { useAuth } from '../contexts/AuthContext';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';
const api = new MockApiClient();

function clearNmdSession(): void {
  if (typeof localStorage === 'undefined') return;
  Object.keys(localStorage)
    .filter((k) => k.startsWith('nmd'))
    .forEach((k) => localStorage.removeItem(k));
}

export default function AdminLayout() {
  const auth = useAuth();
  const navigate = useNavigate();
  const emergency = useEmergencyMode();

  const handleLogout = () => {
    clearNmdSession();
    auth.logout();
    navigate('/login', { replace: true });
  };

  const { data: me } = useQuery({
    queryKey: ['me', auth.token],
    queryFn: () => api.getMe(),
    enabled: !!MOCK_API_URL && !!auth.token,
  });
  const isRootAdmin = me?.role === 'ROOT_ADMIN';
  const isMarketAdmin = me?.role === 'MARKET_ADMIN';
  const isTenantAdmin = me?.role === 'TENANT_ADMIN';
  const marketId = me?.marketId;

  useEffect(() => {
    setEmergencyHeaders(emergency?.enabled ?? false, emergency?.reason ?? '');
  }, [emergency?.enabled, emergency?.reason]);

  const marketNav = marketId
    ? [
        { to: `/markets/${marketId}`, icon: LayoutDashboard, label: 'Overview', end: true },
        { to: `/markets/${marketId}/tenants`, icon: Building2, label: 'Tenants', end: false },
        { to: `/markets/${marketId}/orders`, icon: Store, label: 'Orders', end: false },
        { to: '/customers', icon: Users, label: 'المشتركون', end: true },
        { to: '/leads', icon: ClipboardList, label: 'سجل الطلبات', end: true },
      ]
    : [];

  const rootNav = [
    { to: '/markets', icon: Store, label: 'Markets', end: true },
    { to: '/tenants', icon: Building2, label: 'Global Tenants', end: true },
    { to: '/categories', icon: FolderTree, label: 'إدارة التصنيفات', end: true },
    { to: '/customers', icon: Users, label: 'المشتركون', end: true },
    { to: '/leads', icon: ClipboardList, label: 'سجل الطلبات', end: true },
    { to: '/settings', icon: Settings, label: 'Settings', end: false },
    { to: '/audit', icon: FileText, label: 'Audit', end: true },
  ];

  const tenantNav = [
    { to: '/tenant', icon: LayoutDashboard, label: 'الرئيسية', end: true },
    { to: '/tenant/products', icon: Package, label: 'المنتجات', end: false },
    { to: '/tenant/delivery-zones', icon: MapPin, label: 'مناطق التوصيل', end: false },
    { to: '/tenant/orders', icon: ShoppingCart, label: 'الطلبات', end: false },
    { to: '/tenant/customers', icon: Users, label: 'العملاء', end: false },
    { to: '/leads', icon: ClipboardList, label: 'سجل الطلبات', end: true },
    { to: '/tenant/account/security', icon: Shield, label: 'الأمان', end: false },
  ];

  const navItems = isTenantAdmin ? tenantNav : isMarketAdmin ? marketNav : isRootAdmin ? rootNav : [];
  const navLoading = (isMarketAdmin && !marketId) || (isTenantAdmin && !me?.tenantId) || (isRootAdmin === false && isMarketAdmin === false && !isTenantAdmin && !!me);

  const [searchParams] = useSearchParams();
  const tenantParam = searchParams.get('tenant')?.trim();
  const appendTenant = (path: string) => (tenantParam ? `${path}${path.includes('?') ? '&' : '?'}tenant=${encodeURIComponent(tenantParam)}` : path);

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-[#1E293B] border-e border-[#0F172A]/50 flex flex-col">
        <div className="p-4 border-b border-[#0F172A]/50">
          <h1 className="font-bold text-lg text-white">NMD OS Control</h1>
          {MOCK_API_URL && auth.user && (
            <div className="mt-3">
              <p className="text-xs text-gray-400 truncate" title={auth.user.email}>{auth.user.email}</p>
            </div>
          )}
          {MOCK_API_URL && isRootAdmin && (
            <div className="mt-3">
              <label className="text-xs text-gray-400 block mb-1">وضع الطوارئ</label>
              <input
                type="text"
                placeholder="السبب (مطلوب للتعديل)"
                value={emergency?.reason ?? ''}
                onChange={(e) => emergency?.toggle(e.target.value)}
                className="w-full text-sm bg-[#334155] text-white rounded px-2 py-1 border-0 placeholder-gray-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                {emergency?.enabled ? '✓ التعديل مفعّل' : 'التعديل معطّل'}
              </p>
            </div>
          )}
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navLoading ? (
            <div className="px-3 py-2 text-xs text-gray-500">جاري التحميل...</div>
          ) : (
            <>
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={appendTenant(item.to)}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                      isActive ? 'bg-[#7C3AED] text-white' : 'text-gray-300 hover:bg-[#334155] hover:text-white'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>
        {MOCK_API_URL && auth.user && (
          <div className="p-2 border-t border-[#0F172A]/50 mt-auto">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-red-500/20 hover:text-red-300 transition-colors"
            >
              <LogOut className="w-5 h-5 shrink-0" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        )}
      </aside>
      <main className="flex-1 overflow-auto bg-[#F8FAFC]">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
