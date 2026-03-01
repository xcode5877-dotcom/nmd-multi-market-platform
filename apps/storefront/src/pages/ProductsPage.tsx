import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import { Skeleton, EmptyState, Button } from '@nmd/ui';
import { useAppStore } from '../store/app';
import { ProductCard } from '../components/ProductCard';
import { ProductGridSkeleton } from '../components/skeletons';

const api = new MockApiClient();

export default function ProductsPage() {
  const [searchParams] = useSearchParams();
  const idsParam = searchParams.get('ids');
  const productIds = idsParam ? idsParam.split(',').filter(Boolean) : null;

  const tenantId = useAppStore((s) => s.tenantId) ?? 'default';

  const { data: allProducts = [], isLoading } = useQuery({
    queryKey: ['products', tenantId, productIds ? `ids-${productIds.join(',')}` : 'all'],
    queryFn: () => api.getProducts(tenantId),
    enabled: !!tenantId,
  });

  const products = productIds?.length
    ? allProducts.filter((p) => productIds.includes(p.id))
    : allProducts;

  const { data: campaigns = [] } = useQuery({
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

  if (products.length === 0) {
    return (
      <div className="max-w-6xl mx-auto p-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">المنتجات</h1>
        <EmptyState
          title="لا توجد منتجات"
          description="لا توجد منتجات متاحة حالياً."
          icon={<span className="text-5xl">📦</span>}
          action={
            <Button variant="outline" onClick={() => window.history.back()}>
              العودة
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
    >
      <h1 className="text-2xl font-bold text-gray-900 mb-6">المنتجات</h1>
      <div className="grid grid-cols-2 md:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
        {products.map((prod, i) => (
          <motion.div
            key={prod.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="w-full"
          >
            <ProductCard product={prod} campaigns={campaigns} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
