import { forwardRef } from 'react';

export type EmptyStateVariant = 'no-data' | 'no-results' | 'error';

export interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

const defaultContent: Record<EmptyStateVariant, { title: string; description: string }> = {
  'no-data': {
    title: 'لا توجد بيانات',
    description: 'ابدأ بإضافة العناصر الأولى',
  },
  'no-results': {
    title: 'لا توجد نتائج',
    description: 'جرّب تغيير معايير البحث',
  },
  error: {
    title: 'حدث خطأ',
    description: 'يرجى المحاولة مرة أخرى',
  },
};

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ variant = 'no-data', title, description, icon, action, className = '' }, ref) => {
    const content = defaultContent[variant];
    return (
      <div
        ref={ref}
        className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}
      >
        {icon && <div className="mb-4 text-gray-400">{icon}</div>}
        <h3 className="text-lg font-semibold text-gray-900 mb-1">{title ?? content.title}</h3>
        <p className="text-sm text-gray-500 mb-4">{description ?? content.description}</p>
        {action}
      </div>
    );
  }
);

EmptyState.displayName = 'EmptyState';
