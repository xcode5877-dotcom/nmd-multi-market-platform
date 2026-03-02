import { Outlet, useLocation } from 'react-router-dom';
import { Header } from '../components/Header';
import { CartBar } from '../components/CartBar';
import { ProfessionalBar } from '../components/ProfessionalBar';
import { TrustBar } from '../components/TrustBar';
import { Footer } from '../components/Footer';
import { useAppStore } from '../store/app';

export default function Layout() {
  const { pathname } = useLocation();
  const storeType = useAppStore((s) => s.storeType);
  const isCartOrCheckout = pathname.endsWith('/cart') || pathname.endsWith('/checkout');
  const isProfessional = storeType === 'PROFESSIONAL';
  const mainPb = isProfessional ? 'pb-[var(--professional-bar-height)]' : 'pb-[var(--cart-bar-height)]';

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 overflow-x-hidden">
      <Header />
      <div className={isCartOrCheckout ? 'hidden md:block' : undefined}>
        <TrustBar />
      </div>
      <main className={`flex-1 ${mainPb} md:pb-0`}>
        <Outlet />
      </main>
      <Footer />
      {isProfessional ? <ProfessionalBar /> : <CartBar />}
    </div>
  );
}
