import { useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Store, ArrowRight } from 'lucide-react';
import { getTenantListForMallAsync } from '@nmd/mock';
import { resolveImageUrl } from '../lib/image-url';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

interface PillarFromApi {
  id: string;
  name: string;
  nameAr?: string;
  slug: string;
  sortOrder: number;
}

interface SubCategoryFromApi {
  id: string;
  pillarId: string;
  name: string;
  nameAr?: string;
  slug?: string;
  sortOrder: number;
}

interface MarketTenant {
  id: string;
  slug: string;
  name: string;
  type: string;
  tenantType?: 'RESTAURANT' | 'SHOP' | 'SERVICE';
  storeType?: 'RESTAURANT' | 'PROFESSIONAL';
  branding: { logoUrl?: string; primaryColor?: string };
  marketCategory: string;
  operationalStatus?: 'open' | 'closed' | 'busy';
  businessHours?: Record<string, unknown>;
  pillarId?: string | null;
  subCategoryId?: string | null;
}

export default function MarketSectionPage() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);
  const marketSlug = segments[0] ?? '';
  const pillarSlug = (segments[2] as string) ?? '';

  const [tenants, setTenants] = useState<MarketTenant[]>([]);
  const [pillars, setPillars] = useState<PillarFromApi[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategoryFromApi[]>([]);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setMarketName] = useState('');

  useEffect(() => {
    const slug = marketSlug === 'daburiyya' ? 'dabburiyya' : marketSlug;
    if (!slug) {
      setTenants([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    if (!MOCK_API_URL) {
      setMarketName(slug === 'dabburiyya' ? 'سوق دبورية الرقمي' : slug === 'iksal' ? 'سوق إكسال الرقمي' : slug);
      getTenantListForMallAsync(slug)
        .then((list) => {
          if (cancelled) return;
          const mapped = (list ?? []).map((t) => {
            const os = (t as { operationalStatus?: string }).operationalStatus;
            const status: 'open' | 'busy' | 'closed' | undefined = (os === 'open' || os === 'closed' || os === 'busy') ? os : undefined;
            const type = (t as { type?: string }).type ?? 'GENERAL';
            const tenantType = (t as { tenantType?: string }).tenantType ?? (type === 'FOOD' ? 'RESTAURANT' : 'SHOP');
            const storeType = (t as { storeType?: string }).storeType;
            return {
              id: t.id,
              slug: t.slug,
              name: t.name,
              type,
              tenantType: tenantType as 'RESTAURANT' | 'SHOP' | 'SERVICE',
              storeType: storeType as 'RESTAURANT' | 'PROFESSIONAL' | undefined,
              branding: t.branding ?? {},
              marketCategory: (t as { marketCategory?: string }).marketCategory ?? 'GENERAL',
              operationalStatus: status,
              businessHours: (t as { businessHours?: Record<string, unknown> }).businessHours,
              pillarId: (t as { pillarId?: string | null }).pillarId ?? null,
              subCategoryId: (t as { subCategoryId?: string | null }).subCategoryId ?? null,
            };
          });
          setTenants(mapped.filter((t) => (t as { enabled?: boolean }).enabled !== false && (t as { isListedInMarket?: boolean }).isListedInMarket !== false));
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; };
    }
    setMarketName(slug === 'dabburiyya' ? 'سوق دبورية الرقمي' : slug === 'iksal' ? 'سوق إكسال الرقمي' : slug);
    fetch(`${MOCK_API_URL}/markets/by-slug/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(async (m) => {
        if (cancelled || !m) return;
        setMarketName((m as { name?: string }).name ?? slug);
        const marketId = (m as { id?: string }).id;
        const url = marketId
          ? `${MOCK_API_URL}/markets/${marketId}/tenants?_t=${Date.now()}`
          : `${MOCK_API_URL}/storefront/tenants?_t=${Date.now()}`;
        const res = await fetch(url);
        const list = await res.json();
        const raw = Array.isArray(list) ? list : [];
        const mapped: MarketTenant[] = raw.map((t: Record<string, unknown>) => {
          const os = t.operationalStatus as string | undefined;
          const status: 'open' | 'busy' | 'closed' | undefined = (os === 'open' || os === 'closed' || os === 'busy') ? os : undefined;
          const type = (t.type === 'CLOTHING' || t.type === 'FOOD') ? t.type : 'GENERAL';
          const tenantType = (t.tenantType as string) ?? (type === 'FOOD' ? 'RESTAURANT' : 'SHOP');
          return {
            id: String(t.id ?? ''),
            slug: String(t.slug ?? ''),
            name: String(t.name ?? ''),
            type,
            tenantType: tenantType as 'RESTAURANT' | 'SHOP' | 'SERVICE',
            storeType: t.storeType as 'RESTAURANT' | 'PROFESSIONAL' | undefined,
            branding: (t.branding as Record<string, unknown>) ?? {},
            marketCategory: (t.marketCategory as string) ?? 'GENERAL',
            operationalStatus: status,
            businessHours: t.businessHours as Record<string, unknown> | undefined,
            pillarId: (t.pillarId as string | null) ?? null,
            subCategoryId: (t.subCategoryId as string | null) ?? null,
          };
        });
        if (!cancelled) setTenants(mapped.filter((t) => (t as { enabled?: boolean }).enabled !== false && (t as { isListedInMarket?: boolean }).isListedInMarket !== false));
      })
      .catch(() => { if (!cancelled) setTenants([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [marketSlug]);

  useEffect(() => {
    if (!MOCK_API_URL) return;
    fetch(`${MOCK_API_URL}/pillars`)
      .then((r) => (r.ok ? r.json() : []))
      .then((p) => setPillars(Array.isArray(p) ? p : []))
      .catch(() => {});
  }, []);

  const pillarFromApi = pillars.find((p) => p.slug === pillarSlug);
  const pillarId = pillarFromApi?.id ?? null;

  useEffect(() => {
    if (!MOCK_API_URL || !pillarId) {
      setSubCategories([]);
      setSelectedSubId(null);
      return;
    }
    fetch(`${MOCK_API_URL}/sub-categories?pillarId=${encodeURIComponent(pillarId)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        const sorted = Array.isArray(list)
          ? [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
          : [];
        setSubCategories(sorted);
        setSelectedSubId(null);
      })
      .catch(() => setSubCategories([]));
  }, [pillarId]);

  const pillarStores = pillarFromApi ? tenants.filter((t) => t.pillarId === pillarFromApi.id) : [];
  const filteredStores =
    selectedSubId != null
      ? pillarStores.filter((t) => t.subCategoryId === selectedSubId)
      : pillarStores;

  const sectionTitle = pillarFromApi ? (pillarFromApi.nameAr ?? pillarFromApi.name) : (pillarSlug || 'القسم');
  const backHref = marketSlug ? `/${marketSlug}` : '/';

  return (
    <div className="min-h-screen bg-[#f8fafc] relative overflow-hidden" dir="rtl">
      {/* Background mesh: fixed blurred circles */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 -end-20 w-[320px] h-[320px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute top-1/2 -start-32 w-[280px] h-[280px] rounded-full bg-secondary/5 blur-3xl" />
        <div className="absolute -bottom-32 end-1/3 w-[240px] h-[240px] rounded-full bg-primary/5 blur-3xl" />
      </div>
      {/* Title bar only — no PillarNav, no filter bar */}
      <div className="sticky top-0 z-30 px-5 py-3 bg-white/80 border-b border-gray-200/80 backdrop-blur-md shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Link
            to={backHref}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200/80 text-gray-700 hover:border-primary/30 hover:text-primary transition-all shrink-0"
          >
            <ArrowRight className="w-5 h-5" />
            <span className="text-sm font-medium">السوق</span>
          </Link>
          <h1 className="text-lg font-bold text-gray-900 truncate flex-1 text-center">
            {sectionTitle}
          </h1>
          <div className="w-[72px] shrink-0" aria-hidden />
        </div>
      </div>

      {/* Sub-category ribbon: only when pillar has sub-categories; sticky glass, horizontal scroll */}
      {subCategories.length > 0 && (
        <div className="sticky top-[calc(3rem+env(safe-area-inset-top))] z-20 px-4 py-3 bg-white/60 backdrop-blur-md border-b border-white/20 shadow-sm">
          <div className="max-w-6xl mx-auto overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-2 pb-1 min-w-0">
              <button
                type="button"
                onClick={() => setSelectedSubId(null)}
                className={`shrink-0 rounded-full px-6 py-2 text-sm font-medium transition-all border backdrop-blur-md ${selectedSubId === null ? 'bg-primary/15 text-primary border-primary/30' : 'bg-white/70 text-gray-700 border-white/20 hover:bg-white/90'}`}
              >
                الكل
              </button>
              {subCategories.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSelectedSubId(sub.id)}
                  className={`shrink-0 rounded-full px-6 py-2 text-sm font-medium transition-all border backdrop-blur-md ${selectedSubId === sub.id ? 'bg-primary/15 text-primary border-primary/30' : 'bg-white/70 text-gray-700 border-white/20 hover:bg-white/90'}`}
                >
                  {sub.nameAr ?? sub.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-5 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : pillarStores.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-16 text-center rounded-3xl bg-white shadow-xl border-none"
          >
            <Store className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">لا توجد محلات في هذا القسم</p>
            <Link to={backHref} className="inline-block mt-4 text-primary font-medium hover:underline">
              العودة للسوق
            </Link>
          </motion.div>
        ) : filteredStores.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-12 text-center rounded-3xl bg-white/80 shadow-lg border border-gray-100"
          >
            <p className="text-gray-600">لا توجد محلات في هذا التصنيف</p>
            <button
              type="button"
              onClick={() => setSelectedSubId(null)}
              className="mt-3 text-primary text-xs font-medium hover:underline"
            >
              عرض الكل
            </button>
          </motion.div>
        ) : (
          /* Grid filtered by sub-category; staggered animation when filter changes */
          <section className="grid grid-cols-2 gap-4 relative">
            <AnimatePresence mode="popLayout">
              {filteredStores.map((t, i) => (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                >
                  <Link to={`/${t.slug}`} className="block active:scale-95 transition-transform duration-150 ease-out">
                    <div className="rounded-3xl shadow-xl border-none overflow-hidden bg-white hover:shadow-2xl transition-shadow aspect-[4/5]">
                      <div className="relative w-full h-full min-h-[140px]">
                        <img src={resolveImageUrl(t.branding?.logoUrl) || `https://picsum.photos/seed/${t.slug}/400/300`} alt={t.name} className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent rounded-3xl" />
                        <div className="absolute inset-x-0 bottom-0 p-4 flex flex-col justify-end rounded-b-3xl">
                          <h3 className="text-sm font-bold text-white truncate drop-shadow-md">{t.name}</h3>
                          {t.operationalStatus && (
                            <span className={`text-[10px] mt-0.5 inline-flex items-center gap-1 ${t.operationalStatus === 'open' ? 'text-emerald-300' : t.operationalStatus === 'busy' ? 'text-amber-300' : 'text-red-300'}`}>
                              {t.operationalStatus === 'open' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-open-dot" />}
                              {t.operationalStatus === 'open' ? 'مفتوح' : t.operationalStatus === 'busy' ? 'مشغول' : 'مغلق'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </section>
        )}
      </main>
    </div>
  );
}
