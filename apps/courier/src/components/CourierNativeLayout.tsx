import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { List, MapPin, User, Home, Clock } from 'lucide-react';
import { collectionsPeriodSearch } from '../lib/collectionsPeriod';

const navItems = [
  { to: '/', end: true, label: 'الرئيسية', icon: Home },
  { to: '/orders', end: false, label: 'الطلبات', icon: List },
  { to: '/route', end: false, label: 'المسار', icon: MapPin },
  { to: '/earnings', end: true, label: 'الدوام', icon: Clock },
  { to: '/profile', end: true, label: 'حسابي', icon: User },
];

export default function CourierNativeLayout() {
  const location = useLocation();
  /** Keep collections period across tab switches even if the URL temporarily lacks ?period=. */
  const search = collectionsPeriodSearch(location.search);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Outlet />
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-white border-t border-gray-200 py-2"
        role="navigation"
        aria-label="القائمة الرئيسية"
        dir="rtl"
      >
        {navItems.map(({ to, end, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={`${to}${search}`}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-1 py-1 min-w-0 flex-1 text-[10px] rounded-lg transition-colors ${isActive ? 'text-teal-600 bg-teal-50' : 'text-gray-500'}`
            }
          >
            <Icon className="w-5 h-5 shrink-0" aria-hidden />
            <span className="truncate w-full text-center">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
