import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { MarketCategory } from '@nmd/core';
import { Skeleton } from '@nmd/ui';
import { useState, useEffect, useRef } from 'react';
import { Store, Search } from 'lucide-react';
import { StoreCard } from '../components/StoreCard';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';
const STOREFRONT_URL = import.meta.env.VITE_STOREFRONT_URL ?? 'http://localhost:5173';

/** Promo banner shape. linkTo = tenantSlug. API-ready. */
export interface PromoBanner {
  id: string;
  imageUrl: string;
  title: string;
  linkTo: string; // tenantSlug
  active: boolean;
}

/** Tenant slugs that get "مميز" (Featured) badge on cards. */
export const FEATURED_TENANT_SLUGS: string[] = ['buffalo'];

/** Tenant slugs that get "ممول" (Sponsored) badge. */
export const SPONSORED_TENANT_SLUGS: string[] = [];

/** Section shape for dynamic marketplace. API-ready. */
export interface Section {
  id: string;
  title: string;
  type: 'SLIDER';
  storeIds: string[];
}

export const TYPE_LABELS: Record<string, string> = {
  FOOD: 'طعام',
  CLOTHING: 'ملابس',
  GROCERIES: 'خضار',
  BUTCHER: 'ملحمة',
  OFFERS: 'عروض',
  GENERAL: 'عام',
};

interface Market {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

interface MarketTenant {
  id: string;
  slug: string;
  name: string;
  type: string;
  branding: { logoUrl?: string; primaryColor?: string };
  isActive: boolean;
  marketCategory: string;
  operationalStatus?: 'open' | 'closed' | 'busy';
  businessHours?: Record<string, { open: string; close: string; isClosedDay: boolean }>;
  isFeatured?: boolean;
}

const CATEGORY_TILES: { marketCategory: MarketCategory; label: string; icon: string }[] = [
  { marketCategory: 'FOOD', label: 'طعام', icon: '🍕' },
  { marketCategory: 'CLOTHING', label: 'ملابس', icon: '🛍' },
  { marketCategory: 'GROCERIES', label: 'خضار', icon: '🥬' },
  { marketCategory: 'BUTCHER', label: 'ملحمة', icon: '🥩' },
  { marketCategory: 'OFFERS', label: 'عروض', icon: '📦' },
];

export default function MarketHomePage() {
  const { marketSlug } = useParams<{ marketSlug: string }>();
  const [market, setMarket] = useState<Market | null>(null);
  const [tenants, setTenants] = useState<MarketTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<'ALL' | MarketCategory>('ALL');
  const [search, setSearch] = useState('');
  const [bannerIdx, setBannerIdx] = useState(0);
  const [bannerImageLoaded, setBannerImageLoaded] = useState<Record<string, boolean>>({});
  const shopsRef = useRef<HTMLDivElement>(null);

  const [promos, setPromos] = useState<PromoBanner[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const activeBanners = promos.filter((b) => b.active);

  useEffect(() => {
    if (!marketSlug || !MOCK_API_URL) {
      setMarket(null);
      setTenants([]);
      setPromos([]);
      setSections([]);
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
        const [tenantsRes, bannersRes, layoutRes] = await Promise.all([
          fetch(`${MOCK_API_URL}/markets/${m.id}/tenants?_t=${Date.now()}`),
          fetch(`${MOCK_API_URL}/markets/by-slug/${marketSlug}/banners`),
          fetch(`${MOCK_API_URL}/markets/by-slug/${marketSlug}/layout`),
        ]);
        const list = await tenantsRes.json();
        const banners = bannersRes.ok ? await bannersRes.json() : [];
        const layout = layoutRes.ok ? await layoutRes.json() : [];
        if (!cancelled) {
          setTenants(list ?? []);
          setPromos(banners);
          setSections(layout);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMarket(null);
          setTenants([]);
          setPromos([]);
          setSections([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [marketSlug]);

  useEffect(() => {
    if (activeBanners.length <= 1) return;
    const t = setInterval(() => setBannerIdx((i) => (i + 1) % activeBanners.length), 5000);
    return () => clearInterval(t);
  }, []);

  const handleCategoryClick = (cat: MarketCategory) => {
    setActiveCategory((prev) => (prev === cat ? 'ALL' : cat));
    shopsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const getStoreBadge = (slug: string): 'featured' | 'sponsored' | undefined => {
    if (SPONSORED_TENANT_SLUGS.includes(slug)) return 'sponsored';
    if (FEATURED_TENANT_SLUGS.includes(slug)) return 'featured';
    return undefined;
  };

  /** Resolve tenants for a section by storeIds (id or slug). Preserves order. */
  const getTenantsForSection = (storeIds: string[]): MarketTenant[] => {
    const byId = new Map(tenants.map((t) => [t.id, t]));
    const bySlug = new Map(tenants.map((t) => [t.slug, t]));
    return storeIds
      .map((id) => byId.get(id) ?? bySlug.get(id))
      .filter((t): t is MarketTenant => t != null);
  };

  const visibleTenants = tenants
    .filter((t) => (activeCategory === 'ALL' ? true : (t.marketCategory ?? 'GENERAL') === activeCategory))
    .filter((t) => !search.trim() || t.name.toLowerCase().includes(search.toLowerCase().trim()));

  if (!loading && !market) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center" dir="rtl">
        <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">السوق غير موجود</h2>
        <p className="text-gray-600 mb-6">لم نتمكن من العثور على هذا السوق</p>
        <Link to="/markets" className="text-[#D97706] font-medium hover:underline">
          ← العودة لاختيار السوق
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* 1. Global Search (Crown) - Sticky top-0, glassmorphism */}
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/80 shadow-sm">
        <div className="px-4 py-3">
          <div className="relative max-w-6xl mx-auto">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="ابحث باسم المحل..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full ps-4 pe-12 py-2.5 rounded-xl border border-gray-200 bg-white/60 focus:outline-none focus:ring-2 focus:ring-[#D97706]/30 focus:border-[#D97706] focus:bg-white/90 text-sm shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* 2. Promo Hero (Banner Slider) */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden"
      >
        {activeBanners.length > 0 ? (
          <div className="relative aspect-[21/9] w-full rounded-b-2xl overflow-hidden shadow-lg">
            <AnimatePresence mode="wait">
              {activeBanners.map((b, i) => {
                if (i !== bannerIdx) return null;
                const storeUrl = `${STOREFRONT_URL}/${b.linkTo}`;
                return (
                  <motion.a
                    key={b.id}
                    href={storeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ duration: 0.4 }}
                    className="block absolute inset-0"
                  >
                    <div className="absolute inset-0 bg-gray-900/30 z-10 flex flex-col justify-end p-4 md:p-6">
                      <h2 className="text-xl md:text-2xl font-bold text-white drop-shadow-lg">{b.title}</h2>
                      <span className="inline-flex mt-2 w-fit px-4 py-2 rounded-xl bg-[#B45309] text-white font-semibold text-sm hover:bg-[#92400E] transition-colors shadow-lg">
                        اطلب الآن
                      </span>
                    </div>
                    {!bannerImageLoaded[b.id] && (
                      <Skeleton variant="rectangular" className="absolute inset-0 w-full h-full" />
                    )}
                    <img
                      src={b.imageUrl}
                      alt={b.title}
                      className={`w-full h-full object-cover transition-opacity duration-300 ${bannerImageLoaded[b.id] ? 'opacity-100' : 'opacity-0'}`}
                      onLoad={() => setBannerImageLoaded((prev) => ({ ...prev, [b.id]: true }))}
                    />
                  </motion.a>
                );
              })}
            </AnimatePresence>
            {activeBanners.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
                {activeBanners.map((_, i) => (
                  <motion.button
                    key={i}
                    type="button"
                    onClick={() => setBannerIdx(i)}
                    whileTap={{ scale: 0.9 }}
                    className={`w-2 h-2 rounded-full transition-colors ${i === bannerIdx ? 'bg-white' : 'bg-white/50'}`}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="relative aspect-[21/9] w-full rounded-b-2xl overflow-hidden bg-gradient-to-b from-[#FEF3C7]/40 to-white" />
        )}
      </motion.section>

      {/* 3. Sticky Capsule Categories */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="sticky top-32 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm"
      >
        <div className="px-4 py-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-2 min-w-max">
            <motion.button
              type="button"
              onClick={() => handleCategoryClick('ALL' as MarketCategory)}
              whileTap={{ scale: 0.97 }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all shrink-0 border ${
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
                  onClick={() => handleCategoryClick(c.marketCategory)}
                  whileTap={{ scale: 0.97 }}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all shrink-0 border ${
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
      </motion.section>

      {/* 4. Dynamic Sections (all horizontal sliders) */}
      {sections.map((section, idx) => {
        const sectionTenants = getTenantsForSection(section.storeIds);
        return (
          <motion.section
            key={section.id}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-20px' }}
            transition={{ duration: 0.35, delay: idx * 0.05 }}
            className="py-4 border-b border-gray-100 bg-white"
          >
            <div className="max-w-6xl mx-auto px-4">
              <div className="flex flex-row items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gray-900">{section.title}</h2>
                <motion.button
                  type="button"
                  onClick={() => shopsRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  whileTap={{ scale: 0.97 }}
                  className="text-sm font-medium text-[#D97706] hover:underline"
                >
                  عرض الكل
                </motion.button>
              </div>
              {loading ? (
                <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-2 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-[260px] min-w-[210px] shrink-0 snap-start rounded-xl" />
                  ))}
                </div>
              ) : sectionTenants.length === 0 ? (
                <div className="py-6 text-center rounded-xl bg-gray-50 border border-dashed border-gray-200">
                  <p className="text-sm text-gray-500">لا توجد محلات في هذا القسم</p>
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-2 snap-x snap-mandatory snap-start [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4 scroll-smooth">
                  {sectionTenants.map((t) => (
                    <motion.div key={t.id} className="shrink-0 snap-start min-w-[210px]" whileTap={{ scale: 0.97 }}>
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
                        compact
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.section>
        );
      })}

      {/* 5. All Stores (horizontal slider) */}
      <motion.section
        id="shops"
        ref={shopsRef}
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-20px' }}
        transition={{ duration: 0.35 }}
        className="py-4 border-b border-gray-100 bg-white"
      >
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-row items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">كل المحلات</h2>
            <Link
              to={marketSlug ? `/m/${marketSlug}/all-stores` : '/markets'}
              className="text-sm font-medium text-[#D97706] hover:underline"
            >
              <motion.span whileTap={{ scale: 0.97 }} className="inline-block">
                عرض الكل
              </motion.span>
            </Link>
          </div>
          {loading ? (
            <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-2 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-[260px] min-w-[210px] shrink-0 snap-start rounded-xl" />
              ))}
            </div>
          ) : visibleTenants.length === 0 ? (
            <div className="py-6 text-center rounded-xl bg-gray-50 border border-dashed border-gray-200">
              <span className="text-4xl mb-2 block">🏬</span>
              <p className="text-sm text-gray-500">
                {tenants.length === 0 && !search.trim() && activeCategory === 'ALL'
                  ? 'لا توجد محلات بعد'
                  : 'لا توجد محلات تطابق البحث أو الفئة'}
              </p>
              {tenants.length === 0 && (
                <Link to="/markets" className="inline-block mt-3 text-[#D97706] font-medium hover:underline">
                  ← العودة لاختيار السوق
                </Link>
              )}
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-2 snap-x snap-mandatory snap-start [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4 scroll-smooth">
              {visibleTenants.map((t) => (
                <motion.div key={t.id} className="shrink-0 snap-start min-w-[210px]" whileTap={{ scale: 0.97 }}>
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
                    compact
                  />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.section>
    </div>
  );
}
