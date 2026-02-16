import { useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, Building2, Store, FileText, LogOut, Package, MapPin, ShoppingCart, Shield, Settings } from 'lucide-react';
import { setEmergencyHeaders } from '../api';
import { MockApiClient } from '@nmd/mock';
import { useEmergencyMode } from '../contexts/EmergencyModeContext';
import { useAuth } from '../contexts/AuthContext';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';
const api = new MockApiClient();

export default function AdminLayout() {
  const auth = useAuth();
  const emergency = useEmergencyMode();

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
      ]
    : [];

  const rootNav = [
    { to: '/markets', icon: Store, label: 'Markets', end: true },
    { to: '/tenants', icon: Building2, label: 'Global Tenants', end: true },
    { to: '/settings', icon: Settings, label: 'Settings', end: false },
    { to: '/audit', icon: FileText, label: 'Audit', end: true },
  ];

  const tenantNav = [
    { to: '/tenant', icon: LayoutDashboard, label: 'الرئيسية', end: true },
    { to: '/tenant/products', icon: Package, label: 'المنتجات', end: false },
    { to: '/tenant/delivery-zones', icon: MapPin, label: 'مناطق التوصيل', end: false },
    { to: '/tenant/orders', icon: ShoppingCart, label: 'الطلبات', end: false },
    { to: '/tenant/account/security', icon: Shield, label: 'الأمان', end: false },
  ];

  const navItems = isTenantAdmin ? tenantNav : isMarketAdmin ? marketNav : isRootAdmin ? rootNav : [];
  const navLoading = (isMarketAdmin && !marketId) || (isTenantAdmin && !me?.tenantId) || (isRootAdmin === false && isMarketAdmin === false && !isTenantAdmin && !!me);

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-[#1E293B] border-e border-[#0F172A]/50 flex flex-col">
        <div className="p-4 border-b border-[#0F172A]/50">
          <h1 className="font-bold text-lg text-white">NMD OS Control</h1>
          {MOCK_API_URL && auth.user && (
            <div className="mt-3">
              <p className="text-xs text-gray-400">{auth.user.email}</p>
              <button
                onClick={() => auth.logout()}
                className="mt-1 flex items-center gap-1 text-xs text-gray-400 hover:text-white"
              >
                <LogOut className="w-3 h-3" />
                تسجيل الخروج
              </button>
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
                  to={item.to}
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
      </aside>
      <main className="flex-1 overflow-auto bg-[#F8FAFC]">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
