import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, Button, Skeleton } from '@nmd/ui';
import { MockApiClient } from '@nmd/mock';
import { formatPrice } from '@nmd/core';
import { Wallet, ArrowLeft } from 'lucide-react';
import { fetchDriverOpsFinanceRollup } from '../../drivers/fetchDriverOpsOverview';

const api = new MockApiClient();
const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

const RANGE_OPTIONS = [
  { id: 'today', label: 'اليوم', getRange: () => { const d = new Date(); const s = d.toISOString().slice(0, 10); return { from: s, to: s }; } },
  { id: '7d', label: '7 أيام', getRange: () => { const to = new Date(); const from = new Date(to); from.setDate(from.getDate() - 6); return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }; } },
  { id: 'month', label: 'الشهر', getRange: () => { const d = new Date(); const to = d.toISOString().slice(0, 10); const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); return { from, to }; } },
];

export default function DriversFinanceHubPage() {
  const [rangeId, setRangeId] = useState('7d');
  const { from, to } = useMemo(() => {
    const opt = RANGE_OPTIONS.find((r) => r.id === rangeId);
    return opt?.getRange() ?? { from: undefined, to: undefined };
  }, [rangeId]);

  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ['driver-ops-finance', from, to],
    queryFn: () => fetchDriverOpsFinanceRollup(api, from, to),
    enabled: !!MOCK_API_URL,
  });

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          gross: acc.gross + r.gross,
          cashCollected: acc.cashCollected + r.cashCollected,
          outstandingCash: acc.outstandingCash + r.outstandingCash,
          deliveredOrders: acc.deliveredOrders + r.deliveredOrders,
        }),
        { gross: 0, cashCollected: 0, outstandingCash: 0, deliveredOrders: 0 }
      ),
    [rows]
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        تجميع من واجهات المالية الحالية لكل سوق. للتفاصيل والتسوية استخدم صفحة مالية السوق.
      </p>

      <div className="flex flex-wrap gap-2">
        {RANGE_OPTIONS.map((r) => (
          <Button key={r.id} size="sm" variant={rangeId === r.id ? 'primary' : 'outline'} onClick={() => setRangeId(r.id)}>
            {r.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-gray-500">إجمالي الإيرادات</p>
          <p className="text-xl font-bold">{formatPrice(totals.gross)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">كاش محصّل</p>
          <p className="text-xl font-bold text-emerald-800">{formatPrice(totals.cashCollected)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">مستحق تسليم</p>
          <p className="text-xl font-bold text-amber-800">{formatPrice(totals.outstandingCash)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500">طلبات مُسلّمة</p>
          <p className="text-xl font-bold tabular-nums">{totals.deliveredOrders}</p>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Wallet className="w-5 h-5" />
          حسب السوق
        </h2>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : isError ? (
          <p className="text-red-600 text-center py-6">فشل تحميل البيانات</p>
        ) : rows.length === 0 ? (
          <p className="text-gray-500 text-center py-6">لا توجد بيانات</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2">السوق</th>
                  <th className="px-3 py-2">إجمالي</th>
                  <th className="px-3 py-2">كاش محصّل</th>
                  <th className="px-3 py-2">مستحق</th>
                  <th className="px-3 py-2">مُسلّم</th>
                  <th className="px-3 py-2">سائقون</th>
                  <th className="px-3 py-2">تفاصيل</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.marketId} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-medium">{row.marketName}</td>
                    <td className="px-3 py-2">{formatPrice(row.gross)}</td>
                    <td className="px-3 py-2">{formatPrice(row.cashCollected)}</td>
                    <td className="px-3 py-2">{formatPrice(row.outstandingCash)}</td>
                    <td className="px-3 py-2 tabular-nums">{row.deliveredOrders}</td>
                    <td className="px-3 py-2 tabular-nums">{row.courierRows}</td>
                    <td className="px-3 py-2">
                      <Link
                        to={`/markets/${row.marketId}/finance`}
                        className="inline-flex items-center gap-1 text-teal-700 hover:underline text-xs"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        لوحة المالية
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
