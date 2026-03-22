import { useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from '@nmd/ui';
import { useState, useEffect } from 'react';

const HERO_TITLE_STYLE_MOBILE = { fontSize: '1.25rem', lineHeight: 1.2 } as const;
const HERO_TITLE_STYLE_DESKTOP = { fontSize: '2rem', lineHeight: 1.2 } as const;
function useHeroTitleStyle() {
  const [style, setStyle] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
      ? HERO_TITLE_STYLE_DESKTOP
      : HERO_TITLE_STYLE_MOBILE
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const fn = () => setStyle(mq.matches ? HERO_TITLE_STYLE_DESKTOP : HERO_TITLE_STYLE_MOBILE);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return style;
}
import { Store, Search, ChevronLeft } from 'lucide-react';
import { getTenantListForMallAsync } from '@nmd/mock';
import { StoreCard } from '../components/StoreCard';
import { PillarNav } from '../components/PillarNav';
import { onTenantUpdate } from '../lib/tenant-broadcast';
import { resolveImageUrl } from '../lib/image-url';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

interface PromoBanner {
  id: string;
  imageUrl: string;
  title: string;
  linkTo: string;
  active: boolean;
}

/** Layout section from API; type/sortOrder may be missing in legacy data */
interface Section {
  id: string;
  title: string;
  type?: 'SLIDER' | 'MARKET_GROUP';
  storeIds: string[];
  sortOrder?: number;
}

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

/** tenantType for grouping: RESTAURANT (food), SHOP (retail), SERVICE (pro). storeType PROFESSIONAL = services list. */
interface MarketTenant {
  id: string;
  slug: string;
  name: string;
  type: string;
  tenantType?: 'RESTAURANT' | 'SHOP' | 'SERVICE';
  storeType?: 'RESTAURANT' | 'PROFESSIONAL';
  branding: { logoUrl?: string; primaryColor?: string };
  isActive: boolean;
  marketCategory: string;
  enabled?: boolean;
  isListedInMarket?: boolean;
  operationalStatus?: 'open' | 'closed' | 'busy';
  businessHours?: Record<string, unknown>;
  isFeatured?: boolean;
  marketId?: string | null;
  /** Resolved from pillar/sub-category; prefer over marketCategory for display. */
  categoryName?: string | null;
}

const FEATURED_TENANT_SLUGS: string[] = ['buffalo'];
const SPONSORED_TENANT_SLUGS: string[] = [];

/** Fallback when banner has no image or image fails to load. Keeps hero layout intact. */
const BANNER_PLACEHOLDER = 'https://placehold.co/1200x514/1e293b/ffffff?text=السوق';

/** Fallback only when Admin has not set a title. Admin title always takes precedence. */
const FALLBACK_BANNER_TITLE = 'Now Market';

function effectiveBannerTitle(title: string | undefined | null): string {
  const t = (title ?? '').trim();
  if (!t) return FALLBACK_BANNER_TITLE;
  return t;
}

/** Append cache-bust query to image URL so browsers fetch latest (bypass CDN/browser cache). */
function withCacheBust(url: string, v: number): string {
  if (!url) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${v}`;
}

function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good Morning';
  return 'Good Evening';
}

const CATEGORY_LABEL_MAP: Record<string, string> = {
  FOOD: 'طعام',
  CLOTHING: 'ملابس',
  GROCERIES: 'خضار',
  BUTCHER: 'ملحمة',
  OFFERS: 'عروض',
  GENERAL: 'عام',
};

const FALLBACK_CATEGORIES: GlobalCategory[] = [
  { id: 'ALL', title: 'الكل', icon: '📋', isProfessional: false, sortOrder: -1 },
  { id: 'cat-food', title: 'طعام', icon: '🍕', isProfessional: false, sortOrder: 0, legacyCode: 'FOOD' },
  { id: 'cat-clothing', title: 'ملابس', icon: '🛍', isProfessional: false, sortOrder: 1, legacyCode: 'CLOTHING' },
  { id: 'cat-groceries', title: 'خضار', icon: '🥬', isProfessional: false, sortOrder: 2, legacyCode: 'GROCERIES' },
  { id: 'cat-butcher', title: 'ملحمة', icon: '🥩', isProfessional: false, sortOrder: 3, legacyCode: 'BUTCHER' },
  { id: 'cat-offers', title: 'عروض', icon: '📦', isProfessional: false, sortOrder: 4, legacyCode: 'OFFERS' },
];

/** Resolve category to display name. Never show raw ID/UUID — use title from list or fallback. */
function getCategoryLabel(cats: GlobalCategory[], marketCategory: string | undefined): string {
  const code = (marketCategory ?? '').trim() || 'GENERAL';
  const cat = cats.find((c) => c.legacyCode === code || c.id === code);
  if (cat?.title) return cat.title;
  if (code !== 'GENERAL' && CATEGORY_LABEL_MAP[code]) return CATEGORY_LABEL_MAP[code];
  if (code !== 'GENERAL') return 'تصنيف عام';
  return '';
}

export default function MarketHomePage() {
  const { pathname } = useLocation();
  const marketSlug = pathname.split('/').filter(Boolean)[0] ?? '';
  const [market, setMarket] = useState<Market | null>(null);
  const [tenants, setTenants] = useState<MarketTenant[]>([]);
  const [categories, setCategories] = useState<GlobalCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [bannerIdx, setBannerIdx] = useState(0);
  const [bannerImageLoaded, setBannerImageLoaded] = useState<Record<string, boolean>>({});
  const [promos, setPromos] = useState<PromoBanner[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [bannerImageCacheBust, setBannerImageCacheBust] = useState(() => Date.now());
  const [pillars, setPillars] = useState<Array<{ id: string; name: string; nameAr?: string; slug: string; icon?: string; sortOrder: number }>>([]);
  const heroTitleStyle = useHeroTitleStyle();
  const activeBanners = promos.filter((b) => b.active !== false);

  /** Preload all banner images on page load to eliminate gray gaps during slider transitions */
  useEffect(() => {
    activeBanners.forEach((b) => {
      const base = b.imageUrl?.trim() ? resolveImageUrl(b.imageUrl.trim()) : BANNER_PLACEHOLDER;
      if (!base) return;
      const img = new Image();
      img.src = withCacheBust(base, bannerImageCacheBust);
    });
  }, [activeBanners, bannerImageCacheBust]);

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
    if (!MOCK_API_URL) {
      setCategories(FALLBACK_CATEGORIES.filter((c) => c.id !== 'ALL'));
      return;
    }
    fetch(`${MOCK_API_URL}/global-categories?_t=${Date.now()}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        const arr = Array.isArray(list) ? list : [];
        setCategories(arr.length > 0 ? arr : FALLBACK_CATEGORIES.filter((c) => c.id !== 'ALL'));
      })
      .catch(() => setCategories(FALLBACK_CATEGORIES.filter((c) => c.id !== 'ALL')));
  }, []);

  useEffect(() => {
    if (!MOCK_API_URL) return;
    fetch(`${MOCK_API_URL}/pillars?_t=${Date.now()}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => setPillars(Array.isArray(list) ? list : []))
      .catch(() => setPillars([]));
  }, []);

  useEffect(() => {
    const slug = marketSlug === 'daburiyya' ? 'dabburiyya' : marketSlug;
    if (!slug) {
      setMarket(null);
      setTenants([]);
      setPromos([]);
      setSections([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    if (!MOCK_API_URL) {
      setMarket({ id: 'local', name: slug === 'dabburiyya' ? 'سوق دبورية الرقمي' : slug === 'iksal' ? 'سوق إكسال الرقمي' : slug, slug, isActive: true });
      getTenantListForMallAsync(slug).then((list) => {
        if (!cancelled) {
          const mapped = (list ?? []).map((t) => {
            const os = (t as { operationalStatus?: string }).operationalStatus;
            const status: 'open' | 'busy' | 'closed' | undefined = (os === 'open' || os === 'closed' || os === 'busy') ? os : undefined;
            const bh = (t as { businessHours?: Record<string, unknown> }).businessHours;
            const enabled = (t as { enabled?: boolean }).enabled !== false;
            const isListedInMarket = (t as { isListedInMarket?: boolean }).isListedInMarket !== false;
            const type = (t as { type?: string }).type ?? 'GENERAL';
const tenantType = (t as { tenantType?: string }).tenantType ?? (type === 'FOOD' ? 'RESTAURANT' : 'SHOP');
const storeType = (t as { storeType?: string }).storeType;
return { id: t.id, slug: t.slug, name: t.name, type, tenantType: tenantType as 'RESTAURANT' | 'SHOP' | 'SERVICE', storeType: storeType as 'RESTAURANT' | 'PROFESSIONAL' | undefined, branding: t.branding ?? {}, isActive: true, marketCategory: (t as { marketCategory?: string }).marketCategory ?? 'GENERAL', enabled, isListedInMarket, operationalStatus: status, businessHours: bh, marketId: (t as { marketId?: string | null }).marketId ?? null };
          });
          setTenants(mapped.filter((t) => t.enabled !== false && t.isListedInMarket !== false));
        }
      }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }
    fetch(`${MOCK_API_URL}/markets/by-slug/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(async (m) => {
        if (cancelled || !m) {
          if (!cancelled) setMarket(null);
          return;
        }
        setMarket(m);
        const marketId = (m as { id?: string }).id;
        // Fetch ALL tenants for this market so getTenantsForSection (admin strips) and search see every store. No category filter at fetch.
        const cacheBust = Date.now();
        const [tenantsRes, bannersRes, layoutRes] = await Promise.all([
          marketId
            ? fetch(`${MOCK_API_URL}/markets/${marketId}/tenants?_t=${cacheBust}`)
            : fetch(`${MOCK_API_URL}/storefront/tenants?_t=${cacheBust}`),
          fetch(`${MOCK_API_URL}/markets/by-slug/${slug}/banners?_t=${cacheBust}`, { cache: 'no-store' }),
          fetch(`${MOCK_API_URL}/markets/by-slug/${slug}/layout`),
        ]);
        const list = await tenantsRes.json();
        const bannersRaw = bannersRes.ok ? await bannersRes.json() : [];
        const banners = Array.isArray(bannersRaw)
          ? bannersRaw
          : Array.isArray((bannersRaw as { banners?: unknown[] })?.banners)
            ? (bannersRaw as { banners: PromoBanner[] }).banners
            : [];
        const layout = layoutRes.ok ? await layoutRes.json() : [];
        const raw = Array.isArray(list) ? list : [];
        const mapped: MarketTenant[] = raw.map((t: Record<string, unknown>) => {
          const os = t.operationalStatus as string | undefined;
          const status: 'open' | 'busy' | 'closed' | undefined = (os === 'open' || os === 'closed' || os === 'busy') ? os : undefined;
          const enabled = ((t.enabled as boolean) ?? (t.isActive as boolean) ?? true) !== false;
          const isListedInMarket = (t.isListedInMarket as boolean) !== false;
          const type = (t.type === 'CLOTHING' || t.type === 'FOOD') ? t.type : 'GENERAL';
          const tenantType = (t.tenantType as string) ?? (type === 'FOOD' ? 'RESTAURANT' : 'SHOP');
          const storeType = t.storeType as string | undefined;
          return {
            id: String(t.id ?? ''),
            slug: String(t.slug ?? ''),
            name: String(t.name ?? ''),
            type,
            tenantType: tenantType as 'RESTAURANT' | 'SHOP' | 'SERVICE',
            storeType: storeType as 'RESTAURANT' | 'PROFESSIONAL' | undefined,
            branding: (t.branding as Record<string, unknown>) ?? {},
            isActive: t.isActive !== false,
            marketCategory: (t.marketCategory as string) ?? 'GENERAL',
            enabled,
            isListedInMarket,
            operationalStatus: status,
            businessHours: t.businessHours as Record<string, unknown> | undefined,
            marketId: (t.marketId as string | null) ?? null,
            categoryName: (t.categoryName as string | null | undefined) ?? null,
          };
        });
        const visibleOnly = mapped.filter((t) => t.enabled !== false && t.isListedInMarket !== false);
        if (!cancelled) {
          setTenants(visibleOnly);
          setPromos(banners);
          setSections(layout);
          setBannerImageCacheBust(Date.now());
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
  }, [marketSlug, refreshKey]);

  useEffect(() => {
    if (activeBanners.length <= 1) return;
    const t = setInterval(() => setBannerIdx((i) => (i + 1) % activeBanners.length), 5000);
    return () => clearInterval(t);
  }, [activeBanners.length]);

  useEffect(() => {
    if (bannerIdx >= activeBanners.length && activeBanners.length > 0) {
      setBannerIdx(0);
    }
  }, [activeBanners.length, bannerIdx]);

  const storesPagePath = marketSlug ? `/${marketSlug}/stores` : '/';
  const viewAllPathForSection = (section: Section) =>
    marketSlug
      ? `/${marketSlug}/stores?ids=${(section.storeIds ?? []).join(',')}&title=${encodeURIComponent(section.title || '')}`
      : storesPagePath;

  const getStoreBadge = (slug: string): 'featured' | 'sponsored' | undefined => {
    if (SPONSORED_TENANT_SLUGS.includes(slug)) return 'sponsored';
    if (FEATURED_TENANT_SLUGS.includes(slug)) return 'featured';
    return undefined;
  };

  const getTenantsForSection = (storeIds: string[]): MarketTenant[] => {
    const byId = new Map(tenants.map((t) => [t.id, t]));
    const bySlug = new Map(tenants.map((t) => [t.slug, t]));
    return storeIds
      .map((id) => byId.get(id) ?? bySlug.get(id))
      .filter((t): t is MarketTenant => t != null);
  };

  const matchesSearchAndCategory = (t: MarketTenant): boolean => {
    return !search.trim() || t.name.toLowerCase().includes(search.toLowerCase().trim());
  };

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

  const heroGreeting = `${getTimeBasedGreeting()}, ${market?.name ?? (marketSlug === 'iksal' ? 'إكسال' : marketSlug === 'dabburiyya' || marketSlug === 'daburiyya' ? 'دبورية' : marketSlug)}`;

  return (
    <div className="min-h-screen bg-[#f8fafc] relative overflow-x-hidden">
      {/* Background mesh: fixed blurred circles */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 -end-20 w-[320px] h-[320px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute top-1/2 -start-32 w-[280px] h-[280px] rounded-full bg-secondary/5 blur-3xl" />
        <div className="absolute -bottom-32 end-1/3 w-[240px] h-[240px] rounded-full bg-primary/5 blur-3xl" />
      </div>
      <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200/80 shadow-sm relative">
        <div className="px-5 py-3">
          <div className="relative max-w-6xl mx-auto">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="ابحث باسم المحل..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full ps-5 pe-12 py-2.5 rounded-full border-2 border-gray-200 bg-white/95 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary focus:bg-white text-sm shadow-sm"
            />
          </div>
        </div>
      </div>

      <section className="flex flex-col w-full">
        {activeBanners.length > 0 ? (
          <div className="relative w-full h-[250px] md:aspect-video md:max-h-[320px] rounded-b-2xl overflow-hidden shadow-lg bg-neutral-900">
            <AnimatePresence initial={false}>
              {activeBanners.map((b, i) => {
                if (i !== bannerIdx) return null;
                return (
                  <motion.div
                    key={b.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.4 }}
                    className="absolute inset-0"
                    style={{ transform: 'translateZ(0)', willChange: 'opacity' }}
                  >
                    <Link to={`/${b.linkTo}`} className="block absolute inset-0 z-0">
                      {/* Gradient overlay for readable text on banner image */}
                      <div className="absolute inset-x-0 bottom-0 h-1/2 z-10 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                      <div className="absolute inset-0 z-10 flex flex-col justify-end items-center text-center p-4 md:p-6 pb-6">
                        <p className="text-white/90 text-sm md:text-base mb-1 [text-shadow:0_1px_3px_rgba(0,0,0,0.7)]" aria-hidden>{heroGreeting}</p>
                        <h2 className="font-bold text-white max-w-[90%] [text-shadow:0_2px_6px_rgba(0,0,0,0.8)]" style={heroTitleStyle}>{effectiveBannerTitle(b.title)}</h2>
                      </div>
                      {!bannerImageLoaded[b.id] && (
                        <Skeleton variant="rectangular" className="absolute inset-0 w-full h-full bg-neutral-800" />
                      )}
                      <img
                        src={withCacheBust(resolveImageUrl(b.imageUrl) || BANNER_PLACEHOLDER, bannerImageCacheBust)}
                        alt={b.title}
                        loading="eager"
                        decoding="async"
                        className={`w-full h-full object-cover ${bannerImageLoaded[b.id] ? 'opacity-100' : 'opacity-0'}`}
                        style={{ transition: 'opacity 0.2s ease-out', transform: 'translateZ(0)', willChange: 'opacity' }}
                        onLoad={() => setBannerImageLoaded((prev) => ({ ...prev, [b.id]: true }))}
                        onError={(e) => {
                          const el = e.target as HTMLImageElement;
                          if (el.src !== BANNER_PLACEHOLDER) {
                            el.src = BANNER_PLACEHOLDER;
                            setBannerImageLoaded((prev) => ({ ...prev, [b.id]: true }));
                          }
                        }}
                      />
                    </Link>
                  </motion.div>
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
                    transition={{ duration: 0.15 }}
                    className={`w-2 h-2 rounded-full transition-colors duration-200 ${i === bannerIdx ? 'bg-white' : 'bg-white/50'}`}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="relative w-full h-[250px] md:aspect-video md:max-h-[320px] rounded-b-2xl overflow-hidden bg-gradient-to-b from-primary/10 to-white flex flex-col justify-end items-end text-end p-4 md:p-6 pb-6">
            <p className="text-gray-700/90 text-sm md:text-base [text-shadow:0_1px_2px_rgba(255,255,255,0.8)] relative z-10">{heroGreeting}</p>
          </div>
        )}
        <div className="w-full px-5 py-6">
          <div className="max-w-6xl mx-auto">
            <PillarNav marketSlug={marketSlug} pillars={pillars.length > 0 ? pillars : null} />
          </div>
        </div>
      </section>

      {sections.map((section: Section, idx: number) => {
        const sectionTenants = getTenantsForSection(section.storeIds ?? []).filter(matchesSearchAndCategory);
        if (sectionTenants.length === 0) return null;

        return (
          <motion.section
            key={section.id}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-20px' }}
            transition={{ duration: 0.35, delay: idx * 0.05 }}
            className="py-10"
          >
            <div className="max-w-6xl mx-auto px-5">
              <h2 className="text-lg font-bold text-gray-900 mb-4">{section.title}</h2>
              {loading ? (
                <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-2 snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-5 px-5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="min-w-[140px] w-[140px] aspect-[4/5] shrink-0 snap-start rounded-3xl" />
                  ))}
                </div>
              ) : sectionTenants.length === 0 ? (
                <div className="py-6 text-center rounded-3xl bg-white/80 border border-dashed border-gray-200 shadow-md">
                  <p className="text-sm text-gray-500">لا توجد محلات في هذا القسم</p>
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-2 snap-x snap-mandatory snap-start scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-5 px-5">
                  {sectionTenants.map((t) => (
                    <div key={t.id} className="shrink-0 snap-start w-[140px] min-w-[140px] aspect-[4/5] rounded-3xl overflow-hidden shadow-xl border-none">
                      <StoreCard
                        id={t.id}
                        slug={t.slug}
                        name={t.name}
                        marketSlug={marketSlug}
                        marketCategory={t.marketCategory}
                        type={t.type}
                        branding={t.branding ?? {}}
                        operationalStatus={t.operationalStatus}
                        businessHours={t.businessHours}
                        overrideStatus={(t as { overrideStatus?: 'AUTO' | 'FORCE_OPEN' | 'FORCE_CLOSED' }).overrideStatus}
                        categoryLabel={(t.categoryName ?? getCategoryLabel(categories, t.marketCategory)) || 'تصنيف عام'}
                        badge={getStoreBadge(t.slug)}
                      />
                    </div>
                  ))}
                  <Link to={viewAllPathForSection(section)} className="shrink-0 snap-center flex flex-col items-center justify-center w-[140px] min-w-[140px] aspect-[4/5] rounded-3xl shadow-xl border-none bg-white hover:shadow-2xl transition-shadow">
                    <span className="text-primary font-medium text-xs">عرض الكل</span>
                    <ChevronLeft className="w-5 h-5 text-primary mt-1 rtl:rotate-180" aria-hidden />
                  </Link>
                </div>
              )}
            </div>
          </motion.section>
        );
      })}

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-20px' }}
        transition={{ duration: 0.35 }}
        className="py-10"
      >
        <div className="max-w-6xl mx-auto px-5">
          <div className="rounded-3xl border-2 border-dashed border-gray-200 bg-white/80 shadow-md p-12 text-center">
            <span className="text-4xl mb-3 block">🗺️</span>
            <h3 className="text-lg font-bold text-gray-800 mb-1">
              خريطة {market?.name ?? (marketSlug === 'iksal' ? 'إكسال' : 'دبورية')}
            </h3>
            <p className="text-sm text-gray-500">مواقع المحلات قريباً</p>
          </div>
        </div>
      </motion.section>
    </div>
  );
}
