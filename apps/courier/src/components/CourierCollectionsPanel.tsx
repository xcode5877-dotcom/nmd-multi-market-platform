import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Banknote, RefreshCw } from 'lucide-react';
import { apiFetch } from '../api';
import {
  COLLECTIONS_PERIODS,
  type CollectionsPeriod,
  type DailySummary,
  formatMoney,
  isVerifiedEmptyPeriod,
  readCollectionsAmounts,
} from '../lib/collectionsSummary';

function AmountRows({ daily }: { daily: DailySummary }) {
  const a = readCollectionsAmounts(daily);
  return (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between gap-2">
        <span className="text-slate-400">دخل توصيل الطلبات الخارجية</span>
        <span className="font-bold tabular-nums text-inherit">{formatMoney(a.external)}</span>
      </div>
      {a.splitOk ? (
        <>
          <div className="flex justify-between gap-2">
            <span className="text-slate-400">دخل التوصيل من طلبات التطبيق</span>
            <span className="font-bold tabular-nums">{formatMoney(a.appDelivery)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-slate-400">دخل نسبة التطبيق</span>
            <span className="font-bold tabular-nums">{formatMoney(a.appCommission)}</span>
          </div>
        </>
      ) : (
        <div className="flex justify-between gap-2">
          <span className="text-slate-400">دخل التوصيل والنسبة من طلبات التطبيق</span>
          <span className="font-bold tabular-nums">{formatMoney(a.appCombined)}</span>
        </div>
      )}
      <div className="flex justify-between gap-2 pt-2 border-t border-slate-600/60">
        <span className="text-emerald-300 font-medium">الإجمالي لصالح الشركة</span>
        <span className="font-black text-emerald-300 tabular-nums">{formatMoney(a.gross)}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span className="text-slate-400">تم تسليمه للشركة</span>
        <span className="font-bold tabular-nums">{formatMoney(a.reconciled)}</span>
      </div>
      <div className="flex justify-between gap-2 pt-2 border-t border-slate-600/60">
        <span className="text-amber-300 font-medium">المبلغ المطلوب تسليمه للشركة</span>
        <span className="text-xl font-black text-amber-200 tabular-nums">{formatMoney(a.outstanding)}</span>
      </div>
      <div className="flex justify-between gap-2 text-xs">
        <span className="text-slate-500">المتبقي للتسليم</span>
        <span className="tabular-nums text-slate-300">{formatMoney(a.outstanding)}</span>
      </div>
    </div>
  );
}

/**
 * Company collections through this courier — period-aware, no silent zero on errors.
 */
export function CourierCollectionsPanel({
  enabled,
  courierId,
  period,
  onPeriodChange,
  variant = 'dark',
  showPeriodTabs = true,
  title = 'التحصيل المالي',
}: {
  enabled: boolean;
  courierId?: string | null;
  period: CollectionsPeriod;
  onPeriodChange: (p: CollectionsPeriod) => void;
  variant?: 'dark' | 'light';
  showPeriodTabs?: boolean;
  title?: string;
}) {
  const profileMissing = enabled && !courierId;

  const summaryQ = useQuery({
    queryKey: ['courier-daily-summary', courierId ?? 'none', period],
    queryFn: () =>
      apiFetch<DailySummary>(`/courier/daily-summary?period=${encodeURIComponent(period)}`),
    enabled: enabled && !!courierId,
    refetchInterval: 15_000,
    retry: 1,
  });

  /** Hint query: if current period is empty, check whether all-time has verified activity. */
  const allHintQ = useQuery({
    queryKey: ['courier-daily-summary', courierId ?? 'none', 'all', 'hint'],
    queryFn: () => apiFetch<DailySummary>('/courier/daily-summary?period=all'),
    enabled: enabled && !!courierId && period !== 'all' && summaryQ.isSuccess,
    staleTime: 60_000,
    retry: 0,
  });

  const dark = variant === 'dark';
  const shell = dark
    ? 'p-4 bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-lg text-white'
    : 'p-4 bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-900';
  const muted = dark ? 'text-slate-400' : 'text-slate-500';
  const warnBox = dark
    ? 'text-xs text-amber-300 bg-amber-950/40 border border-amber-700/50 rounded-lg px-2 py-1.5'
    : 'text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5';

  if (profileMissing) {
    return (
      <div className={shell} aria-label={title}>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Banknote className="w-4 h-4 text-emerald-400" />
          {title}
        </h3>
        <p className="text-sm text-amber-300">تعذر ربط حساب السائق بملفه</p>
      </div>
    );
  }

  const daily = summaryQ.data;
  const amounts = daily ? readCollectionsAmounts(daily) : null;
  const emptyPeriod = daily ? isVerifiedEmptyPeriod(daily) : false;
  const allAmounts = allHintQ.data ? readCollectionsAmounts(allHintQ.data) : null;
  const hasPrior =
    period !== 'all' &&
    emptyPeriod &&
    allHintQ.isSuccess &&
    allAmounts != null &&
    (allAmounts.gross > 0 || allAmounts.outstanding > 0 || (allAmounts.missingFeeCount > 0));

  return (
    <div className={shell} aria-label={title}>
      <h3 className={`text-sm font-semibold mb-2 flex items-center gap-2 ${dark ? 'text-slate-300' : ''}`}>
        <Banknote className="w-4 h-4 text-emerald-400" />
        {title}
      </h3>
      <p className={`text-[11px] mb-3 ${muted}`}>
        {daily?.ownershipNoteAr ??
          'هذه المبالغ محصلة لصالح الشركة ولا تمثل راتب السائق'}
      </p>

      {showPeriodTabs && (
        <div className="flex flex-wrap gap-2 mb-3">
          {COLLECTIONS_PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPeriodChange(p.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                period === p.id
                  ? 'bg-teal-600 text-white'
                  : dark
                    ? 'bg-slate-700 text-slate-200'
                    : 'bg-slate-100 text-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {summaryQ.isLoading && (
        <p className={`text-sm text-center py-4 ${muted}`}>جاري تحميل التحصيل...</p>
      )}

      {summaryQ.isError && (
        <div className="text-center py-4 space-y-2">
          <p className="text-sm text-red-400">تعذر تحميل البيانات</p>
          <button
            type="button"
            onClick={() => summaryQ.refetch()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            إعادة المحاولة
          </button>
        </div>
      )}

      {summaryQ.isSuccess && daily && amounts && (
        <>
          {(amounts.incomplete || amounts.missingFeeCount > 0) && (
            <p className={`${warnBox} mb-3`}>
              {daily.missingExternalFeeWarningAr ??
                'توجد طلبات بحاجة لمراجعة أجرة التوصيل'}
              {amounts.missingFeeCount > 0
                ? ` (${amounts.missingFeeCount})`
                : ''}
            </p>
          )}

          {hasPrior && (
            <div className={`${warnBox} mb-3 space-y-2`}>
              <p>
                {period === 'today'
                  ? 'لا توجد حركة اليوم'
                  : 'لا توجد مبالغ موثقة ضمن هذه الفترة'}
              </p>
              <p>يوجد سجل سابق — اعرض الكل</p>
              <button
                type="button"
                onClick={() => onPeriodChange('all')}
                className="inline-flex px-3 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-bold"
              >
                الكل
              </button>
              <Link
                to="/earnings?period=all"
                className="block text-xs text-teal-300 underline mt-1"
              >
                فتح صفحة الدوام والتحصيل ←
              </Link>
            </div>
          )}

          {emptyPeriod && !hasPrior && period === 'all' && (
            <p className={`text-sm mb-3 ${muted}`}>
              ₪0 — لا توجد مبالغ موثقة ضمن هذه الفترة
            </p>
          )}

          {emptyPeriod && !hasPrior && period !== 'all' && (
            <p className={`text-sm mb-3 ${muted}`}>
              ₪0 — لا توجد مبالغ موثقة ضمن هذه الفترة
            </p>
          )}

          <AmountRows daily={daily} />

          {daily.workedMinutesInPeriod != null && (
            <div className={`flex justify-between gap-2 text-xs pt-2 mt-2 border-t border-slate-600/40 ${muted}`}>
              <span>ساعات العمل (الفترة)</span>
              <span className="tabular-nums">
                {(daily.workedMinutesInPeriod / 60).toFixed(2)} س · {daily.workedMinutesInPeriod} د
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
