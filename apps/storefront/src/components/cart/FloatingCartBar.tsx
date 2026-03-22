import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { formatPrice } from '@nmd/core';
import { useAppStore } from '../../store/app';
import { useCartStore, ADDITIONAL_STORE_DELIVERY_FEE_NIS } from '../../store/cart';

function getCartPath(tenantSlug: string, tenantIdsInCart: string[]): string {
  const firstTenantInCart = tenantIdsInCart[0];
  if (tenantSlug) return `/${tenantSlug}/cart`;
  if (firstTenantInCart) return `/${firstTenantInCart}/cart`;
  return '/';
}

/** Paths where FloatingCartBar must NEVER show (cart flow, market picker, platform routes). */
function isHiddenPath(pathname: string): boolean {
  if (pathname === '/' || pathname === '') return true;
  if (pathname.endsWith('/cart')) return true;
  if (pathname.endsWith('/checkout')) return true;
  if (pathname.includes('/order/') && pathname.endsWith('/success')) return true;
  return false;
}

/** True only when on a tenant store or product page (not market, not platform). */
function isStoreOrProductPage(pathname: string): boolean {
  const path = (pathname ?? '').replace(/^#/, '').trim() || '/';
  const segments = path.split('/').filter(Boolean);
  const first = segments[0] ?? '';
  const excluded = ['daburiyya', 'dabburiyya', 'iksal', 'my-account', 'my-activity', 'order', 'merchant', 'p', 'categories'];
  return segments.length >= 1 && !!first && !excluded.includes(first) && !path.endsWith('/cart') && !path.endsWith('/checkout');
}

export function FloatingCartBar() {
  const { pathname } = useLocation();
  const tenantSlug = useAppStore((s) => s.tenantSlug ?? s.tenantId ?? '');

  const carts = useCartStore((s) => s.carts);
  const lastAddTimestamp = useCartStore((s) => s.lastAddTimestamp);

  const tenantIds = Object.keys(carts).filter((id) => (carts[id]?.length ?? 0) > 0);
  const count = tenantIds.reduce((sum, tid) => sum + (carts[tid] ?? []).reduce((s, i) => s + i.quantity, 0), 0);

  const storeCount = tenantIds.length;
  const itemsTotal = tenantIds.reduce(
    (sum, tid) => sum + (carts[tid] ?? []).reduce((s, i) => s + i.totalPrice, 0),
    0
  );
  const multiStoreFee = storeCount > 1 ? (storeCount - 1) * ADDITIONAL_STORE_DELIVERY_FEE_NIS : 0;
  const total = itemsTotal + multiStoreFee;

  // Only show on store/product pages: native app uses this (Layout has no CartBar); web uses CartBar from layouts.
  const isNativeApp = typeof navigator !== 'undefined' && navigator.userAgent.includes('NMDCustomerApp');
  const showBar =
    count > 0 &&
    !isHiddenPath(pathname) &&
    isStoreOrProductPage(pathname) &&
    isNativeApp;

  const [playPop, setPlayPop] = useState(false);
  const prevTimestampRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!showBar) return;
    if (lastAddTimestamp != null && lastAddTimestamp !== prevTimestampRef.current) {
      prevTimestampRef.current = lastAddTimestamp;
      setPlayPop(true);
      const t = window.setTimeout(() => setPlayPop(false), 350);
      return () => window.clearTimeout(t);
    }
  }, [lastAddTimestamp, showBar]);

  const cartPath = getCartPath(tenantSlug, tenantIds);

  // Native app has its own in-app nav bar; we want to float above it.
  const bottomOffset = isNativeApp ? 'calc(var(--nmd-app-bar-height, 100px) + 8px)' : 'var(--cart-bar-height)';

  return (
    <>
      <AnimatePresence mode="wait">
        {showBar && (
          <motion.div
            key="floating-cart-bar"
            initial={{ y: 28, opacity: 0 }}
            animate={{
              y: playPop ? -6 : 0,
              opacity: 1,
              scale: playPop ? 1.02 : 1,
            }}
            exit={{ y: 28, opacity: 0, transition: { duration: 0.2, ease: 'easeIn' } }}
            transition={{
              y: { type: 'spring', damping: 24, stiffness: 280 },
              opacity: { duration: 0.2 },
              scale: { duration: 0.25, ease: 'easeOut' },
            }}
            className="fixed md:hidden left-4 right-4 z-[9998] rounded-2xl overflow-hidden bg-white/80 backdrop-blur-lg border-t border-white/20 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]"
            style={{
              bottom: bottomOffset,
              paddingTop: '0.65rem',
              paddingBottom: 'max(0.65rem, env(safe-area-inset-bottom, 0px))',
            }}
            dir="rtl"
          >
            <div className="flex items-center gap-3 px-4" style={{ minHeight: '3.25rem' }}>
              {/* Right: item count */}
              <div className="flex-1 flex flex-col items-end gap-0.5 min-w-0">
                <span className="text-xs text-neutral-500 truncate w-full text-end">{`لديك ${count} منتجات`}</span>
              </div>

              {/* Middle: total price */}
              <div className="flex-1 flex items-center justify-center">
                <span className="text-lg font-semibold text-gray-900">{formatPrice(total)}</span>
              </div>

              {/* Left: view cart */}
              <div className="flex-1 flex items-center justify-end">
                <Link
                  to={cartPath}
                  className="flex items-center justify-center gap-2 h-12 px-4 rounded-xl bg-primary text-white font-medium text-base hover:opacity-90 active:opacity-95 transition-opacity cursor-pointer"
                  aria-label="عرض السلة"
                >
                  <span>عرض السلة</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reserve space so content isn't covered by the fixed bar */}
      {showBar && <div className="md:hidden" style={{ height: 84 }} aria-hidden />}
    </>
  );
}

