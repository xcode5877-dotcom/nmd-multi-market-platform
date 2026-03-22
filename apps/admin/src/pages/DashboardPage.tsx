import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, PageHeader, EmptyState, Button } from '@nmd/ui';
import { useAdminContext } from '../context/AdminContext';
import { useAuth } from '../contexts/AuthContext';
import { useOrderAlarm } from '../contexts/OrderAlarmContext';
import { isPlatformAdmin } from '../lib/is-platform-admin';
import { createAdminData } from '../store/admin-data';
import { getDeliverySettings, getTenantById, listOrdersByTenant, listCampaigns } from '@nmd/mock';
import { MockApiClient } from '@nmd/mock';
import { isValidWhatsAppPhone, formatPrice } from '@nmd/core';
import { Check, Circle, Copy, ExternalLink, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

const api = new MockApiClient();
const USE_API = !!import.meta.env.VITE_MOCK_API_URL;
const MOCK_API_URL = (import.meta.env.VITE_MOCK_API_URL ?? '').replace(/\/$/, '');
/** Set VITE_STOREFRONT_URL for "عرض المتجر" link. Production: e.g. https://nmd.marketing. No hardcoded localhost. */
const STOREFRONT_URL = (import.meta.env.VITE_STOREFRONT_URL ?? '').replace(/\/$/, '');
const TOKEN_KEY = 'nmd-access-token';

export default function DashboardPage() {
  const { tenantId } = useAdminContext();
  const { user } = useAuth();
  const orderAlarm = useOrderAlarm();
  const [readinessPanelCollapsed, setReadinessPanelCollapsed] = useState(false);
  const [testPushLoading, setTestPushLoading] = useState(false);
  const [testPushResult, setTestPushResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [registerPushLoading, setRegisterPushLoading] = useState(false);
  const adminData = createAdminData(tenantId);

  const catalogQuery = useQuery({
    queryKey: ['catalog', tenantId],
    queryFn: () => api.getCatalogApi(tenantId),
    enabled: !!tenantId && USE_API,
  });
  const tenantQuery = useQuery({
    queryKey: ['tenant-registry', tenantId],
    queryFn: () => api.getTenantById(tenantId),
    enabled: !!tenantId && USE_API,
  });
  const ordersQuery = useQuery({
    queryKey: ['orders', tenantId],
    queryFn: () => api.listOrdersByTenant(tenantId),
    enabled: !!tenantId && USE_API,
  });
  const dashboardStatsQuery = useQuery({
    queryKey: ['dashboard-stats', tenantId],
    queryFn: () => api.getTenantDashboardStats(tenantId),
    enabled: !!tenantId,
  });
  const campaignsQuery = useQuery({
    queryKey: ['campaigns', tenantId],
    queryFn: () => api.listCampaignsApi(tenantId),
    enabled: !!tenantId && USE_API,
  });
  const deliveryQuery = useQuery({
    queryKey: ['delivery', tenantId],
    queryFn: () => api.getDeliverySettingsApi(tenantId),
    enabled: !!tenantId && USE_API,
  });

  const categories = USE_API ? (catalogQuery.data?.categories ?? []) : adminData.getCategories();
  const products = USE_API ? (catalogQuery.data?.products ?? []) : adminData.getProducts();
  const tenant = USE_API ? tenantQuery.data : getTenantById(tenantId);
  const orders = USE_API ? (ordersQuery.data ?? []) : listOrdersByTenant(tenantId);
  const campaigns = USE_API ? (campaignsQuery.data ?? []) : listCampaigns(tenantId);
  const delivery = USE_API ? deliveryQuery.data : getDeliverySettings(tenantId);

  const stats = dashboardStatsQuery.data;
  const ordersTodayCount = stats?.orderCountToday ?? orders.filter(
    (o: { createdAt?: string }) => new Date(o.createdAt!).toDateString() === new Date().toDateString()
  ).length;
  const storeUrl = tenant ? `${STOREFRONT_URL}?tenant=${tenant.slug}` : '';

  const hasCategories = categories.length > 0;
  const hasProducts = products.length > 0;
  const deliveryObj = delivery as { zones?: unknown[]; deliveryFee?: number } | null | undefined;
  const hasDelivery = !!(deliveryObj?.zones?.length || (deliveryObj && (deliveryObj.deliveryFee ?? 0) > 0));
  const hasCampaign = campaigns.length > 0;

  const tenantReg = tenant as { whatsappPhone?: string; hero?: { title?: string; imageUrl?: string }; banners?: unknown[] } | null | undefined;
  const launchChecks = {
    whatsapp: isValidWhatsAppPhone(tenantReg?.whatsappPhone),
    categories: categories.length >= 3,
    products: products.length >= 5,
    stock: products.some((p: { variants?: { stock?: number }[]; quantity?: number; stock?: number }) => {
      const v = p.variants;
      if (v?.length) return v.some((vr) => (vr.stock ?? 0) > 0);
      return ((p as { quantity?: number }).quantity ?? (p as { stock?: number }).stock ?? 0) > 0;
    }),
    hero: !!(tenantReg?.hero?.title?.trim() || tenantReg?.hero?.imageUrl?.trim()),
    banners: (tenantReg?.banners?.length ?? 0) >= 1,
  };
  const launchReady = Object.values(launchChecks).every(Boolean);

  const setupComplete = hasCategories && hasProducts && (isPlatformAdmin(user?.role) ? hasDelivery : true) && hasCampaign;
  const catalogEmpty = !hasCategories && !hasProducts;
  const isLoading = USE_API && catalogQuery.isLoading;

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (catalogEmpty) {
    return (
      <div>
        <PageHeader title="لوحة التحكم" subtitle="نظرة عامة على متجرك" />
        <LaunchReadinessPanel checks={launchChecks} ready={launchReady} collapsed={readinessPanelCollapsed} onToggleCollapsed={() => setReadinessPanelCollapsed((c) => !c)} />
        <EmptyState
          title="المحل جاهز ✅"
          description="لسه ما تمت إضافة تصنيفات أو منتجات."
          icon={<span className="text-5xl">📦</span>}
          action={
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/catalog/categories">
                <Button>إضافة تصنيفات ومنتجات</Button>
              </Link>
              <Button variant="outline" onClick={() => window.location.reload()}>
                إعادة المحاولة
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="لوحة التحكم" subtitle="نظرة عامة على متجرك" />
      <LaunchReadinessPanel checks={launchChecks} ready={launchReady} collapsed={readinessPanelCollapsed} onToggleCollapsed={() => setReadinessPanelCollapsed((c) => !c)} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="w-full shadow-sm border border-slate-100">
          <div className="p-4">
            <p className="text-sm text-gray-500">إيرادات اليوم</p>
            <p className="text-2xl font-bold text-primary">{stats ? formatPrice(stats.dailyRevenue) : '—'}</p>
          </div>
        </Card>
        <Card className="w-full shadow-sm border border-slate-100">
          <div className="p-4">
            <p className="text-sm text-gray-500">إيرادات الشهر</p>
            <p className="text-2xl font-bold text-primary">{stats ? formatPrice(stats.monthlyRevenue) : '—'}</p>
          </div>
        </Card>
        <Card className="w-full shadow-sm border border-slate-100">
          <div className="p-4">
            <p className="text-sm text-gray-500">الطلبات اليوم</p>
            <p className="text-2xl font-bold text-primary">{ordersTodayCount}</p>
          </div>
        </Card>
        <Card className="w-full shadow-sm border border-slate-100">
          <div className="p-4">
            <p className="text-sm text-gray-500">التصنيفات</p>
            <p className="text-2xl font-bold text-primary">{categories.length}</p>
          </div>
        </Card>
      </div>
      <Card className="mb-6 shadow-sm border border-slate-100">
        <div className="p-4">
          <h2 className="font-semibold text-gray-900 mb-3">الملخص المالي (من الطلبات المكتملة)</h2>
          <p className="text-sm text-gray-500 mb-2">عمولة المنصة: {stats?.platformCommissionPercent ?? 0}%</p>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
            <span>[ إجمالي المبيعات: <strong>{formatPrice(stats?.totalSales ?? 0)}</strong> ]</span>
            <span className="text-gray-500">−</span>
            <span>[ عمولة المنصة: <strong>{formatPrice(stats?.platformFee ?? 0)}</strong> ]</span>
            <span className="text-gray-500">=</span>
            <span className="text-primary font-bold">[ رصيد التاجر: {formatPrice(stats?.merchantBalance ?? 0)} ]</span>
          </div>
        </div>
      </Card>
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card className="shadow-sm border border-slate-100">
          <div className="p-4">
            <h2 className="font-semibold text-gray-900 mb-3">تنبيه المخزون المنخفض</h2>
            <div className="h-12 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700 text-sm">
              تنبيه المخزون (UI فقط)
            </div>
          </div>
        </Card>
        <Card className="shadow-sm border border-slate-100">
          <div className="p-4">
            <h2 className="font-semibold text-gray-900 mb-3">الوحدات المفعّلة</h2>
            <p className="text-sm text-gray-500">Commerce, Restaurant, Apparel, Inventory, Analytics</p>
          </div>
        </Card>
      </div>
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card className="shadow-sm border border-slate-100">
          <div className="p-4">
            <h2 className="font-semibold text-gray-900 mb-3">رابط المتجر</h2>
            <div className="flex gap-2">
              <input
                readOnly
                value={storeUrl}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm"
              />
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(storeUrl)}
                className="p-2 rounded-lg hover:bg-gray-100"
              >
                <Copy className="w-4 h-4" />
              </button>
              <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg hover:bg-gray-100">
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </Card>
        {USE_API && MOCK_API_URL && (
          <Card className="shadow-sm border border-slate-100">
            <div className="p-4">
              <h2 className="font-semibold text-gray-900 mb-3">اختبار التنبيه (Push)</h2>
              <p className="text-sm text-gray-500 mb-2">إرسال تنبيه تجريبي للتأكد من الاستلام على هذا الجهاز.</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={testPushLoading}
                  onClick={async () => {
                    setTestPushResult(null);
                    setTestPushLoading(true);
                    try {
                      const token = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
                      const res = await fetch(`${MOCK_API_URL}/merchant/push-test`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          ...(token ? { Authorization: `Bearer ${token}` } : {}),
                        },
                      });
                      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; sent?: number; error?: string };
                      if (res.ok && data.ok) {
                        setTestPushResult({ ok: true, message: data.sent ? `تم الإرسال إلى ${data.sent} جهاز` : 'تم الإرسال' });
                      } else {
                        setTestPushResult({ ok: false, message: data.error ?? `خطأ ${res.status}` });
                      }
                    } catch (e) {
                      setTestPushResult({ ok: false, message: e instanceof Error ? e.message : 'فشل الطلب' });
                    } finally {
                      setTestPushLoading(false);
                    }
                  }}
                >
                  {testPushLoading ? 'جاري الإرسال...' : 'Test Push'}
                </Button>
                {orderAlarm && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={registerPushLoading}
                    onClick={async () => {
                      setRegisterPushLoading(true);
                      setTestPushResult(null);
                      try {
                        await orderAlarm.registerForPush();
                        if (!orderAlarm.pushError) {
                          setTestPushResult({ ok: true, message: 'تم تفعيل التنبيه على هذا الجهاز' });
                        }
                      } finally {
                        setRegisterPushLoading(false);
                      }
                    }}
                  >
                    {registerPushLoading ? 'جاري التفعيل...' : 'تفعيل التنبيه يدوياً'}
                  </Button>
                )}
              </div>
              {testPushResult && (
                <p className={`mt-2 text-sm ${testPushResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                  {testPushResult.message}
                </p>
              )}
              {orderAlarm?.pushError && (
                <p className="mt-2 text-sm text-red-600" role="alert">
                  {orderAlarm.pushError}
                </p>
              )}
            </div>
          </Card>
        )}
        <Card className="shadow-sm border border-slate-100">
          <div className="p-4">
            <h2 className="font-semibold text-gray-900 mb-3">معاينة الجوال</h2>
            <div className="flex justify-center">
              <div className="w-28 h-48 rounded-2xl border-4 border-gray-400 bg-white shadow-inner overflow-hidden">
                <div className="h-6 bg-gray-300 flex items-center justify-center">
                  <div className="w-12 h-3 rounded-full bg-gray-400" />
                </div>
                <div className="p-2 bg-gray-50 h-full flex items-center justify-center text-gray-500 text-xs">
                  Storefront
                </div>
              </div>
            </div>
            <div className="mt-3 h-20 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 text-sm">
              QR Code placeholder
            </div>
          </div>
        </Card>
      </div>
      {!setupComplete && (
        <Card className="mb-6 shadow-sm border border-slate-100">
          <div className="p-4">
            <h2 className="font-semibold text-gray-900 mb-3">قائمة الإعداد</h2>
            <ul className="space-y-2">
              <SetupItem done={hasCategories} label="إضافة التصنيفات" to="/catalog/categories" />
              <SetupItem done={hasProducts} label="إضافة المنتجات" to="/catalog/products" />
              {isPlatformAdmin(user?.role) && <SetupItem done={hasDelivery} label="إعداد التوصيل" to="/settings/delivery" />}
              <SetupItem done={hasCampaign} label="إنشاء أول حملة" to="/campaigns" />
            </ul>
          </div>
        </Card>
      )}
    </div>
  );
}

function SetupItem({ done, label, to }: { done: boolean; label: string; to: string }) {
  return (
    <li>
      <Link
        to={to}
        className={`flex items-center gap-2 py-1.5 rounded px-2 -ms-2 ${done ? 'text-gray-500' : 'text-primary hover:bg-primary/10'}`}
      >
        {done ? <Check className="w-4 h-4 text-green-600" /> : <Circle className="w-4 h-4" />}
        <span>{label}</span>
      </Link>
    </li>
  );
}

const LAUNCH_LABELS: Record<string, string> = {
  whatsapp: 'رقم واتساب',
  categories: '3 تصنيفات على الأقل',
  products: '5 منتجات على الأقل',
  stock: 'منتج واحد متوفر بالمخزون',
  hero: 'الهيرو مُعد',
  banners: 'بانر واحد على الأقل',
};

function LaunchReadinessPanel({
  checks,
  ready,
  collapsed,
  onToggleCollapsed,
}: {
  checks: Record<string, boolean>;
  ready: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  return (
    <Card className="mb-6 shadow-sm border border-slate-100" dir="rtl">
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-gray-900">جاهزية الإطلاق</h2>
          {onToggleCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              aria-expanded={!collapsed}
            >
              {collapsed ? (
                <>
                  <span>إظهار</span>
                  <ChevronDown className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>إخفاء</span>
                  <ChevronUp className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
        {!collapsed && (
          <>
            <ul className="space-y-2 mb-4 mt-3">
              {Object.entries(checks).map(([key, ok]) => (
                <li key={key} className="flex items-center gap-2 text-sm">
                  {ok ? (
                    <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  )}
                  <span className={ok ? 'text-gray-700' : 'text-gray-600'}>{LAUNCH_LABELS[key] ?? key}</span>
                </li>
              ))}
            </ul>
            <div className="pt-2 border-t border-gray-200">
              {ready ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-100 text-green-800 text-sm font-medium">
                  <Check className="w-4 h-4" />
                  المحل جاهز للإطلاق
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-800 text-sm font-medium">
                  <AlertCircle className="w-4 h-4" />
                  المحل غير جاهز بعد
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
