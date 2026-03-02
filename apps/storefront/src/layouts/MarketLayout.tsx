import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import { useGlobalAuthModal } from '../contexts/GlobalAuthModalContext';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

interface Market {
  id: string;
  name: string;
  slug: string;
}

const MARKET_NAMES: Record<string, string> = {
  dabburiyya: 'سوق دبورية الرقمي',
  daburiyya: 'سوق دبورية الرقمي',
  iksal: 'سوق إكسال الرقمي',
};

export default function MarketLayout() {
  const { pathname } = useLocation();
  const marketSlug = pathname.split('/').filter(Boolean)[0] ?? '';
  const [market, setMarket] = useState<Market | null>(null);
  const { customer } = useCustomerAuth();
  const { openAuthModal } = useGlobalAuthModal();

  useEffect(() => {
    const slug = marketSlug === 'daburiyya' ? 'dabburiyya' : marketSlug;
    if (!slug) {
      setMarket(null);
      return;
    }
    if (!MOCK_API_URL) {
      setMarket({ id: 'local', name: MARKET_NAMES[slug] ?? slug, slug });
      return;
    }
    let cancelled = false;
    fetch(`${MOCK_API_URL}/markets/by-slug/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (!cancelled) setMarket(m ?? { id: 'local', name: MARKET_NAMES[slug] ?? slug, slug });
      })
      .catch(() => {
        if (!cancelled) setMarket({ id: 'local', name: MARKET_NAMES[slug] ?? slug, slug });
      });
    return () => { cancelled = true; };
  }, [marketSlug]);

  const marketName = market?.name ?? 'السوق';
  const marketSlugDisplay = market?.slug ?? marketSlug ?? '';

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF9] overflow-x-hidden">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to={marketSlug ? `/${marketSlug}` : '/'} className="flex items-center gap-2">
            <span className="font-bold text-xl text-gray-900">{marketName}</span>
            <span className="text-xs text-gray-500">/{marketSlugDisplay}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F8FAFC] text-gray-500 border border-gray-200">NMD OS</span>
          </Link>
          <nav className="flex items-center gap-4">
            {customer ? (
              <Link
                to="/my-activity"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <User className="w-5 h-5" />
                <span className="hidden sm:inline">حسابي</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => openAuthModal()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-[#D97706] hover:bg-amber-50 transition-colors"
              >
                <User className="w-5 h-5" />
                <span className="hidden sm:inline">تسجيل الدخول</span>
              </button>
            )}
            <Link to="/" className="text-gray-700 hover:text-[#D97706] transition-colors text-sm">الأسواق</Link>
            {marketSlug && (
              <button
                type="button"
                onClick={() => document.getElementById('shops')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-gray-700 hover:text-[#D97706] transition-colors text-sm"
              >
                المحلات
              </button>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>
      <Link
        to={marketSlug ? `/${marketSlug}` : '/'}
        className="nmd-btn-active fixed bottom-6 end-6 z-50 md:hidden px-5 py-3 rounded-full bg-[#B45309] text-white font-semibold shadow-lg shadow-[#D97706]/25 hover:bg-[#92400E] transition-all"
      >
        اطلب الآن
      </Link>
      <footer className="bg-[#1E293B] text-gray-400 py-10 mt-auto">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-8 mb-6">
            <Link to="/" className="hover:text-white transition-colors">الأسواق</Link>
          </div>
          <p className="text-center text-sm">© {marketName}</p>
        </div>
      </footer>
    </div>
  );
}
