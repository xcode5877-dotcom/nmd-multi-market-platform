import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { MarketCategory } from '@nmd/core';
import { Skeleton } from '@nmd/ui';
import { useState, useEffect } from 'react';
import { Store, Search, ArrowRight } from 'lucide-react';
import { StoreCard } from '../components/StoreCard';
import {
  FEATURED_TENANT_SLUGS,
  SPONSORED_TENANT_SLUGS,
  TYPE_LABELS,
} from './MarketHomePage';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';
const STOREFRONT_URL = import.meta.env.VITE_STOREFRONT_URL ?? 'http://localhost:5173';

const CATEGORY_TILES: { marketCategory: MarketCategory; label: string; icon: string }[] = [
  { marketCategory: 'FOOD', label: 'طعام', icon: '🍕' },
  { marketCategory: 'CLOTHING', label: 'ملابس', icon: '🛍' },
  { marketCategory: 'GROCERIES', label: 'خضار', icon: '🥬' },
  { marketCategory: 'BUTCHER', label: 'ملحمة', icon: '🥩' },
  { marketCategory: 'OFFERS', label: 'عروض', icon: '📦' },
];

interface Market {
  id: string;
  name: string;
  slug: string;
}

interface MarketTenant {
  id: string;
  slug: string;
  name: string;
  type: string;
  branding: { logoUrl?: string; primaryColor?: string };
  marketCategory: string;
  operationalStatus?: 'open' | 'closed' | 'busy';
  businessHours?: Record<string, { open: string; close: string; isClosedDay: boolean }>;
}

export default function AllStoresPage() {
  const { marketSlug } = useParams<{ marketSlug: string }>();
  const [market, setMarket] = useState<Market | null>(null);
  const [tenants, setTenants] = useState<MarketTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<'ALL' | MarketCategory>('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!marketSlug || !MOCK_API_URL) {
      setMarket(null);
      setTenants([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch(`${MOCK_API_URL}/markets/by-slug/${marketSlug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(async (m) => {
        if (cancelled || !m) {
          if (!cancelled) setMarket(null);
          return;
        }
        setMarket(m);
        const res = await fetch(`${MOCK_API_URL}/markets/${m.id}/tenants?_t=${Date.now()}`);
        const list = await res.json();
        if (!cancelled) setTenants(list ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setMarket(null);
          setTenants([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [marketSlug]);

  const getStoreBadge = (slug: string): 'featured' | 'sponsored' | undefined => {
    if (SPONSORED_TENANT_SLUGS.includes(slug)) return 'sponsored';
    if (FEATURED_TENANT_SLUGS.includes(slug)) return 'featured';
    return undefined;
  };

  const visibleTenants = tenants
    .filter((t) => (activeCategory === 'ALL' ? true : (t.marketCategory ?? 'GENERAL') === activeCategory))
    .filter((t) => !search.trim() || t.name.toLowerCase().includes(search.toLowerCase().trim()));

  if (!loading && !market) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center" dir="rtl">
        <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">السوق غير موجود</h2>
        <Link to="/markets" className="text-[#D97706] font-medium hover:underline">
          ← العودة لاختيار السوق
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <Link
        to={marketSlug ? `/m/${marketSlug}` : '/markets'}
        className="inline-flex items-center gap-2 text-[#D97706] font-medium hover:underline mb-6"
      >
        <ArrowRight className="w-4 h-4" />
        العودة للسوق
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">جميع المحلات</h1>

      {/* Search + Category filters */}
      <div className="mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="ابحث باسم المحل..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full ps-4 pe-12 py-2.5 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#D97706]/30 focus:border-[#D97706] text-sm"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <motion.button
            type="button"
            onClick={() => setActiveCategory('ALL' as MarketCategory)}
            whileTap={{ scale: 0.96 }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap shrink-0 border ${
              activeCategory === 'ALL'
                ? 'bg-[#B45309] text-white border-[#B45309]'
                : 'bg-white text-gray-700 border-gray-200 hover:border-[#D97706]/50'
            }`}
          >
            الكل
          </motion.button>
          {CATEGORY_TILES.map((c) => {
            const isActive = activeCategory === c.marketCategory;
            return (
              <motion.button
                key={c.marketCategory}
                type="button"
                onClick={() => setActiveCategory(c.marketCategory)}
                whileTap={{ scale: 0.96 }}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap shrink-0 border ${
                  isActive ? 'bg-[#B45309] text-white border-[#B45309]' : 'bg-white text-gray-700 border-gray-200 hover:border-[#D97706]/50'
                }`}
              >
                <span>{c.icon}</span>
                {c.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 md:gap-6 justify-items-center">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-[320px] w-full max-w-[220px] rounded-xl" />
          ))}
        </div>
      ) : visibleTenants.length === 0 ? (
        <div className="py-12 text-center rounded-xl bg-white border border-gray-200 shadow-sm">
          <span className="text-4xl mb-4 block">🏬</span>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {tenants.length === 0 && !search.trim() && activeCategory === 'ALL'
              ? 'لا توجد محلات بعد'
              : 'لا توجد محلات تطابق البحث أو الفئة'}
          </h3>
          <p className="text-gray-600 max-w-md mx-auto text-sm">
            {tenants.length === 0 ? 'هذا السوق جاهز لانضمام محلات جديدة.' : 'جرّب تغيير كلمة البحث أو اختر فئة أخرى'}
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4 md:gap-6 items-start content-start justify-items-center"
        >
          {visibleTenants.map((t) => (
            <motion.div key={t.id} whileTap={{ scale: 0.96 }} className="w-full max-w-[220px]">
              <StoreCard
                id={t.id}
                slug={t.slug}
                name={t.name}
                marketCategory={t.marketCategory}
                type={t.type}
                branding={t.branding ?? {}}
                operationalStatus={t.operationalStatus}
                businessHours={t.businessHours}
                storeUrl={`${STOREFRONT_URL}/${t.slug}`}
                categoryLabel={TYPE_LABELS[t.marketCategory ?? 'GENERAL'] ?? TYPE_LABELS.GENERAL}
                badge={getStoreBadge(t.slug)}
              />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
