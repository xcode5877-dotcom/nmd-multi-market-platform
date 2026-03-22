import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { CartBar } from '../components/CartBar';

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

  return (
    <div className="min-h-screen flex flex-col bg-[#ffffff] overflow-x-hidden p-0 m-0 w-full" style={{ width: '100%', margin: 0 }}>
      <main className={`flex-1 overflow-visible ${typeof navigator !== 'undefined' && navigator.userAgent.includes('NMDCustomerApp') ? 'pb-0' : 'pb-[var(--cart-bar-height)] md:pb-0'}`}>
        <Outlet />
      </main>
      {typeof navigator !== 'undefined' && !navigator.userAgent.includes('NMDCustomerApp') && <CartBar />}
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
