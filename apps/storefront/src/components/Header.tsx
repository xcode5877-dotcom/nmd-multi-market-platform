import { useState, useMemo, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ShoppingCart, Search, User, Menu, X, Store, Bell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { MockApiClient, getTenantListForMallAsync } from '@nmd/mock';
import { TenantSwitcher, useLayoutStyle, layoutHeaderClass } from '@nmd/ui';
import { useAppStore } from '../store/app';
import { useCartStore } from '../store/cart';
import { persistTenant } from '../lib/tenant';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import { useGlobalAuthModal } from '../contexts/GlobalAuthModalContext';

const api = new MockApiClient();
const USE_API = !!import.meta.env.VITE_MOCK_API_URL;
const RETURN_MARKET_KEY = 'nmd-return-market-slug';
const DEFAULT_MARKET_SLUG = 'dabburiyya';

export type HeaderVariant = 'store' | 'marketplace';

export interface HeaderProps {
  variant?: HeaderVariant;
  marketName?: string;
  marketSlug?: string;
}

export function Header({ variant = 'store', marketName: marketNameProp, marketSlug: marketSlugProp }: HeaderProps = {}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [returnMarketSlug, setReturnMarketSlug] = useState<string | null>(() =>
    typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(RETURN_MARKET_KEY) : null
  );
  const { tenantSlug } = useParams<{ tenantSlug?: string }>();

  useEffect(() => {
    const slug = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(RETURN_MARKET_KEY) : null;
    setReturnMarketSlug(slug);
  }, [tenantSlug]);
  const tenantId = useAppStore((s) => s.tenantId) ?? '';
  const tenantName = useAppStore((s) => s.tenantName);
  const layoutStyle = useLayoutStyle();
  const tenantKey = tenantSlug ?? tenantId ?? '';
  const isMarketplace = variant === 'marketplace';
  const { data: tenant } = useQuery({
    queryKey: ['tenant', tenantKey],
    queryFn: () => api.getTenant(tenantKey),
    enabled: !!tenantKey,
    staleTime: 0,
  });
  const storeType = useAppStore((s) => s.storeType);
  const { customer } = useCustomerAuth();
  const { openAuthModal } = useGlobalAuthModal();

  const handleLogout = () => {
    localStorage.removeItem('nmd-customer-token');
    window.location.reload();
  };

  const { data: catalog } = useQuery({
    queryKey: ['catalog', tenantKey],
    queryFn: () => api.getCatalogApi(tenantKey),
    enabled: !!tenantKey && USE_API,
  });
  const mainCategories = useMemo(() => {
    const cats = catalog?.categories ?? [];
    return cats.filter((c: { parentId?: string | null }) => !c.parentId || c.parentId === '');
  }, [catalog?.categories]);

  const count = useCartStore((s) => {
    const items = s.getItems(tenantId);
    return items.reduce((sum, i) => sum + i.quantity, 0);
  });
  const showCart = !isMarketplace && storeType !== 'PROFESSIONAL';
  const basePath = isMarketplace && marketSlugProp ? `/${marketSlugProp}` : (tenant?.slug ? `/${tenant.slug}` : '/');
  const slugOrId = tenant?.slug ?? tenantSlug ?? tenantId;
  const centerLabel = isMarketplace ? (marketNameProp ?? 'السوق') : (tenant?.name ?? tenantName ?? 'Store');
  const centerLogoUrl = isMarketplace ? undefined : tenant?.branding?.logoUrl;

  const { data: tenantsData } = useQuery({
    queryKey: ['tenants-mall'],
    queryFn: () => getTenantListForMallAsync('dabburiyya'),
    enabled: USE_API,
  });
  const tenants = useMemo(
    () => (USE_API ? (tenantsData ?? []).map((t: { id: string; slug: string; name: string }) => ({ id: t.id, slug: t.slug, name: t.name })) : []),
    [USE_API, tenantsData]
  );

  const headerBarClass = isMarketplace
    ? 'bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm'
    : layoutHeaderClass(layoutStyle);

  return (
    <header className={`sticky top-0 z-40 ${headerBarClass} pt-[env(safe-area-inset-top)]`}>
      {/* Row: [Menu + Search + User + Cart] | Logo (center) | Back to Market (store only, left) */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 order-1">
          <div className="flex items-center w-10 h-10 shrink-0 justify-center">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="p-2 rounded-lg hover:bg-black/5 transition-colors"
              aria-label="القائمة"
              aria-expanded={menuOpen}
            >
              <Menu className="w-6 h-6 text-gray-700" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setSearchExpanded((e) => !e)}
            className="p-2 rounded-lg hover:bg-black/5 transition-colors"
            aria-label="بحث"
          >
            <Search className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" />
          </button>
          <button
            type="button"
            onClick={() => { setMenuOpen(false); openAuthModal(); }}
            className="p-2 rounded-lg hover:bg-black/5 transition-colors"
            aria-label={customer ? 'الحساب' : 'دخول'}
          >
            <User className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" />
          </button>
          {showCart && (
            <Link to={`${basePath}/cart`} className="relative p-2 rounded-lg hover:bg-black/5 transition-colors" aria-label={`السلة ${count} منتج`}>
              <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" />
              {count > 0 && (
                <span className="absolute top-0.5 end-0.5 bg-primary text-white text-[10px] min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </Link>
          )}
          <TenantSwitcher
            tenants={tenants}
            currentTenant={slugOrId}
            onSelect={(slug) => { persistTenant(slug); window.location.href = `/${slug}`; }}
            visible={import.meta.env.DEV}
          />
        </div>

        <Link to={basePath} className="flex items-center justify-center min-w-0 flex-1 mx-2 order-2 overflow-hidden" onClick={() => setMenuOpen(false)}>
          <span className="flex items-center justify-center max-h-[48px] w-full min-w-0">
            {centerLogoUrl ? (
              <img src={centerLogoUrl} alt={centerLabel} loading="lazy" decoding="async" className="max-h-[48px] w-auto max-w-[180px] object-contain" />
            ) : (
              <span className="font-bold text-base sm:text-lg text-primary truncate max-w-[140px] sm:max-w-[220px]">{centerLabel}</span>
            )}
          </span>
        </Link>

        <div className="flex items-center justify-end shrink-0 order-3 min-w-0">
          {!isMarketplace && (returnMarketSlug || DEFAULT_MARKET_SLUG) && (
            <Link
              to={`/${returnMarketSlug ?? DEFAULT_MARKET_SLUG}`}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 transition-colors border border-gray-300 shadow-sm hover:border-gray-400 font-medium"
              aria-label="العودة للسوق"
            >
              <Store className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-primary" aria-hidden />
              <span className="hidden sm:inline text-sm">العودة للسوق</span>
              <span className="sm:hidden text-sm">السوق</span>
            </Link>
          )}
        </div>
      </div>

      {/* Row 2: Search bar (when expanded) */}
      {searchExpanded && (
        <div className="border-t border-gray-100 bg-gray-50/80 px-4 sm:px-6 py-2">
          <div className="max-w-6xl mx-auto relative">
            <Search className="absolute top-1/2 -translate-y-1/2 end-3 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="search"
              placeholder={isMarketplace ? 'بحث في السوق...' : 'بحث في المتجر...'}
              autoFocus
              className="w-full h-10 pe-10 ps-4 rounded-xl border border-gray-200 bg-white text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
      )}

      {/* Side menu: Categories + Login/Register or Logout */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 pt-[calc(4rem+env(safe-area-inset-top))]" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <div className="fixed top-0 end-0 z-50 w-full max-w-[280px] h-full bg-white shadow-xl pt-[env(safe-area-inset-top)] flex flex-col" role="dialog" aria-label="القائمة">
            <div className="flex items-center justify-between px-4 h-14 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-700">القائمة</span>
              <button type="button" onClick={() => setMenuOpen(false)} className="p-2 rounded-lg hover:bg-gray-100" aria-label="إغلاق">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-auto py-2">
              {isMarketplace ? (
                <ul className="space-y-0.5">
                  <li>
                    <Link to="/" onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50">
                      الأسواق
                    </Link>
                  </li>
                  {marketSlugProp && (
                    <li>
                      <Link to={`/${marketSlugProp}/stores`} onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50">
                        المحلات
                      </Link>
                    </li>
                  )}
                  <li>
                    <Link to={basePath} onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50">
                      الرئيسية
                    </Link>
                  </li>
                </ul>
              ) : (
                <>
                  <div className="px-3 py-1 text-xs font-medium text-gray-500 uppercase tracking-wide">التصنيفات</div>
                  {mainCategories.length > 0 ? (
                <ul className="space-y-0.5">
                  <li>
                    <Link to={basePath} onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50">
                      الرئيسية
                    </Link>
                  </li>
                  {mainCategories.map((cat: { id: string; name: string }) => (
                    <li key={cat.id}>
                      <Link to={`${basePath}/c/${cat.id}`} onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50">
                        {cat.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                    <Link to={basePath} onClick={() => setMenuOpen(false)} className="block px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
                      الرئيسية
                    </Link>
                  )}
                </>
              )}
              {customer && (
                <div className="border-t border-gray-100 pt-2 mt-2">
                  <Link
                    to={isMarketplace ? `/my-activity` : `/${tenant?.slug ?? tenantSlugOrId}/my-activity`}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
                  >
                    <Bell className="w-5 h-5 text-primary" />
                    تفعيل التنبيهات
                  </Link>
                </div>
              )}
            </nav>
            <div className="border-t border-gray-100 p-4 space-y-2">
              {customer ? (
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); handleLogout(); }}
                  className="w-full py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  تسجيل الخروج
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); openAuthModal(); }}
                  className="w-full py-2.5 rounded-lg text-sm font-medium text-primary hover:bg-primary/10"
                >
                  دخول / إنشاء حساب
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
}