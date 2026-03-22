import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  ShoppingCart,
  LayoutGrid,
  FolderTree,
  Package,
  Sliders,
  Megaphone,
  Palette,
  Truck,
  Users,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  User,
  LayoutList,
  Store,
  ClipboardList,
  Menu,
  Bell,
  BellOff,
  Volume2,
} from 'lucide-react';
import { getStorage, setStorage } from '../lib/storage';
import { useAuth } from '../contexts/AuthContext';
import { isPlatformAdmin } from '../lib/is-platform-admin';
import { useOrderAlarm } from '../contexts/OrderAlarmContext';

const SIDEBAR_KEY = 'sidebar-collapsed';

type NavItem = { to: string; icon: React.ComponentType<{ className?: string }>; label: string };
type NavSection = { sectionLabel: string; items: NavItem[] };

// All paths must be absolute (leading /) so they resolve correctly under basename /merchant. Use NavLink only (no <a>).
// Delivery Settings link is added only for ROOT_ADMIN/SUPER_ADMIN (see render).
function getNavSections(showDelivery: boolean): NavSection[] {
  const sections: NavSection[] = [
    {
      sectionLabel: 'نظرة عامة',
      items: [
        { to: '/', icon: LayoutDashboard, label: 'لوحة التحكم' },
        { to: '/orders', icon: ShoppingCart, label: 'الطلبات' },
        { to: '/orders/board', icon: LayoutGrid, label: 'لوحة الطلبات' },
        { to: '/leads', icon: ClipboardList, label: 'سجل الطلبات' },
      ],
    },
    {
      sectionLabel: 'الكتالوج',
      items: [
        { to: '/catalog/products', icon: Package, label: 'المنتجات' },
        { to: '/catalog/categories', icon: FolderTree, label: 'التصنيفات' },
        { to: '/catalog/options', icon: Sliders, label: 'مجموعات الخيارات' },
      ],
    },
    {
      sectionLabel: 'الحملات',
      items: [{ to: '/campaigns', icon: Megaphone, label: 'الحملات' }],
    },
    {
      sectionLabel: 'الإدارة',
      items: [
        { to: '/settings/store', icon: Store, label: 'إعدادات المحل' },
        { to: '/settings/staff', icon: Users, label: 'الفريق' },
        { to: '/branding', icon: Palette, label: 'واجهة المحل' },
        { to: '/homepage', icon: LayoutList, label: 'الصفحة الرئيسية' },
      ],
    },
  ];
  if (showDelivery) {
    sections.push({
      sectionLabel: 'الأمان',
      items: [{ to: '/settings/delivery', icon: Truck, label: 'مناطق التوصيل' }],
    });
  }
  return sections;
}

function toAbsolutePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

function OrderAlarmBell() {
  const alarm = useOrderAlarm();
  if (!alarm) return null;
  const { hasPendingAlarm, pendingCount, muted, setMuted, stopSound, testSound, audioBlocked, enableSoundAlerts } = alarm;
  const handleBellClick = () => {
    if (hasPendingAlarm && !muted) stopSound();
    else setMuted(!muted);
  };
  return (
    <div className="flex items-center gap-1">
      {audioBlocked && hasPendingAlarm && !muted && (
        <button
          type="button"
          onClick={enableSoundAlerts}
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors whitespace-nowrap"
          title="المتصفح منع التشغيل التلقائي — انقر لتفعيل التنبيه الصوتي"
        >
          تفعيل التنبيه الصوتي
        </button>
      )}
      <button
        type="button"
        onClick={handleBellClick}
        className={`relative p-2 rounded-xl transition-colors ${
          hasPendingAlarm ? 'text-amber-600 hover:bg-amber-50' : 'text-slate-600 hover:bg-slate-100'
        } ${muted ? 'opacity-60' : ''}`}
        title={muted ? 'تفعيل التنبيه' : hasPendingAlarm ? `إيقاف التنبيه — ${pendingCount} طلب بانتظار الموافقة` : 'تنبيه الطلبات'}
      >
        {muted ? (
          <BellOff className="w-5 h-5 stroke-[1.5]" />
        ) : (
          <Bell className="w-5 h-5 stroke-[1.5]" />
        )}
        {hasPendingAlarm && !muted && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 items-center justify-center text-[10px] font-bold text-white">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={testSound}
        className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
        title="تجربة الصوت"
      >
        <Volume2 className="w-5 h-5 stroke-[1.5]" />
      </button>
    </div>
  );
}

function clearNmdSession(): void {
  if (typeof localStorage === 'undefined') return;
  const keys = Object.keys(localStorage).filter((k) => k.startsWith('nmd'));
  keys.forEach((k) => localStorage.removeItem(k));
}

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(() => getStorage<boolean>(SIDEBAR_KEY) ?? false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navSections = getNavSections(isPlatformAdmin(user?.role));

  useEffect(() => {
    setStorage(SIDEBAR_KEY, collapsed);
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // When app is opened from FCM "new order" notification tap, navigate to orders board
  useEffect(() => {
    const bridge = (window as unknown as { NativeBridge?: { getPendingOrderId?: () => string } }).NativeBridge;
    const orderId = bridge?.getPendingOrderId?.();
    if (orderId && typeof orderId === 'string' && orderId.trim()) {
      navigate(`/orders/board?highlight=${encodeURIComponent(orderId.trim())}`, { replace: true });
    }
  }, [navigate]);

  const handleLogout = () => {
    clearNmdSession();
    logout();
    navigate('/login', { replace: true });
  };

  const sidebarContent = (
    <>
      <div className={`border-b border-slate-200/80 flex items-center ${collapsed ? 'p-2 justify-center' : 'p-4 justify-end'}`}>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 shrink-0 transition-colors"
          aria-label={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
        >
          {collapsed ? <PanelLeft className="w-5 h-5 stroke-[1.5]" /> : <PanelLeftClose className="w-5 h-5 stroke-[1.5]" />}
        </button>
      </div>
      <nav className="flex-1 p-2 overflow-auto">
        {navSections.map((section) => (
          <div key={section.sectionLabel} className={collapsed ? 'space-y-1' : 'mb-4 last:mb-0'}>
            {!collapsed && (
              <div className="px-3 py-1.5 text-xs font-medium text-slate-500 uppercase tracking-wider">
                {section.sectionLabel}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const pathname = toAbsolutePath(item.to);
                const Icon = item.icon;
                return (
                  <NavLink
                    key={pathname}
                    to={{ pathname, search: location.search || '' }}
                    end={pathname === '/'}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors ${
                        collapsed ? 'justify-center' : ''
                      } ${isActive ? 'bg-primary text-white' : 'text-slate-700 hover:bg-slate-100'}`
                    }
                  >
                    <Icon className="w-5 h-5 shrink-0 stroke-[1.5]" />
                    {!collapsed && <span>{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </>
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 overflow-x-hidden">
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200/80 px-4 sm:px-5 md:px-6 py-3 flex items-center justify-between gap-4 shrink-0 shadow-sm min-h-[3.25rem] overflow-hidden">
        <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            className="md:hidden min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-xl hover:bg-slate-100 text-slate-600 shrink-0 cursor-pointer touch-manipulation"
            aria-label="القائمة"
          >
            <Menu className="w-5 h-5 stroke-[1.5]" />
          </button>
          <h1 className="font-bold text-lg text-primary truncate min-w-0 max-w-[50vw] sm:max-w-none">Store OS Dashboard</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <OrderAlarmBell />
          <span className="hidden sm:flex items-center gap-2 text-sm text-slate-600">
            <User className="w-4 h-4 stroke-[1.5]" />
            {user?.email ?? '—'}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-slate-700 hover:bg-red-50 hover:text-red-600 transition-colors"
            title="تسجيل الخروج"
          >
            <LogOut className="w-4 h-4 stroke-[1.5]" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-900/20 md:hidden cursor-pointer"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
        )}
        {/* Sidebar: overlay on mobile, in-flow on md+ (z-40 so Drawer z-[9999] stays on top) */}
        <aside
          className={`
            flex flex-col shrink-0 transition-[transform,width] duration-200 ease-out
            bg-white border-e border-slate-200/80 shadow-sm
            fixed top-0 right-0 bottom-0 z-40 w-60 pt-14
            md:static md:pt-0 md:translate-x-0
            ${collapsed ? 'md:w-[4.5rem]' : 'md:w-60'}
            ${mobileOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
          `}
        >
          {sidebarContent}
        </aside>
        <main className="flex-1 overflow-auto bg-slate-50 min-w-0">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="px-4 sm:px-6 py-6 min-h-full"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
