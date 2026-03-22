import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CircleDot } from 'lucide-react';
import { useBottomNav } from '../contexts/BottomNavContext';
import { PLATFORM_BRANDING } from '@nmd/core';

/** Markets-only paths where the FAB is shown */
function isMarketsPage(pathname: string): boolean {
  const p = (pathname ?? '').replace(/^#/, '').trim() || '/';
  const first = p.split('/').filter(Boolean)[0] ?? '';
  if (!first || first === '') return true;
  return ['daburiyya', 'dabburiyya', 'iksal'].includes(first);
}

/** FAB: teal branding, responsive, above order-tracking banner & bottom nav */
export function FloatingLuckyWheelFab() {
  const { pathname } = useLocation();
  const { visible: bottomNavVisible, height: bottomNavHeight } = useBottomNav();

  if (!isMarketsPage(pathname)) return null;

  const bottomOffset = bottomNavVisible
    ? `calc(${bottomNavHeight}px + env(safe-area-inset-bottom, 0px) + 16px)`
    : 'calc(24px + env(safe-area-inset-bottom, 0px))';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="fixed z-[9996] flex-shrink-0 w-14 h-14 min-w-[56px] min-h-[56px]"
      style={{
        bottom: bottomOffset,
        insetInlineEnd: 'max(1rem, env(safe-area-inset-right, 16px))',
      }}
    >
      <Link
        to="/lucky-wheel"
        className="flex items-center justify-center w-full h-full rounded-full shadow-lg active:scale-95 transition-transform border-2 border-white/90 touch-manipulation"
        style={{
          backgroundColor: PLATFORM_BRANDING.primaryColor,
          boxShadow: '0 4px 14px rgba(15, 118, 110, 0.4), 0 0 0 2px rgba(10, 10, 10, 0.08)',
        }}
        aria-label="العجلة المحظوظة"
      >
        <CircleDot className="w-7 h-7 text-white" strokeWidth={2.5} />
      </Link>
    </motion.div>
  );
}
