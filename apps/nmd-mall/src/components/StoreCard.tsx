import { getOperationalStatus } from '@nmd/core';
import type { OperationalStatus } from '@nmd/core';
import { Card } from '@nmd/ui';

const STATUS_CONFIG: Record<OperationalStatus, { label: string; badgeClass: string; dotClass: string }> = {
  open: { label: 'مفتوح', badgeClass: 'bg-emerald-500/90', dotClass: 'bg-emerald-400' },
  busy: { label: 'مشغول', badgeClass: 'bg-amber-500/90', dotClass: 'bg-amber-400' },
  closed: { label: 'مغلق', badgeClass: 'bg-red-500/90', dotClass: 'bg-red-400' },
};

export type StoreBadge = 'featured' | 'sponsored' | undefined;

interface StoreCardProps {
  id: string;
  slug: string;
  name: string;
  marketCategory?: string;
  type: string;
  branding: { logoUrl?: string; primaryColor?: string };
  operationalStatus?: OperationalStatus;
  businessHours?: Record<string, { open: string; close: string; isClosedDay: boolean }>;
  storeUrl: string;
  categoryLabel?: string;
  /** "مميز" (Featured) or "ممول" (Sponsored) - for premium placement */
  badge?: StoreBadge;
  /** Compact size for horizontal sliders */
  compact?: boolean;
}

const BADGE_CONFIG: Record<NonNullable<StoreCardProps['badge']>, { label: string; className: string }> = {
  featured: { label: 'مميز', className: 'bg-emerald-500/90 text-white' },
  sponsored: { label: 'ممول', className: 'bg-amber-500/90 text-white' },
};

/** High-quality placeholder for stores without logos. Deterministic per slug. */
const PLACEHOLDER_BASE = 'https://picsum.photos/seed';

export function StoreCard({
  name,
  slug,
  branding,
  operationalStatus,
  businessHours,
  storeUrl,
  categoryLabel,
  badge,
  compact,
}: StoreCardProps) {
  const tenant = { operationalStatus, businessHours };
  const status = getOperationalStatus(tenant);
  const cfg = STATUS_CONFIG[status];
  const logoUrl = branding.logoUrl?.trim() || `${PLACEHOLDER_BASE}/${encodeURIComponent(slug || name)}/400/400`;
  const cardClass = compact
    ? 'w-full min-w-[210px] max-w-[210px] h-[260px]'
    : 'w-full max-w-[220px] h-[320px]';

  return (
    <a href={storeUrl} target="_blank" rel="noopener noreferrer" className={`block w-full group ${compact ? 'min-w-[210px] max-w-[210px]' : 'max-w-[220px]'}`}>
      <Card className={`${cardClass} flex flex-col overflow-hidden rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100`}>
        {/* Logo area - aspect-square, object-cover. Uses placeholder when no logo. */}
        <div className="relative aspect-square w-full overflow-hidden shrink-0 bg-gray-100">
          <img
            src={logoUrl}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {/* Status badge - absolute overlay top-right */}
          <div
            className={`absolute top-2 end-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium text-white shadow-sm ${cfg.badgeClass}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
            {cfg.label}
          </div>
          {/* Featured/Sponsored badge - top-left */}
          {badge && (
            <div className={`absolute top-2 start-2 inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium shadow-sm ${BADGE_CONFIG[badge].className}`}>
              {BADGE_CONFIG[badge].label}
            </div>
          )}
        </div>

        {/* Text area - fixed height, line-clamp prevents expansion */}
        <div className="flex-1 min-h-0 flex flex-col justify-center px-2 py-2 shrink-0">
          <h3 className="text-sm font-bold text-gray-900 text-center line-clamp-1 truncate">
            {name}
          </h3>
          {categoryLabel && (
            <p className="text-xs text-gray-500 text-center line-clamp-1 truncate mt-0.5">
              {categoryLabel}
            </p>
          )}
        </div>
      </Card>
    </a>
  );
}
