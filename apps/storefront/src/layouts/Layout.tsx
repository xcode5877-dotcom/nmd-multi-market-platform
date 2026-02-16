import { Outlet } from 'react-router-dom';
import { Header } from '../components/Header';
import { CartBar } from '../components/CartBar';
import { TrustBar } from '../components/TrustBar';
import { Footer } from '../components/Footer';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <TrustBar />
      <main className="flex-1 pb-[var(--cart-bar-height)] md:pb-0">
        <Outlet />
      </main>
      <Footer />
      <CartBar />
    </div>
  );
}
