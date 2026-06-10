import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, useToast, ConfirmDialog, OrderListFilters, OrderListCountsBar, OrderSourceBadge } from '@nmd/ui';
import { MockApiClient } from '@nmd/mock';
import {
  formatPrice,
  formatDateTimeGregorian,
  filterOrdersForList,
  sortOrdersByNewest,
  getOrderListCounts,
  DEFAULT_ORDER_SOURCE_FILTER,
  DEFAULT_ORDER_STATUS_FILTER,
  type OrderSourceFilter,
  type OrderStatusFilterKey,
} from '@nmd/core';
import { useTenant } from '../contexts/TenantContext';
import StoreStatusToggle from '../../components/StoreStatusToggle';
import { Banknote, CreditCard, Eye, Trash2, TrendingUp } from 'lucide-react';

const api = new MockApiClient();

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
  payment?: { method?: string };
  paymentMethod?: string;
  isExternal?: boolean;
}

type TimeRangeKey = 'day' | 'week' | 'month';
type PaymentFilter = 'ALL' | 'CASH' | 'CARD';

function paymentBadgeForOrder(o: OrderExt): { label: string; className: string } {
  const raw = String(o.payment?.method ?? o.paymentMethod ?? 'CASH')
    .toUpperCase()
    .trim();
  if (
    raw === 'CARD' ||
    raw === 'CREDIT_CARD' ||
    raw === 'CREDIT' ||
    raw === 'ONLINE' ||
    raw === 'VISA'
  ) {
    return { label: 'فيزا', className: 'bg-blue-100 text-blue-800 border border-blue-200' };
  }
  return { label: 'نقداً', className: 'bg-emerald-100 text-emerald-800 border border-emerald-200' };
}

export default function TenantOrdersPage() {
  console.log('NMD-TARGET-ACQUIRED: This is the Tenant Orders Page!');
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { tenantId, tenant } = useTenant();
  const [deleteTarget, setDeleteTarget] = useState<OrderExt | null>(null);
  const [hardDeleting, setHardDeleting] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRangeKey>('day');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('ALL');
  const [sourceFilter, setSourceFilter] = useState<OrderSourceFilter>(DEFAULT_ORDER_SOURCE_FILTER);
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilterKey>(DEFAULT_ORDER_STATUS_FILTER);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['merchant-stats', tenantId, timeRange],
    queryFn: () => api.getMerchantStats(tenantId!, timeRange),
    enabled: !!tenantId,
  });

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', tenantId, paymentFilter],
    queryFn: () =>
      api.listOrdersByTenant(tenantId!, {
        paymentMethod: paymentFilter,
      }),
    enabled: !!tenantId,
  });

  const orderCounts = useMemo(() => getOrderListCounts(orders as OrderExt[]), [orders]);

  const orderRows = filterOrdersForList(
    sortOrdersByNewest(orders as OrderExt[]),
    sourceFilter,
    statusFilter
  );

  const markReadyMutation = useMutation({
    mutationFn: (orderId: string) => api.markOrderReady(tenantId!, orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['merchant-stats', tenantId] });
      addToast('تم تعليم الطلب جاهزاً', 'success');
    },
    onError: (e) => addToast(e instanceof Error ? e.message : 'فشل', 'error'),
  });

  const handleHardDelete = async () => {
    if (!deleteTarget) return;
    setHardDeleting(true);
    try {
      const base = (import.meta.env.VITE_MOCK_API_URL ?? '/api').replace(/\/$/, '');
      const orderId = deleteTarget.id;
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('nmd-access-token') : null;
      const res = await fetch(`${base}/orders/${encodeURIComponent(orderId)}/hard-delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error(String(res.status));

      // Optimistic UI update: remove from orders immediately.
      queryClient.setQueryData<OrderExt[]>(['orders', tenantId], (old) => {
        if (!old) return old;
        return old.filter((o) => o.id !== orderId);
      });

      queryClient.invalidateQueries({ queryKey: ['orders', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['merchant-stats', tenantId] });
      setDeleteTarget(null);
      addToast('تم حذف الطلب نهائياً', 'success');
    } catch {
      addToast('فشل حذف الطلب', 'error');
    } finally {
      setHardDeleting(false);
    }
  };

  const tenantType = (tenant as { tenantType?: string })?.tenantType ?? 'SHOP';
  const isRestaurant = tenantType === 'RESTAURANT';
  const allowFallback = (tenant as { allowMarketCourierFallback?: boolean })?.allowMarketCourierFallback ?? false;


  if (!tenantId) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">الطلبات</h1>
        <Card className="p-6">
          <p className="text-sm text-gray-500">جاري تحميل بيانات المتجر...</p>
        </Card>
      </div>
    );
  }

  const operationalStatus = (tenant as { operationalStatus?: 'open' | 'closed' | 'busy' })?.operationalStatus ?? 'open';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">الطلبات</h1>
          <Link to="/delivery-leads" className="text-sm text-primary hover:underline">
            طلبات واتساب / اتصال
          </Link>
        </div>
        {tenantId && (
          <StoreStatusToggle
            tenantId={tenantId}
            currentStatus={operationalStatus}
            emphasizeClosed
            variant="full"
          />
        )}
      </div>
      {allowFallback && (
        <p className="text-sm text-amber-600 mb-4">⚠️ تفعيل الانتقال لتوصيل السوق عند التأخر</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-sm text-gray-600">ملخص المبيعات (طلبات مكتملة / مدفوعة)</p>
        <div className="flex items-center gap-2">
          <label htmlFor="tenant-stats-range" className="text-sm text-gray-600 whitespace-nowrap">
            الفترة:
          </label>
          <select
            id="tenant-stats-range"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRangeKey)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="day">اليوم</option>
            <option value="week">هذا الأسبوع</option>
            <option value="month">هذا الشهر</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 border border-slate-200 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm text-gray-500 mb-1">إجمالي المبيعات</p>
              <p className="text-2xl font-bold text-gray-900 tabular-nums">
                {statsLoading ? '…' : formatPrice(stats?.totalSales ?? 0)}
              </p>
              <p className="text-xs text-gray-400 mt-1">{stats?.orderCount ?? 0} طلب</p>
            </div>
            <div className="rounded-full bg-slate-100 p-2">
              <TrendingUp className="w-6 h-6 text-slate-600" aria-hidden />
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-emerald-200 bg-emerald-50/40 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm text-emerald-800 mb-1">نقداً</p>
              <p className="text-2xl font-bold text-emerald-900 tabular-nums">
                {statsLoading ? '…' : formatPrice(stats?.cashSales ?? 0)}
              </p>
              <p className="text-xs text-emerald-700/80 mt-1">{stats?.cashOrderCount ?? 0} طلب</p>
            </div>
            <div className="rounded-full bg-emerald-100 p-2">
              <Banknote className="w-6 h-6 text-emerald-700" aria-hidden />
            </div>
          </div>
        </Card>
        <Card className="p-4 border border-blue-200 bg-blue-50/40 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm text-blue-800 mb-1">بطاقة / فيزا</p>
              <p className="text-2xl font-bold text-blue-900 tabular-nums">
                {statsLoading ? '…' : formatPrice(stats?.onlineSales ?? 0)}
              </p>
              <p className="text-xs text-blue-700/80 mt-1">{stats?.onlineOrderCount ?? 0} طلب</p>
            </div>
            <div className="rounded-full bg-blue-100 p-2">
              <CreditCard className="w-6 h-6 text-blue-700" aria-hidden />
            </div>
          </div>
        </Card>
      </div>

      <OrderListCountsBar counts={orderCounts} className="mb-3" />
      <OrderListFilters
        sourceFilter={sourceFilter}
        statusFilter={statusFilter}
        onSourceChange={setSourceFilter}
        onStatusChange={setStatusFilter}
        className="mb-4"
      />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className="text-sm text-gray-600">تصفية الطلبات حسب الدفع:</span>
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {(['ALL', 'CASH', 'CARD'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setPaymentFilter(key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                paymentFilter === key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {key === 'ALL' ? 'الكل' : key === 'CASH' ? 'نقداً' : 'فيزا'}
            </button>
          ))}
        </div>
      </div>

      <Card className="p-4">
        {isLoading ? (
          <p className="text-gray-500 py-8 text-center">جاري التحميل...</p>
        ) : orderRows.length === 0 ? (
          <p className="text-gray-500 py-8 text-center">لا توجد طلبات</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-start font-medium text-gray-700">الطلب</th>
                  <th className="px-4 py-2 text-start font-medium text-gray-700">التاريخ</th>
                  <th className="px-4 py-2 text-start font-medium text-gray-700">المبلغ والدفع</th>
                  <th className="px-4 py-2 text-start font-medium text-gray-700">الحالة</th>
                  {isRestaurant && <th className="px-4 py-2 text-start font-medium text-gray-700">جاهز في</th>}
                  <th className="px-4 py-2 text-start font-medium text-gray-700">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {orderRows.map((o) => {
                  const payBadge = paymentBadgeForOrder(o);
                  const readyAt = o.readyAt ? new Date(o.readyAt ?? 0) : null;
                  const now = new Date();
                  const minsLeft = readyAt ? Math.max(0, Math.round((readyAt.getTime() - now.getTime()) / 60000)) : null;
                  const canMarkReady = isRestaurant && o.status !== 'READY' && o.status !== 'OUT_FOR_DELIVERY' && o.status !== 'DELIVERED' && o.status !== 'CANCELED';
                  return (
                    <tr key={o.id} className="border-t border-gray-100">
                      <td className="px-4 py-2">
                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-xs">{o.id.slice(0, 8)}</span>
                          <OrderSourceBadge isExternal={o.isExternal} />
                        </div>
                      </td>
                      <td className="px-4 py-2 text-gray-600">{o.createdAt ? formatDateTimeGregorian(o.createdAt) : '-'}</td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium tabular-nums">{formatPrice(o.total ?? 0)}</span>
                          {payBadge && (
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${payBadge.className}`}
                            >
                              {payBadge.label}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span className={o.status === 'READY' ? 'text-green-600 font-medium' : ''}>
                          {o.status ?? '-'}
                        </span>
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
                        <div className="flex flex-wrap items-center gap-2">
                          {canMarkReady && (
                            <Button
                              size="sm"
                              onClick={() => markReadyMutation.mutate(o.id)}
                              disabled={markReadyMutation.isPending}
                            >
                              جاهز للاستلام
                            </Button>
                          )}
                          <button
                            type="button"
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                            onClick={() => addToast('عرض الطلب (واجهة تجريبية)', 'info')}
                            aria-label="عرض الطلب"
                            title="عرض الطلب"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                            onClick={() => setDeleteTarget(o)}
                            aria-label="حذف الطلب نهائياً"
                            title="حذف نهائياً"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleHardDelete}
        title="حذف الطلب نهائياً"
        message={deleteTarget ? 'هل أنت متأكد من حذف هذا الطلب؟' : ''}
        confirmLabel="حذف نهائياً"
        variant="danger"
        loading={hardDeleting}
        closeOnConfirm={false}
      />
    </div>
  );
}
