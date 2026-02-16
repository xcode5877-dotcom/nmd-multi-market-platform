import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Tabs, TabsList, TabsTrigger, TabsContent, Button, Badge, useToast } from '@nmd/ui';
import { getTenantById, getCatalog, listOrdersByTenant } from '@nmd/mock';
import { MockApiClient } from '@nmd/mock';
import { useState } from 'react';
import { formatPrice } from '@nmd/core';
import { Sparkles, ArrowLeft, Settings } from 'lucide-react';

const api = new MockApiClient();
const USE_API = !!import.meta.env.VITE_MOCK_API_URL;
const ADMIN_PORT = 5174;
const STOREFRONT_PORT = 5173;

export default function TenantDetailPage() {
  const params = useParams<{ id?: string; tenantId?: string }>();
  const id = params.tenantId ?? params.id;
  const queryClient = useQueryClient();
  const { data: tenantFromApi, isLoading } = useQuery({
    queryKey: ['tenant-registry', id],
    queryFn: () => api.getTenantById(id!),
    enabled: !!id && USE_API,
  });
  const { data: catalogFromApi } = useQuery({
    queryKey: ['catalog', id],
    queryFn: () => api.getCatalogApi(id!),
    enabled: !!id && USE_API,
  });
  const { data: ordersFromApi = [] } = useQuery({
    queryKey: ['orders', id],
    queryFn: () => api.listOrdersByTenant(id!),
    enabled: !!id && USE_API,
  });

  const addToast = useToast().addToast;
  const markReadyMutation = useMutation({
    mutationFn: (orderId: string) => api.markOrderReady(id!, orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
      addToast('تم تعليم الطلب جاهزاً', 'success');
    },
    onError: (err) => addToast(err instanceof Error ? err.message : 'فشل', 'error'),
  });
  const applyTemplateMutation = useMutation({
    mutationFn: () => api.applyTemplateApi(id!, 'clothing'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-registry', id] });
      queryClient.invalidateQueries({ queryKey: ['catalog', id] });
      addToast('تم تطبيق القالب بنجاح', 'success');
    },
    onError: (err) => addToast(err instanceof Error ? err.message : 'فشل تطبيق القالب', 'error'),
  });

  const tenant = id ? (USE_API ? tenantFromApi : getTenantById(id)) : null;
  const [tab, setTab] = useState('branding');

  if (USE_API && isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!tenant) {
    return (
      <div className="p-8 text-center text-gray-500">
        المستأجر غير موجود
      </div>
    );
  }

  const catalog = USE_API ? (catalogFromApi ?? { categories: [], products: [], optionGroups: [] }) : getCatalog(tenant.id);
  const tenantType = (tenant as { tenantType?: string }).tenantType ?? (tenant.type === 'FOOD' ? 'RESTAURANT' : 'SHOP');
  const isRestaurant = tenantType === 'RESTAURANT';
  const orders = (USE_API ? ordersFromApi : listOrdersByTenant(tenant.id)).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 20);

  const adminUrl = `http://localhost:${ADMIN_PORT}/?tenant=${tenant.slug}`;
  const storefrontUrl = `http://localhost:${STOREFRONT_PORT}/?tenant=${tenant.slug}`;

  const marketId = params.tenantId ? params.id : undefined;

  return (
    <div>
      {marketId && (
        <Link
          to={`/markets/${marketId}/tenants`}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          رجوع للمستأجرين
        </Link>
      )}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-2xl"
            style={{ backgroundColor: tenant.primaryColor }}
          >
            {tenant.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
              {tenant?.businessType && <Badge className="text-xs">{tenant.businessType}</Badge>}
            </div>
            <p className="text-gray-500">/{tenant.slug}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => applyTemplateMutation.mutate()}
            disabled={applyTemplateMutation.isPending}
            className="gap-1.5"
          >
            <Sparkles className="w-4 h-4" />
            {applyTemplateMutation.isPending ? 'جاري التطبيق...' : 'تطبيق قالب جاهز'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.open(adminUrl, '_blank')}>
            فتح لوحة المستأجر
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.open(storefrontUrl, '_blank')}>
            فتح المتجر
          </Button>
          <Link to={marketId ? `/markets/${marketId}/tenants/${id}/settings/delivery` : `/tenants/${id}/settings/delivery`}>
            <Button size="sm" variant="outline" className="gap-1.5">
              <Settings className="w-4 h-4" />
              إعدادات التوصيل
            </Button>
          </Link>
        </div>
      </div>
      <Tabs value={tab} onChange={setTab}>
        <TabsList>
          <TabsTrigger value="branding">العلامة التجارية</TabsTrigger>
          <TabsTrigger value="catalog">الكتالوج</TabsTrigger>
          <TabsTrigger value="orders">الطلبات</TabsTrigger>
        </TabsList>
        <TabsContent value="branding">
          <Card className="p-6">
            <div className="space-y-2 text-sm">
              <p><span className="text-gray-500">اللون الأساسي:</span> <span className="font-mono" style={{ color: tenant.primaryColor }}>{tenant.primaryColor}</span></p>
              <p><span className="text-gray-500">اللون الثانوي:</span> <span className="font-mono" style={{ color: tenant.secondaryColor }}>{tenant.secondaryColor}</span></p>
              <p><span className="text-gray-500">الخط:</span> {tenant.fontFamily}</p>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="catalog">
          <Card className="p-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-gray-50">
                <p className="text-2xl font-bold text-primary">{catalog.categories?.length ?? 0}</p>
                <p className="text-sm text-gray-500">تصنيفات</p>
              </div>
              <div className="p-4 rounded-lg bg-gray-50">
                <p className="text-2xl font-bold text-primary">{catalog.products?.length ?? 0}</p>
                <p className="text-sm text-gray-500">منتجات</p>
              </div>
              <div className="p-4 rounded-lg bg-gray-50">
                <p className="text-2xl font-bold text-primary">{catalog.optionGroups?.length ?? 0}</p>
                <p className="text-sm text-gray-500">مجموعات خيارات</p>
              </div>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="orders">
          <Card className="p-6">
            <p className="text-sm text-gray-500 mb-4">آخر 20 طلب</p>
            {orders.length === 0 ? (
              <p className="text-gray-500">لا توجد طلبات</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-start py-2">#</th>
                      <th className="text-start py-2">التاريخ</th>
                      <th className="text-start py-2">الإجمالي</th>
                      <th className="text-start py-2">الحالة</th>
                      {isRestaurant && <th className="text-start py-2">جاهز في</th>}
                      {USE_API && isRestaurant && <th className="text-start py-2">إجراء</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o, i) => {
                      const oExt = o as { id?: unknown; status?: string; readyAt?: string; fallbackTriggeredAt?: string };
                      const idStr = String(oExt.id ?? '');
                      const hasValidId = idStr.length > 0;
                      if (!hasValidId && i < 3) console.warn('[TenantDetailPage] Order with missing/non-string id:', o); // Guard: avoid spam
                      const readyAt = oExt.readyAt ? new Date(oExt.readyAt) : null;
                      const now = new Date();
                      const minsLeft = readyAt ? Math.max(0, Math.round((readyAt.getTime() - now.getTime()) / 60000)) : null;
                      const canMarkReady = USE_API && isRestaurant && hasValidId && oExt.status !== 'READY' && oExt.status !== 'OUT_FOR_DELIVERY' && oExt.status !== 'DELIVERED' && oExt.status !== 'CANCELED';
                      return (
                        <tr key={hasValidId ? idStr : `order-${i}`} className="border-b">
                          <td className="py-2 font-mono">{hasValidId ? idStr.slice(0, 8) : '—'}</td>
                          <td className="py-2">{new Date(o.createdAt).toLocaleDateString('ar-SA')}</td>
                          <td className="py-2">{formatPrice(o.total)}</td>
                          <td className="py-2">
                            <span className={oExt.status === 'READY' ? 'text-green-600 font-medium' : ''}>{oExt.status ?? o.status}</span>
                            {oExt.fallbackTriggeredAt && <span className="ms-1 text-xs text-amber-600" title="انتقل لتوصيل السوق">↗</span>}
                          </td>
                          {isRestaurant && (
                            <td className="py-2">
                              {oExt.status === 'READY' ? <span className="text-green-600">جاهز</span> : minsLeft !== null ? <span>{minsLeft} د</span> : '-'}
                            </td>
                          )}
                          {USE_API && isRestaurant && (
                            <td className="py-2">
                              {canMarkReady && (
                                <Button size="sm" onClick={() => markReadyMutation.mutate(idStr)} disabled={markReadyMutation.isPending}>
                                  جاهز للاستلام
                                </Button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
