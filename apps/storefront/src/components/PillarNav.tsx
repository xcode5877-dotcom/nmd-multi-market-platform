import { Link, useLocation } from 'react-router-dom';
import { UtensilsCrossed, ShoppingBag, Briefcase, Wrench } from 'lucide-react';

export type PillarType = 'food' | 'retail' | 'services' | 'crafts';

/** From API: GET /pillars */
export interface PillarFromApi {
  id: string;
  name: string;
  nameAr?: string;
  slug: string;
  icon?: string;
  sortOrder: number;
}

const FALLBACK_PILLARS: { type: PillarType; label: string; slug: string; icon: typeof UtensilsCrossed }[] = [
  { type: 'food', label: 'طعام', slug: 'food', icon: UtensilsCrossed },
  { type: 'retail', label: 'تجزئة', slug: 'retail', icon: ShoppingBag },
  { type: 'services', label: 'خدمات', slug: 'services', icon: Briefcase },
  { type: 'crafts', label: 'حرفيون', slug: 'crafts', icon: Wrench },
];

export interface PillarNavProps {
  marketSlug: string;
  /** From Admin: GET /pillars. When set, links use pillar.slug and labels use nameAr/name. */
  pillars?: PillarFromApi[] | null;
  /** Optional: current pillar slug for active state (e.g. on section page) */
  activePillarSlug?: string | null;
}

export function PillarNav({ marketSlug, pillars = null, activePillarSlug = null }: PillarNavProps) {
  const { pathname } = useLocation();
  const basePath = marketSlug ? `/${marketSlug}` : '';
  const isSectionPage = pathname.includes('/section/');
  const useApi = Array.isArray(pillars) && pillars.length > 0;
  const items = useApi
    ? pillars.map((p) => ({ key: p.id, slug: p.slug, label: p.nameAr || p.name, icon: p.icon }))
    : FALLBACK_PILLARS.map((p) => ({ key: p.type, slug: p.slug, label: p.label, icon: p.icon }));

  return (
    <nav
      className="flex overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-5 px-5"
      aria-label="أقسام السوق"
    >
      <div className="flex gap-4 min-w-max justify-start">
        {items.map(({ key, slug, label, icon }) => {
          const to = `${basePath}/section/${slug}`;
          const isActive = activePillarSlug === slug || (isSectionPage && pathname.endsWith(`/section/${slug}`));
          const isEmoji = typeof icon === 'string';
          const LucideIcon = FALLBACK_PILLARS.find((p) => p.slug === slug)?.icon ?? ShoppingBag;
          return (
            <Link
              key={key}
              to={to}
              className="shrink-0 snap-center flex flex-col items-center gap-2 group"
              aria-current={isActive ? 'page' : undefined}
            >
              <span
                className={`
                  flex w-14 h-14 md:w-16 md:h-16 rounded-full items-center justify-center
                  border-2 transition-all duration-200
                  shadow-sm
                  ${isActive
                    ? 'bg-primary/20 border-primary text-primary shadow-md'
                    : 'bg-white border-gray-200 text-gray-900 group-hover:border-primary/40 group-hover:bg-gray-100 group-hover:text-primary'
                  }
                `}
              >
                {isEmoji && icon ? (
                  <span className="text-2xl" aria-hidden>{icon}</span>
                ) : (
                  <LucideIcon className="w-6 h-6 md:w-7 md:h-7 shrink-0" aria-hidden />
                )}
              </span>
              <span className={`text-xs font-medium text-center max-w-[72px] truncate ${isActive ? 'text-primary' : 'text-gray-900'}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
