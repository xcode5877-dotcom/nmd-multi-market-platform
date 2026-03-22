import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { CartBar } from '../components/CartBar';
import { AndroidFloatingCartBar } from '../components/AndroidFloatingCartBar';
import { isAndroidOrMobileApp } from '../lib/platform';

const ANNOUNCEMENT_KEY = 'nmd-announcement-closed';

export default function LandingLayout() {
  const { pathname } = useLocation();
  const [announcementClosed, setAnnouncementClosed] = useState(false);
  const isMarketsPicker = pathname === '/' || pathname === '';
  const isLuckyWheel = pathname.includes('lucky-wheel');

  useEffect(() => {
    if (localStorage.getItem(ANNOUNCEMENT_KEY) === '1') setAnnouncementClosed(true);
  }, []);

  const closeAnnouncement = () => {
    setAnnouncementClosed(true);
    localStorage.setItem(ANNOUNCEMENT_KEY, '1');
  };

  const isAndroid = isAndroidOrMobileApp();
  return (
    <div
      className="flex flex-col overflow-x-hidden overflow-y-visible min-h-screen p-0 m-0 w-full bg-[#ffffff]"
    >
      {!announcementClosed && (
        <div className="shrink-0 flex items-center justify-center gap-2 py-2 px-4 rounded-b-full mx-4 mb-2" style={{ backgroundColor: 'rgba(15,118,110,0.12)', borderBottom: '1px solid rgba(15,118,110,0.2)' }}>
          <span className="text-sm font-medium" style={{ color: '#0a0a0a' }}>السوق في مرحلته التجريبية</span>
          <button type="button" onClick={closeAnnouncement} className="p-1 rounded-full hover:bg-white/50 transition-colors" aria-label="إغلاق">
            <X className="w-4 h-4" style={{ color: '#0f766e' }} />
          </button>
        </div>
      )}
      <main
        className={
          isAndroid
            ? 'flex-1 min-h-0 flex flex-col pb-20 overflow-visible'
            : `flex-1 min-h-0 flex flex-col overflow-visible ${
                typeof navigator !== 'undefined' && navigator.userAgent.includes('NMDCustomerApp')
                  ? 'pb-0'
                  : 'pb-[var(--cart-bar-height)] md:pb-0'
              }`
        }
      >
        {isAndroid ? (
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="w-full max-w-screen-xl mx-auto p-0 m-0 flex-1 flex flex-col min-h-0"
            style={{ width: '100%', margin: 0 }}
          >
            <Outlet />
          </motion.div>
        ) : isLuckyWheel ? (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-[#ffffff]">
            <Outlet />
          </div>
        ) : (
          <Outlet />
        )}
      </main>
      {isAndroidOrMobileApp() ? (
        <AndroidFloatingCartBar />
      ) : (
        typeof navigator !== 'undefined' && !navigator.userAgent.includes('NMDCustomerApp') && <CartBar />
      )}
      {!isMarketsPicker && !isLuckyWheel && (
        <footer className="bg-[#1E293B] text-gray-400 py-10 mt-auto">
          <div className="max-w-6xl mx-auto px-4 text-center">
            <Link to="/" className="hover:text-white">الأسواق</Link>
            <p className="mt-4 text-sm">© NMD Markets</p>
          </div>
        </footer>
      )}
    </div>
  );
}
