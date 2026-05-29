import { Link } from 'react-router-dom';
import { Card, Skeleton } from '@nmd/ui';
import {
  Store,
  Users,
  Radio,
  Truck,
  UserCheck,
  UserX,
  Package,
  RefreshCw,
  ClipboardList,
} from 'lucide-react';
import { useDriverOpsOverview } from '../../drivers/useDriverOpsOverview';
import { DriversOpsStatCard } from '../../components/drivers/DriversOpsStatCard';
import { DriversMarketOpsTable } from '../../components/drivers/DriversMarketOpsTable';

export default function DriversHubPage() {
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useDriverOpsOverview();

  const totals = data?.totals;
  const updatedLabel = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          آخر تحديث: {updatedLabel}
          {isFetching ? ' · جاري التحديث...' : ''}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      {isError ? (
        <Card className="p-6 border-red-200 bg-red-50 text-red-800">
          فشل تحميل لوحة التوصيل. تحقق من الاتصال بالخادم.
        </Card>
      ) : null}

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : totals ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <DriversOpsStatCard label="الأسواق" value={totals.markets} icon={Store} />
          <DriversOpsStatCard label="إجمالي السائقين" value={totals.couriers} icon={Users} />
          <DriversOpsStatCard label="متصلون" value={totals.onlineCouriers} icon={Radio} tone="success" />
          <DriversOpsStatCard label="غير متصلين" value={totals.offlineCouriers} icon={UserX} />
          <DriversOpsStatCard label="متاحون للتوصيل" value={totals.availableCouriers} icon={UserCheck} tone="info" />
          <DriversOpsStatCard label="توصيلات نشطة" value={totals.activeDeliveries} icon={Truck} tone="warning" />
          <DriversOpsStatCard label="في الطابور" value={totals.queueCount} icon={ClipboardList} />
          <DriversOpsStatCard
            label="توصيلات اليوم"
            value={totals.deliveriesToday}
            hint={`طلبات خارجية اليوم: ${totals.externalOrdersToday}`}
            icon={Package}
          />
        </div>
      ) : null}

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="font-semibold text-gray-900">الأسواق — نظرة تشغيلية</h2>
          <Link to="/drivers/markets" className="text-sm text-teal-700 hover:underline">
            عرض كل الاختصارات
          </Link>
        </div>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <DriversMarketOpsTable rows={data?.markets ?? []} />
        )}
      </Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Link
          to="/drivers/couriers"
          className="p-4 rounded-xl border border-teal-200 bg-teal-50/50 hover:border-teal-400 hover:shadow-sm transition-shadow"
        >
          <p className="font-medium text-gray-900">إدارة السائقين</p>
          <p className="text-xs text-gray-500 mt-1">إضافة وتعديل وتعطيل السائقين لكل الأسواق</p>
        </Link>
        <Link
          to="/external-orders"
          className="p-4 rounded-xl border border-gray-200 bg-white hover:border-teal-300 hover:shadow-sm transition-shadow"
        >
          <p className="font-medium text-gray-900">الطلبات الخارجية</p>
          <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{totals?.externalOrdersTotal ?? '—'}</p>
          <p className="text-xs text-gray-500 mt-1">تقرير عالمي للطلبات اليدوية من السائقين</p>
        </Link>
        <Link
          to="/drivers/finance"
          className="p-4 rounded-xl border border-gray-200 bg-white hover:border-teal-300 hover:shadow-sm transition-shadow"
        >
          <p className="font-medium text-gray-900">التسويات المالية</p>
          <p className="text-xs text-gray-500 mt-2">ملخص نقدي وكوبا لكل سوق</p>
        </Link>
        <Link
          to="/drivers/reports"
          className="p-4 rounded-xl border border-gray-200 bg-white hover:border-teal-300 hover:shadow-sm transition-shadow"
        >
          <p className="font-medium text-gray-900">التقارير</p>
          <p className="text-xs text-gray-500 mt-2">ترتيب السائقين وسجل التسويات</p>
        </Link>
      </div>
    </div>
  );
}
