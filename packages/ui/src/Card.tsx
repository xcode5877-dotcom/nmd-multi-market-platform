import { forwardRef } from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'elevated' | 'outlined';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'elevated', className = '', children, ...props }, ref) => {
    const variantStyles = {
      elevated: 'bg-white shadow-md',
      outlined: 'bg-white border border-gray-200',
    };
    return (
      <div
        ref={ref}
        className={`rounded-[var(--radius)] ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
