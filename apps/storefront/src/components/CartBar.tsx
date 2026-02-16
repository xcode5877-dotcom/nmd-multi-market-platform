import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/app';
import { useCartStore } from '../store/cart';
import { formatPrice } from '@nmd/core';

export function CartBar() {
  const tenantId = useAppStore((s) => s.tenantId) ?? '';
  const tenantSlug = useAppStore((s) => s.tenantSlug) ?? tenantId;
  const count = useCartStore((s) =>
    (s.getItems(tenantId) ?? []).reduce((sum, i) => sum + i.quantity, 0)
  );
  const total = useCartStore((s) =>
    (s.getItems(tenantId) ?? []).reduce((sum, i) => sum + i.totalPrice, 0)
  );
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

  if (count === 0) return null;

  return (
    <>
      {/* Spacer: prevents content from being hidden behind fixed bar */}
      <div
        className="md:hidden"
        style={{ height: 'var(--cart-bar-height)' }}
        aria-hidden
      />
      <div
        className={`md:hidden fixed bottom-0 start-0 end-0 z-40 bg-white/95 backdrop-blur-md border-t border-neutral-200 shadow-[0_-1px_3px_rgba(0,0,0,0.06)] transition-shadow ${pulse ? 'animate-pulse-once' : ''}`}
        style={{
          paddingTop: '0.75rem',
          paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
        }}
        dir="rtl"
      >
        <Link
          to={tenantSlug ? `/${tenantSlug}/cart` : '/cart'}
          className="flex items-center justify-between gap-4 px-4 min-h-[3rem]"
        >
          {/* Right: Total label + price + count badge */}
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-xs text-neutral-500">المجموع</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-gray-900">
                {formatPrice(total)}
              </span>
              <span className="text-xs font-medium text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
                {count} قطعة
              </span>
            </div>
          </div>

          {/* Left: CTA button */}
          <span className="flex items-center justify-center h-12 min-w-[7rem] px-6 rounded-xl bg-primary text-white font-medium text-base hover:opacity-90 active:opacity-95 transition-opacity">
            عرض السلة
          </span>
        </Link>
      </div>
    </>
  );
}
