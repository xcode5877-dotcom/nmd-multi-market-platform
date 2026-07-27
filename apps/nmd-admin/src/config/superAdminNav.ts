import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Store,
  Building2,
  FolderTree,
  LayoutGrid,
  ClipboardList,
  UserCog,
  Radio,
  BarChart3,
  LineChart,
  Wallet,
  Percent,
  Package,
  Trophy,
  Gift,
  Tag,
  CircleDot,
  Send,
  Megaphone,
  ImagePlus,
  Users,
  Settings,
  CreditCard,
  Clock,
  Home,
  FileText,
} from 'lucide-react';

export type SuperAdminNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** NavLink `end` — default true */
  end?: boolean;
  /** Muted helper under the label (taxonomy clarity only) */
  hint?: string;
};

export type SuperAdminNavSection = {
  id: string;
  title: string;
  items: SuperAdminNavItem[];
  /** Active link highlight (drivers hub keeps teal) */
  accent?: 'teal' | 'purple';
};

/**
 * ROOT_ADMIN / SUPER_ADMIN sidebar — navigation only.
 * Route paths unchanged; legacy routes (/plans, /modules, /api) intentionally omitted.
 */
export const SUPER_ADMIN_NAV_SECTIONS: SuperAdminNavSection[] = [
  {
    id: 'overview',
    title: 'النظرة العامة',
    items: [
      { to: '/monitoring', label: 'لوحة التحكم', icon: LayoutDashboard, end: true },
      {
        to: '/economics',
        label: 'اقتصاديات المنصة',
        hint: 'ذكاء ربحية تشغيلي — قراءة فقط',
        icon: LineChart,
        end: true,
      },
      {
        to: '/store-profit-report',
        label: 'تقرير ربح المتاجر',
        hint: 'Super Admin — نسبة + توصيل',
        icon: Wallet,
        end: true,
      },
      {
        to: '/finance/reports',
        label: 'التقارير المالية',
        hint: 'ذكاء مالي — قراءة فقط',
        icon: FileText,
        end: true,
      },
      { to: '/markets', label: 'الأسواق', icon: Store, end: true },
    ],
  },
  {
    id: 'markets-stores',
    title: 'الأسواق والمتاجر',
    items: [
      { to: '/tenants', label: 'كل المتاجر', icon: Building2, end: true },
      {
        to: '/platform-fees',
        label: 'إدارة رسوم المنصة',
        hint: 'عرض تشغيلي لكل المتاجر',
        icon: Percent,
        end: true,
      },
      {
        to: '/categories',
        label: 'التصنيفات القديمة',
        hint: 'متوافق مع النظام القديم',
        icon: FolderTree,
        end: true,
      },
      {
        to: '/pillars',
        label: 'أعمدة المول',
        hint: 'نظام التصنيف الحالي للمول',
        icon: LayoutGrid,
        end: true,
      },
      { to: '/system/templates', label: 'قوالب المتاجر', icon: LayoutGrid, end: true },
    ],
  },
  {
    id: 'orders-ops',
    title: 'الطلبات والتشغيل',
    items: [
      { to: '/delivery-leads', label: 'طلبات واتساب / اتصال', icon: ClipboardList, end: true },
    ],
  },
  {
    id: 'drivers',
    title: 'السائقون والتوصيل',
    accent: 'teal',
    items: [
      { to: '/drivers', label: 'لوحة التوصيل', icon: LayoutDashboard, end: true },
      { to: '/drivers/couriers', label: 'إدارة السائقين', icon: UserCog, end: true },
      { to: '/drivers/markets', label: 'الأسواق والتوصيل', icon: Radio, end: true },
      { to: '/drivers/reports', label: 'التقارير', icon: BarChart3, end: true },
      { to: '/drivers/finance', label: 'التسويات المالية', icon: Wallet, end: true },
      { to: '/external-orders', label: 'الطلبات الخارجية', icon: Package, end: true },
    ],
  },
  {
    id: 'marketing',
    title: 'التسويق والنمو',
    items: [
      { to: '/contests', label: 'المسابقات', icon: Trophy, end: true },
      { to: '/rewards', label: 'المكافآت والبطولات', icon: Gift, end: true },
      { to: '/coupons', label: 'أكواد الخصم', icon: Tag, end: true },
      { to: '/lucky-wheel', label: 'عجلة الحظ', icon: CircleDot, end: true },
      { to: '/push-notifications', label: 'إشعارات العملاء', icon: Send, end: true },
      { to: '/home-builder', label: 'بناء الصفحة الرئيسية', icon: Megaphone, end: true },
      { to: '/modifier-icons', label: 'مكتبة أيقونات الإضافات', icon: ImagePlus, end: true },
    ],
  },
  {
    id: 'customers',
    title: 'العملاء',
    items: [{ to: '/customers', label: 'المشتركون', icon: Users, end: true }],
  },
  {
    id: 'system',
    title: 'النظام',
    items: [
      { to: '/settings', label: 'إعدادات النظام', icon: Settings, end: true },
      { to: '/settings/payments', label: 'المدفوعات', icon: CreditCard, end: true },
      { to: '/settings/category-policies', label: 'سياسات SLA', icon: Clock, end: true },
      { to: '/settings/home-layout', label: 'ترتيب الصفحة الرئيسية', icon: Home, end: true },
      { to: '/audit', label: 'سجل التدقيق', icon: FileText, end: true },
    ],
  },
];
