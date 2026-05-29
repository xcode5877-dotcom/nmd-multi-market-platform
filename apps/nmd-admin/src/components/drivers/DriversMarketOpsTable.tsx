import { Link } from 'react-router-dom';
import { Radio, Truck, BarChart3, Wallet } from 'lucide-react';
import type { DriverOpsMarketRow } from '../../drivers/types';

export function DriversMarketOpsTable({ rows }: { rows: DriverOpsMarketRow[] }) {
  if (rows.length === 0) {
    return <p className="text-gray-500 py-8 text-center">لا توجد أسواق</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-right">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 font-medium text-gray-700">السوق</th>
            <th className="px-3 py-2 font-medium text-gray-700">السائقون</th>
            <th className="px-3 py-2 font-medium text-gray-700">متصل</th>
            <th className="px-3 py-2 font-medium text-gray-700">غير متصل</th>
            <th className="px-3 py-2 font-medium text-gray-700">متاح</th>
            <th className="px-3 py-2 font-medium text-gray-700">طلبات نشطة</th>
            <th className="px-3 py-2 font-medium text-gray-700">الطابور</th>
            <th className="px-3 py-2 font-medium text-gray-700">توصيلات اليوم</th>
            <th className="px-3 py-2 font-medium text-gray-700">إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.marketId} className="border-t border-gray-100 hover:bg-gray-50/80">
              <td className="px-3 py-3">
                <div className="font-medium text-gray-900">{row.marketName}</div>
                {!row.isActive ? (
                  <span className="text-xs text-amber-600">غير نشط</span>
                ) : null}
              </td>
              <td className="px-3 py-3 tabular-nums">{row.activeCouriers}/{row.totalCouriers}</td>
              <td className="px-3 py-3">
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <Radio className="w-3.5 h-3.5" />
                  {row.onlineCouriers}
                </span>
              </td>
              <td className="px-3 py-3 text-slate-600 tabular-nums">{row.offlineCouriers}</td>
              <td className="px-3 py-3 text-sky-700 tabular-nums">{row.availableCouriers}</td>
              <td className="px-3 py-3 font-semibold tabular-nums">{row.activeDeliveries}</td>
              <td className="px-3 py-3 tabular-nums">{row.queueCount}</td>
              <td className="px-3 py-3 tabular-nums">{row.deliveriesToday}</td>
              <td className="px-3 py-3">
                <div className="flex flex-wrap gap-1 justify-end">
                  <Link
                    to={`/markets/${row.marketId}/dispatch`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-teal-600 text-white hover:bg-teal-700"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    التوجيه
                  </Link>
                  <Link
                    to={`/markets/${row.marketId}/finance`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    مالية
                  </Link>
                  <Link
                    to={`/markets/${row.marketId}/reports`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    تقارير
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
