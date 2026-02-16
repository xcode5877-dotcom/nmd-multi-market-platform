import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, useToast } from '@nmd/ui';
import { MockApiClient } from '@nmd/mock';
import { formatPrice } from '@nmd/core';
import { useTenant } from '../contexts/TenantContext';

const api = new MockApiClient();
const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

interface OrderExt {
  id: string;
  tenantId: string;
  status?: string;
  readyAt?: string;
  createdAt?: string;
  total?: number;
  fulfillmentType?: string;
  deliveryAssignmentMode?: string;
  fallbackTriggeredAt?: string;
}

export default function TenantOrdersPage() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { tenantId, tenant } = useTenant();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', tenantId],
    queryFn: () => api.listOrdersByTenant(tenantId!),
    enabled: !!MOCK_API_URL && !!tenantId,
  });

  const markReadyMutation = useMutation({
    mutationFn: (orderId: string) => api.markOrderReady(tenantId!, orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', tenantId] });
      addToast('تم تعليم الطلب جاهزاً', 'success');
    },
    onError: (e) => addToast(e instanceof Error ? e.message : 'فشل', 'error'),
  });

  const tenantType = (tenant as { tenantType?: string })?.tenantType ?? 'SHOP';
  const isRestaurant = tenantType === 'RESTAURANT';
  const allowFallback = (tenant as { allowMarketCourierFallback?: boolean })?.allowMarketCourierFallback ?? false;

  const sortedOrders = ([...orders] as OrderExt[]).sort(
    (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
  );

  if (!MOCK_API_URL || !tenantId) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">الطلبات</h1>
        <Card className="p-6">
          <p className="text-sm text-gray-500">يتطلب الاتصال بواجهة برمجة التطبيقات</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">الطلبات</h1>
      {allowFallback && (
        <p className="text-sm text-amber-600 mb-4">⚠️ تفعيل الانتقال لتوصيل السوق عند التأخر</p>
      )}
      <Card className="p-4">
        {isLoading ? (
          <p className="text-gray-500 py-8 text-center">جاري التحميل...</p>
        ) : sortedOrders.length === 0 ? (
          <p className="text-gray-500 py-8 text-center">لا توجد طلبات</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-start font-medium text-gray-700">الطلب</th>
                  <th className="px-4 py-2 text-start font-medium text-gray-700">التاريخ</th>
                  <th className="px-4 py-2 text-start font-medium text-gray-700">الإجمالي</th>
                  <th className="px-4 py-2 text-start font-medium text-gray-700">الحالة</th>
                  {isRestaurant && <th className="px-4 py-2 text-start font-medium text-gray-700">جاهز في</th>}
                  <th className="px-4 py-2 text-start font-medium text-gray-700">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {sortedOrders.map((o) => {
                  const readyAt = o.readyAt ? new Date(o.readyAt) : null;
                  const now = new Date();
                  const minsLeft = readyAt ? Math.max(0, Math.round((readyAt.getTime() - now.getTime()) / 60000)) : null;
                  const canMarkReady = isRestaurant && o.status !== 'READY' && o.status !== 'OUT_FOR_DELIVERY' && o.status !== 'DELIVERED' && o.status !== 'CANCELED';
                  return (
                    <tr key={o.id} className="border-t border-gray-100">
                      <td className="px-4 py-2 font-mono text-xs">{o.id.slice(0, 8)}</td>
                      <td className="px-4 py-2 text-gray-600">{o.createdAt ? new Date(o.createdAt).toLocaleString('ar-SA') : '-'}</td>
                      <td className="px-4 py-2">{formatPrice(o.total ?? 0)}</td>
                      <td className="px-4 py-2">
                        <span className={o.status === 'READY' ? 'text-green-600 font-medium' : ''}>{o.status ?? '-'}</span>
                        {o.fallbackTriggeredAt && (
                          <span className="ms-1 text-xs text-amber-600" title="انتقل لتوصيل السوق">↗</span>
                        )}
                      </td>
                      {isRestaurant && (
                        <td className="px-4 py-2">
                          {o.status === 'READY' ? (
                            <span className="text-green-600">جاهز</span>
                          ) : minsLeft !== null ? (
                            <span className={minsLeft <= 0 ? 'text-amber-600' : 'text-gray-600'}>{minsLeft} د</span>
                          ) : (
                            '-'
                          )}
                        </td>
                      )}
                      <td className="px-4 py-2">
                        {canMarkReady && (
                          <Button
                            size="sm"
                            onClick={() => markReadyMutation.mutate(o.id)}
                            disabled={markReadyMutation.isPending}
                          >
                            جاهز للاستلام
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
