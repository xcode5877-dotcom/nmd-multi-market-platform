import { getOperationalStatus } from '@nmd/core';
import type { OperationalStatus } from '@nmd/core';
import { Card } from '@nmd/ui';

const STATUS_CONFIG: Record<OperationalStatus, { label: string; badgeClass: string; dotClass: string }> = {
  open: { label: 'مفتوح', badgeClass: 'bg-emerald-500/90', dotClass: 'bg-emerald-400' },
  busy: { label: 'مشغول', badgeClass: 'bg-amber-500/90', dotClass: 'bg-amber-400' },
  closed: { label: 'مغلق', badgeClass: 'bg-red-500/90', dotClass: 'bg-red-400' },
};

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
}

export function StoreCard({
  name,
  branding,
  operationalStatus,
  businessHours,
  storeUrl,
  categoryLabel,
}: StoreCardProps) {
  const tenant = { operationalStatus, businessHours };
  const status = getOperationalStatus(tenant);
  const cfg = STATUS_CONFIG[status];
  const primaryColor = branding.primaryColor ?? '#D97706';

  return (
    <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="block w-full max-w-[220px] group">
      <Card className="w-full max-w-[220px] h-[300px] flex flex-col overflow-hidden rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100">
        {/* Logo area - fixed height, object-cover fills exact pixel area */}
        <div
          className={`relative h-[220px] w-full overflow-hidden shrink-0 ${
            branding.logoUrl ? 'bg-gray-100' : ''
          }`}
          style={branding.logoUrl ? undefined : { backgroundColor: primaryColor }}
        >
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-white font-bold text-4xl">{name.charAt(0)}</span>
            </div>
          )}
          {/* Status badge - absolute overlay top-right */}
          <div
            className={`absolute top-2 end-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium text-white shadow-sm ${cfg.badgeClass}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass}`} />
            {cfg.label}
          </div>
        </div>

        {/* Text area - fixed h-[80px], line-clamp prevents expansion */}
        <div className="h-[80px] flex flex-col justify-center px-2 py-2 shrink-0">
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
