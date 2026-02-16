import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, PageHeader, EmptyState, Button } from '@nmd/ui';
import { useAdminContext } from '../context/AdminContext';
import { createAdminData } from '../store/admin-data';
import { getDeliverySettings, getTenantById, listOrdersByTenant, listCampaigns } from '@nmd/mock';
import { MockApiClient } from '@nmd/mock';
import { isValidWhatsAppPhone } from '@nmd/core';
import { Check, Circle, Copy, ExternalLink, AlertCircle } from 'lucide-react';

const api = new MockApiClient();
const USE_API = !!import.meta.env.VITE_MOCK_API_URL;
const STOREFRONT_URL = import.meta.env.DEV ? 'http://localhost:5173' : '/storefront';

export default function DashboardPage() {
  const { tenantId } = useAdminContext();
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

  const ordersToday = orders.filter(
    (o: { createdAt?: string }) => new Date(o.createdAt!).toDateString() === new Date().toDateString()
  );
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

  const setupComplete = hasCategories && hasProducts && hasDelivery && hasCampaign;
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
        <LaunchReadinessPanel checks={launchChecks} ready={launchReady} />
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
      <LaunchReadinessPanel checks={launchChecks} ready={launchReady} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">الإيرادات</p>
            <p className="text-2xl font-bold text-primary">—</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">الطلبات اليوم</p>
            <p className="text-2xl font-bold text-primary">{ordersToday.length}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <p className="text-sm text-gray-500">التصنيفات</p>
            <p className="text-2xl font-bold text-primary">{categories.length}</p>
          </div>
        </Card>
      </div>
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card>
          <div className="p-4">
            <h2 className="font-semibold text-gray-900 mb-3">تنبيه المخزون المنخفض</h2>
            <div className="h-12 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700 text-sm">
              تنبيه المخزون (UI فقط)
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <h2 className="font-semibold text-gray-900 mb-3">الوحدات المفعّلة</h2>
            <p className="text-sm text-gray-500">Commerce, Restaurant, Apparel, Inventory, Analytics</p>
          </div>
        </Card>
      </div>
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <Card>
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
        <Card>
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
        <Card className="mb-6">
          <div className="p-4">
            <h2 className="font-semibold text-gray-900 mb-3">قائمة الإعداد</h2>
            <ul className="space-y-2">
              <SetupItem done={hasCategories} label="إضافة التصنيفات" to="/catalog/categories" />
              <SetupItem done={hasProducts} label="إضافة المنتجات" to="/catalog/products" />
              <SetupItem done={hasDelivery} label="إعداد التوصيل" to="/settings/delivery" />
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
}: {
  checks: Record<string, boolean>;
  ready: boolean;
}) {
  return (
    <Card className="mb-6" dir="rtl">
      <div className="p-4">
        <h2 className="font-semibold text-gray-900 mb-3">جاهزية الإطلاق</h2>
        <ul className="space-y-2 mb-4">
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
      </div>
    </Card>
  );
}
