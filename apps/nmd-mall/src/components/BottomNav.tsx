import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutGrid, ClipboardList, User } from 'lucide-react';

const STOREFRONT_URL = import.meta.env.VITE_STOREFRONT_URL ?? 'http://localhost:5173';
const DEFAULT_TENANT_SLUG = 'daburiyya';
const myActivityUrl = `${STOREFRONT_URL}/${DEFAULT_TENANT_SLUG}/my-activity`;
const myAccountUrl = `${STOREFRONT_URL}/${DEFAULT_TENANT_SLUG}/my-account`;

const TAB_CLASS =
  'flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-w-0 flex-1 text-xs font-medium transition-colors rounded-lg';

export interface BottomNavProps {
  basePath: string;
  className?: string;
}

export function BottomNav({ basePath, className = '' }: BottomNavProps) {
  const { pathname } = useLocation();
  const base = basePath.replace(/\/$/, '') || '';

  const homeHref = base || '/markets';
  const categoriesHref = '/legacy/categories';
  const isHome = pathname === '/markets' || pathname === base || pathname === base + '/';
  const isCategories = pathname.startsWith('/legacy/categories');

  return (
    <nav
      className={`md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex items-stretch justify-around shadow-[0_-2px_10px_rgba(0,0,0,0.06)] ${className}`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
      aria-label="التنقل الرئيسي"
    >
      <Link
        to={homeHref}
        className={`${TAB_CLASS} ${isHome ? 'text-[#D97706] bg-amber-50' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
        aria-current={isHome ? 'page' : undefined}
      >
        <Home className="w-5 h-5 shrink-0" aria-hidden />
        <span className="truncate max-w-full">الرئيسية</span>
      </Link>
      <Link
        to={categoriesHref}
        className={`${TAB_CLASS} ${isCategories ? 'text-[#D97706] bg-amber-50' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
        aria-current={isCategories ? 'page' : undefined}
      >
        <LayoutGrid className="w-5 h-5 shrink-0" aria-hidden />
        <span className="truncate max-w-full">التصنيفات</span>
      </Link>
      <a
        href={myActivityUrl}
        className={`${TAB_CLASS} text-gray-500 hover:text-gray-900 hover:bg-gray-50`}
      >
        <ClipboardList className="w-5 h-5 shrink-0" aria-hidden />
        <span className="truncate max-w-full">طلباتي</span>
      </a>
      <a
        href={myAccountUrl}
        className={`${TAB_CLASS} text-gray-500 hover:text-gray-900 hover:bg-gray-50`}
      >
        <User className="w-5 h-5 shrink-0" aria-hidden />
        <span className="truncate max-w-full">حسابي</span>
      </a>
    </nav>
  );
}

export const BOTTOM_NAV_HEIGHT = 64;
