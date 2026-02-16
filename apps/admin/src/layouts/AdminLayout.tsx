import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  ShoppingCart,
  LayoutGrid,
  FolderTree,
  Package,
  Sliders,
  Megaphone,
  Palette,
  Truck,
  Users,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { getStorage, setStorage } from '../lib/storage';

const SIDEBAR_KEY = 'sidebar-collapsed';

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'لوحة التحكم' },
  { to: '/orders', icon: ShoppingCart, label: 'الطلبات' },
  { to: '/orders/board', icon: LayoutGrid, label: 'لوحة الطلبات' },
  { to: '/catalog/categories', icon: FolderTree, label: 'التصنيفات' },
  { to: '/catalog/products', icon: Package, label: 'المنتجات' },
  { to: '/catalog/options', icon: Sliders, label: 'مجموعات الخيارات' },
  { to: '/campaigns', icon: Megaphone, label: 'الحملات' },
  { to: '/settings/delivery', icon: Truck, label: 'مناطق التوصيل' },
  { to: '/settings/staff', icon: Users, label: 'الفريق' },
  { to: '/branding', icon: Palette, label: 'واجهة المحل' },
];

export default function AdminLayout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => getStorage<boolean>(SIDEBAR_KEY) ?? false);

  useEffect(() => {
    setStorage(SIDEBAR_KEY, collapsed);
  }, [collapsed]);

  return (
    <div className="min-h-screen flex">
      <aside
        className={`bg-white border-e border-gray-200 flex flex-col shrink-0 transition-[width] duration-200 ${
          collapsed ? 'w-[4.5rem]' : 'w-56'
        }`}
      >
        <div className={`border-b border-gray-200 flex items-center gap-2 ${collapsed ? 'p-2 justify-center' : 'p-4 justify-between'}`}>
          {!collapsed && <h1 className="font-bold text-lg text-primary truncate">Store OS Dashboard</h1>}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 shrink-0"
            aria-label={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
          >
            {collapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  collapsed ? 'justify-center' : ''
                } ${isActive ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'}`
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto bg-gray-50">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="p-6 min-h-full"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
