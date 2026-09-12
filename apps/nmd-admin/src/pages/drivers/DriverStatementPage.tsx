import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, Button, Skeleton } from '@nmd/ui';
import { formatPrice } from '@nmd/core';
import { ArrowRight, User, Download } from 'lucide-react';
import { adminPayrollFetch, openPayslipPdf } from '../../lib/adminPayrollFetch';

type StatementResponse = {
  courier: {
    id: string;
    name: string;
    phone?: string;
    marketId?: string;
    canStartShift?: boolean;
    isActive?: boolean;
    isOnline?: boolean;
    isAvailable?: boolean;
  };
  config: { hourlyRate: number; orderCommissionPercent: number; deliveryFeeShare: number };
  outstandingBalance: number;
  totalSettled: number;
  hoursTotalMinutes?: number;
  hoursTotalLabel?: string;
  companyCollections?: {
    externalDeliveryIncome: number;
    appDeliveryIncome: number;
    appCommissionIncome: number;
    companyGrossThroughCourier: number;
    reconciledToCompany: number;
    outstandingToCompany: number;
    ownershipNoteAr?: string;
  };
  collectionsPeriod?: { from: string; to: string; timezone: string; period: string };
  shifts: {
    id: string;
    date: string;
    startTime: string;
    endTime: string | null;
    hours: number | null;
    workedMinutes?: number | null;
    status?: string;
    durationLabel?: string;
    autoClosed: boolean;
    accountingStatus?: string;
    accountingLabel?: string;
  }[];
  earnings: { id: string; date: string; type: string; amount: number; referenceId?: string | null; description?: string | null }[];
  expenses: { id: string; date: string; category: string; amount: number; status: string; note?: string | null }[];
  bonuses: { id: string; date: string; amount: number; description?: string | null }[];
  settlements: { id: string; date: string; periodStart: string; periodEnd: string; grossAmount: number; expensesAmount: number; netAmount: number; notes?: string | null }[];
};

const TABS = [
  { id: 'shifts', label: 'سجل الدوام' },
  { id: 'earnings', label: 'دفتر قديم' },
  { id: 'expenses', label: 'مطالبات مصاريف' },
  { id: 'bonuses', label: 'مكافآت دفترية' },
  { id: 'settlements', label: 'تسويات دفترية قديمة' },
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
      <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950">
        <p className="font-semibold">الدوام + التحصيل المالي</p>
        <p className="mt-1">
          ساعات العمل منفصلة عن التحصيل. المبالغ أدناه لصالح الشركة عبر السائق — ليست راتبه.
        </p>
      </div>
      <Link to="/drivers/payroll-finance" className="inline-flex items-center gap-1 text-sm text-teal-700 hover:underline">
        <ArrowRight className="w-4 h-4" />
        سجل دوام السائقين
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
                <h2 className="text-xl font-bold text-gray-900">سجل دوام السائق — {data.courier.name}</h2>
                {data.courier.phone && <p className="text-sm text-gray-500 mt-1" dir="ltr">{data.courier.phone}</p>}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
                  <div>
                    <p className="text-gray-500">ساعات العمل</p>
                    <p className="font-semibold text-teal-800">{data.hoursTotalLabel ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">صلاحية بدء الدوام</p>
                    <p className="font-semibold">
                      {data.courier.canStartShift ? 'مسموح بدء الدوام' : 'بدء الدوام موقوف'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">السوق</p>
                    <p className="font-semibold">{data.courier.marketId ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">حالة السائق</p>
                    <p className="font-semibold">{data.courier.isActive ? 'نشط' : 'غير نشط'}</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {data.companyCollections && (
            <Card className="p-5 space-y-3 border-emerald-100 bg-emerald-50/40">
              <h3 className="font-bold text-gray-900">التحصيل المالي</h3>
              <p className="text-xs text-gray-600">
                {data.companyCollections.ownershipNoteAr ??
                  'هذه المبالغ محصلة لصالح الشركة ولا تمثل راتب السائق'}
              </p>
              {data.collectionsPeriod && (
                <p className="text-xs text-gray-500">
                  الفترة: {data.collectionsPeriod.from} → {data.collectionsPeriod.to}
                  {data.collectionsPeriod.timezone ? ` · ${data.collectionsPeriod.timezone}` : ''}
                </p>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">دخل توصيل الطلبات الخارجية</p>
                  <p className="font-bold">{formatPrice(data.companyCollections.externalDeliveryIncome)}</p>
                </div>
                <div>
                  <p className="text-gray-500">دخل التوصيل من طلبات التطبيق</p>
                  <p className="font-bold">{formatPrice(data.companyCollections.appDeliveryIncome)}</p>
                </div>
                <div>
                  <p className="text-gray-500">دخل نسبة التطبيق</p>
                  <p className="font-bold">{formatPrice(data.companyCollections.appCommissionIncome)}</p>
                </div>
                <div>
                  <p className="text-emerald-800">الإجمالي لصالح الشركة</p>
                  <p className="font-black text-emerald-800">
                    {formatPrice(data.companyCollections.companyGrossThroughCourier)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">تم تسليمه للشركة</p>
                  <p className="font-bold">{formatPrice(data.companyCollections.reconciledToCompany)}</p>
                </div>
                <div>
                  <p className="text-amber-800">المبلغ المطلوب تسليمه للشركة</p>
                  <p className="font-black text-amber-900">
                    {formatPrice(data.companyCollections.outstandingToCompany)}
                  </p>
                </div>
              </div>
            </Card>
          )}

          <div className="rounded-lg border border-slate-200 bg-white px-4 py-2">
            <h3 className="font-semibold text-gray-900 text-sm">الدوام</h3>
            <p className="text-xs text-gray-500">ساعات العمل لحساب تعويض السائق لاحقاً — بدون خصم تلقائي من التحصيل</p>
          </div>

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
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="border-b bg-gray-50 text-gray-500">
                    <th className="p-3 text-right">التاريخ</th>
                    <th className="p-3 text-right">البداية</th>
                    <th className="p-3 text-right">النهاية</th>
                    <th className="p-3 text-right">ساعات العمل</th>
                    <th className="p-3 text-right">إغلاق تلقائي؟</th>
                  </tr>
                </thead>
                <tbody>
                  {data.shifts.length === 0 && (
                    <tr>
                      <td className="p-4 text-center text-gray-500" colSpan={5}>
                        لا توجد سجلات دوام
                      </td>
                    </tr>
                  )}
                  {data.shifts.map((s) => {
                    const isActive = s.status === 'ACTIVE' || (!s.endTime && s.status !== 'INVALID_RANGE');
                    const durationText =
                      s.durationLabel ??
                      (s.hours != null ? `${s.hours.toFixed(1)} س` : isActive ? 'قيد الدوام الآن' : '—');
                    return (
                      <tr key={s.id} className="border-b">
                        <td className="p-3 whitespace-nowrap">{s.date}</td>
                        <td className="p-3 whitespace-nowrap" dir="ltr">
                          {new Date(s.startTime).toLocaleTimeString('ar-IL', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-3 whitespace-nowrap" dir="ltr">
                          {s.endTime
                            ? new Date(s.endTime).toLocaleTimeString('ar-IL', { hour: '2-digit', minute: '2-digit' })
                            : 'قيد الدوام الآن'}
                        </td>
                        <td className={`p-3 whitespace-nowrap ${isActive ? 'text-emerald-700 font-medium' : ''}`}>
                          {durationText}
                        </td>
                        <td className="p-3">{s.autoClosed ? 'نعم' : 'لا'}</td>
                      </tr>
                    );
                  })}
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
