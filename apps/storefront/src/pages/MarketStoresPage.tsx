import { useLocation, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Skeleton } from '@nmd/ui';
import { useState, useEffect, useMemo } from 'react';
import { Store, Search, ArrowRight } from 'lucide-react';
import { getTenantListForMallAsync } from '@nmd/mock';
import { PillarNav } from '../components/PillarNav';
import { onTenantUpdate } from '../lib/tenant-broadcast';
import { resolveImageUrl } from '../lib/image-url';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

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
  marketId?: string | null;
  enabled?: boolean;
  isListedInMarket?: boolean;
  operationalStatus?: 'open' | 'closed' | 'busy';
  businessHours?: Record<string, unknown>;
  openTime?: string;
  closeTime?: string;
  forceClosed?: boolean;
}

export default function MarketStoresPage() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const idsParam = searchParams.get('ids')?.trim() || '';
  const titleParam = searchParams.get('title')?.trim() || '';
  const filterIds = idsParam ? idsParam.split(',').map((s) => s.trim()).filter(Boolean) : null;
  const marketSlug = pathname.split('/').filter(Boolean)[0] ?? '';
  const [market, setMarket] = useState<Market | null>(null);
  const [tenants, setTenants] = useState<MarketTenant[]>([]);
  const [pillars, setPillars] = useState<Array<{ id: string; name: string; nameAr?: string; slug: string; icon?: string; sortOrder: number }>>([]);
  const [loading, setLoading] = useState(true);
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
    const title = titleParam || 'كل المحلات';
    const marketName = market?.name ?? '';
    document.title = marketName ? `${title} — ${marketName}` : title;
    return () => {
      document.title = '';
    };
  }, [titleParam, market?.name]);

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
        if (!cancelled) {
          const mapped = (list ?? []).map((t) => {
            const os = (t as { operationalStatus?: string }).operationalStatus;
            const status: 'open' | 'busy' | 'closed' | undefined = os === 'open' || os === 'closed' || os === 'busy' ? os : undefined;
            const bh = (t as { businessHours?: Record<string, unknown> }).businessHours;
            const openTime = (t as { openTime?: string }).openTime;
            const closeTime = (t as { closeTime?: string }).closeTime;
            const forceClosed = (t as { forceClosed?: boolean }).forceClosed;
            const enabled = (t as { enabled?: boolean }).enabled !== false;
            const isListedInMarket = (t as { isListedInMarket?: boolean }).isListedInMarket !== false;
            return {
              id: t.id,
              slug: t.slug,
              name: t.name,
              type: (t as { type?: string }).type ?? 'GENERAL',
              branding: t.branding ?? {},
              isActive: true,
              marketCategory: (t as { marketCategory?: string }).marketCategory ?? 'GENERAL',
              marketId: (t as { marketId?: string | null }).marketId ?? undefined,
              enabled,
              isListedInMarket,
              operationalStatus: status,
              businessHours: bh,
              openTime,
              closeTime,
              forceClosed,
            };
          });
          setTenants(mapped.filter((t) => t.enabled !== false && t.isListedInMarket !== false));
        }
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
        const marketId = (m as { id?: string }).id;
        const tenantsRes = marketId
          ? await fetch(`${MOCK_API_URL}/markets/${marketId}/tenants?_t=${Date.now()}`)
          : await fetch(`${MOCK_API_URL}/storefront/tenants?_t=${Date.now()}`);
        const list = await tenantsRes.json();
        const raw = Array.isArray(list) ? list : [];
        const mapped: MarketTenant[] = raw.map((t: Record<string, unknown>) => {
          const os = t.operationalStatus as string | undefined;
          const status: 'open' | 'busy' | 'closed' | undefined = os === 'open' || os === 'closed' || os === 'busy' ? os : undefined;
          const enabled = ((t.enabled as boolean) ?? (t.isActive as boolean) ?? true) !== false;
          const isListedInMarket = (t.isListedInMarket as boolean) !== false;
          return {
            id: String(t.id ?? ''),
            slug: String(t.slug ?? ''),
            name: String(t.name ?? ''),
            type: (t.type === 'CLOTHING' || t.type === 'FOOD') ? t.type : 'GENERAL',
            branding: (t.branding as Record<string, unknown>) ?? {},
            isActive: t.isActive !== false,
            marketCategory: (t.marketCategory as string) ?? 'GENERAL',
            marketId: (t.marketId as string | null | undefined) ?? undefined,
            enabled,
            isListedInMarket,
            operationalStatus: status,
            businessHours: t.businessHours as Record<string, unknown> | undefined,
            openTime: t.openTime as string | undefined,
            closeTime: t.closeTime as string | undefined,
            forceClosed: t.forceClosed as boolean | undefined,
          };
        });
        const visibleOnly = mapped.filter((t) => t.enabled !== false && t.isListedInMarket !== false);
        if (!cancelled) setTenants(visibleOnly);
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

  const pageTitle = titleParam || 'كل المحلات';

  const visibleTenants = useMemo(
    () => tenants.filter((t) => t.enabled !== false && t.isListedInMarket !== false),
    [tenants]
  );
  const tenantsInScope = useMemo(
    () =>
      filterIds && filterIds.length > 0
        ? visibleTenants.filter((t) => filterIds.some((id) => id === t.id || id === t.slug))
        : visibleTenants,
    [visibleTenants, filterIds]
  );
  const filteredTenants = useMemo(
    () =>
      tenantsInScope.filter((t) =>
        !search.trim() || t.name.toLowerCase().includes(search.toLowerCase().trim())
      ),
    [tenantsInScope, search]
  );

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
    <div className="min-h-screen bg-[#f8fafc] relative overflow-hidden" dir="rtl">
      {/* Background mesh: fixed blurred circles */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-40 -end-20 w-[320px] h-[320px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute top-1/2 -start-32 w-[280px] h-[280px] rounded-full bg-secondary/5 blur-3xl" />
        <div className="absolute -bottom-32 end-1/3 w-[240px] h-[240px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="sticky top-0 z-30 px-5 py-3 bg-white/80 border-b border-gray-200/80 backdrop-blur-md shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Link
            to={marketHomePath}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-gray-200/80 text-gray-700 hover:border-primary/30 hover:text-primary transition-all shrink-0"
          >
            <ArrowRight className="w-5 h-5" />
            <span className="text-sm font-medium">السوق</span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 truncate flex-1 text-center">
            {pageTitle}
          </h1>
          <div className="w-[72px] shrink-0" aria-hidden />
        </div>
      </div>

      {/* PillarNav: same circular glass style as Home */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="px-5 py-6 relative"
      >
        <div className="max-w-6xl mx-auto">
          <PillarNav marketSlug={marketSlug} pillars={pillars.length > 0 ? pillars : null} />
        </div>
      </motion.section>

      {/* Search */}
      <div className="max-w-6xl mx-auto px-5 pb-4 relative">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="ابحث باسم المحل..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full ps-4 pe-12 py-2.5 rounded-xl border border-gray-200 bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
          />
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-5 py-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="aspect-[4/5] rounded-3xl" />
            ))}
          </div>
        ) : filteredTenants.length === 0 ? (
          <div className="py-16 text-center rounded-3xl bg-white/90 shadow-xl border border-gray-100">
            <span className="text-5xl mb-4 block">🏬</span>
            <p className="text-gray-600">
              {tenantsInScope.length === 0 && !search.trim()
                ? (filterIds?.length ? 'لا توجد محلات في هذه المجموعة' : 'لا توجد محلات في هذا السوق')
                : 'لا توجد محلات تطابق البحث'}
            </p>
            <Link to={marketHomePath} className="inline-block mt-4 text-primary font-medium hover:underline">
              ← العودة للسوق
            </Link>
          </div>
        ) : (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 gap-4"
          >
            {filteredTenants.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.04 }}
              >
                <Link to={`/${t.slug}`} className="block active:scale-95 transition-transform duration-150 ease-out">
                  <div className="rounded-3xl shadow-xl border-none overflow-hidden bg-white hover:shadow-2xl transition-shadow aspect-[4/5]">
                    <div className="relative w-full h-full min-h-[140px]">
                      <img src={resolveImageUrl(t.branding?.logoUrl) || `https://picsum.photos/seed/${t.slug}/400/300`} alt={t.name} className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent rounded-3xl" />
                      <div className="absolute inset-x-0 bottom-0 p-4 flex flex-col justify-end rounded-b-3xl">
                        <h3 className="text-sm font-bold text-white truncate drop-shadow-md">{t.name}</h3>
                        {(() => {
                          const isAdminClosed = (t as { overrideStatus?: string }).overrideStatus === 'FORCE_CLOSED';
                          const isAdminOpen = (t as { overrideStatus?: string }).overrideStatus === 'FORCE_OPEN';
                          const st = isAdminClosed ? 'closed' : isAdminOpen ? 'open' : (t.operationalStatus ?? null);
                          if (!st && !isAdminClosed && !isAdminOpen) return null;
                          const effectiveStatus = st ?? 'open';
                          const label = isAdminClosed ? 'مغلق مؤقتاً' : effectiveStatus === 'open' ? 'مفتوح' : effectiveStatus === 'busy' ? 'مشغول' : 'مغلق';
                          const color = effectiveStatus === 'open' ? 'text-emerald-300' : effectiveStatus === 'busy' ? 'text-amber-300' : 'text-red-300';
                          return (
                            <span className={`text-[10px] mt-0.5 inline-flex items-center gap-1 ${color}`}>
                              {effectiveStatus === 'open' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-open-dot" />}
                              {label}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.section>
        )}
      </main>
    </div>
  );
}
