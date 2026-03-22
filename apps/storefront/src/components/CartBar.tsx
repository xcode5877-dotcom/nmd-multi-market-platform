import { useEffect, useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { formatPrice } from '@nmd/core';
import { useAppStore } from '../store/app';
import { useCartStore, ADDITIONAL_STORE_DELIVERY_FEE_NIS } from '../store/cart';
import { useBottomNav } from '../contexts/BottomNavContext';
import { isAndroidOrMobileApp } from '../lib/platform';

function isHiddenPath(pathname: string): boolean {
  if (pathname.endsWith('/cart') || pathname.endsWith('/checkout')) return true;
  if (pathname.includes('/order/') && pathname.endsWith('/success')) return true;
  return false;
}

/** True when on market picker, market home/stores, or other platform routes (not a tenant store). */
function isPlatformOrMarketRoute(pathname: string): boolean {
  const first = pathname.split('/').filter(Boolean)[0] ?? '';
  return !first || ['daburiyya', 'dabburiyya', 'iksal', 'order', 'merchant', 'my-activity', 'my-account', 'p', 'categories'].includes(first);
}

/** Show CartBar ONLY on tenant store and product pages (not market, cart, checkout). */
function shouldShowCartBar(pathname: string): boolean {
  if (isHiddenPath(pathname)) return false;
  if (isPlatformOrMarketRoute(pathname)) return false;
  return true;
}

export function CartBar() {
  const { pathname } = useLocation();
  const storeType = useAppStore((s) => s.storeType);
  const tenantSlug = useAppStore((s) => s.tenantSlug ?? s.tenantId ?? '');
  const carts = useCartStore((s) => s.carts);
  const lastAddTimestamp = useCartStore((s) => s.lastAddTimestamp);

  const [pulse, setPulse] = useState(false);
  const prevTimestampRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (lastAddTimestamp != null && lastAddTimestamp !== prevTimestampRef.current) {
      prevTimestampRef.current = lastAddTimestamp;
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 500);
      return () => clearTimeout(t);
    }
  }, [lastAddTimestamp]);

  const tenantIds = Object.keys(carts).filter((id) => (carts[id]?.length ?? 0) > 0);
  const storeCount = tenantIds.length;
  const itemsTotal = tenantIds.reduce(
    (sum, tid) => sum + (carts[tid] ?? []).reduce((s, i) => s + i.totalPrice, 0),
    0
  );
  const multiStoreFee = storeCount > 1 ? (storeCount - 1) * ADDITIONAL_STORE_DELIVERY_FEE_NIS : 0;
  const total = itemsTotal + multiStoreFee;
  const count = tenantIds.reduce((sum, tid) => sum + (carts[tid] ?? []).reduce((s, i) => s + i.quantity, 0), 0);

  const hideForProfessional = storeType === 'PROFESSIONAL' && !isPlatformOrMarketRoute(pathname);
  const isMarketPicker = pathname === '/' || pathname === '';
  const showEmptyOnPicker = isAndroidOrMobileApp() && isMarketPicker && count === 0;
  if (hideForProfessional || !shouldShowCartBar(pathname)) return null;
  if (count === 0 && !showEmptyOnPicker) return null;

  const firstTenantInCart = tenantIds[0];
  const cartPath = tenantSlug ? `/${tenantSlug}/cart` : firstTenantInCart ? `/${firstTenantInCart}/cart` : '/';

  const { visible: bottomNavVisible, height: bottomNavHeight } = useBottomNav();
  const bottomOffset = bottomNavVisible
    ? `calc(${bottomNavHeight}px + env(safe-area-inset-bottom, 0px))`
    : '0';

  return (
    <>
      <div
        className="md:hidden"
        style={{ height: bottomNavVisible ? `calc(5rem + ${bottomNavHeight}px + env(safe-area-inset-bottom, 0px))` : 'var(--cart-bar-height)' }}
        aria-hidden
      />
      <div
        className={`md:hidden fixed start-0 end-0 z-50 rounded-t-2xl bg-white/95 backdrop-blur-md border-t border-neutral-200 shadow-sm transition-shadow ${pulse ? 'animate-pulse-once' : ''}`}
        style={{
          bottom: bottomOffset,
          paddingTop: '0.75rem',
          paddingBottom: '0.75rem',
        }}
        dir="rtl"
      >
        <Link
          to={cartPath}
          className="flex items-center justify-between gap-4 px-4 min-h-[3rem]"
          aria-label="سلة التسوق"
        >
          <div className="flex flex-col items-end gap-0.5 min-w-0 flex-1">
            <span className="text-xs text-neutral-500 truncate w-full text-end">سلة التسوق</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-gray-900">
                {count === 0 ? '—' : formatPrice(total)}
              </span>
              <span className="text-xs font-medium text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
                {count} قطعة
              </span>
            </div>
          </div>
          <span className="flex items-center justify-center h-12 min-w-[7rem] px-6 rounded-full bg-primary text-white font-bold text-base shrink-0">
            عرض السلة
          </span>
        </Link>
      </div>
    </>
  );
}
