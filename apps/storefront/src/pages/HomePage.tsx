import { Link, NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import { Skeleton, EmptyState, Button } from '@nmd/ui';
import { useAppStore } from '../store/app';
import { useTheme } from '@nmd/ui';
import { TopHeroCarousel } from '../components/TopHeroCarousel';
import { ProductCard } from '../components/ProductCard';
import { ProductGridSkeleton, CategoryTabsSkeleton } from '../components/skeletons';
import { formatMoney, type Product } from '@nmd/core';

const api = new MockApiClient();
const ADMIN_URL = import.meta.env.DEV ? 'http://localhost:5174' : '/admin';

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
  const { branding } = useTheme();
  const tenantId = useAppStore((s) => s.tenantId) ?? 'default';
  const tenantSlug = useAppStore((s) => s.tenantSlug);
  const hero = branding.hero;
  const banners = branding.banners ?? [];
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

  const recentProducts = [...allProducts]
    .sort((a, b) => {
      const aDate = (a as Product).createdAt ?? '0';
      const bDate = (b as Product).createdAt ?? '0';
      return bDate.localeCompare(aDate);
    })
    .slice(0, 6) as Product[];

  const featuredProducts = (() => {
    const featured = (allProducts as Product[]).filter((p) => p.isFeatured === true);
    if (featured.length >= 6) return featured.slice(0, 6);
    if (featured.length > 0) {
      const rest = (allProducts as Product[]).filter((p) => !p.isFeatured).sort((a, b) => {
        const aDate = a.createdAt ?? '0';
        const bDate = b.createdAt ?? '0';
        return bDate.localeCompare(aDate);
      });
      return [...featured, ...rest].slice(0, 6);
    }
    return recentProducts;
  })();

  const tenantName = useAppStore((s) => s.tenantName) ?? '';
  const mainCats = mainCategories(categories ?? []);
  const isEmpty = !isLoading && mainCats.length === 0 && (!categories || categories.length === 0);

  if (isEmpty) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <EmptyState
          title="المحل جاهز ✅"
          description="لسه ما تمت إضافة تصنيفات أو منتجات."
          icon={<span className="text-5xl">📦</span>}
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <a href={`${ADMIN_URL}?tenant=${tenantSlug || tenantId}`} target="_blank" rel="noopener noreferrer">
                <Button>افتح لوحة الإدارة لإضافة منتجات</Button>
              </a>
              <Button variant="outline" onClick={() => refetch()}>
                إعادة المحاولة
              </Button>
            </div>
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

  return (
    <motion.div
      className="max-w-6xl mx-auto p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <CampaignBanner tenantId={tenantId} />

      {/* 1) Categories - minimal underline-style tabs */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">تصفحي حسب الفئة</h2>
        {/* Mobile: horizontal scroll */}
        <div className="flex gap-6 overflow-x-auto pb-2 -mx-4 px-4 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden overscroll-x-contain">
          {mainCats.map((cat) => (
            <NavLink
              key={cat.id}
              to={`/${tenantSlug || tenantId}/c/${cat.id}`}
              className={({ isActive }) =>
                `group flex-shrink-0 relative pb-2 pt-1 text-base font-medium transition-colors duration-200 ${
                  isActive ? 'text-primary font-semibold' : 'text-gray-500 hover:text-primary'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {cat.name}
                  <span
                    className={`absolute bottom-0 start-2 h-0.5 bg-primary transition-[width] duration-200 ease-out ${
                      isActive ? 'w-[calc(100%-1rem)]' : 'w-0 group-hover:w-[calc(100%-1rem)]'
                    }`}
                  />
                </>
              )}
            </NavLink>
          ))}
        </div>
        {/* Desktop: centered row */}
        <div className="hidden md:flex flex-wrap justify-center gap-8">
          {mainCats.map((cat) => (
            <NavLink
              key={cat.id}
              to={`/${tenantSlug || tenantId}/c/${cat.id}`}
              className={({ isActive }) =>
                `group relative pb-2 pt-1 text-lg font-medium transition-colors duration-200 ${
                  isActive ? 'text-primary font-semibold' : 'text-gray-500 hover:text-primary'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {cat.name}
                  <span
                    className={`absolute bottom-0 start-2 h-0.5 bg-primary transition-[width] duration-200 ease-out ${
                      isActive ? 'w-[calc(100%-1rem)]' : 'w-0 group-hover:w-[calc(100%-1rem)]'
                    }`}
                  />
                </>
              )}
            </NavLink>
          ))}
        </div>
      </section>

      {/* 2) TopHeroCarousel */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10"
      >
        <TopHeroCarousel hero={hero} banners={banners} />
      </motion.section>

      {/* 3) مختارات */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-gray-900 mb-1">مختارات {tenantName} ⭐</h2>
        <p className="text-sm text-gray-500 mb-4">أفضل اختياراتنا لك</p>
        {featuredProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {featuredProducts.map((prod, i) => (
              <motion.div
                key={prod.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <ProductCard product={prod} campaigns={campaigns} />
              </motion.div>
            ))}
          </div>
        ) : (
          <EmptyState
            variant="no-data"
            title="لا توجد منتجات مميزة"
            description="أضف منتجات وحدّدها كمميزة في لوحة الإدارة"
            action={
              <a href={`${ADMIN_URL}?tenant=${tenantSlug || tenantId}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">افتح لوحة الإدارة</Button>
              </a>
            }
          />
        )}
      </section>

      {/* 4) وصل حديثًا */}
      <section className="mb-10">
        <div className="flex justify-between items-end mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">وصل حديثًا 💫</h2>
            <p className="text-sm text-gray-500">موديلات جديدة كل أسبوع</p>
          </div>
          {mainCats[0] && recentProducts.length > 0 && (
            <Link
              to={`/${tenantSlug || tenantId}/c/${mainCats[0].id}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              عرض الكل
            </Link>
          )}
        </div>
        {recentProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {recentProducts.map((prod, i) => (
              <motion.div
                key={prod.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <ProductCard product={prod} campaigns={campaigns} />
              </motion.div>
            ))}
          </div>
        ) : (
          <EmptyState
            variant="no-data"
            title="لا توجد منتجات حديثة"
            description="أضف منتجات في لوحة الإدارة لتظهر هنا"
            action={
              <a href={`${ADMIN_URL}?tenant=${tenantSlug || tenantId}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm">افتح لوحة الإدارة</Button>
              </a>
            }
          />
        )}
      </section>

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
    </motion.div>
  );
}
