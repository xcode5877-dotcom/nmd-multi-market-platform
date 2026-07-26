import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, Button, Skeleton } from '@nmd/ui';
import { formatPrice } from '@nmd/core';
import { Wallet, ArrowLeft } from 'lucide-react';
import { apiHeaders } from '../../api';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

type Dashboard = {
  driverCollectionsToday: number;
  pendingCollections: number;
  settledToday: number;
  deliveryFeesToday: number;
  platformCommissionsToday: number;
};

type DriverSummary = {
  courierId: string;
  courierName: string;
  marketId?: string;
  completedOrders: number;
  deliveryFeesTotal: number;
  platformCommissionTotal: number;
  driverCollectionTotal: number;
  outstandingCollection: number;
  todayCollection: number;
};

export default function DriversFinanceHubPage() {
  const [preset, setPreset] = useState('today');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['driver-collections-finance-hub', preset],
    queryFn: async () => {
      const q = preset === 'today' || preset === 'yesterday' ? `?preset=${preset}` : '';
      const res = await fetch(`${MOCK_API_URL}/admin/driver-collections${q}`, {
        headers: apiHeaders(),
      });
      if (!res.ok) throw new Error('failed');
      return res.json() as Promise<{ drivers: DriverSummary[]; dashboard: Dashboard }>;
    },
    enabled: !!MOCK_API_URL,
  });

  const totals = useMemo(() => {
    const rows = data?.drivers ?? [];
    return rows.reduce(
      (acc, r) => ({
        collection: acc.collection + r.driverCollectionTotal,
        delivery: acc.delivery + r.deliveryFeesTotal,
        commission: acc.commission + r.platformCommissionTotal,
        outstanding: acc.outstanding + r.outstandingCollection,
        orders: acc.orders + r.completedOrders,
      }),
      { collection: 0, delivery: 0, commission: 0, outstanding: 0, orders: 0 }
    );
  }, [data?.drivers]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        محاسبة تحصيل Now Market (رسوم التوصيل + عمولة المنصة) — بدون إجمالي الطلب / إيراد المطعم.
        للتفاصيل والتسوية:{' '}
        <Link to="/drivers/collections" className="text-teal-700 hover:underline">
          تحصيل السائقين
        </Link>
      </p>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'today', label: 'اليوم' },
          { id: 'yesterday', label: 'أمس' },
          { id: 'all', label: 'الكل' },
        ].map((r) => (
          <Button
            key={r.id}
            size="sm"
            variant={preset === r.id ? 'primary' : 'outline'}
            onClick={() => setPreset(r.id)}
          >
            {r.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4">
          <p className="text-xs text-gray-500">تحصيل السائقين اليوم</p>
          <p className="text-xl font-bold">
            {formatPrice(data?.dashboard.driverCollectionsToday ?? 0)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">معلّق</p>
          <p className="text-xl font-bold text-amber-800">
            {formatPrice(data?.dashboard.pendingCollections ?? totals.outstanding)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">تم التسوية اليوم</p>
          <p className="text-xl font-bold text-emerald-800">
            {formatPrice(data?.dashboard.settledToday ?? 0)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">رسوم التوصيل اليوم</p>
          <p className="text-xl font-bold">
            {formatPrice(data?.dashboard.deliveryFeesToday ?? 0)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">عمولات المنصة اليوم</p>
          <p className="text-xl font-bold">
            {formatPrice(data?.dashboard.platformCommissionsToday ?? 0)}
          </p>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          حسب السائق — تحصيل المنصة
        </h2>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : isError ? (
          <p className="text-red-600 text-center py-6">فشل تحميل البيانات</p>
        ) : (data?.drivers.length ?? 0) === 0 ? (
          <p className="text-gray-500 text-center py-6">لا توجد بيانات</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2">السائق</th>
                  <th className="px-3 py-2">طلبات</th>
                  <th className="px-3 py-2">رسوم التوصيل</th>
                  <th className="px-3 py-2">عمولة المنصة</th>
                  <th className="px-3 py-2">تحصيل السائق</th>
                  <th className="px-3 py-2">معلّق</th>
                  <th className="px-3 py-2">تفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {(data?.drivers ?? []).map((row) => (
                  <tr key={row.courierId} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-medium">{row.courierName}</td>
                    <td className="px-3 py-2 tabular-nums">{row.completedOrders}</td>
                    <td className="px-3 py-2">{formatPrice(row.deliveryFeesTotal)}</td>
                    <td className="px-3 py-2">{formatPrice(row.platformCommissionTotal)}</td>
                    <td className="px-3 py-2 font-semibold text-teal-800">
                      {formatPrice(row.driverCollectionTotal)}
                    </td>
                    <td className="px-3 py-2 text-amber-800">
                      {formatPrice(row.outstandingCollection)}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        to={`/drivers/collections/${row.courierId}`}
                        className="inline-flex items-center gap-1 text-teal-700 hover:underline text-xs"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        محاسبة
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
