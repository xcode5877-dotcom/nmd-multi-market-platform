import { Outlet, useLocation } from 'react-router-dom';
import { Header } from '../components/Header';
import { CartBar } from '../components/CartBar';
import { TrustBar } from '../components/TrustBar';
import { Footer } from '../components/Footer';

export default function Layout() {
  const { pathname } = useLocation();
  const isCartOrCheckout = pathname.endsWith('/cart') || pathname.endsWith('/checkout');

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 overflow-x-hidden">
      <Header />
      <div className={isCartOrCheckout ? 'hidden md:block' : undefined}>
        <TrustBar />
      </div>
      <main className="flex-1 pb-[var(--cart-bar-height)] md:pb-0">
        <Outlet />
      </main>
      <Footer />
      <CartBar />
    </div>
  );
}
