import { Link, useLocation } from 'react-router-dom';
import { Home, Tag, ClipboardList, User } from 'lucide-react';
import { PLATFORM_BRANDING } from '@nmd/core';
const NAV_HEIGHT = 64;

export const NOW_BOTTOM_NAV_HEIGHT = NAV_HEIGHT;

const TABS = [
  { to: '/', label: 'الرئيسية', icon: Home },
  { to: '/offers', label: 'العروض', icon: Tag },
  { to: '/my-orders', label: 'طلباتي', icon: ClipboardList },
  { to: '/my-account', label: 'حسابي', icon: User },
] as const;

/** Resolve first market for "offers" and "my-orders" when no tenant in context. */
function getMarketBase() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const first = pathname.split('/').filter(Boolean)[0] ?? '';
  if (first === 'daburiyya' || first === 'dabburiyya' || first === 'iksal') return `/${first}`;
  return '/daburiyya';
}

export function NowMarketBottomNav() {
  const location = useLocation();
  const marketBase = getMarketBase();

  const resolveHref = (to: string) => {
    if (to === '/') return '/';
    if (to === '/my-account') return '/my-account';
    if (to === '/offers') return `${marketBase}`;
    if (to === '/my-orders') return '/my-activity';
    return to;
  };

  return (
    <nav
      className="now-market-tab-bar fixed bottom-0 left-0 right-0 w-full m-0 z-[9998] bg-white border-t border-gray-200 flex items-center justify-around safe-area-pb"
      style={{
        height: NAV_HEIGHT,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        boxShadow: '0 -2px 12px rgba(0,0,0,0.06)',
      }}
      aria-label="التنقل الرئيسي"
    >
      {TABS.map(({ to, label, icon: Icon }) => {
        const href = resolveHref(to);
        const isActive =
          href === '/'
            ? location.pathname === '/' || location.pathname === ''
            : to === '/offers'
              ? /^\/(daburiyya|dabburiyya|iksal)(\/|$)/.test(location.pathname)
              : location.pathname.startsWith(href);
        return (
          <Link
            key={to}
            to={href}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-w-0 py-1 active:scale-95 transition-transform"
            aria-current={isActive ? 'page' : undefined}
          >
            <span
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                isActive ? 'bg-[#0f766e]/15' : 'bg-transparent'
              }`}
              style={isActive ? { color: PLATFORM_BRANDING.primaryColor } : { color: '#6b7280' }}
            >
              <Icon className="w-5 h-5" strokeWidth={2.5} />
            </span>
            <span
              className={`text-[10px] font-semibold truncate max-w-[64px] ${
                isActive ? 'text-[#0a0a0a]' : 'text-gray-500'
              }`}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
