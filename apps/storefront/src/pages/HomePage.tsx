import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import { Skeleton, EmptyState, Button } from '@nmd/ui';
import { useAppStore } from '../store/app';
import { useTheme } from '@nmd/ui';
import { onTenantUpdate } from '../lib/tenant-broadcast';
import { TopHeroCarousel } from '../components/TopHeroCarousel';
import { ProductCard } from '../components/ProductCard';
import { ServiceCard } from '../components/ServiceCard';
import { ProfessionalHero } from '../components/ProfessionalHero';
import { AvailableSlotsPlaceholder } from '../components/AvailableSlotsPlaceholder';
import { CollectionSlider } from '../components/CollectionSlider';
import { StatusBadge } from '../components/StatusBadge';
import { ProductGridSkeleton, CategoryTabsSkeleton } from '../components/skeletons';
import { formatMoney, getOperationalStatus, type Product } from '@nmd/core';
import type { HomeCollection } from '@nmd/core';

const api = new MockApiClient();

const ENTRANCE_ALERT_KEY = 'nmd-entrance-alert-dismissed';

function EntranceAlert({
  status,
  orderPolicy,
  onDismiss,
}: {
  status: 'busy' | 'closed';
  orderPolicy: 'accept_always' | 'accept_only_when_open';
  onDismiss: () => void;
}) {
  const busyMsg = 'نحن مشغولون حالياً، قد يستغرق تجهيز طلبك وقتاً أطول.';
  const closedMsg =
    orderPolicy === 'accept_only_when_open'
      ? 'المحل مغلق حالياً، يمكنك تصفح المنتجات وسنقوم بمعالجة طلبك عند الافتتاح.'
      : 'المحل مغلق حالياً، يمكنك التصفح والطلب وسنقوم بمعالجة طلبك عند الافتتاح.';

  return (
    <div
      className={`mb-6 p-4 rounded-xl border-2 flex items-start justify-between gap-4 ${
        status === 'busy'
          ? 'bg-amber-50 border-amber-300 text-amber-900'
          : 'bg-red-50 border-red-500/50 text-red-900'
      }`}
      dir="rtl"
    >
      <p className="font-medium flex-1">{status === 'busy' ? busyMsg : closedMsg}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 px-4 py-2 rounded-lg bg-white/80 hover:bg-white font-medium text-sm border border-gray-200 transition-colors"
      >
        فهمت
      </button>
    </div>
  );
}

function CategoryTab({
  id,
  name,
  activeCategoryId,
  onSelect,
}: {
  id: string;
  name: string;
  activeCategoryId: string | null;
  onSelect: () => void;
}) {
  const isActive = activeCategoryId === id;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
        isActive
          ? 'bg-primary text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {name}
    </button>
  );
}

function CampaignBanner({ tenantId }: { tenantId: string }) {
  const { data: campaigns } = useQuery({
    queryKey: ['campaigns', tenantId],
    queryFn: () => api.getCampaigns(tenantId),
    enabled: !!tenantId,
  });
  const active = (campaigns?.filter((c) => c.status === 'active') ?? []).sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
  );
  const best = active[0];
  if (!best) return null;
  const label = best.type === 'PERCENT' ? `خصم ${best.value}%` : `خصم ${formatMoney(best.value)}`;
  return (
    <div className="mb-4 p-3 rounded-xl bg-primary/10 text-primary font-medium text-center">
      {label}
    </div>
  );
}

export default function HomePage() {
  const { tenantSlug: urlSlug } = useParams<{ tenantSlug?: string }>();
  const { branding } = useTheme();
  const tenantId = useAppStore((s) => s.tenantId) ?? 'default';
  const tenantSlug = useAppStore((s) => s.tenantSlug) ?? urlSlug;
  const tenantName = useAppStore((s) => s.tenantName) ?? '';
  const storeType = useAppStore((s) => s.storeType);
  const isProfessional = storeType === 'PROFESSIONAL';

  const hero = branding.hero;
  const banners = branding.banners ?? [];
  const collections = (branding.collections ?? []).filter((c) => (c as HomeCollection).isActive !== false);
  const mainCategories = (categories: { id: string; name: string; parentId?: string | null; isVisible?: boolean }[]) =>
    (categories ?? []).filter((c) => !c.parentId || c.parentId === '').filter((c) => c.isVisible !== false);
  const { data: categories, isLoading, refetch } = useQuery({
    queryKey: ['menu', tenantId],
    queryFn: () => api.getMenu(tenantId),
    enabled: !!tenantId,
  });

  const { data: allProducts = [] } = useQuery({
    queryKey: ['products', tenantId, 'recent'],
    queryFn: () => api.getProducts(tenantId),
    enabled: !!tenantId,
  });

  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns', tenantId],
    queryFn: () => api.getCampaigns(tenantId),
    enabled: !!tenantId,
  });

  /** Use slug from URL when on tenant route to share cache with TenantGate; fallback to tenantId. Fetches from same API as Mall (Store Admin settings). */
  const tenantKey = urlSlug ?? tenantId;
  const { data: tenant, refetch: refetchTenant } = useQuery({
    queryKey: ['tenant', tenantKey],
    queryFn: () => api.getTenant(tenantKey!),
    enabled: !!tenantKey,
    staleTime: 30 * 1000,
  });

  /** Real-time sync: when Store Admin toggles status, refetch so Store Page reflects immediately */
  useEffect(() => {
    const unsub = onTenantUpdate((updatedTenantId) => {
      if (tenant?.id === updatedTenantId || tenantId === updatedTenantId) refetchTenant();
    });
    return unsub;
  }, [tenant?.id, tenantId, refetchTenant]);

  /** Keep document title in sync with tenant name (prefer tenant from query) */
  const displayName = tenant?.name ?? tenantName;
  useEffect(() => {
    if (displayName) document.title = `${displayName} | متجر`;
  }, [displayName]);

  const operationalStatus = tenant ? getOperationalStatus(tenant) : 'open';
  const orderPolicy = (tenant?.orderPolicy as 'accept_always' | 'accept_only_when_open') ?? 'accept_only_when_open';

  const [alertDismissed, setAlertDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(ENTRANCE_ALERT_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const showEntranceAlert = !alertDismissed && (operationalStatus === 'busy' || operationalStatus === 'closed');

  const handleDismissAlert = () => {
    setAlertDismissed(true);
    try {
      sessionStorage.setItem(ENTRANCE_ALERT_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const mainCats = mainCategories(categories ?? []);
  const services = (allProducts as Product[]).filter((p) => p.isAvailable !== false);
  const isEmpty = !isLoading && mainCats.length === 0 && (!categories || categories.length === 0);
  const isEmptyProfessional = isProfessional && !isLoading && services.length === 0;

  /** Use dynamic collections when configured (backup/10am store design); otherwise fallback to featured + category rows */
  const useDynamicCollections = collections.length > 0;
  function resolveCollectionProducts(c: HomeCollection): Product[] {
    if (c.type === 'category' && c.targetId) {
      return (allProducts as Product[]).filter((p) => p.categoryId === c.targetId);
    }
    if (c.type === 'manual' && c.targetIds?.length) {
      const idSet = new Set(c.targetIds);
      return (allProducts as Product[]).filter((p) => idSet.has(p.id));
    }
    return [];
  }

  if (isEmptyProfessional) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        {tenant && (
          <div className="flex justify-end mb-3">
            <StatusBadge tenant={tenant} variant="hero" />
          </div>
        )}
        {tenant ? (
          <ProfessionalHero tenant={tenant} hero={hero} banners={banners} />
        ) : (
          <section className="mb-12">
            <TopHeroCarousel hero={hero} banners={banners} />
          </section>
        )}
        <EmptyState
          title="لا توجد خدمات متاحة"
          description="لا توجد خدمات معروضة حالياً."
          icon={<span className="text-5xl">📋</span>}
          action={
            <Button variant="outline" onClick={() => refetch()}>
              إعادة المحاولة
            </Button>
          }
        />
      </div>
    );
  }

  if (isEmpty && !isProfessional) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <EmptyState
          title="لا توجد منتجات متاحة"
          description="لا توجد تصنيفات أو منتجات في هذا المتجر حالياً."
          icon={<span className="text-5xl">📦</span>}
          action={
            <Button variant="outline" onClick={() => refetch()}>
              إعادة المحاولة
            </Button>
          }
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <Skeleton className="h-8 w-32 mb-4" />
        <CategoryTabsSkeleton count={4} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-40 w-full rounded-2xl mb-10" />
        <Skeleton className="h-8 w-40 mb-4" />
        <ProductGridSkeleton count={6} columns="2-3-4" />
      </div>
    );
  }

  /** PROFESSIONAL layout: Status Badge + Hero (ProfessionalHero or fallback) + Service List + Available Slots */
  if (isProfessional) {
    return (
      <motion.div
        className="max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        {/* Back to Market is in Header; Status Badge stays above hero */}
        {tenant && (
          <div className="flex justify-end mb-3">
            <StatusBadge tenant={tenant} variant="hero" />
          </div>
        )}

        {/* Hero: always render so the top is never empty */}
        {tenant ? (
          <ProfessionalHero tenant={tenant} hero={hero} banners={banners} />
        ) : (
          <section className="mb-12">
            <TopHeroCarousel hero={hero} banners={banners} />
          </section>
        )}

        {/* Service List */}
        <section className="mb-10" dir="rtl">
          <h2 className="text-xl font-bold text-gray-900 mb-4">خدماتنا</h2>
          <div className="space-y-4">
            {services.map((prod, i) => (
              <motion.div
                key={prod.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <ServiceCard
                  product={prod}
                  tenantSlug={tenantSlug || tenantId}
                  actionType="inquire"
                />
              </motion.div>
            ))}
          </div>
        </section>

        {/* Available Slots placeholder */}
        <AvailableSlotsPlaceholder />
      </motion.div>
    );
  }

  return (
    <motion.div
      className="max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {showEntranceAlert && (
        <EntranceAlert
          status={operationalStatus === 'busy' ? 'busy' : 'closed'}
          orderPolicy={orderPolicy}
          onDismiss={handleDismissAlert}
        />
      )}
      <CampaignBanner tenantId={tenantId} />

      {/* Store status above hero, aligned with Back to Market (left in RTL) */}
      {tenant && (
        <div className="flex justify-end mb-3">
          <StatusBadge tenant={tenant} variant="hero" />
        </div>
      )}

      {/* Horizontal category tabs: above Hero, below Status; smooth scroll to section on click */}
      {(() => {
        const mainCatIds = new Set(mainCats.map((c) => c.id));
        const uncategorized = (allProducts as Product[]).filter(
          (p) => !p.categoryId || !mainCatIds.has(p.categoryId)
        );
        const categoriesWithProducts = mainCats.filter((cat) =>
          (allProducts as Product[]).some((p) => p.categoryId === cat.id)
        );
        const hasOther = uncategorized.length > 0;
        const tabs = [...categoriesWithProducts, ...(hasOther ? [{ id: 'other', name: 'أخرى' }] : [])];
        if (tabs.length === 0) return null;

        return (
          <nav
            className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 sm:mx-0 sm:px-0 mb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden overscroll-x-contain"
            aria-label="التصنيفات"
          >
            {tabs.map((tab) => (
              <CategoryTab
                key={tab.id}
                id={tab.id}
                name={tab.name}
                activeCategoryId={activeCategoryId}
                onSelect={() => {
                  setActiveCategoryId(tab.id);
                  const el = document.getElementById(`category-${tab.id}`);
                  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
              />
            ))}
          </nav>
        );
      })()}

      {/* TopHeroCarousel */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12"
      >
        <TopHeroCarousel hero={hero} banners={banners} />
      </motion.section>

      {/* Dynamic collections (backup/10am store design) or category rows */}
      {useDynamicCollections
        ? [...collections]
            .sort((a, b) => ((a as HomeCollection).sortOrder ?? 0) - ((b as HomeCollection).sortOrder ?? 0))
            .map((c) => {
              const coll = c as HomeCollection;
              const products = resolveCollectionProducts(coll);
              const viewAllHref =
                coll.type === 'category' && coll.targetId
                  ? `/${tenantSlug || tenantId}/category/${coll.targetId}`
                  : coll.type === 'manual' && coll.targetIds?.length
                    ? `/${tenantSlug || tenantId}/products?ids=${coll.targetIds.join(',')}`
                    : mainCats[0]
                      ? `/${tenantSlug || tenantId}/category/${mainCats[0].id}`
                      : `/${tenantSlug || tenantId}/products`;
              return (
                <CollectionSlider
                  key={coll.id}
                  title={coll.title}
                  products={products}
                  campaigns={campaigns}
                  viewAllHref={viewAllHref}
                />
              );
            })
        : null}

      {!useDynamicCollections && (
        <>
      {/* Product rows by category: horizontal scroll per category, after Hero only */}
      {mainCats.map((cat) => {
        const categoryProducts = (allProducts as Product[]).filter((p) => p.categoryId === cat.id);
        if (categoryProducts.length === 0) return null;
        return (
          <section key={cat.id} id={`category-${cat.id}`} className="mb-10 scroll-mt-24">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-lg font-bold text-gray-900">{cat.name}</h2>
              <Link
                to={`/${tenantSlug || tenantId}/category/${cat.id}`}
                className="text-sm font-medium text-[#00A0A0] hover:text-[#008080] hover:underline transition-colors shrink-0"
              >
                عرض الكل
              </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden overscroll-x-contain">
              {categoryProducts.map((prod) => (
                <div key={prod.id} className="shrink-0 w-[160px] sm:w-[180px]">
                  <ProductCard product={prod} campaigns={campaigns} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
      {/* Uncategorized products if any */}
      {(() => {
        const mainCatIds = new Set(mainCats.map((c) => c.id));
        const uncategorized = (allProducts as Product[]).filter(
          (p) => !p.categoryId || !mainCatIds.has(p.categoryId)
        );
        if (uncategorized.length === 0) return null;
        return (
          <section id="category-other" className="mb-10 scroll-mt-24">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-lg font-bold text-gray-900">أخرى</h2>
              <Link
                to={`/${tenantSlug || tenantId}/category/other`}
                className="text-sm font-medium text-[#00A0A0] hover:text-[#008080] hover:underline transition-colors shrink-0"
              >
                عرض الكل
              </Link>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden overscroll-x-contain">
              {uncategorized.map((prod) => (
                <div key={prod.id} className="shrink-0 w-[160px] sm:w-[180px]">
                  <ProductCard product={prod} campaigns={campaigns} />
                </div>
              ))}
            </div>
          </section>
        );
      })()}
        </>
      )}

      {!isProfessional && (
        <section className="mt-12 py-8 rounded-2xl bg-gradient-to-b from-gray-50 to-transparent">
          <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">لماذا تختارنا</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3 text-xl">✓</div>
              <h3 className="font-semibold text-gray-900 mb-1">جودة مضمونة</h3>
              <p className="text-sm text-gray-600">منتجات طازجة واختيار دقيق</p>
            </div>
            <div className="text-center p-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3 text-xl">⚡</div>
              <h3 className="font-semibold text-gray-900 mb-1">توصيل سريع</h3>
              <p className="text-sm text-gray-600">وصول طلبك بأسرع وقت</p>
            </div>
            <div className="text-center p-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3 text-xl">💬</div>
              <h3 className="font-semibold text-gray-900 mb-1">دعم واتساب</h3>
              <p className="text-sm text-gray-600">نحن هنا لمساعدتك</p>
            </div>
          </div>
        </section>
      )}
    </motion.div>
  );
}
