import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, Button, Skeleton, Input } from '@nmd/ui';
import { formatPrice } from '@nmd/core';
import { FileText, Download } from 'lucide-react';
import { adminPayrollFetch, openPayslipPdf } from '../../lib/adminPayrollFetch';

type SettlementRow = {
  id: string;
  courierId: string;
  courierName: string;
  marketId?: string | null;
  periodStart: string;
  periodEnd: string;
  grossAmount: number;
  expensesAmount: number;
  netAmount: number;
  createdAt: string;
  notes?: string | null;
};

type HistoryResponse = {
  settlements: SettlementRow[];
  totals: { totalPaid: number; outstandingBalance: number; count: number };
};

export default function PayrollSettlementHistoryPage() {
  const [courierId, setCourierId] = useState('');
  const [marketId, setMarketId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const queryKey = ['payroll-settlement-history', courierId, marketId, from, to];

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams();
      if (courierId) params.set('courierId', courierId);
      if (marketId) params.set('marketId', marketId);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      return adminPayrollFetch<HistoryResponse>(`/admin/payroll-settlements?${params}`);
    },
    enabled: !!import.meta.env.VITE_MOCK_API_URL,
  });

  const rows = data?.settlements ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-teal-600" />
          سجل الرواتب
        </h2>
        <p className="text-sm text-gray-500 mt-1">جميع تسويات رواتب السائقين</p>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm">
          معرّف السائق
          <Input value={courierId} onChange={(e) => setCourierId(e.target.value)} className="mt-1 w-48" placeholder="courier-..." />
        </label>
        <label className="text-sm">
          السوق
          <Input value={marketId} onChange={(e) => setMarketId(e.target.value)} className="mt-1 w-40" placeholder="market-..." />
        </label>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" />
        <span className="text-gray-400">—</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" />
      </div>

      {data?.totals && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card className="p-4">
            <p className="text-xs text-gray-500">إجمالي المدفوع (تسويات)</p>
            <p className="text-xl font-bold text-emerald-800">{formatPrice(data.totals.totalPaid)}</p>
          </Card>
          <Card className="p-4 border-amber-200 bg-amber-50/50">
            <p className="text-xs text-gray-600">المستحق غير المدفوع</p>
            <p className="text-xl font-bold text-amber-900">{formatPrice(data.totals.outstandingBalance)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-gray-500">عدد التسويات</p>
            <p className="text-xl font-bold tabular-nums">{data.totals.count}</p>
          </Card>
        </div>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-right text-gray-500">
              <th className="p-3">التاريخ</th>
              <th className="p-3">السائق</th>
              <th className="p-3">الفترة</th>
              <th className="p-3">إجمالي</th>
              <th className="p-3">مصاريف</th>
              <th className="p-3">صافي</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="p-4"><Skeleton className="h-8 w-full" /></td></tr>
            )}
            {isError && (
              <tr><td colSpan={7} className="p-6 text-center text-red-600">تعذّر التحميل</td></tr>
            )}
            {rows.map((s) => (
              <tr key={s.id} className="border-b hover:bg-gray-50">
                <td className="p-3">{s.createdAt.slice(0, 10)}</td>
                <td className="p-3">
                  <Link to={`/drivers/${s.courierId}`} className="text-teal-700 hover:underline font-medium">
                    {s.courierName}
                  </Link>
                </td>
                <td className="p-3 text-xs">{s.periodStart} → {s.periodEnd}</td>
                <td className="p-3">{formatPrice(s.grossAmount)}</td>
                <td className="p-3">{formatPrice(s.expensesAmount)}</td>
                <td className="p-3 font-bold">{formatPrice(s.netAmount)}</td>
                <td className="p-3">
                  <Button size="sm" variant="outline" onClick={() => openPayslipPdf(s.id)}>
                    <Download className="w-3.5 h-3.5 ml-1" />
                    PDF
                  </Button>
                </td>
              </tr>
            ))}
            {!isLoading && rows.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-gray-500">لا توجد تسويات</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
