import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Drawer, Button, Skeleton } from '@nmd/ui';
import { Truck, KeyRound, Pencil, Trash2 } from 'lucide-react';
import type { GlobalCourierRow } from '../../drivers/globalCourierTypes';
import { DriverOnlineBadge } from './DriverOnlineBadge';
import { useGlobalCouriersApi } from '../../drivers/useGlobalCouriers';

export function CourierDetailsDrawer({
  courier,
  open,
  onClose,
  onEdit,
  onChangePassword,
  onDelete,
  canWrite,
}: {
  courier: GlobalCourierRow | null;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onChangePassword: () => void;
  onDelete?: () => void;
  canWrite: boolean;
}) {
  const api = useGlobalCouriersApi();
  const marketId = courier?.marketId;
  const courierId = courier?.id;

  const { data: financeStats, isLoading: financeLoading } = useQuery({
    queryKey: ['courier-finance-stats', marketId, courierId],
    queryFn: () => api.getMarketCourierFinancialStats(marketId!, courierId!),
    enabled: open && !!marketId && !!courierId,
  });

  const { data: recentOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['courier-recent-orders', marketId, courierId],
    queryFn: async () => {
      const orders = await api.getMarketOrders(marketId!);
      return orders
        .filter(
          (o) =>
            (o as { courierId?: string }).courierId === courierId &&
            o.fulfillmentType === 'DELIVERY',
        )
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
        .slice(0, 8);
    },
    enabled: open && !!marketId && !!courierId,
  });

  if (!courier) return null;

  const allowedCount = Array.isArray(courier.allowedStoreIds) ? courier.allowedStoreIds.length : 0;

  return (
    <Drawer open={open} onClose={onClose} title={courier.name} contentClassName="w-full max-w-md">
      <div className="space-y-5 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <DriverOnlineBadge isOnline={courier.isOnline} isAvailable={courier.isAvailable} isActive={courier.isActive} />
          <span className="text-gray-500">{courier.marketName}</span>
        </div>

        <dl className="grid grid-cols-2 gap-2">
          <dt className="text-gray-500">الجوال</dt>
          <dd className="font-medium">{courier.phone ?? '—'}</dd>
          <dt className="text-gray-500">البريد</dt>
          <dd className="font-medium break-all">{courier.email ?? '—'}</dd>
          <dt className="text-gray-500">السعة</dt>
          <dd>{courier.capacity ?? 3}</dd>
          <dt className="text-gray-500">إجمالي التوصيلات</dt>
          <dd>{courier.deliveryCount ?? 0}</dd>
          <dt className="text-gray-500">متاجر مسموحة</dt>
          <dd>{allowedCount > 0 ? allowedCount : 'كل المتاجر'}</dd>
        </dl>

        {(courier.deliveredCountToday != null || courier.pointsWeek != null) && (
          <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
            <p className="font-medium text-gray-900 mb-2">الأداء</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <span>اليوم: {courier.deliveredCountToday ?? 0}</span>
              <span>الأسبوع: {courier.deliveredCountWeek ?? 0}</span>
              <span>نقاط اليوم: {courier.pointsToday ?? 0}</span>
              <span>نقاط الأسبوع: {courier.pointsWeek ?? 0}</span>
              {courier.onTimeRate != null && <span>ضمن SLA: {courier.onTimeRate}%</span>}
              {courier.avgTotalMin != null && <span>متوسط: {courier.avgTotalMin} د</span>}
            </div>
            {(courier.badgesWeek?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {courier.badgesWeek!.map((b) => (
                  <span key={b} className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                    {b}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <p className="font-medium text-gray-900 mb-2">المالية</p>
          {financeLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : financeStats ? (
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <dt className="text-gray-500">إيراد التطبيق</dt>
              <dd>{Number(financeStats.appRevenue ?? 0).toFixed(2)} ₪</dd>
              <dt className="text-gray-500">خارجي</dt>
              <dd>{Number(financeStats.externalRevenue ?? 0).toFixed(2)} ₪</dd>
              <dt className="text-gray-500">مصاريف</dt>
              <dd>{Number(financeStats.expenses ?? 0).toFixed(2)} ₪</dd>
              <dt className="text-gray-500 font-semibold">صافي</dt>
              <dd className="font-bold text-emerald-700">{Number(financeStats.net ?? 0).toFixed(2)} ₪</dd>
            </dl>
          ) : (
            <p className="text-gray-500">لا توجد بيانات</p>
          )}
        </div>

        <div>
          <p className="font-medium text-gray-900 mb-2">آخر الطلبات</p>
          {ordersLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : recentOrders.length === 0 ? (
            <p className="text-gray-500 text-xs">لا توجد طلبات حديثة</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {recentOrders.map((o) => (
                <li key={o.id} className="flex justify-between gap-2 border-b border-gray-100 py-1">
                  <span className="font-mono">{o.id?.slice(0, 10)}</span>
                  <span>{o.status ?? '—'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Link
            to={`/markets/${courier.marketId}/dispatch`}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700"
          >
            <Truck className="w-4 h-4" />
            فتح التوجيه
          </Link>
          {canWrite && (
            <>
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Pencil className="w-4 h-4 ml-1" />
                تعديل
              </Button>
              <Button size="sm" variant="outline" onClick={onChangePassword}>
                <KeyRound className="w-4 h-4 ml-1" />
                كلمة المرور
              </Button>
            </>
          )}
        </div>

        {canWrite && onDelete && (
          <div className="pt-4 mt-2 border-t border-red-100">
            <p className="text-xs font-medium text-red-700 mb-2">متقدم / منطقة الخطر</p>
            <Button
              size="sm"
              variant="outline"
              className="text-red-700 border-red-200 hover:bg-red-50 w-full justify-center"
              onClick={onDelete}
            >
              <Trash2 className="w-4 h-4 ml-1" />
              حذف السائق
            </Button>
          </div>
        )}
      </div>
    </Drawer>
  );
}
