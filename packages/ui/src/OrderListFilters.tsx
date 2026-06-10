import { Select } from './Select';
import {
  ORDER_SOURCE_FILTER_OPTIONS,
  ORDER_STATUS_FILTER_OPTIONS,
  type OrderSourceFilter,
  type OrderStatusFilterKey,
} from '@nmd/core';

export interface OrderListFiltersProps {
  sourceFilter: OrderSourceFilter;
  statusFilter: OrderStatusFilterKey;
  onSourceChange: (value: OrderSourceFilter) => void;
  onStatusChange: (value: OrderStatusFilterKey) => void;
  /** Hide source filter on pages that never show external orders (e.g. courier). */
  showSourceFilter?: boolean;
  className?: string;
}

export function OrderListFilters({
  sourceFilter,
  statusFilter,
  onSourceChange,
  onStatusChange,
  showSourceFilter = true,
  className = '',
}: OrderListFiltersProps) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {showSourceFilter && (
        <Select
          value={sourceFilter}
          onChange={(e) => onSourceChange(e.target.value as OrderSourceFilter)}
          options={ORDER_SOURCE_FILTER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          className="min-w-[160px]"
          aria-label="مصدر الطلب"
        />
      )}
      <Select
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value as OrderStatusFilterKey)}
        options={ORDER_STATUS_FILTER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        className="min-w-[140px]"
        aria-label="حالة الطلب"
      />
    </div>
  );
}

export function OrderSourceBadge({ isExternal }: { isExternal?: boolean | null }) {
  const meta = isExternal
    ? {
        label: '📞 طلب خارجي',
        className:
          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200',
      }
    : {
        label: '📱 من التطبيق',
        className:
          'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800 border border-sky-200',
      };
  return <span className={meta.className}>{meta.label}</span>;
}
