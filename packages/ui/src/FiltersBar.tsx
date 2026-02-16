import { forwardRef } from 'react';

export interface FiltersBarProps {
  search?: React.ReactNode;
  chips?: React.ReactNode;
  selects?: React.ReactNode;
  className?: string;
}

export const FiltersBar = forwardRef<HTMLDivElement, FiltersBarProps>(
  ({ search, chips, selects, className = '' }, ref) => (
    <div ref={ref} className={`flex flex-wrap items-center gap-3 mb-4 ${className}`}>
      {search && <div className="flex-1 min-w-[120px]">{search}</div>}
      {chips && <div className="flex flex-wrap gap-2">{chips}</div>}
      {selects && <div className="flex flex-wrap gap-2">{selects}</div>}
    </div>
  )
);

FiltersBar.displayName = 'FiltersBar';
