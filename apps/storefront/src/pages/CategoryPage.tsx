import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import { Skeleton, EmptyState, Button } from '@nmd/ui';
import { formatMoney } from '@nmd/core';
import { useAppStore } from '../store/app';
import { ProductCard } from '../components/ProductCard';
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

const ADMIN_URL = import.meta.env.DEV ? 'http://localhost:5174' : '/admin';

export default function CategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  const tenantId = useAppStore((s) => s.tenantId) ?? 'default';
  const tenantSlug = useAppStore((s) => s.tenantSlug);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);

  const { data: menu } = useQuery({
    queryKey: ['menu', tenantId],
    queryFn: () => api.getMenu(tenantId),
    enabled: !!tenantId,
  });

  const category = menu?.find((c) => c.id === categoryId);
  const subcategories = (menu ?? []).filter((c) => c.parentId === categoryId);
  const isMainCategory = !category?.parentId || category.parentId === '';
  const effectiveCategoryId = selectedSubId || categoryId;

  const needsAllProducts = isMainCategory && subcategories.length > 0 && !selectedSubId;
  const products = useQuery({
    queryKey: ['products', tenantId, needsAllProducts ? 'all' : effectiveCategoryId],
    queryFn: () =>
      needsAllProducts
        ? api.getProducts(tenantId).then((all) => {
            const subIds = new Set(subcategories.map((s) => s.id));
            return all.filter((p) => p.categoryId === categoryId || subIds.has(p.categoryId));
          })
        : api.getProducts(tenantId, effectiveCategoryId!),
    enabled: !!tenantId && (needsAllProducts || !!effectiveCategoryId),
  });

  const allProducts = products.data ?? [];
  const isLoading = products.isLoading;
  const { data: campaigns } = useQuery({
    queryKey: ['campaigns', tenantId],
    queryFn: () => api.getCampaigns(tenantId),
    enabled: !!tenantId,
  });

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <Skeleton className="h-8 w-48 mb-6" />
        <ProductGridSkeleton count={6} columns="2-3-4" />
      </div>
    );
  }

  if (allProducts.length === 0) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{category?.name ?? 'المنتجات'}</h1>
        {isMainCategory && subcategories.length > 0 && (
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
          description="لم تتم إضافة منتجات في هذا التصنيف بعد."
          icon={<span className="text-5xl">📦</span>}
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="outline" onClick={() => navigate(`/${tenantSlug || tenantId}`)}>
                العودة للمتجر
              </Button>
              <a href={`${ADMIN_URL}?tenant=${tenantSlug || tenantId}`} target="_blank" rel="noopener noreferrer">
                <Button>افتح لوحة الإدارة</Button>
              </a>
            </div>
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
    >
      <CampaignBanner tenantId={tenantId} />
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-bold text-gray-900 mb-4"
      >
        {category?.name ?? 'المنتجات'}
      </motion.h1>
      {isMainCategory && subcategories.length > 0 && (
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {allProducts.map((prod, i) => (
          <motion.div
            key={prod.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <ProductCard product={prod} campaigns={campaigns ?? []} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
