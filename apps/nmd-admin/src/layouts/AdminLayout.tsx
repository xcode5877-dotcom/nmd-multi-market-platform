import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { Outlet, NavLink, useNavigate, useSearchParams, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Building2,
  Store,
  LogOut,
  Package,
  MapPin,
  ShoppingCart,
  Shield,
  Settings,
  ClipboardList,
  Users,
  Truck,
  Bell,
  BellOff,
  Volume2,
  AlertCircle,
  DollarSign,
} from 'lucide-react';
import StoreStatusToggle from '../components/StoreStatusToggle';
import { setEmergencyHeaders, TOKEN_KEY } from '../api';
import { MockApiClient } from '@nmd/mock';
import { useEmergencyMode } from '../contexts/EmergencyModeContext';
import { useAuth } from '../contexts/AuthContext';
import { useNativeBridge } from '../contexts/NativeBridgeContext';
import { MarketOrderAlarmProvider, useMarketOrderAlarm } from '../contexts/MarketOrderAlarmContext';
import { SUPER_ADMIN_NAV_SECTIONS, type SuperAdminNavSection } from '../config/superAdminNav';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';
const api = new MockApiClient();

type FlatNavItem = {
  to: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  end: boolean;
};

/** Parse marketId and tenantId from pathname when inside markets/:id/tenants/:tenantId (or nested). */
function parseMarketAndTenantFromPath(pathname: string): { marketId?: string; tenantId?: string } {
  const match = pathname.match(/\/markets\/([^/]+)\/tenants\/([^/]+)/);
  if (match) return { marketId: match[1], tenantId: match[2] };
  return {};
}

function navLinkClass(isActive: boolean, accent: SuperAdminNavSection['accent']) {
  if (accent === 'teal') {
    return isActive
      ? 'bg-teal-600 text-white'
      : 'text-gray-300 hover:bg-[#334155] hover:text-white';
  }
  return isActive ? 'bg-[#7C3AED] text-white' : 'text-gray-300 hover:bg-[#334155] hover:text-white';
}

/** Simplified dashboard summary for native app: Today's Sales, Active Stores, Urgent Alerts. */
function AdminNativeDashboardSummary() {
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => api.getMe(), enabled: !!MOCK_API_URL });
  const alarm = useMarketOrderAlarm();
  const pendingCount = alarm?.pendingCount ?? 0;
  const hasAlerts = (alarm?.hasPendingAlarm ?? false) && !alarm?.muted;

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-bold text-gray-900">لوحة التحكم</h1>
      <div className="grid grid-cols-1 gap-3">
        <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <DollarSign className="w-4 h-4" />
            مبيعات اليوم
          </div>
          <p className="text-xl font-semibold text-gray-900">—</p>
          <NavLink to="/markets" className="text-sm text-[#7C3AED] hover:underline mt-1 inline-block">
            عرض الأسواق
          </NavLink>
        </div>
        <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Store className="w-4 h-4" />
            متاجر نشطة
          </div>
          <p className="text-xl font-semibold text-gray-900">—</p>
          <NavLink to="/tenants" className="text-sm text-[#7C3AED] hover:underline mt-1 inline-block">
            عرض المتاجر
          </NavLink>
        </div>
        <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <AlertCircle className="w-4 h-4" />
            تنبيهات عاجلة
          </div>
          <p className={`text-xl font-semibold ${hasAlerts ? 'text-amber-600' : 'text-gray-900'}`}>
            {hasAlerts ? `${pendingCount} طلب بانتظار الموافقة` : 'لا يوجد'}
          </p>
          {hasAlerts && (
            <NavLink to="/markets" className="text-sm text-[#7C3AED] hover:underline mt-1 inline-block">
              عرض الطلبات
            </NavLink>
          )}
        </div>
      </div>
      {me && (
        <p className="text-xs text-gray-400 truncate" title={me.email}>
          {me.email}
        </p>
      )}
    </div>
  );
}

export default function AdminLayout() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const emergency = useEmergencyMode();
  const { isNativeApp } = useNativeBridge();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(TOKEN_KEY);
    auth.logout();
    navigate('/login', { replace: true });
  };

  const { data: me } = useQuery({
    queryKey: ['me', auth.token],
    queryFn: () => api.getMe(),
    enabled: !!MOCK_API_URL && !!auth.token,
  });
  const { data: tenantForStatus } = useQuery({
    queryKey: ['tenant-by-id', me?.tenantId],
    queryFn: () => api.getTenantById(me!.tenantId!),
    enabled: !!MOCK_API_URL && !!me?.tenantId && me?.role === 'TENANT_ADMIN',
  });
  const isRootAdmin = me?.role === 'ROOT_ADMIN' || me?.role === 'SUPER_ADMIN';
  const isMarketAdmin = me?.role === 'MARKET_ADMIN';
  const isTenantAdmin = me?.role === 'TENANT_ADMIN';
  const marketId = me?.marketId;
  const params = useParams<{ id?: string; tenantId?: string }>();
  const fromPath = useMemo(() => parseMarketAndTenantFromPath(location.pathname), [location.pathname]);
  const marketIdFromUrl = params.id ?? fromPath.marketId;
  const tenantIdFromUrl = params.tenantId ?? fromPath.tenantId;
  const isInsideStoreDashboard = Boolean(marketIdFromUrl && tenantIdFromUrl);

  useEffect(() => {
    setEmergencyHeaders(emergency?.enabled ?? false, emergency?.reason ?? '');
  }, [emergency?.enabled, emergency?.reason]);

  const marketNav: FlatNavItem[] = marketId
    ? [
        { to: `/markets/${marketId}`, icon: LayoutDashboard, label: 'Overview', end: true },
        { to: `/markets/${marketId}/tenants`, icon: Building2, label: 'Tenants', end: false },
        { to: `/markets/${marketId}/orders`, icon: Store, label: 'Orders', end: false },
        { to: '/customers', icon: Users, label: 'المشتركون', end: true },
        { to: '/delivery-leads', icon: ClipboardList, label: 'طلبات واتساب / اتصال', end: true },
      ]
    : [];

  const tenantNav: FlatNavItem[] = [
    { to: '/tenant', icon: LayoutDashboard, label: 'الرئيسية', end: true },
    { to: '/tenant/products', icon: Package, label: 'المنتجات', end: false },
    { to: '/tenant/delivery-zones', icon: MapPin, label: 'مناطق التوصيل', end: false },
    { to: '/tenant/orders', icon: ShoppingCart, label: 'الطلبات', end: false },
    { to: '/tenant/customers', icon: Users, label: 'العملاء', end: false },
    { to: '/delivery-leads', icon: ClipboardList, label: 'طلبات واتساب / اتصال', end: true },
    { to: '/tenant/account/security', icon: Shield, label: 'الأمان', end: false },
  ];

  const baseNavItems: FlatNavItem[] = isTenantAdmin ? tenantNav : isMarketAdmin ? marketNav : [];
  const deliveryLink: FlatNavItem | null =
    isInsideStoreDashboard && marketIdFromUrl && tenantIdFromUrl
      ? {
          to: `/markets/${marketIdFromUrl}/tenants/${tenantIdFromUrl}/settings/delivery`,
          icon: Truck,
          label: 'مناطق التوصيل',
          end: false,
        }
      : null;
  const navItems = deliveryLink ? [...baseNavItems, deliveryLink] : baseNavItems;
  const navLoading =
    (isMarketAdmin && !marketId) ||
    (isTenantAdmin && !me?.tenantId) ||
    (isRootAdmin === false && isMarketAdmin === false && !isTenantAdmin && !!me);

  const [searchParams] = useSearchParams();
  const tenantParam = searchParams.get('tenant')?.trim();
  const appendTenant = (path: string) =>
    tenantParam ? `${path}${path.includes('?') ? '&' : '?'}tenant=${encodeURIComponent(tenantParam)}` : path;

  const isIndex = location.pathname === '/' || location.pathname === '';
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  const nativeNavItems = [
    { to: '/', end: true, label: 'الرئيسية', icon: LayoutDashboard },
    { to: '/markets', end: true, label: 'الأسواق', icon: Store },
    { to: '/tenants', end: true, label: 'المتاجر', icon: Building2 },
    { to: '/settings', end: false, label: 'الإعدادات', icon: Settings },
  ];

  if (isNativeApp) {
    return (
      <MarketOrderAlarmProvider marketId={marketIdFromUrl}>
        <div className="min-h-screen flex flex-col bg-[#F8FAFC] pb-24">
          <main className="flex-1 overflow-auto">
            {isIndex ? (
              <AdminNativeDashboardSummary />
            ) : (
              <div className="p-6">
                <Outlet />
              </div>
            )}
          </main>
          <nav
            className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-[#1E293B] border-t border-[#0F172A]/50 py-2 text-white"
            role="navigation"
            aria-label="القائمة الرئيسية"
          >
            {nativeNavItems.map(({ to, end, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={appendTenant(to)}
                end={end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 px-2 py-1 min-w-0 flex-1 text-[10px] rounded-lg transition-colors ${
                    isActive ? 'bg-[#7C3AED] text-white' : 'text-gray-400 hover:text-white'
                  }`
                }
              >
                <Icon className="w-5 h-5 shrink-0" aria-hidden />
                <span className="truncate w-full text-center">{label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </MarketOrderAlarmProvider>
    );
  }

  return (
    <MarketOrderAlarmProvider marketId={marketIdFromUrl}>
      <div className="min-h-screen flex bg-[#F8FAFC]">
        {mobileMenuOpen && (
          <button
            type="button"
            aria-label="إغلاق القائمة"
            className="fixed inset-0 z-30 bg-black/40 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
        <aside
          className={`fixed top-0 bottom-0 right-0 z-40 w-72 max-w-[85vw] bg-[#1E293B] border-e border-[#0F172A]/50 flex flex-col transform transition-transform duration-200 md:static md:translate-x-0 md:w-60 ${
            mobileMenuOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
          }`}
        >
          <div className="p-4 border-b border-[#0F172A]/50 shrink-0">
            <h1 className="font-bold text-lg text-white">NMD OS Control</h1>
            <MarketOrderAlarmBell />
            {MOCK_API_URL && auth.user && (
              <div className="mt-3">
                <p className="text-xs text-gray-400 truncate" title={auth.user.email}>
                  {auth.user.email}
                </p>
              </div>
            )}
            {isTenantAdmin && me?.tenantId && (
              <div className="mt-3">
                <StoreStatusToggle
                  tenantId={me.tenantId}
                  currentStatus={
                    (tenantForStatus as { operationalStatus?: 'open' | 'closed' | 'busy' })?.operationalStatus ??
                    'open'
                  }
                  emphasizeClosed
                  variant="full"
                />
              </div>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto p-2 space-y-4 min-h-0" aria-label="القائمة الجانبية">
            {navLoading ? (
              <div className="px-3 py-2 text-xs text-gray-500">جاري التحميل...</div>
            ) : isRootAdmin ? (
              SUPER_ADMIN_NAV_SECTIONS.map((section) => (
                <div key={section.id} className="space-y-0.5">
                  <p className="px-3 pt-1 pb-1.5 text-[11px] font-semibold tracking-wide text-gray-500 border-b border-[#334155]/60 mb-1">
                    {section.title}
                  </p>
                  {section.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={appendTenant(item.to)}
                      end={item.end ?? true}
                      className={({ isActive }) =>
                        `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${navLinkClass(
                          isActive,
                          section.accent
                        )}`
                      }
                    >
                      <item.icon className="w-4 h-4 shrink-0" aria-hidden />
                      <span className="leading-snug">{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              ))
            ) : (
              <div className="space-y-0.5">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={appendTenant(item.to)}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${navLinkClass(
                        isActive,
                        'purple'
                      )}`
                    }
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            )}
          </nav>

          <div className="shrink-0 p-2 border-t border-[#0F172A]/50 space-y-2">
            {MOCK_API_URL && isRootAdmin && (
              <div className="px-2 py-2 rounded-lg bg-[#334155]/40">
                <label className="text-xs text-gray-400 block mb-1">وضع الطوارئ</label>
                <input
                  type="text"
                  placeholder="السبب (مطلوب للتعديل)"
                  value={emergency?.reason ?? ''}
                  onChange={(e) => emergency?.toggle(e.target.value)}
                  className="w-full text-sm bg-[#334155] text-white rounded px-2 py-1.5 border-0 placeholder-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {emergency?.enabled ? '✓ التعديل مفعّل' : 'التعديل معطّل'}
                </p>
              </div>
            )}
            {MOCK_API_URL && auth.user && (
              <button
                type="button"
                onClick={handleLogout}
                aria-label="تسجيل الخروج"
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:bg-[#334155] hover:text-white transition-colors"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                تسجيل الخروج
              </button>
            )}
          </div>
        </aside>

        <main className="flex-1 overflow-auto bg-[#F8FAFC] min-w-0">
          <div className="md:hidden sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200">
            <div className="px-3 py-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="min-h-11 min-w-11 px-3 rounded-lg border border-gray-200 text-gray-700 bg-white active:bg-gray-100"
                aria-label="فتح القائمة"
              >
                <span className="text-lg leading-none">☰</span>
              </button>
              <div className="min-w-0 text-center flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">NMD OS Control</p>
                {auth.user?.email ? (
                  <p className="text-[11px] text-gray-500 truncate">{auth.user.email}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-1">
                <MarketOrderAlarmBell />
                {MOCK_API_URL && auth.user && (
                  <button
                    type="button"
                    onClick={handleLogout}
                    aria-label="تسجيل الخروج"
                    className="min-h-11 min-w-11 px-3 rounded-lg border border-gray-200 text-gray-700 bg-white active:bg-gray-100"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="p-3 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </MarketOrderAlarmProvider>
  );
}

function MarketOrderAlarmBell() {
  const alarm = useMarketOrderAlarm();
  if (!alarm) return null;
  const { hasPendingAlarm, pendingCount, muted, setMuted, testSound, audioBlocked, enableSoundAlerts } = alarm;
  return (
    <div className="flex items-center gap-1 mt-2">
      {audioBlocked && hasPendingAlarm && !muted && (
        <button
          type="button"
          onClick={enableSoundAlerts}
          className="px-2 py-1 rounded text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors whitespace-nowrap"
          title="المتصفح منع التشغيل التلقائي — انقر لتفعيل التنبيه الصوتي"
        >
          تفعيل التنبيه الصوتي
        </button>
      )}
      <button
        type="button"
        onClick={() => setMuted(!muted)}
        className={`relative p-1.5 rounded-lg transition-colors ${
          hasPendingAlarm ? 'text-amber-400 hover:bg-amber-500/20' : 'text-gray-400 hover:bg-[#334155]'
        } ${muted ? 'opacity-60' : ''}`}
        title={muted ? 'تفعيل التنبيه' : hasPendingAlarm ? `${pendingCount} طلب بانتظار الموافقة` : 'تنبيه الطلبات'}
      >
        {muted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
        {hasPendingAlarm && !muted && (
          <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 items-center justify-center text-[9px] font-bold text-white">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={testSound}
        className="p-1.5 rounded-lg text-gray-400 hover:bg-[#334155] transition-colors"
        title="تجربة الصوت"
      >
        <Volume2 className="w-4 h-4" />
      </button>
    </div>
  );
}
