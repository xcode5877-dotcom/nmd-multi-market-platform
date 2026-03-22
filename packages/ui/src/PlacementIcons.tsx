import type { ReactNode } from 'react';

const size = 20;
const viewBox = `0 0 ${size} ${size}`;
const cx = size / 2;
const cy = size / 2;
const r = size / 2 - 1;

/** Whole: 100% filled circle */
export function WholeCircleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox={viewBox} className={className} fill="currentColor" aria-hidden>
      <circle cx={cx} cy={cy} r={r} />
    </svg>
  );
}

/** Left half: circle with only the LEFT 50% filled (النصف الأيسر) */
export function LeftHalfCircleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox={viewBox} className={className} fill="currentColor" aria-hidden>
      <path d={`M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r} L ${cx} ${cy} Z`} />
    </svg>
  );
}

/** Right half: circle with only the RIGHT 50% filled (النصف الأيمن) */
export function RightHalfCircleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox={viewBox} className={className} fill="currentColor" aria-hidden>
      <path d={`M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} L ${cx} ${cy} Z`} />
    </svg>
  );
}

export type Placement = 'WHOLE' | 'LEFT' | 'RIGHT';

export function PlacementIcon({ placement, className }: { placement: Placement; className?: string }): ReactNode {
  switch (placement) {
    case 'WHOLE':
      return <WholeCircleIcon className={className} />;
    case 'LEFT':
      return <LeftHalfCircleIcon className={className} />;
    case 'RIGHT':
      return <RightHalfCircleIcon className={className} />;
    default:
      return null;
  }
}
