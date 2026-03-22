import { Outlet, useLocation } from 'react-router-dom';
import { CartBar } from '../components/CartBar';
import { ProfessionalBar } from '../components/ProfessionalBar';
import { TrustBar } from '../components/TrustBar';
import { Footer } from '../components/Footer';
import { useAppStore } from '../store/app';
import { useNativeBridge } from '../contexts/NativeBridgeContext';

export default function Layout() {
  const { pathname } = useLocation();
  const storeType = useAppStore((s) => s.storeType);
  const { isNativeApp } = useNativeBridge();
  const isCartOrCheckout = pathname.endsWith('/cart') || pathname.endsWith('/checkout');
  const isProfessional = storeType === 'PROFESSIONAL';
  const mainPb = isNativeApp
    ? 'pb-0'
    : isProfessional
      ? 'pb-[var(--professional-bar-height)]'
      : 'pb-[var(--cart-bar-height)]';

  return (
    <div className="min-h-screen flex flex-col bg-[#ffffff] overflow-x-hidden p-0 m-0 w-full">
      <div className={isCartOrCheckout ? 'hidden md:block' : undefined}>
        <TrustBar />
      </div>
      <main className={`flex-1 pt-0 overflow-visible ${mainPb} md:pb-0`}>
        <Outlet />
      </main>
      <Footer />
      {typeof navigator !== 'undefined' && !navigator.userAgent.includes('NMDCustomerApp') && (isProfessional ? <ProfessionalBar /> : <CartBar />)}
    </div>
  );
}
