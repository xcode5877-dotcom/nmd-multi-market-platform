import { motion } from 'framer-motion';
import { Activity, PackageSearch } from 'lucide-react';
import { useBottomNav } from '../contexts/BottomNavContext';
import type { PublicOrderForTracking } from './OrderTrackingSheet';

export interface OrderTrackingFloatingProps {
  order: PublicOrderForTracking | null;
  onClick: () => void;
}

const SAFE_MARGIN = 16;

/** Premium pill-shaped banner: sits above bottom nav and FAB with safe-area margin. */
export function OrderTrackingFloating({ order, onClick }: OrderTrackingFloatingProps) {
  const { visible: bottomNavVisible, height: bottomNavHeight } = useBottomNav();

  if (!order) return null;

  // Live hub should only be visible for "alive" orders.
  const status = order.status ?? '';
  if (['DELIVERED', 'COMPLETED', 'CANCELLED', 'CANCELED'].includes(status)) return null;

  const isDelivery = order.fulfillmentType === 'DELIVERY';
  const liveStatusText = (() => {
    if (['PENDING', 'CONFIRMED'].includes(status)) return 'تم استلام الطلب';
    if (status === 'PREPARING') return 'جاري التحضير';
    if (['READY', 'OUT_FOR_DELIVERY'].includes(status)) return isDelivery ? 'جاري التوصيل' : 'جاهز للاستلام';
    return isDelivery ? 'جاري التوصيل' : 'قريباً جاهز';
  })();

  const bottomOffset = bottomNavVisible
    ? `calc(${bottomNavHeight}px + ${SAFE_MARGIN}px + env(safe-area-inset-bottom, 0px))`
    : 'calc(var(--cart-bar-height, 0px) + 1.1rem)';

  return (
    <motion.button
      type="button"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      onClick={onClick}
      className="fixed z-[9995] left-4 right-4 rounded-full select-none touch-manipulation backdrop-blur-md text-white border border-white/20"
      style={{
        bottom: bottomOffset,
        backgroundColor: 'rgba(15,118,110,0.92)',
        paddingTop: '0.6rem',
        paddingBottom: '0.6rem',
        paddingLeft: '1rem',
        paddingRight: '1rem',
        boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 -4px 20px rgba(0,0,0,0.06)',
      }}
      aria-label="عرض تفاصيل تتبع الطلب"
    >
      <motion.div
        className="flex items-center justify-between gap-3"
        initial={false}
        animate={{ y: [0, -2, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Right side: Pulse + order id + live status */}
        <div className="flex items-center gap-3 min-w-0" dir="rtl">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-white/10 border border-white/20">
            <motion.span
              className="absolute inset-0 rounded-full border border-white/30 pointer-events-none"
              animate={{ scale: [1, 1.3, 1.3], opacity: [0.55, 0, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
              aria-hidden
            />
            <span className="relative text-white">
              <Activity className="w-5 h-5" strokeWidth={2} />
            </span>
          </div>

          <div className="min-w-0">
            <div className="text-xs font-medium text-white/80 truncate" dir="ltr">
              #{order.id.slice(0, 8)}
            </div>
            <div className="text-sm font-semibold text-white truncate">{liveStatusText}</div>
          </div>
        </div>

        {/* Left side: subtle tracker icon */}
        <div className="flex items-center justify-end">
          <span className="relative w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
            <PackageSearch className="w-5 h-5 text-white" strokeWidth={2} />
          </span>
        </div>
      </motion.div>
    </motion.button>
  );
}
