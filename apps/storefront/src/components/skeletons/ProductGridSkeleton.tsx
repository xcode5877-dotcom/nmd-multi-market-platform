import { memo } from 'react';
import { ProductCardSkeleton } from '../ProductCardSkeleton';

interface ProductGridSkeletonProps {
  count?: number;
  columns?: '2' | '2-3-4' | '2-4';
}

const GRID_CLASS = {
  '2': 'grid-cols-2',
  '2-3-4': 'grid-cols-2 md:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]',
  '2-4': 'grid-cols-2 md:grid-cols-4',
} as const;

function ProductGridSkeletonInner({ count = 6, columns = '2-3-4' }: ProductGridSkeletonProps) {
  return (
    <div className={`grid gap-2 ${GRID_CLASS[columns]}`}>
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export const ProductGridSkeleton = memo(ProductGridSkeletonInner);
