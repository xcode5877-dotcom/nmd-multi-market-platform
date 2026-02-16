import { forwardRef } from 'react';

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: 'bg-blue-100 text-blue-800',
  CONFIRMED: 'bg-amber-100 text-amber-800',
  PREPARING: 'bg-purple-100 text-purple-800',
  READY: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-gray-100 text-gray-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'جديد',
  CONFIRMED: 'تم التواصل',
  PREPARING: 'قيد التحضير',
  READY: 'جاهز',
  COMPLETED: 'تم التسليم',
  CANCELLED: 'ملغي',
};

export interface InlineBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: OrderStatus | string;
}

export const InlineBadge = forwardRef<HTMLSpanElement, InlineBadgeProps>(
  ({ status, className = '', ...props }, ref) => {
    const style = STATUS_STYLES[status as OrderStatus] ?? 'bg-gray-100 text-gray-700';
    const label = STATUS_LABELS[status as OrderStatus] ?? status;
    return (
      <span
        ref={ref}
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style} ${className}`}
        {...props}
      >
        {label}
      </span>
    );
  }
);

InlineBadge.displayName = 'InlineBadge';
