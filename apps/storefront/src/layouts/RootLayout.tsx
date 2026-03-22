import { Outlet } from 'react-router-dom';
import { GlobalAppHeader, GLOBAL_HEADER_HEIGHT } from '../components/GlobalHeader';
import { AndroidHeader, ANDROID_HEADER_HEIGHT } from '../components/AndroidHeader';
import { NowMarketBottomNav, NOW_BOTTOM_NAV_HEIGHT } from '../components/NowMarketBottomNav';
import { FloatingLuckyWheelFab } from '../components/FloatingLuckyWheelFab';
import { BottomNavProvider } from '../contexts/BottomNavContext';
import { isAndroidOrMobileApp, isPwaOrWebMobile } from '../lib/platform';
import { FloatingCartBar } from '../components/cart/FloatingCartBar';

/**
 * Root layout for ALL routes (Landing, Market, Stores).
 * Web: GlobalAppHeader. Android/Mobile app: AndroidHeader.
 * PWA/Web-Mobile: NowMarketBottomNav (Home | Offers | My Orders | Account).
 */
export default function RootLayout() {
  const useAndroidHeader = isAndroidOrMobileApp();
  const showBottomNav = isPwaOrWebMobile();
  const headerHeight = useAndroidHeader ? ANDROID_HEADER_HEIGHT : GLOBAL_HEADER_HEIGHT;

  return (
    <BottomNavProvider visible={showBottomNav} height={NOW_BOTTOM_NAV_HEIGHT}>
      <div className="min-h-screen flex flex-col bg-white overflow-x-hidden w-full p-0 m-0" style={{ width: '100%', margin: 0, padding: 0 }}>
        {useAndroidHeader ? <AndroidHeader /> : <GlobalAppHeader />}
        <main
          className="flex-1 flex flex-col min-w-0 min-h-0 overflow-visible"
          style={{
            paddingTop: `calc(var(--global-header-height, ${headerHeight}px) + env(safe-area-inset-top, 0px))`,
            paddingBottom: showBottomNav ? `calc(${NOW_BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))` : undefined,
          }}
        >
          <Outlet />
        </main>
        {showBottomNav && <NowMarketBottomNav />}
        <FloatingLuckyWheelFab />
        <FloatingCartBar />
      </div>
    </BottomNavProvider>
  );
}
