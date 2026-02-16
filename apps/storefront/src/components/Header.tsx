import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingCart, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { MockApiClient, getTenantListForMallAsync } from '@nmd/mock';
import { TenantSwitcher, useLayoutStyle, layoutHeaderClass } from '@nmd/ui';
import { useAppStore } from '../store/app';
import { useCartStore } from '../store/cart';
import { persistTenant } from '../lib/tenant';

const api = new MockApiClient();
const USE_API = !!import.meta.env.VITE_MOCK_API_URL;

export function Header() {
  const [searchFocused, setSearchFocused] = useState(false);
  const tenantId = useAppStore((s) => s.tenantId) ?? '';
  const layoutStyle = useLayoutStyle();
  const { data: tenant } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => api.getTenant(tenantId),
    enabled: !!tenantId,
  });
  const count = useCartStore((s) => {
    const items = s.getItems(tenantId);
    return items.reduce((sum, i) => sum + i.quantity, 0);
  });
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
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link to={tenant?.slug ? `/${tenant.slug}` : '/'} className="flex items-center gap-2 flex-shrink-0">
          {tenant?.branding.logoUrl ? (
            <img src={tenant.branding.logoUrl} alt={tenant.name} className="h-8" />
          ) : (
            <span className="font-bold text-lg text-primary">{tenant?.name ?? 'Store'}</span>
          )}
        </Link>
        <div className="flex items-center gap-2">
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
            currentTenant={tenant?.slug ?? tenantId}
            onSelect={(slug) => {
              persistTenant(slug);
              window.location.href = `/${slug}`;
            }}
            visible={import.meta.env.DEV}
          />
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
        </div>
      </div>
    </header>
  );
}
