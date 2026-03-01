import { memo } from 'react';
import { Skeleton } from '@nmd/ui';

function ProductCardSkeletonInner() {
  return (
    <article
      className="h-[380px] md:h-[420px] flex flex-col bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm"
      style={{ borderWidth: '0.5px' }}
      dir="rtl"
    >
      <div className="aspect-square w-full bg-[#f8f8f8] relative overflow-hidden flex-shrink-0">
        <Skeleton
          variant="rectangular"
          className="absolute inset-0 w-full h-full rounded-none"
        />
      </div>
      <div className="p-3 flex flex-col flex-1 min-h-0">
        <Skeleton className="h-[2.5rem] md:h-[3rem] w-full shrink-0" />
        <div className="flex-1 min-h-0" />
        <div className="flex items-center justify-between gap-2 mt-auto flex-shrink-0 pt-3">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gray-200" />
        </div>
      </div>
    </article>
  );
}

export const ProductCardSkeleton = memo(ProductCardSkeletonInner);
