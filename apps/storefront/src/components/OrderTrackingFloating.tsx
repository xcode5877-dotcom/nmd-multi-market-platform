import { motion } from 'framer-motion';
import { PackageSearch } from 'lucide-react';
import type { PublicOrderForTracking } from './OrderTrackingSheet';

export interface OrderTrackingFloatingProps {
  order: PublicOrderForTracking | null;
  onClick: () => void;
}

/** Premium FAB: w-16 glass circle, Lucide icon with primary glow, dual-pulse (fast inner + slow radar). */
export function OrderTrackingFloating({ order, onClick }: OrderTrackingFloatingProps) {
  if (!order) return null;

  return (
    <motion.button
      type="button"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      onClick={onClick}
      className="fixed z-[100] w-16 h-16 rounded-full flex items-center justify-center select-none touch-manipulation bottom-[calc(var(--cart-bar-height,0px)+1.25rem)] end-[1.25rem] bg-white/30 backdrop-blur-2xl border border-white/50 shadow-2xl"
      style={{
        boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(255,255,255,0.2), inset 0 1px 0 rgba(255,255,255,0.4)',
      }}
      aria-label="عرض تفاصيل تتبع الطلب"
    >
      {/* Slow outer radar wave */}
      <motion.span
        className="absolute inset-0 rounded-full border-2 border-primary/40 pointer-events-none"
        animate={{ scale: [1, 1.4, 1.4], opacity: [0.5, 0, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
        aria-hidden
      />
      {/* Fast inner pulse */}
      <motion.span
        className="absolute inset-0 rounded-full border-2 border-primary/60 pointer-events-none"
        animate={{ scale: [1, 1.12, 1], opacity: [0.7, 0.2, 0.7] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      />
      <span className="relative flex items-center justify-center text-primary" style={{ filter: 'drop-shadow(0 0 6px var(--color-primary))' }}>
        <PackageSearch className="w-8 h-8" strokeWidth={2} />
      </span>
    </motion.button>
  );
}
