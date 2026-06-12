import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, Button, Skeleton } from '@nmd/ui';
import { formatPrice } from '@nmd/core';
import { ArrowRight, User, Download } from 'lucide-react';
import { adminPayrollFetch, openPayslipPdf } from '../../lib/adminPayrollFetch';

type StatementResponse = {
  courier: { id: string; name: string; phone?: string; marketId?: string };
  config: { hourlyRate: number; orderCommissionPercent: number; deliveryFeeShare: number };
  outstandingBalance: number;
  totalSettled: number;
  shifts: { id: string; date: string; startTime: string; endTime: string | null; hours: number | null; autoClosed: boolean }[];
  earnings: { id: string; date: string; type: string; amount: number; referenceId?: string | null; description?: string | null }[];
  expenses: { id: string; date: string; category: string; amount: number; status: string; note?: string | null }[];
  bonuses: { id: string; date: string; amount: number; description?: string | null }[];
  settlements: { id: string; date: string; periodStart: string; periodEnd: string; grossAmount: number; expensesAmount: number; netAmount: number; notes?: string | null }[];
};

const TABS = [
  { id: 'shifts', label: 'الشفتات' },
  { id: 'earnings', label: 'الأرباح' },
  { id: 'expenses', label: 'المصاريف' },
  { id: 'bonuses', label: 'المكافآت' },
  { id: 'settlements', label: 'التسويات' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const TYPE_LABELS: Record<string, string> = {
  DELIVERY_FEE: 'رسوم توصيل',
  ORDER_COMMISSION: 'عمولة طلب',
  BONUS: 'مكافأة',
  ADJUSTMENT: 'تعديل',
};

export default function DriverStatementPage() {
  const { driverId } = useParams<{ driverId: string }>();
  const [tab, setTab] = useState<TabId>('shifts');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['driver-payroll-statement', driverId],
    queryFn: () => adminPayrollFetch<StatementResponse>(`/admin/drivers/${driverId}/payroll-statement`),
    enabled: !!driverId,
  });

  if (!driverId) return null;

  return (
    <div className="space-y-6">
      <Link to="/drivers/payroll-finance" className="inline-flex items-center gap-1 text-sm text-teal-700 hover:underline">
        <ArrowRight className="w-4 h-4" />
        مالية السائقين
      </Link>

      {isLoading && <Skeleton className="h-32 w-full" />}
      {isError && <p className="text-red-600">تعذّر تحميل تفاصيل السائق</p>}

      {data && (
        <>
          <Card className="p-5">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-teal-100 text-teal-700">
                <User className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900">تفاصيل السائق — {data.courier.name}</h2>
                {data.courier.phone && <p className="text-sm text-gray-500 mt-1" dir="ltr">{data.courier.phone}</p>}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
                  <div>
                    <p className="text-gray-500">المستحق غير المدفوع</p>
                    <p className="text-lg font-bold text-amber-800">{formatPrice(data.outstandingBalance)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">أجر الساعة</p>
                    <p className="font-semibold">₪{data.config.hourlyRate}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">نسبة العمولة</p>
                    <p className="font-semibold">{data.config.orderCommissionPercent}%</p>
                  </div>
                  <div>
                    <p className="text-gray-500">إجمالي المُسوّى</p>
                    <p className="font-semibold">{formatPrice(data.totalSettled)}</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === t.id ? 'bg-teal-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <Card className="overflow-x-auto p-0">
            {tab === 'shifts' && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-500">
                    <th className="p-3 text-right">التاريخ</th>
                    <th className="p-3 text-right">البداية</th>
                    <th className="p-3 text-right">النهاية</th>
                    <th className="p-3 text-right">الساعات</th>
                    <th className="p-3 text-right">إغلاق تلقائي؟</th>
                  </tr>
                </thead>
                <tbody>
                  {data.shifts.map((s) => (
                    <tr key={s.id} className="border-b">
                      <td className="p-3">{s.date}</td>
                      <td className="p-3" dir="ltr">{new Date(s.startTime).toLocaleTimeString('ar-IL', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="p-3" dir="ltr">{s.endTime ? new Date(s.endTime).toLocaleTimeString('ar-IL', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td className="p-3">{s.hours != null ? s.hours.toFixed(1) : '—'}</td>
                      <td className="p-3">{s.autoClosed ? 'نعم' : 'لا'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'earnings' && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-500">
                    <th className="p-3 text-right">التاريخ</th>
                    <th className="p-3 text-right">النوع</th>
                    <th className="p-3 text-right">المبلغ</th>
                    <th className="p-3 text-right">المرجع</th>
                  </tr>
                </thead>
                <tbody>
                  {data.earnings.map((e) => (
                    <tr key={e.id} className="border-b">
                      <td className="p-3">{e.date.slice(0, 10)}</td>
                      <td className="p-3">{TYPE_LABELS[e.type] ?? e.type}</td>
                      <td className="p-3 font-medium text-emerald-700">{formatPrice(e.amount)}</td>
                      <td className="p-3 text-xs text-gray-500 font-mono">{e.referenceId?.slice(0, 12) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'expenses' && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-500">
                    <th className="p-3 text-right">التاريخ</th>
                    <th className="p-3 text-right">الفئة</th>
                    <th className="p-3 text-right">المبلغ</th>
                    <th className="p-3 text-right">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {data.expenses.map((e) => (
                    <tr key={e.id} className="border-b">
                      <td className="p-3">{e.date.slice(0, 10)}</td>
                      <td className="p-3">{e.category}</td>
                      <td className="p-3">{formatPrice(e.amount)}</td>
                      <td className="p-3">{e.status === 'APPROVED' ? 'معتمد' : e.status === 'PENDING' ? 'معلق' : 'مرفوض'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'bonuses' && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-500">
                    <th className="p-3 text-right">التاريخ</th>
                    <th className="p-3 text-right">المبلغ</th>
                    <th className="p-3 text-right">السبب</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bonuses.map((b) => (
                    <tr key={b.id} className="border-b">
                      <td className="p-3">{b.date.slice(0, 10)}</td>
                      <td className="p-3 font-medium text-violet-700">{formatPrice(b.amount)}</td>
                      <td className="p-3">{b.description ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === 'settlements' && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-500">
                    <th className="p-3 text-right">تاريخ التسوية</th>
                    <th className="p-3 text-right">الفترة</th>
                    <th className="p-3 text-right">إجمالي</th>
                    <th className="p-3 text-right">مصاريف</th>
                    <th className="p-3 text-right">صافي</th>
                    <th className="p-3" />
                  </tr>
                </thead>
                <tbody>
                  {data.settlements.map((s) => (
                    <tr key={s.id} className="border-b">
                      <td className="p-3">{s.date.slice(0, 10)}</td>
                      <td className="p-3">{s.periodStart} → {s.periodEnd}</td>
                      <td className="p-3">{formatPrice(s.grossAmount)}</td>
                      <td className="p-3">{formatPrice(s.expensesAmount)}</td>
                      <td className="p-3 font-bold">{formatPrice(s.netAmount)}</td>
                      <td className="p-3">
                        <Button size="sm" variant="outline" onClick={() => openPayslipPdf(s.id)}>
                          <Download className="w-3.5 h-3.5" />
                          PDF
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
