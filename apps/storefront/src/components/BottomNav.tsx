import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutGrid, ClipboardList, User } from 'lucide-react';

const TAB_CLASS =
  'flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-w-0 flex-1 text-xs font-medium transition-colors rounded-lg';

export interface BottomNavProps {
  /** Base path for tenant store (e.g. /my-store) or market (e.g. /dabburiyya). Used for Home and Categories. */
  basePath: string;
  /** Optional class for the container */
  className?: string;
}

const tabs = [
  { key: 'home', label: 'الرئيسية', icon: Home, path: '' },
  { key: 'categories', label: 'التصنيفات', icon: LayoutGrid, path: '/products' },
  { key: 'orders', label: 'طلباتي', icon: ClipboardList, path: '/my-activity' },
  { key: 'profile', label: 'حسابي', icon: User, path: '/my-account' },
] as const;

/**
 * Mobile-only fixed bottom navigation. Home and Categories use basePath; Orders and Profile use global /my-activity and /my-account.
 * Ensure parent main has pb-[var(--bottom-nav-height)] on mobile so content is not hidden behind the bar.
 */
export function BottomNav({ basePath, className }: BottomNavProps) {
  const { pathname } = useLocation();
  const base = basePath.replace(/\/$/, '') || '';

  return (
    <nav
      className={`md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-pb flex items-stretch justify-around shadow-[0_-2px_10px_rgba(0,0,0,0.06)] ${className ?? ''}`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
      aria-label="التنقل الرئيسي"
    >
      {tabs.map(({ key, label, icon: Icon, path }) => {
        let href: string;
        if (key === 'home') {
          href = base || '/';
        } else if (key === 'categories') {
          href = base ? `${base}/products` : '/';
        } else {
          href = path;
        }
        const isActive =
          pathname === href ||
          (href.length > 1 && pathname.startsWith(href + '/'));
        return (
          <Link
            key={key}
            to={href}
            className={`${TAB_CLASS} ${isActive ? 'text-primary bg-primary/10' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon className="w-5 h-5 shrink-0" aria-hidden />
            <span className="truncate max-w-full">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Height for content padding so main is not hidden behind fixed bottom nav. Use in layout: pb-[var(--bottom-nav-height)] md:pb-0 */
export const BOTTOM_NAV_HEIGHT = 64;
