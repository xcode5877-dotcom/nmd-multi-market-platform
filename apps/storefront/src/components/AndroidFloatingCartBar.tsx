import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { formatPrice } from '@nmd/core';
import { useAppStore } from '../store/app';
import { useCartStore, ADDITIONAL_STORE_DELIVERY_FEE_NIS } from '../store/cart';

/**
 * Floating cart bar for Android app only. Shown ONLY on Store pages, Store Homepages, and Product pages (when totalItems > 0).
 * STRICTLY HIDDEN on: / (Market Picker), /cart, /checkout, /my-account, /my-activity, /categories.
 */
export function AndroidFloatingCartBar() {
  const { pathname } = useLocation();
  const tenantSlug = useAppStore((s) => s.tenantSlug ?? s.tenantId ?? '');
  const carts = useCartStore((s) => s.carts);
  const lastAddTimestamp = useCartStore((s) => s.lastAddTimestamp);
  const prevTimestampRef = useRef<number | undefined>(undefined);

  const tenantIds = Object.keys(carts).filter((id) => (carts[id]?.length ?? 0) > 0);
  const storeCount = tenantIds.length;
  const itemsTotal = tenantIds.reduce(
    (sum, tid) => sum + (carts[tid] ?? []).reduce((s, i) => s + i.totalPrice, 0),
    0
  );
  const multiStoreFee = storeCount > 1 ? (storeCount - 1) * ADDITIONAL_STORE_DELIVERY_FEE_NIS : 0;
  const total = itemsTotal + multiStoreFee;
  const count = tenantIds.reduce((sum, tid) => sum + (carts[tid] ?? []).reduce((s, i) => s + i.quantity, 0), 0);

  const firstTenantInCart = tenantIds[0];
  const cartPath = tenantSlug ? `/${tenantSlug}/cart` : firstTenantInCart ? `/${firstTenantInCart}/cart` : '/';

  const [playPop, setPlayPop] = useState(false);
  useEffect(() => {
    if (lastAddTimestamp != null && lastAddTimestamp !== prevTimestampRef.current) {
      prevTimestampRef.current = lastAddTimestamp;
      setPlayPop(true);
      const t = setTimeout(() => setPlayPop(false), 400);
      return () => clearTimeout(t);
    }
  }, [lastAddTimestamp]);

  const path = pathname?.replace(/^#/, '') || '/';
  const segments = path.split('/').filter(Boolean);
  const isHome = path === '/' || path === '';
  const isCart = path.endsWith('/cart');
  const isCheckout = path.endsWith('/checkout');
  const reservedFirst = ['my-account', 'my-activity', 'categories'];
  const firstSegment = segments[0];
  const isStoreOrProductPage =
    !isHome &&
    segments.length >= 1 &&
    firstSegment != null &&
    !reservedFirst.includes(firstSegment) &&
    !isCart &&
    !isCheckout;
  const showBar = count > 0 && isStoreOrProductPage;

  return (
    <>
      <AnimatePresence mode="wait">
        {showBar && (
          <motion.div
            key="floating-cart-bar"
            initial={{ y: 100, opacity: 0 }}
            animate={{
              y: 0,
              opacity: 1,
              scale: playPop ? 1.08 : 1,
            }}
            exit={{ y: 100, opacity: 0, transition: { duration: 0.3, ease: 'easeIn' } }}
            transition={{
              y: { type: 'spring', damping: 24, stiffness: 300 },
              opacity: { duration: 0.25 },
              scale: { duration: 0.35, ease: 'easeOut' },
            }}
            className="fixed bottom-4 left-4 right-4 z-50 rounded-3xl overflow-hidden bg-white/80 backdrop-blur-2xl border-t"
            style={{
              borderTopWidth: 1,
              borderTopColor: 'rgba(15, 118, 110, 0.28)',
              paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))',
              WebkitBackdropFilter: 'blur(40px)',
              backdropFilter: 'blur(40px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
            }}
            dir="rtl"
          >
            <Link
              to={cartPath}
              className="flex items-center justify-between gap-4 px-4 py-3 min-h-[56px] active:opacity-90"
              aria-label="سلة التسوق"
            >
              <div className="flex flex-col items-end gap-0.5 min-w-0 flex-1">
                <span className="text-xs text-neutral-500 truncate w-full text-end">سلة التسوق</span>
                <div className="flex items-center gap-2">
                  <motion.span
                    className="text-lg font-semibold text-gray-900"
                    animate={{ opacity: [1, 0.85, 1] }}
                    transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                  >
                    {formatPrice(total)}
                  </motion.span>
                  <span className="text-xs font-medium text-neutral-600 bg-white border border-neutral-200 px-2 py-0.5 rounded-full">
                    {count} قطعة
                  </span>
                </div>
              </div>
              <span
                className="flex items-center justify-center h-11 min-w-[6.5rem] px-5 rounded-2xl font-medium text-base shrink-0 text-white"
                style={{ backgroundColor: 'var(--color-primary, #0f766e)' }}
              >
                عرض السلة
              </span>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
      {showBar && (
        <div
          className="h-[72px]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          aria-hidden
        />
      )}
    </>
  );
}
