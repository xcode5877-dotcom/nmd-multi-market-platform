import { memo } from 'react';
import { Skeleton } from '@nmd/ui';

interface CategoryTabsSkeletonProps {
  count?: number;
  /** 'mobile' | 'desktop' | 'both' - mobile = horizontal scroll pills, desktop = centered row */
  variant?: 'mobile' | 'desktop' | 'both';
}

function CategoryTabsSkeletonInner({ count = 5, variant = 'both' }: CategoryTabsSkeletonProps) {
  const pills = Array.from({ length: count }, (_, i) => (
    <Skeleton key={i} className="h-9 w-20 rounded-full flex-shrink-0" />
  ));

  return (
    <div className="mb-8">
      <Skeleton className="h-6 w-40 mb-3" />
      {variant === 'mobile' && (
        <div className="flex gap-6 overflow-x-auto pb-2 -mx-4 px-4 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {pills}
        </div>
      )}
      {variant === 'desktop' && (
        <div className="hidden md:flex flex-wrap justify-center gap-8">
          {pills}
        </div>
      )}
      {variant === 'both' && (
        <>
          <div className="flex gap-6 overflow-x-auto pb-2 -mx-4 px-4 md:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {pills}
          </div>
          <div className="hidden md:flex flex-wrap justify-center gap-8">
            {pills}
          </div>
        </>
      )}
    </div>
  );
}

export const CategoryTabsSkeleton = memo(CategoryTabsSkeletonInner);
