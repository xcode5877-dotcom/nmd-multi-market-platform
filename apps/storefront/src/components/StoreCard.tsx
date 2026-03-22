import { Link } from 'react-router-dom';
import { getOperationalStatus } from '@nmd/core';
import type { OperationalStatus, OverrideStatus } from '@nmd/core';
import { resolveImageUrl } from '../lib/image-url';

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; dotClass: string }> = {
  open: { label: 'مفتوح', badgeClass: 'bg-emerald-500/90', dotClass: 'bg-emerald-400' },
  busy: { label: 'مشغول', badgeClass: 'bg-amber-500/90', dotClass: 'bg-amber-400' },
  closed: { label: 'مغلق', badgeClass: 'bg-red-500/90', dotClass: 'bg-red-400' },
};

const ADMIN_CLOSED_STATUS = { label: 'مغلق مؤقتاً', badgeClass: 'bg-red-600/95', dotClass: 'bg-red-400' };

export type StoreBadge = 'featured' | 'sponsored' | undefined;

const RETURN_MARKET_KEY = 'nmd-return-market-slug';

export interface StoreCardProps {
  id: string;
  slug: string;
  name: string;
  marketCategory?: string;
  type: string;
  branding: { logoUrl?: string; primaryColor?: string };
  operationalStatus?: OperationalStatus;
  businessHours?: Record<string, unknown>;
  openTime?: string;
  closeTime?: string;
  forceClosed?: boolean;
  overrideStatus?: OverrideStatus;
  categoryLabel?: string;
  badge?: StoreBadge;
  /** When set, stored before nav so Header can show "Back to Market" to this market */
  marketSlug?: string;
  /** @deprecated Card is always compact now; kept for backward compatibility */
  compact?: boolean;
}

const BADGE_CONFIG: Record<string, { label: string; className: string }> = {
  featured: { label: 'مميز', className: 'bg-emerald-500/90 text-white' },
  sponsored: { label: 'ممول', className: 'bg-amber-500/90 text-white' },
};

const PLACEHOLDER_BASE = 'https://picsum.photos/seed';

export function StoreCard({
  name,
  slug,
  branding,
  operationalStatus,
  businessHours,
  openTime,
  closeTime,
  forceClosed,
  overrideStatus,
  categoryLabel,
  badge,
  marketSlug,
}: StoreCardProps) {
  const status = getOperationalStatus({
    operationalStatus,
    businessHours,
    openTime,
    closeTime,
    forceClosed,
    overrideStatus,
  });
  const isAdminClosed = overrideStatus === 'FORCE_CLOSED';
  const cfg = isAdminClosed ? ADMIN_CLOSED_STATUS : (STATUS_CONFIG[status] ?? STATUS_CONFIG.closed);
  const rawLogo = branding?.logoUrl?.trim();
  const logoUrl = rawLogo ? resolveImageUrl(rawLogo) : `${PLACEHOLDER_BASE}/${encodeURIComponent(slug || name)}/400/400`;

  const handleClick = () => {
    if (marketSlug && typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(RETURN_MARKET_KEY, marketSlug);
    }
  };

  return (
    <Link
      to={`/${slug}`}
      onClick={handleClick}
      className="block w-full group active:scale-95 transition-transform duration-150 ease-out"
    >
      <div
        className="w-full overflow-hidden rounded-xl shadow-sm border border-gray-100/80 bg-white hover:shadow-md hover:border-gray-200 transition-all duration-200"
        dir="rtl"
      >
        {/* Store logo and name are the main focus; full card is clickable */}
        <div className="relative flex justify-center pt-5 pb-2 bg-gray-50 border-b border-gray-100/80">
          <span className="relative flex shrink-0 w-20 h-20 rounded-full border border-gray-100 overflow-hidden bg-white shadow-sm">
            <img
              src={logoUrl}
              alt={name}
              loading="lazy"
              decoding="async"
              className="w-full h-full object-cover object-center group-hover:scale-[1.03] transition-transform duration-300"
            />
          </span>
          <div
            className={`absolute top-1.5 end-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium text-white ${cfg.badgeClass}`}
          >
            <span className={`w-1 h-1 rounded-full ${cfg.dotClass} ${status === 'open' ? 'animate-open-dot' : ''}`} />
            {cfg.label}
          </div>
          {badge && (
            <div
              className={`absolute top-1.5 start-1.5 inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-medium ${BADGE_CONFIG[badge].className}`}
            >
              {BADGE_CONFIG[badge].label}
            </div>
          )}
        </div>
        {/* Content: store name + optional category (never show raw ID/UUID) */}
        <div className="px-3 py-3 text-center min-w-0">
          <h3 className="text-sm font-bold text-gray-900 truncate">{name}</h3>
          {(() => {
            const label = categoryLabel?.trim();
            const display = !label ? '' : /^[0-9a-f-]{20,}$/i.test(label) ? 'تصنيف عام' : label;
            return display ? <p className="text-[10px] text-gray-500 truncate mt-0.5">{display}</p> : null;
          })()}
        </div>
      </div>
    </Link>
  );
}
