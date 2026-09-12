import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useNativeBridge } from '../contexts/NativeBridgeContext';
import { apiFetch } from '../api';
import { CourierAttendancePanel } from '../components/CourierAttendancePanel';
import { ArrowRight, Banknote } from 'lucide-react';
import { useState } from 'react';

type DailySummary = {
  externalDeliveryIncome?: number;
  externalDeliveryIncomeVerified?: number;
  externalOrdersMissingFeeCount?: number;
  hasIncompleteFinancialData?: boolean;
  missingExternalFeeWarningAr?: string;
  appDeliveryIncome?: number;
  appCommissionIncome?: number;
  appIncomeSplitAvailable?: boolean;
  appDeliveryAndCommissionIncome?: number;
  companyGrossThroughCourier?: number;
  reconciledToCompany?: number;
  outstandingToCompany?: number;
  ownershipNoteAr?: string;
  workedMinutesInPeriod?: number;
  from?: string;
  to?: string;
};

const PERIODS = [
  { id: 'today', label: 'اليوم' },
  { id: 'week', label: 'الأسبوع' },
  { id: 'month', label: 'الشهر' },
  { id: 'all', label: 'الكل' },
] as const;

function money(n: number | undefined): string {
  return `₪${(Number(n) || 0).toFixed(2)}`;
}

/**
 * Route /earnings kept for backward compatibility.
 * Shows الدوام + تحصيل (company money through courier) — not personal wages.
 */
export default function CourierEarningsPage() {
  const { user } = useAuth();
  const { isNativeApp } = useNativeBridge();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['id']>('today');

  const { data: daily, isLoading, isError } = useQuery({
    queryKey: ['courier-daily-summary', period],
    queryFn: () => apiFetch<DailySummary>(`/courier/daily-summary?period=${period}`),
    enabled: !!user,
  });

  if (!user) return null;

  const splitOk = daily?.appIncomeSplitAvailable !== false;

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      {!isNativeApp && (
        <header className="bg-teal-600 text-white px-4 py-4 shadow">
          <Link to="/" className="text-sm text-teal-100 mb-1 inline-flex items-center gap-1">
            <ArrowRight className="w-4 h-4 rotate-180" />
            الرئيسية
          </Link>
          <h1 className="text-xl font-bold">الدوام والتحصيل</h1>
          <p className="text-xs text-teal-100 mt-1">ساعات العمل + مبالغ الشركة عبرك</p>
        </header>
      )}

      <div className="p-4 max-w-md mx-auto space-y-4">
        <section aria-label="الدوام">
          <CourierAttendancePanel enabled={!!user.courierId} defaultPeriod={period === 'all' ? 'all' : period} />
        </section>

        <section
          aria-label="التحصيل المالي"
          className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3"
        >
          <h2 className="font-bold text-slate-900 flex items-center gap-2">
            <Banknote className="w-4 h-4 text-emerald-600" />
            التحصيل المالي
          </h2>
          <p className="text-xs text-slate-600">
            {daily?.ownershipNoteAr ??
              'هذه المبالغ محصلة لصالح الشركة ولا تمثل راتب السائق'}
          </p>
          {(daily?.hasIncompleteFinancialData ||
            (daily?.externalOrdersMissingFeeCount ?? 0) > 0) && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
              {daily?.missingExternalFeeWarningAr ??
                'يوجد طلب خارجي بحاجة لمراجعة أجرة التوصيل'}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  period === p.id ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {isLoading && <p className="text-sm text-slate-500 text-center py-4">جاري التحميل...</p>}
          {isError && (
            <p className="text-sm text-red-600 text-center py-4">تعذّر تحميل التحصيل. أعد المحاولة.</p>
          )}

          {daily && !isLoading && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">دخل توصيل الطلبات الخارجية</span>
                <span className="font-bold tabular-nums">
                  {money(daily.externalDeliveryIncomeVerified ?? daily.externalDeliveryIncome)}
                </span>
              </div>
              {splitOk ? (
                <>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">دخل التوصيل من طلبات التطبيق</span>
                    <span className="font-bold tabular-nums">{money(daily.appDeliveryIncome)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">دخل نسبة التطبيق</span>
                    <span className="font-bold tabular-nums">{money(daily.appCommissionIncome)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">دخل التوصيل والنسبة من طلبات التطبيق</span>
                  <span className="font-bold tabular-nums">
                    {money(daily.appDeliveryAndCommissionIncome)}
                  </span>
                </div>
              )}
              <div className="flex justify-between gap-2 pt-2 border-t">
                <span className="text-emerald-700 font-medium">الإجمالي لصالح الشركة</span>
                <span className="font-black text-emerald-700 tabular-nums">
                  {money(daily.companyGrossThroughCourier)}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-500">تم تسليمه للشركة</span>
                <span className="font-bold tabular-nums">{money(daily.reconciledToCompany)}</span>
              </div>
              <div className="flex justify-between gap-2 pt-2 border-t">
                <span className="text-amber-800 font-medium">المبلغ المطلوب تسليمه للشركة</span>
                <span className="text-lg font-black text-amber-800 tabular-nums">
                  {money(daily.outstandingToCompany)}
                </span>
              </div>
              <div className="flex justify-between gap-2 text-xs text-slate-500">
                <span>المتبقي للتسليم</span>
                <span className="tabular-nums">{money(daily.outstandingToCompany)}</span>
              </div>
              <div className="flex justify-between gap-2 text-xs text-slate-500 pt-1 border-t">
                <span>ساعات العمل (الفترة)</span>
                <span className="tabular-nums">
                  {((daily.workedMinutesInPeriod ?? 0) / 60).toFixed(2)} س
                  {' · '}
                  {daily.workedMinutesInPeriod ?? 0} د
                </span>
              </div>
            </div>
          )}
        </section>

        <Link to="/expenses" className="block text-center text-sm text-teal-700 font-medium py-2">
          تسجيل مصروف تشغيلي ←
        </Link>
      </div>
    </div>
  );
}
