import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, OrderListFilters } from '@nmd/ui';
import { filterOrdersForList, type OrderStatusFilterKey } from '@nmd/core';
import { listAdminExternalOrders, type ExternalOrderAdminRow } from '../api';

export default function ExternalOrdersAdminPage() {
  // External manual orders are created COMPLETED — default to الكل so the report is visible.
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilterKey>('all');
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ['admin-external-orders'],
    queryFn: () => listAdminExternalOrders(),
  });
  const filteredRows = useMemo(
    () =>
      filterOrdersForList(
        (data as ExternalOrderAdminRow[]).map((row) => ({ ...row, isExternal: true })),
        'external',
        statusFilter
      ),
    [data, statusFilter]
  );

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-4">التقرير العالمي للطلبات الخارجية</h2>
      <Card className="p-4">
        <OrderListFilters
          sourceFilter="external"
          statusFilter={statusFilter}
          onSourceChange={() => undefined}
          onStatusChange={setStatusFilter}
          showSourceFilter={false}
          className="mb-4"
        />
        {isLoading ? (
          <p className="text-gray-500 py-8 text-center">جاري التحميل...</p>
        ) : isError ? (
          <p className="text-red-600 py-8 text-center">فشل تحميل التقرير</p>
        ) : filteredRows.length === 0 ? (
          <p className="text-gray-500 py-8 text-center">لا توجد طلبات خارجية تطابق التصفية</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-start">الوقت</th>
                  <th className="px-3 py-2 text-start">السوق</th>
                  <th className="px-3 py-2 text-start">السائق</th>
                  <th className="px-3 py-2 text-start">المحل</th>
                  <th className="px-3 py-2 text-start">الوجهة</th>
                  <th className="px-3 py-2 text-start">رسوم التوصيل</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">{row.createdAt ? new Date(row.createdAt).toLocaleString('ar-EG') : '—'}</td>
                    <td className="px-3 py-2">{row.marketName ?? row.marketId ?? '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col">
                        <span>{row.courierName ?? row.courierId ?? '—'}</span>
                        {row.courierPhone && <span className="text-xs text-gray-500">{row.courierPhone}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2">{row.storeDisplayName ?? row.tenantName ?? row.manualStoreName ?? 'Other'}</td>
                    <td className="px-3 py-2">{row.externalDestination ?? '—'}</td>
                    <td className="px-3 py-2 font-semibold">{Number(row.deliveryFee ?? 0).toFixed(2)} ₪</td>
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
