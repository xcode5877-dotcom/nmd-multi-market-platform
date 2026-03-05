import { getOperationalStatus } from '@nmd/core';
import type { OperationalStatus } from '@nmd/core';

/** Full tenant shape from API so status uses is_open (forceClosed) + operating_hours (openTime/closeTime/businessHours). */
interface TenantLike {
  operationalStatus?: OperationalStatus;
  businessHours?: import('@nmd/core').BusinessHours;
  openTime?: string;
  closeTime?: string;
  forceClosed?: boolean;
}

const STATUS_CONFIG: Record<OperationalStatus, { label: string; className: string; dotClass: string; pulse?: boolean }> = {
  open: { label: 'مفتوح', className: 'bg-emerald-500/90 text-white', dotClass: 'bg-emerald-400', pulse: true },
  busy: { label: 'مشغول', className: 'bg-amber-500/90 text-white', dotClass: 'bg-amber-400', pulse: true },
  closed: { label: 'مغلق', className: 'bg-red-500/90 text-white', dotClass: 'bg-red-400', pulse: false },
};

export function StatusBadge({ tenant, variant = 'default' }: { tenant: TenantLike; variant?: 'default' | 'header' | 'hero' }) {
  const status = getOperationalStatus(tenant);
  const config = STATUS_CONFIG[status];
  const pulseClass = config.pulse && (variant === 'header' || variant === 'hero') ? 'animate-pulse' : '';

  if (variant === 'header') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${config.className} ${pulseClass}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
        {config.label}
      </span>
    );
  }

  if (variant === 'hero') {
    return (
      <span
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium shadow-sm ${config.className} ${pulseClass}`}
      >
        <span className={`w-2 h-2 rounded-full shrink-0 ${config.dotClass}`} aria-hidden />
        {config.label}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} aria-hidden />
      {config.label}
    </span>
  );
}
