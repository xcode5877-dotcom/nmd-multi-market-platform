import { useState, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ShoppingCart, Search, User } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { MockApiClient, getTenantListForMallAsync } from '@nmd/mock';
import { TenantSwitcher, useLayoutStyle, layoutHeaderClass } from '@nmd/ui';
import { useAppStore } from '../store/app';
import { useCartStore } from '../store/cart';
import { persistTenant } from '../lib/tenant';
import { StatusBadge } from './StatusBadge';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import { useGlobalAuthModal } from '../contexts/GlobalAuthModalContext';

const api = new MockApiClient();
const USE_API = !!import.meta.env.VITE_MOCK_API_URL;

export function Header() {
  const [searchFocused, setSearchFocused] = useState(false);
  const { tenantSlug } = useParams<{ tenantSlug?: string }>();
  const tenantId = useAppStore((s) => s.tenantId) ?? '';
  const tenantName = useAppStore((s) => s.tenantName);
  const layoutStyle = useLayoutStyle();
  /** Use slug from URL when on tenant route so we share cache with TenantGate; fallback to tenantId */
  const tenantKey = tenantSlug ?? tenantId ?? '';
  const { data: tenant } = useQuery({
    queryKey: ['tenant', tenantKey],
    queryFn: () => api.getTenant(tenantKey),
    enabled: !!tenantKey,
    staleTime: 0,
  });
  const storeType = useAppStore((s) => s.storeType);
  const { customer } = useCustomerAuth();
  const { openAuthModal } = useGlobalAuthModal();
  const count = useCartStore((s) => {
    const items = s.getItems(tenantId);
    return items.reduce((sum, i) => sum + i.quantity, 0);
  });
  const showCart = storeType !== 'PROFESSIONAL';
  const { data: tenantsData } = useQuery({
    queryKey: ['tenants-mall'],
    queryFn: () => getTenantListForMallAsync('dabburiyya'),
    enabled: USE_API,
  });
  const tenants = useMemo(
    () => (USE_API ? (tenantsData ?? []).map((t) => ({ id: t.id, slug: t.slug, name: t.name })) : []),
    [USE_API, tenantsData]
  );

  return (
    <header className={`sticky top-0 z-40 ${layoutHeaderClass(layoutStyle)}`}>
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-shrink">
          {tenant?.slug && (
            <Link to="/" className="text-sm font-medium text-gray-500 hover:text-primary transition-colors shrink-0">
              السوق
            </Link>
          )}
          {tenant?.slug && <span className="text-gray-300">|</span>}
          <Link to={tenant?.slug ? `/${tenant.slug}` : '/'} className="flex items-center gap-2 min-w-0 flex-shrink">
          {tenant?.branding.logoUrl ? (
            <img src={tenant.branding.logoUrl} alt={tenant.name} className="h-8 shrink-0" />
          ) : (
            <span className="font-bold text-lg text-primary truncate max-w-[120px] sm:max-w-none">{tenant?.name ?? tenantName ?? 'Store'}</span>
          )}
          {tenant && <StatusBadge tenant={tenant} variant="header" />}
          </Link>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <div className={`relative overflow-hidden transition-all ${searchFocused ? 'w-28 sm:w-44' : 'w-24'}`}>
            <Search className="absolute top-1/2 -translate-y-1/2 end-2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="search"
              placeholder="بحث..."
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="w-full h-9 pe-9 ps-3 rounded-lg border border-gray-200 bg-gray-50 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:bg-white"
            />
          </div>
          <TenantSwitcher
            tenants={tenants}
            currentTenant={tenant?.slug ?? tenantSlug ?? tenantId}
            onSelect={(slug) => {
              persistTenant(slug);
              window.location.href = `/${slug}`;
            }}
            visible={import.meta.env.DEV}
          />
          {customer ? (
            <Link
              to={tenant?.slug ? `/${tenant.slug}/my-activity` : '/my-activity'}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <User className="w-5 h-5" />
              <span className="hidden sm:inline">حسابي</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              <User className="w-5 h-5" />
              <span className="hidden sm:inline">تسجيل الدخول</span>
            </button>
          )}
        {showCart && (
          <Link
            to={tenant?.slug ? `/${tenant.slug}/cart` : '/cart'}
            className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label={`Cart with ${count} items`}
          >
            <ShoppingCart className="w-6 h-6 text-gray-700" />
            {count > 0 && (
              <span className="absolute -top-1 -end-1 bg-primary text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {count}
              </span>
            )}
          </Link>
        )}
        </div>
      </div>
    </header>
  );
}
