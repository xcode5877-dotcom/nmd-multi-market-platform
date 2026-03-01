import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Product, Campaign } from '@nmd/core';
import { ProductCard } from './ProductCard';
import { EmptyState } from '@nmd/ui';

interface CollectionSliderProps {
  title: string;
  products: Product[];
  campaigns: Campaign[];
  viewAllHref: string;
  viewAllLabel?: string;
}

/**
 * Horizontal product slider with CSS scroll-snap.
 * Desktop: 4 products per row.
 * Mobile: ~2.5 products visible with peek of next.
 */
export function CollectionSlider({
  title,
  products,
  campaigns,
  viewAllHref,
  viewAllLabel = 'عرض الكل',
}: CollectionSliderProps) {
  if (products.length === 0) {
    return (
      <section className="mb-10">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{title}</h2>
        <EmptyState
          variant="no-data"
          title="لا توجد منتجات"
          description="لا توجد منتجات في هذا القسم حالياً."
        />
      </section>
    );
  }

  return (
    <section className="mb-10">
      <div className="flex justify-between items-end mb-4">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <Link
          to={viewAllHref}
          className="text-sm font-medium text-primary hover:underline shrink-0"
        >
          {viewAllLabel}
        </Link>
      </div>
      {/* Horizontal scroll: scroll-snap, 4 per row desktop, peek on mobile */}
      <div
        className="flex gap-2 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden overscroll-x-contain"
        style={{
          scrollSnapType: 'x mandatory',
        }}
      >
        {products.map((prod, i) => (
          <motion.div
            key={prod.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex shrink-0 w-[calc(50%-0.25rem)] min-[480px]:w-[180px] md:w-[180px] snap-start"
            style={{ scrollSnapAlign: 'start' }}
          >
            <div className="h-full flex items-stretch">
              <ProductCard product={prod} campaigns={campaigns} />
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
