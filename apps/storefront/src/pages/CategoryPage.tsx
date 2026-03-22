import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import { Skeleton, EmptyState, Button } from '@nmd/ui';
import { formatMoney } from '@nmd/core';
import { useAppStore } from '../store/app';
import { ProductCard } from '../components/ProductCard';
import { ServiceCard } from '../components/ServiceCard';
import { ProductGridSkeleton } from '../components/skeletons';

const api = new MockApiClient();

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

const isOtherCategory = (id: string) => id === 'other';

export default function CategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  const tenantId = useAppStore((s) => s.tenantId) ?? 'default';
  const tenantSlug = useAppStore((s) => s.tenantSlug);
  const storeType = useAppStore((s) => s.storeType);
  const isProfessional = storeType === 'PROFESSIONAL';
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);

  const { data: menu } = useQuery({
    queryKey: ['menu', tenantId],
    queryFn: () => api.getMenu(tenantId),
    enabled: !!tenantId && !isOtherCategory(categoryId ?? ''),
  });

  const sortedMenu = (menu ?? []).slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const category = isOtherCategory(categoryId ?? '') ? { id: 'other', name: 'أخرى', parentId: null } : sortedMenu.find((c) => c.id === categoryId);
  const subcategories = sortedMenu.filter((c) => c.parentId === categoryId);
  const isMainCategory = !category?.parentId || category.parentId === '';
  const effectiveCategoryId = selectedSubId || categoryId;

  const needsAllProducts = isMainCategory && subcategories.length > 0 && !selectedSubId;
  const productsForCategory = useQuery({
    queryKey: ['products', tenantId, needsAllProducts ? 'all' : effectiveCategoryId],
    queryFn: () =>
      needsAllProducts
        ? api.getProducts(tenantId).then((all) => {
            const subIds = new Set(subcategories.map((s) => s.id));
            return all.filter((p) => p.categoryId === categoryId || subIds.has(p.categoryId));
          })
        : api.getProducts(tenantId, effectiveCategoryId!),
    enabled: !!tenantId && (needsAllProducts || !!effectiveCategoryId) && !isOtherCategory(categoryId ?? ''),
  });

  const productsOther = useQuery({
    queryKey: ['products', tenantId, 'other'],
    queryFn: async () => {
      const [all, menuData] = await Promise.all([api.getProducts(tenantId), api.getMenu(tenantId)]);
      const mainCatIds = new Set((menuData ?? []).filter((c) => !c.parentId || c.parentId === '').map((c) => c.id));
      return all.filter((p) => !p.categoryId || !mainCatIds.has(p.categoryId));
    },
    enabled: !!tenantId && isOtherCategory(categoryId ?? ''),
  });

  const allProductsRaw = isOtherCategory(categoryId ?? '') ? (productsOther.data ?? []) : (productsForCategory.data ?? []);
  const allProducts = allProductsRaw.slice().sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const isLoading = isOtherCategory(categoryId ?? '') ? productsOther.isLoading : productsForCategory.isLoading;
  const { data: campaigns } = useQuery({
    queryKey: ['campaigns', tenantId],
    queryFn: () => api.getCampaigns(tenantId),
    enabled: !!tenantId,
  });

  const backHref = `/${tenantSlug || tenantId}`;
  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-4" style={{ ['--color-primary' as string]: '#00A0A0' }}>
        <Link to={backHref} className="inline-flex items-center gap-1 text-sm font-medium text-[#00A0A0] hover:text-[#008080] mb-4">
          <ChevronRight className="w-4 h-4" aria-hidden />
          العودة للمتجر
        </Link>
        <Skeleton className="h-8 w-48 mb-6" />
        <ProductGridSkeleton count={6} columns="2-3-4" />
      </div>
    );
  }

  const showSubcategories = isMainCategory && subcategories.length > 0 && !isOtherCategory(categoryId ?? '');

  if (allProducts.length === 0) {
    return (
      <div className="max-w-6xl mx-auto p-4" style={{ ['--color-primary' as string]: '#00A0A0' }}>
        <Link to={backHref} className="inline-flex items-center gap-1 text-sm font-medium text-[#00A0A0] hover:text-[#008080] mb-4">
          <ChevronRight className="w-4 h-4" aria-hidden />
          العودة للمتجر
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{category?.name ?? 'المنتجات'}</h1>
        {showSubcategories && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              type="button"
              onClick={() => setSelectedSubId(null)}
              className="px-4 py-2 rounded-full text-sm font-medium bg-primary text-white"
            >
              الكل
            </button>
            {subcategories.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => setSelectedSubId(sub.id)}
                className="px-4 py-2 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                {sub.name}
              </button>
            ))}
          </div>
        )}
        <EmptyState
          title="لا توجد منتجات"
          description="لا توجد منتجات متاحة في هذا التصنيف حالياً."
          icon={<span className="text-5xl">📦</span>}
          action={
            <Button variant="outline" onClick={() => navigate(`/${tenantSlug || tenantId}`)}>
              العودة للرئيسية
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <motion.div
      className="max-w-6xl mx-auto p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      style={{ ['--color-primary' as string]: '#00A0A0' }}
    >
      <CampaignBanner tenantId={tenantId} />
      <Link to={backHref} className="inline-flex items-center gap-1 text-sm font-medium text-[#00A0A0] hover:text-[#008080] mb-4">
        <ChevronRight className="w-4 h-4" aria-hidden />
        العودة للمتجر
      </Link>
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-bold text-gray-900 mb-4"
      >
        {category?.name ?? 'المنتجات'}
      </motion.h1>
      {showSubcategories && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            type="button"
            onClick={() => setSelectedSubId(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              !selectedSubId ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            الكل
          </button>
          {subcategories.map((sub) => (
            <button
              key={sub.id}
              type="button"
              onClick={() => setSelectedSubId(sub.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedSubId === sub.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {sub.name}
            </button>
          ))}
        </div>
      )}
      {isProfessional ? (
        <div className="space-y-4">
          {allProducts.map((prod, i) => (
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
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {allProducts.map((prod, i) => (
            <motion.div
              key={prod.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="w-full"
            >
              <ProductCard product={prod} campaigns={campaigns ?? []} />
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
