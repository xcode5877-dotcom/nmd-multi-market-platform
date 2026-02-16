import { memo } from 'react';
import { Skeleton } from '@nmd/ui';

function ProductCardSkeletonInner() {
  return (
    <article
      className="bg-white rounded-2xl shadow-sm overflow-hidden"
      dir="rtl"
    >
      <div className="aspect-[4/5] w-full bg-gray-100 relative overflow-hidden">
        <Skeleton
          variant="rectangular"
          className="absolute inset-0 w-full h-full rounded-none"
        />
      </div>
      <div className="p-3 flex flex-col gap-0.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="flex items-center justify-between gap-2 mt-1">
          <Skeleton className="h-5 w-16" />
          <Skeleton variant="circular" className="w-9 h-9" />
        </div>
      </div>
    </article>
  );
}

export const ProductCardSkeleton = memo(ProductCardSkeletonInner);
