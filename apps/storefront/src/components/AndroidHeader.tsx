import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, User, ShoppingCart, Home, UserCircle, Activity, Store, LogOut, ArrowRight } from 'lucide-react';
import { useCartStore } from '../store/cart';
import { useAppStore } from '../store/app';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import { useGlobalAuthModal } from '../contexts/GlobalAuthModalContext';
import { PLATFORM_BRANDING } from '@nmd/core';
import { Drawer } from '@nmd/ui';

const ANDROID_HEADER_HEIGHT_PX = 56;
export const ANDROID_HEADER_HEIGHT = ANDROID_HEADER_HEIGHT_PX;

const DRAWER_LINKS = [
  { to: '/', label: 'الرئيسية', icon: Home },
  { to: '/my-account', label: 'حسابي', icon: UserCircle },
  { to: '/my-activity', label: 'نشاطي', icon: Activity },
  { to: '/', label: 'اختيار السوق', icon: Store },
] as const;

/**
 * Android app header: Burger (opens drawer), Logo (center, links to /), Profile + Cart (right).
 * Drawer: nav links + Logout at bottom. Only rendered when isAndroidOrMobileApp() (RootLayout).
 */
export function AndroidHeader() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { customer, logout } = useCustomerAuth();
  const { openAuthModal } = useGlobalAuthModal();
  const tenantSlug = useAppStore((s) => s.tenantSlug ?? s.tenantId);
  const totalCount = useCartStore((s) => {
    const ids = s.getTenantIdsInCart();
    return ids.reduce((sum, id) => sum + (s.getItems(id)?.reduce((n, i) => n + i.quantity, 0) ?? 0), 0);
  });
  const firstTenantInCart = useCartStore((s) => s.getTenantIdsInCart()[0] ?? null);
  const cartHref = tenantSlug ? `/${tenantSlug}/cart` : firstTenantInCart ? `/${firstTenantInCart}/cart` : '/';

  const [drawerOpen, setDrawerOpen] = useState(false);

  const closeDrawer = () => setDrawerOpen(false);

  const handleNav = (to: string) => {
    navigate(to);
    closeDrawer();
  };

  const handleLogout = () => {
    logout();
    closeDrawer();
    navigate('/');
  };

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 w-full m-0 z-[9999] backdrop-blur-md border-b border-[#0f766e]/20 isolate pt-[env(safe-area-inset-top)]"
        style={{
          minHeight: ANDROID_HEADER_HEIGHT_PX,
          backgroundColor: PLATFORM_BRANDING.primaryColor,
        }}
        data-android-header
      >
        <div
          className="relative flex items-center justify-between w-full max-w-6xl mx-auto px-4 sm:px-6"
          style={{ minHeight: ANDROID_HEADER_HEIGHT_PX }}
          dir="rtl"
        >
          {/* Left (RTL start): Burger + Back — fixed width */}
          <div className="flex items-center justify-start gap-2 min-w-[96px] shrink-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="p-2 rounded-full hover:bg-white/10 active:bg-white/20 transition-colors touch-manipulation"
              aria-label="القائمة"
            >
              <Menu className="w-5 h-5 text-white" strokeWidth={2.5} />
            </button>
            {pathname !== '/' && (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="back-btn-header w-10 h-10 flex items-center justify-center rounded-full border-2 border-white/50 bg-white/20 hover:bg-white/30 active:scale-90 transition-all shrink-0"
                style={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)' }}
                aria-label="رجوع"
              >
                <ArrowRight className="w-5 h-5 text-white" strokeWidth={2} />
              </button>
            )}
          </div>

          {/* Center: Logo — perfectly centered */}
          <Link
            to="/"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-auto"
            aria-label="الرئيسية"
          >
            {PLATFORM_BRANDING.logoUrl ? (
              <img
                src={PLATFORM_BRANDING.logoUrl}
                alt="NMD"
                className="h-9 w-auto max-h-[44px] object-contain"
                loading="eager"
              />
            ) : (
              <span className="font-bold text-xl truncate max-w-[160px] text-white">
                NMD
              </span>
            )}
          </Link>

          {/* Right: Profile + Cart — gap-5 */}
          <div className="flex items-center justify-end gap-5 min-w-[110px] shrink-0">
            <Link
              to="/my-account"
              className="p-2 rounded-full hover:bg-white/10 active:bg-white/20 transition-colors"
              aria-label={customer ? 'حسابي' : 'تسجيل الدخول'}
              onClick={customer ? undefined : (e) => { e.preventDefault(); openAuthModal(); }}
            >
              <User className="w-5 h-5 text-white" strokeWidth={2} />
            </Link>
            <Link
              to={cartHref}
              className="relative p-2 rounded-full hover:bg-white/10 active:bg-white/20 transition-colors"
              aria-label={totalCount > 0 ? `سلة التسوق ${totalCount} منتج` : 'سلة التسوق (فارغة)'}
            >
              <ShoppingCart className="w-5 h-5 text-white" strokeWidth={2} />
              {totalCount > 0 && (
                <span className="absolute top-0.5 end-0.5 text-[#0f766e] text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 bg-white">
                  {totalCount > 99 ? '99+' : totalCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title="القائمة"
        side="end"
        contentClassName="max-w-[280px] flex flex-col"
      >
        <div className="flex flex-col flex-1 min-h-0">
          <nav className="flex flex-col gap-1 py-2 flex-1" aria-label="التنقل الرئيسي">
            {DRAWER_LINKS.map(({ to, label, icon: Icon }) => {
              const isActive =
                to === '/'
                  ? pathname === '/' || pathname === ''
                  : pathname.startsWith(to);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => handleNav(to)}
                  className={`flex items-center gap-3 w-full px-4 py-3.5 text-right rounded-full font-medium transition-colors ${
                    isActive
                      ? 'bg-[#0f766e]/15 text-[#0f766e] hover:bg-[#0f766e]/20'
                      : 'text-gray-800 hover:bg-gray-100 active:bg-gray-200'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 ${isActive ? 'text-[#0f766e]' : 'text-gray-500'}`}
                    strokeWidth={2}
                  />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>
          <div className="shrink-0 pt-4 pb-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3.5 text-right rounded-full text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors font-medium"
            >
              <LogOut className="w-5 h-5 shrink-0" strokeWidth={2} />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </Drawer>
    </>
  );
}
