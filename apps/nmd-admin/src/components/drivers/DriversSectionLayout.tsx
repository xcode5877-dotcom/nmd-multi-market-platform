import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, FileText, Wallet, Store, Package, UserCog, CircleDollarSign, Banknote } from 'lucide-react';

const SUB_LINKS = [
  { to: '/drivers', label: 'لوحة التوصيل', icon: LayoutDashboard, end: true },
  { to: '/drivers/couriers', label: 'إدارة السائقين', icon: UserCog, end: true },
  { to: '/drivers/collections', label: 'تحصيل السائقين', icon: Banknote, end: false },
  { to: '/drivers/markets', label: 'الأسواق والتوصيل', icon: Store, end: true },
  { to: '/drivers/reports', label: 'التقارير', icon: FileText, end: true },
  { to: '/drivers/finance', label: 'التسويات المالية', icon: Wallet, end: true },
  { to: '/drivers/payroll-finance', label: 'مالية السائقين', icon: CircleDollarSign, end: true },
  { to: '/drivers/payroll-history', label: 'سجل الرواتب', icon: FileText, end: true },
  { to: '/external-orders', label: 'الطلبات الخارجية', icon: Package, end: true },
] as const;

/** Shared sub-navigation for Super Admin driver operations hub. */
export default function DriversSectionLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">السائقون والتوصيل</h1>
        <p className="text-sm text-gray-500 mt-1">مركز العمليات — عرض موحّد دون تغيير منطق التوجيه الحالي</p>
      </div>
      <nav
        className="flex flex-wrap gap-2 p-1 bg-white border border-gray-200 rounded-xl shadow-sm"
        aria-label="قسم السائقين والتوصيل"
      >
        {SUB_LINKS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
