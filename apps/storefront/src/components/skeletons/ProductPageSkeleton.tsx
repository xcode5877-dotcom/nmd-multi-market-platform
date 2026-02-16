import { memo } from 'react';
import { Skeleton } from '@nmd/ui';

function ProductPageSkeletonInner() {
  return (
    <div className="max-w-5xl mx-auto p-4" dir="rtl">
      <div className="grid md:grid-cols-2 gap-6 md:gap-8">
        {/* Gallery */}
        <div className="space-y-3">
          <Skeleton className="aspect-[4/5] rounded-2xl" />
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="w-16 h-20 rounded-xl" />
            ))}
          </div>
        </div>
        {/* Text blocks */}
        <div className="space-y-4">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-10 w-32 mt-2" />
          <Skeleton className="h-12 w-full mt-6" />
          <div className="flex gap-2 mt-4">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-10 flex-1" />
          </div>
          <div className="mt-6 space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
          <div className="mt-6 pt-6 border-t border-gray-200 space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export const ProductPageSkeleton = memo(ProductPageSkeletonInner);
