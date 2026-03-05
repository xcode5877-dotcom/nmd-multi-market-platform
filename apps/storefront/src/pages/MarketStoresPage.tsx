import { useLocation, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Skeleton } from '@nmd/ui';
import { useState, useEffect } from 'react';
import { Store, Search, ArrowRight, UtensilsCrossed, Shirt, Leaf, Flame, Tag, ShoppingBag, LayoutGrid } from 'lucide-react';
import { getTenantListForMallAsync } from '@nmd/mock';
import { StoreCard } from '../components/StoreCard';
import { onTenantUpdate } from '../lib/tenant-broadcast';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

interface GlobalCategory {
  id: string;
  title: string;
  icon: string;
  isProfessional: boolean;
  sortOrder: number;
  legacyCode?: string;
}

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
  businessHours?: Record<string, unknown>;
  openTime?: string;
  closeTime?: string;
  forceClosed?: boolean;
}

const FEATURED_TENANT_SLUGS: string[] = ['buffalo'];
const SPONSORED_TENANT_SLUGS: string[] = [];

const FALLBACK_CATEGORIES: GlobalCategory[] = [
  { id: 'ALL', title: 'الكل', icon: '📋', isProfessional: false, sortOrder: -1 },
  { id: 'cat-food', title: 'طعام', icon: '🍕', isProfessional: false, sortOrder: 0, legacyCode: 'FOOD' },
  { id: 'cat-clothing', title: 'ملابس', icon: '🛍', isProfessional: false, sortOrder: 1, legacyCode: 'CLOTHING' },
  { id: 'cat-groceries', title: 'خضار', icon: '🥬', isProfessional: false, sortOrder: 2, legacyCode: 'GROCERIES' },
  { id: 'cat-butcher', title: 'ملحمة', icon: '🥩', isProfessional: false, sortOrder: 3, legacyCode: 'BUTCHER' },
  { id: 'cat-offers', title: 'عروض', icon: '📦', isProfessional: false, sortOrder: 4, legacyCode: 'OFFERS' },
];

const CATEGORY_LABEL_MAP: Record<string, string> = {
  FOOD: 'طعام',
  CLOTHING: 'ملابس',
  GROCERIES: 'خضار',
  BUTCHER: 'ملحمة',
  OFFERS: 'عروض',
  GENERAL: 'عام',
};

function getCategoryLabel(cats: GlobalCategory[], marketCategory: string): string {
  const cat = cats.find((c) => c.legacyCode === marketCategory || c.id === marketCategory);
  return cat?.title ?? CATEGORY_LABEL_MAP[marketCategory ?? 'GENERAL'] ?? marketCategory ?? 'عام';
}

const CATEGORY_LUCIDE: Record<string, any> = {
  'FOOD': UtensilsCrossed,
  'cat-food': UtensilsCrossed,
  'CLOTHING': Shirt,
  'cat-clothing': Shirt,
  'GROCERIES': Leaf,
  'cat-groceries': Leaf,
  'BUTCHER': Flame,
  'cat-butcher': Flame,
  'OFFERS': Tag,
  'cat-offers': Tag,
  'GENERAL': ShoppingBag,
  'ALL': LayoutGrid
};

function CategoryIcon({ category }: { category: GlobalCategory }) {
  const icon = category?.icon?.trim();
  const useLucide = !icon || icon === '?' || icon.length > 2;
  const IconComponent = CATEGORY_LUCIDE[category.legacyCode ?? ''] ?? CATEGORY_LUCIDE[category.id] ?? ShoppingBag;
  if (useLucide) return <IconComponent className="w-4 h-4 shrink-0" />;
  return <span className="text-base leading-none">{icon}</span>;
}

function getStoreBadge(slug: string): 'featured' | 'sponsored' | undefined {
  if (SPONSORED_TENANT_SLUGS.includes(slug)) return 'sponsored';
  if (FEATURED_TENANT_SLUGS.includes(slug)) return 'featured';
  return undefined;
}

export default function MarketStoresPage() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get('category')?.trim() || '';
  const marketSlug = pathname.split('/').filter(Boolean)[0] ?? '';
  const [market, setMarket] = useState<Market | null>(null);
  const [tenants, setTenants] = useState<MarketTenant[]>([]);
  const [categories, setCategories] = useState<GlobalCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>(categoryParam || 'ALL');
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const onFocus = () => setRefreshKey((k) => k + 1);
    window.addEventListener('focus', onFocus);
    const unsub = onTenantUpdate(() => setRefreshKey((k) => k + 1));
    return () => {
      window.removeEventListener('focus', onFocus);
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!categoryParam) return;
    const match = categories.find((c) => c.id === categoryParam || c.legacyCode === categoryParam);
    if (match) setActiveCategory(match.id);
  }, [categoryParam, categories]);

  useEffect(() => {
    if (!MOCK_API_URL) {
      setCategories(FALLBACK_CATEGORIES.filter((c) => c.id !== 'ALL'));
    } else {
      fetch(`${MOCK_API_URL}/global-categories?_t=${Date.now()}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((list) => {
          const arr = Array.isArray(list) ? list : [];
          setCategories(arr.length > 0 ? arr : FALLBACK_CATEGORIES.filter((c) => c.id !== 'ALL'));
        })
        .catch(() => setCategories(FALLBACK_CATEGORIES.filter((c) => c.id !== 'ALL')));
    }
  }, []);

  useEffect(() => {
    const slug = marketSlug === 'daburiyya' ? 'dabburiyya' : marketSlug;
    if (!slug) {
      setMarket(null);
      setTenants([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    if (!MOCK_API_URL) {
      setMarket({
        id: 'local',
        name: slug === 'dabburiyya' ? 'سوق دبورية الرقمي' : slug === 'iksal' ? 'سوق إكسال الرقمي' : slug,
        slug,
        isActive: true,
      });
      getTenantListForMallAsync(slug).then((list) => {
        if (!cancelled)
          setTenants(
            (list ?? []).map((t) => {
              const os = (t as { operationalStatus?: string }).operationalStatus;
              const status = os === 'open' || os === 'closed' || os === 'busy' ? os : undefined;
              const bh = (t as { businessHours?: Record<string, unknown> }).businessHours;
              const openTime = (t as { openTime?: string }).openTime;
              const closeTime = (t as { closeTime?: string }).closeTime;
              const forceClosed = (t as { forceClosed?: boolean }).forceClosed;
              return {
                id: t.id,
                slug: t.slug,
                name: t.name,
                type: (t as { type?: string }).type ?? 'GENERAL',
                branding: t.branding ?? {},
                isActive: true,
                marketCategory: (t as { marketCategory?: string }).marketCategory ?? 'GENERAL',
                operationalStatus: status,
                businessHours: bh,
                openTime,
                closeTime,
                forceClosed,
              };
            })
          );
      }).catch(() => {}).finally(() => {
        if (!cancelled) setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }
    fetch(`${MOCK_API_URL}/markets/by-slug/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(async (m) => {
        if (cancelled || !m) {
          if (!cancelled) setMarket(null);
          return;
        }
        setMarket(m);
        const tenantsRes = await fetch(`${MOCK_API_URL}/markets/${m.id}/tenants?_t=${Date.now()}`);
        const list = await tenantsRes.json();
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
    return () => {
      cancelled = true;
    };
  }, [marketSlug, refreshKey]);

  const tenantMatchesCategory = (t: MarketTenant, catId: string): boolean => {
    if (catId === 'ALL') return true;
    const cat = categories.find((c) => c.id === catId);
    const mc = t.marketCategory ?? 'GENERAL';
    if (cat?.legacyCode && mc === cat.legacyCode) return true;
    return mc === catId;
  };

  const filteredTenants = tenants.filter((t) => {
    const matchesSearch = !search.trim() || t.name.toLowerCase().includes(search.toLowerCase().trim());
    const matchesCat = activeCategory === 'ALL' || tenantMatchesCategory(t, activeCategory);
    return matchesSearch && matchesCat;
  });

  if (!loading && !market) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center" dir="rtl">
        <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">السوق غير موجود</h2>
        <p className="text-gray-600 mb-6">لم نتمكن من العثور على هذا السوق</p>
        <Link to="/" className="text-primary font-medium hover:underline">
          ← العودة لاختيار السوق
        </Link>
      </div>
    );
  }

  const slug = marketSlug === 'daburiyya' ? 'dabburiyya' : marketSlug;
  const marketHomePath = slug ? `/${marketSlug}` : '/';

  return (
    <div className="min-h-screen bg-[#FAFAF9]" dir="rtl">
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <Link
            to={marketHomePath}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-primary font-medium text-sm mb-4"
          >
            <ArrowRight className="w-4 h-4" />
            العودة إلى {market?.name ?? 'السوق'}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">كل المحلات</h1>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="ابحث باسم المحل..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full ps-4 pe-12 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
            />
          </div>
        </div>
        <div className="px-4 pb-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-2 min-w-max items-center">
            <motion.button
              type="button"
              onClick={() => setActiveCategory('ALL')}
              whileTap={{ scale: 0.97 }}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all shrink-0 border ${
                activeCategory === 'ALL'
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-primary/50'
              }`}
            >
              الكل
            </motion.button>
            {categories.map((c) => (
              <motion.button
                key={c.id}
                type="button"
                onClick={() => setActiveCategory(c.id)}
                whileTap={{ scale: 0.97 }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all shrink-0 border ${
                  activeCategory === c.id
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-primary/50'
                }`}
              >
                <CategoryIcon category={c} />
                {c.title}
              </motion.button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
            ))}
          </div>
        ) : filteredTenants.length === 0 ? (
          <div className="py-16 text-center rounded-2xl bg-white border border-dashed border-gray-200">
            <span className="text-5xl mb-4 block">🏬</span>
            <p className="text-gray-600">
              {tenants.length === 0 && !search.trim() && activeCategory === 'ALL'
                ? 'لا توجد محلات بعد'
                : 'لا توجد محلات تطابق البحث أو الفئة'}
            </p>
            {tenants.length === 0 && (
              <Link to={marketHomePath} className="inline-block mt-4 text-primary font-medium hover:underline">
                ← العودة للسوق
              </Link>
            )}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
            className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3"
          >
            {filteredTenants.map((t) => (
              <StoreCard
                key={t.id}
                id={t.id}
                slug={t.slug}
                name={t.name}
                marketSlug={marketSlug}
                marketCategory={t.marketCategory}
                type={t.type}
                branding={t.branding ?? {}}
                operationalStatus={t.operationalStatus}
                businessHours={t.businessHours}
                openTime={t.openTime}
                closeTime={t.closeTime}
                forceClosed={t.forceClosed}
                categoryLabel={getCategoryLabel(categories, t.marketCategory ?? 'GENERAL')}
                badge={getStoreBadge(t.slug)}
              />
            ))}
          </motion.div>
        )}
      </main>
    </div>
  );
}
