import { Outlet, Link, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

interface Market {
  id: string;
  name: string;
  slug: string;
}

export default function MarketLayout() {
  const { marketSlug } = useParams<{ marketSlug: string }>();
  const [market, setMarket] = useState<Market | null>(null);

  useEffect(() => {
    if (!marketSlug || !MOCK_API_URL) {
      setMarket(null);
      return;
    }
    let cancelled = false;
    fetch(`${MOCK_API_URL}/markets/by-slug/${marketSlug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => {
        if (!cancelled) setMarket(m);
      })
      .catch(() => {
        if (!cancelled) setMarket(null);
      });
    return () => { cancelled = true; };
  }, [marketSlug]);

  const marketName = market?.name ?? 'السوق';
  const marketSlugDisplay = market?.slug ?? marketSlug ?? '';

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF9] overflow-x-hidden">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to={marketSlug ? `/m/${marketSlug}` : '/markets'} className="flex items-center gap-2">
            <span className="font-bold text-xl text-gray-900">{marketName}</span>
            <span className="text-xs text-gray-500">/{marketSlugDisplay}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F8FAFC] text-gray-500 border border-gray-200">NMD OS</span>
          </Link>
          <nav className="flex gap-4">
            <Link to="/markets" className="text-gray-700 hover:text-[#D97706] transition-colors text-sm">الأسواق</Link>
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
        to={marketSlug ? `/m/${marketSlug}` : '/markets'}
        className="nmd-btn-active fixed bottom-6 end-6 z-50 md:hidden px-5 py-3 rounded-full bg-[#B45309] text-white font-semibold shadow-lg shadow-[#D97706]/25 hover:bg-[#92400E] transition-all"
      >
        اطلب الآن
      </Link>
      <footer className="bg-[#1E293B] text-gray-400 py-10 mt-auto">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-8 mb-6">
            <Link to="/markets" className="hover:text-white transition-colors">الأسواق</Link>
          </div>
          <p className="text-center text-sm">© {marketName}</p>
        </div>
      </footer>
    </div>
  );
}
