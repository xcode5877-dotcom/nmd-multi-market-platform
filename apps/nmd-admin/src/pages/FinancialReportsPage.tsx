import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, Button, Skeleton } from '@nmd/ui';
import { formatPrice } from '@nmd/core';
import {
  AlertTriangle,
  Download,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Minus,
} from 'lucide-react';
import { apiHeaders } from '../api';
import {
  adminReportErrorMessage,
  AdminReportFetchError,
  fetchAdminReportJson,
} from '../lib/adminReportFetch';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

const PRESETS = [
  { id: 'TODAY', label: 'اليوم' },
  { id: 'YESTERDAY', label: 'أمس' },
  { id: 'CURRENT_WEEK', label: 'هذا الأسبوع' },
  { id: 'PREVIOUS_WEEK', label: 'الأسبوع السابق' },
  { id: 'CURRENT_MONTH', label: 'هذا الشهر' },
  { id: 'PREVIOUS_MONTH', label: 'الشهر السابق' },
  { id: 'LAST_7_DAYS', label: 'آخر 7 أيام' },
  { id: 'LAST_30_DAYS', label: 'آخر 30 يوماً' },
  { id: 'CUSTOM_RANGE', label: 'مخصص' },
] as const;

type PresetId = (typeof PRESETS)[number]['id'];

const TABS = [
  { id: 'overview', label: 'نظرة عامة' },
  { id: 'shops', label: 'المتاجر' },
  { id: 'areas', label: 'المناطق' },
  { id: 'drivers', label: 'السائقون' },
  { id: 'payments', label: 'طرق الدفع' },
  { id: 'sources', label: 'مصادر الطلبات' },
  { id: 'refunds', label: 'الاستردادات' },
  { id: 'anomalies', label: 'التنبيهات' },
] as const;

type TabId = (typeof TABS)[number]['id'];

type MetricSnapshot = {
  orderCount: number;
  completedOrderCount: number;
  cancelledOrderCount: number;
  refundedOrderCount: number;
  grossOrderValue: number;
  platformRevenue: number;
  deliveryFeeRevenue: number;
  platformCommissionRevenue: number;
  restaurantPayable: number;
  driverCashInHand: number;
  driverPlatformLiability: number;
  driverRestaurantLiability: number;
  driverSettledAmount: number;
  driverOutstandingAmount: number;
  refundedGross: number;
};

type MetricComparison = {
  metric: keyof MetricSnapshot;
  absoluteChange: number;
  percentageChange: number | null;
  trend: 'up' | 'down' | 'flat';
};

type FinancialSummary = {
  period: { from: string; to: string; timezone: string; preset: string };
  current: MetricSnapshot;
  previous: MetricSnapshot;
  comparison: MetricComparison[];
  revenueBreakdown: {
    deliveryFees: number;
    platformCommissions: number;
    appDeliveryIncome: number;
    externalDeliveryIncome: number;
    grossPlatformRevenue: number;
    refundedGrossInformational: number;
    netPlatformRevenueNote: string;
  };
};

function money(n: number | undefined | null): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return formatPrice(v);
}

function financialReportErrorMessage(error: unknown): string {
  if (error instanceof AdminReportFetchError) {
    if (error.status === 401) return 'انتهت الجلسة';
    if (error.status === 403) return 'لا تملك صلاحية عرض التقارير المالية';
    if (error.status === 404) return 'خدمة التقرير غير متوفرة';
    if (error.status >= 500) return 'حدث خطأ أثناء إعداد التقرير';
    if (error.status === 0) return 'تعذر الاتصال بالخادم';
  }
  return adminReportErrorMessage(error);
}

function buildFilterQuery(
  preset: PresetId,
  customFrom: string,
  customTo: string,
  extras?: Record<string, string | undefined>
): string {
  const params = new URLSearchParams();
  if (preset === 'CUSTOM_RANGE') {
    params.set('preset', 'CUSTOM_RANGE');
    if (customFrom) params.set('from', customFrom);
    if (customTo) params.set('to', customTo);
  } else {
    params.set('preset', preset);
  }
  if (extras) {
    for (const [k, v] of Object.entries(extras)) {
      if (v) params.set(k, v);
    }
  }
  return params.toString();
}

function comparisonFor(
  comparison: MetricComparison[] | undefined,
  metric: keyof MetricSnapshot
): MetricComparison | undefined {
  return comparison?.find((c) => c.metric === metric);
}

function TrendBadge({ cmp }: { cmp?: MetricComparison }) {
  if (!cmp) return null;
  const Icon = cmp.trend === 'up' ? TrendingUp : cmp.trend === 'down' ? TrendingDown : Minus;
  const color =
    cmp.trend === 'up'
      ? 'text-emerald-700'
      : cmp.trend === 'down'
        ? 'text-rose-700'
        : 'text-gray-500';
  const pct =
    cmp.percentageChange == null
      ? '—'
      : `${cmp.percentageChange > 0 ? '+' : ''}${cmp.percentageChange}%`;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] mt-1 ${color}`}>
      <Icon className="h-3 w-3" />
      {pct} ({cmp.absoluteChange > 0 ? '+' : ''}
      {money(cmp.absoluteChange)})
    </span>
  );
}

function MetricCard({
  label,
  value,
  hint,
  cmp,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  cmp?: MetricComparison;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-xl font-bold mt-1 ${accent ?? 'text-gray-900'}`}>{value}</p>
      <TrendBadge cmp={cmp} />
      {hint && <p className="text-[11px] text-gray-400 mt-1 leading-snug">{hint}</p>}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
      لا توجد بيانات للفترة المحددة
    </div>
  );
}

export default function FinancialReportsPage() {
  const [preset, setPreset] = useState<PresetId>('LAST_7_DAYS');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [tab, setTab] = useState<TabId>('overview');
  const [orderSource, setOrderSource] = useState('ALL');
  const [paymentMethod, setPaymentMethod] = useState('ALL');

  const filterQs = useMemo(
    () =>
      buildFilterQuery(preset, customFrom, customTo, {
        orderSource: orderSource !== 'ALL' ? orderSource : undefined,
        paymentMethod: paymentMethod !== 'ALL' ? paymentMethod : undefined,
      }),
    [preset, customFrom, customTo, orderSource, paymentMethod]
  );

  const summaryQuery = useQuery({
    queryKey: ['financial-reports-summary', filterQs],
    queryFn: () =>
      fetchAdminReportJson<FinancialSummary>(`/admin/financial-reports/summary?${filterQs}`),
  });

  const timeseriesQuery = useQuery({
    queryKey: ['financial-reports-timeseries', filterQs],
    queryFn: () =>
      fetchAdminReportJson<{ rows: Array<Record<string, number | string>> }>(
        `/admin/financial-reports/timeseries?${filterQs}`
      ),
    enabled: tab === 'overview',
  });

  const shopsQuery = useQuery({
    queryKey: ['financial-reports-shops', filterQs],
    queryFn: () =>
      fetchAdminReportJson<{ rows: Array<Record<string, number | string>> }>(
        `/admin/financial-reports/shops?${filterQs}`
      ),
    enabled: tab === 'shops',
  });

  const areasQuery = useQuery({
    queryKey: ['financial-reports-areas', filterQs],
    queryFn: () =>
      fetchAdminReportJson<{ rows: Array<Record<string, number | string>> }>(
        `/admin/financial-reports/delivery-areas?${filterQs}`
      ),
    enabled: tab === 'areas',
  });

  const driversQuery = useQuery({
    queryKey: ['financial-reports-drivers', filterQs],
    queryFn: () =>
      fetchAdminReportJson<{ rows: Array<Record<string, number | string>> }>(
        `/admin/financial-reports/drivers?${filterQs}`
      ),
    enabled: tab === 'drivers',
  });

  const paymentsQuery = useQuery({
    queryKey: ['financial-reports-payments', filterQs],
    queryFn: () =>
      fetchAdminReportJson<{ rows: Array<Record<string, number | string>> }>(
        `/admin/financial-reports/payment-methods?${filterQs}`
      ),
    enabled: tab === 'payments',
  });

  const sourcesQuery = useQuery({
    queryKey: ['financial-reports-sources', filterQs],
    queryFn: () =>
      fetchAdminReportJson<{ rows: Array<Record<string, number | string>> }>(
        `/admin/financial-reports/order-sources?${filterQs}`
      ),
    enabled: tab === 'sources',
  });

  const refundsQuery = useQuery({
    queryKey: ['financial-reports-refunds', filterQs],
    queryFn: () =>
      fetchAdminReportJson<Record<string, number | string>>(
        `/admin/financial-reports/refunds?${filterQs}`
      ),
    enabled: tab === 'refunds',
  });

  const anomaliesQuery = useQuery({
    queryKey: ['financial-reports-anomalies', filterQs],
    queryFn: () =>
      fetchAdminReportJson<{ rows: Array<Record<string, string>> }>(
        `/admin/financial-reports/anomalies?${filterQs}`
      ),
    enabled: tab === 'anomalies',
  });

  const exportKind =
    tab === 'shops'
      ? 'shops'
      : tab === 'areas'
        ? 'delivery-areas'
        : tab === 'drivers'
          ? 'drivers'
          : tab === 'payments'
            ? 'payment-methods'
            : tab === 'sources'
              ? 'order-sources'
              : tab === 'refunds'
                ? 'refunds'
                : tab === 'anomalies'
                  ? 'anomalies'
                  : 'summary';

  async function downloadCsv() {
    const url = `${MOCK_API_URL}/admin/financial-reports/export?${filterQs}&kind=${exportKind}`;
    const res = await fetch(url, { headers: apiHeaders() });
    if (!res.ok) throw new AdminReportFetchError('export failed', res.status);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `financial-report-${exportKind}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const c = summaryQuery.data?.current;
  const cmp = summaryQuery.data?.comparison;
  const period = summaryQuery.data?.period;
  const activeError =
    summaryQuery.error ||
    (tab === 'overview' && timeseriesQuery.error) ||
    (tab === 'shops' && shopsQuery.error) ||
    (tab === 'areas' && areasQuery.error) ||
    (tab === 'drivers' && driversQuery.error) ||
    (tab === 'payments' && paymentsQuery.error) ||
    (tab === 'sources' && sourcesQuery.error) ||
    (tab === 'refunds' && refundsQuery.error) ||
    (tab === 'anomalies' && anomaliesQuery.error);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">التقارير المالية</h1>
          <p className="text-sm text-gray-500 mt-1">
            ذكاء مالي لسوبر أدمن — إيراد ناو ماركت منفصل عن حجم المبيعات. لا يغيّر التحصيل أو التسعير.
          </p>
          {period && (
            <p className="text-xs text-gray-400 mt-1">
              {period.from} → {period.to} · {period.timezone} · {period.preset}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void summaryQuery.refetch();
            }}
          >
            <RefreshCw className="h-4 w-4 ms-1" />
            تحديث
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void downloadCsv().catch(() => undefined);
            }}
          >
            <Download className="h-4 w-4 ms-1" />
            تصدير CSV
          </Button>
        </div>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              className={`rounded-lg px-3 py-1.5 text-sm border ${
                preset === p.id
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === 'CUSTOM_RANGE' && (
          <div className="flex flex-wrap gap-3 items-center">
            <label className="text-sm text-gray-600">
              من
              <input
                type="date"
                className="ms-2 rounded border border-gray-200 px-2 py-1"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </label>
            <label className="text-sm text-gray-600">
              إلى
              <input
                type="date"
                className="ms-2 rounded border border-gray-200 px-2 py-1"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </label>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <label className="text-sm text-gray-600">
            مصدر الطلب
            <select
              className="ms-2 rounded border border-gray-200 px-2 py-1"
              value={orderSource}
              onChange={(e) => setOrderSource(e.target.value)}
            >
              <option value="ALL">الكل</option>
              <option value="APP">تطبيق</option>
              <option value="EXTERNAL">خارجي</option>
            </select>
          </label>
          <label className="text-sm text-gray-600">
            طريقة الدفع
            <select
              className="ms-2 rounded border border-gray-200 px-2 py-1"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="ALL">الكل</option>
              <option value="CASH_ON_DELIVERY">نقد عند الاستلام</option>
              <option value="ONLINE_PAID">مدفوع أونلاين</option>
              <option value="CARD_ON_DELIVERY">بطاقة عند الاستلام</option>
              <option value="EXTERNAL_DELIVERY">توصيل خارجي</option>
              <option value="UNKNOWN">غير معروف</option>
            </select>
          </label>
        </div>
      </Card>

      <div className="flex flex-wrap gap-1 border-b border-gray-200 pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-t-lg px-3 py-2 text-sm ${
              tab === t.id
                ? 'bg-white border border-b-white border-gray-200 font-semibold text-gray-900 -mb-px'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          {financialReportErrorMessage(activeError)}
        </div>
      )}

      {summaryQuery.isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}

      {!summaryQuery.isLoading && !summaryQuery.error && c && tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <MetricCard
              label="إجمالي قيمة الطلبات"
              value={money(c.grossOrderValue)}
              hint="حجم مبيعات — ليس إيراد ناو ماركت"
              cmp={comparisonFor(cmp, 'grossOrderValue')}
            />
            <MetricCard
              label="إيرادات ناو ماركت"
              value={money(c.platformRevenue)}
              accent="text-emerald-700"
              cmp={comparisonFor(cmp, 'platformRevenue')}
            />
            <MetricCard
              label="رسوم التوصيل"
              value={money(c.deliveryFeeRevenue)}
              cmp={comparisonFor(cmp, 'deliveryFeeRevenue')}
            />
            <MetricCard
              label="عمولات التطبيق"
              value={money(c.platformCommissionRevenue)}
              cmp={comparisonFor(cmp, 'platformCommissionRevenue')}
            />
            <MetricCard
              label="مستحق المطاعم"
              value={money(c.restaurantPayable)}
              hint="رصيد COD مع السائقين"
              cmp={comparisonFor(cmp, 'restaurantPayable')}
            />
            <MetricCard
              label="النقد مع السائقين"
              value={money(c.driverCashInHand)}
              cmp={comparisonFor(cmp, 'driverCashInHand')}
            />
            <MetricCard
              label="مستحق ناو ماركت من السائقين"
              value={money(c.driverPlatformLiability)}
              cmp={comparisonFor(cmp, 'driverPlatformLiability')}
            />
            <MetricCard
              label="تمت تسويته مع السائقين"
              value={money(c.driverSettledAmount)}
              cmp={comparisonFor(cmp, 'driverSettledAmount')}
            />
            <MetricCard
              label="المتبقي على السائقين"
              value={money(c.driverOutstandingAmount)}
              cmp={comparisonFor(cmp, 'driverOutstandingAmount')}
            />
            <MetricCard
              label="المبالغ المستردة"
              value={money(c.refundedGross)}
              hint="معلوماتي — حالة REFUNDED"
              cmp={comparisonFor(cmp, 'refundedGross')}
            />
          </div>

          {summaryQuery.data?.revenueBreakdown && (
            <Card className="p-4">
              <h2 className="font-semibold text-gray-900 mb-2">تفصيل إيراد المنصة</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">رسوم التوصيل</p>
                  <p className="font-bold">{money(summaryQuery.data.revenueBreakdown.deliveryFees)}</p>
                </div>
                <div>
                  <p className="text-gray-500">عمولات</p>
                  <p className="font-bold">
                    {money(summaryQuery.data.revenueBreakdown.platformCommissions)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">توصيل تطبيق</p>
                  <p className="font-bold">
                    {money(summaryQuery.data.revenueBreakdown.appDeliveryIncome)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">توصيل خارجي</p>
                  <p className="font-bold">
                    {money(summaryQuery.data.revenueBreakdown.externalDeliveryIncome)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-amber-700 mt-3">
                {summaryQuery.data.revenueBreakdown.netPlatformRevenueNote}
              </p>
            </Card>
          )}

          <Card className="p-4 overflow-x-auto">
            <h2 className="font-semibold text-gray-900 mb-3">الاتجاه اليومي</h2>
            {timeseriesQuery.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : !timeseriesQuery.data?.rows?.length ? (
              <EmptyState />
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b">
                    <th className="py-2 text-start">التاريخ</th>
                    <th className="py-2 text-start">طلبات</th>
                    <th className="py-2 text-start">GMV</th>
                    <th className="py-2 text-start">إيراد المنصة</th>
                    <th className="py-2 text-start">توصيل</th>
                    <th className="py-2 text-start">عمولة</th>
                    <th className="py-2 text-start">استرداد</th>
                  </tr>
                </thead>
                <tbody>
                  {timeseriesQuery.data.rows.map((r) => (
                    <tr key={String(r.date)} className="border-b border-gray-50">
                      <td className="py-2">{r.date}</td>
                      <td className="py-2">{r.orderCount}</td>
                      <td className="py-2">{money(Number(r.grossOrderValue))}</td>
                      <td className="py-2 font-medium text-emerald-700">
                        {money(Number(r.platformRevenue))}
                      </td>
                      <td className="py-2">{money(Number(r.deliveryFeeRevenue))}</td>
                      <td className="py-2">{money(Number(r.commissionRevenue))}</td>
                      <td className="py-2">{money(Number(r.refundAmount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {tab === 'shops' && (
        <ReportTable
          loading={shopsQuery.isLoading}
          rows={shopsQuery.data?.rows}
          columns={[
            { key: 'shopName', label: 'المتجر' },
            { key: 'completedOrderCount', label: 'مكتمل' },
            { key: 'cancelledOrderCount', label: 'ملغى' },
            { key: 'grossOrderValue', label: 'GMV', money: true },
            { key: 'restaurantPayable', label: 'مستحق مطعم', money: true },
            { key: 'platformCommission', label: 'عمولة', money: true },
            { key: 'deliveryFee', label: 'توصيل', money: true },
            { key: 'platformRevenue', label: 'إيراد منصة', money: true },
            { key: 'averageOrderValue', label: 'متوسط طلب', money: true },
            { key: 'platformRevenuePerOrder', label: 'إيراد/طلب', money: true },
          ]}
        />
      )}

      {tab === 'areas' && (
        <ReportTable
          loading={areasQuery.isLoading}
          rows={areasQuery.data?.rows}
          columns={[
            { key: 'areaName', label: 'المنطقة' },
            { key: 'deliveredOrders', label: 'مسلّم' },
            { key: 'cancelledOrders', label: 'ملغى' },
            { key: 'grossOrderValue', label: 'GMV', money: true },
            { key: 'deliveryFeeRevenue', label: 'رسوم توصيل', money: true },
            { key: 'platformCommission', label: 'عمولة', money: true },
            { key: 'platformRevenue', label: 'إيراد منصة', money: true },
            { key: 'averageDeliveryFee', label: 'متوسط توصيل', money: true },
            { key: 'averageOrderValue', label: 'متوسط طلب', money: true },
          ]}
          note="المنطقة من الطلب (zoneName / externalDestination) — ليس عنوان العميل الحالي."
        />
      )}

      {tab === 'drivers' && (
        <ReportTable
          loading={driversQuery.isLoading}
          rows={driversQuery.data?.rows}
          columns={[
            {
              key: 'courierName',
              label: 'السائق',
              render: (r) => (
                <Link
                  className="text-teal-700 hover:underline"
                  to={`/drivers/collections/${r.courierId}`}
                >
                  {String(r.courierName)}
                </Link>
              ),
            },
            { key: 'completedOrders', label: 'توصيلات' },
            { key: 'cashInHandTotal', label: 'نقد باليد', money: true },
            { key: 'platformLiabilityTotal', label: 'مستحق المنصة', money: true },
            { key: 'restaurantLiabilityTotal', label: 'مستحق مطاعم', money: true },
            { key: 'totalDriverLiability', label: 'إجمالي التزام', money: true },
            { key: 'settledCollection', label: 'مسوّى', money: true },
            { key: 'outstandingCollection', label: 'متبقي', money: true },
            { key: 'anomalyCount', label: 'تنبيهات' },
          ]}
          note="يعيد استخدام Driver Collections V3 دون إعادة حساب الالتزامات."
        />
      )}

      {tab === 'payments' && (
        <ReportTable
          loading={paymentsQuery.isLoading}
          rows={paymentsQuery.data?.rows}
          columns={[
            { key: 'paymentMethod', label: 'الطريقة' },
            { key: 'orderCount', label: 'طلبات' },
            { key: 'grossOrderValue', label: 'GMV', money: true },
            { key: 'platformRevenue', label: 'إيراد منصة', money: true },
            { key: 'cashCollectedByDrivers', label: 'نقد محصّل', money: true },
            { key: 'refundedGross', label: 'استرداد', money: true },
            { key: 'cancelledCount', label: 'ملغى' },
          ]}
        />
      )}

      {tab === 'sources' && (
        <ReportTable
          loading={sourcesQuery.isLoading}
          rows={sourcesQuery.data?.rows}
          columns={[
            { key: 'source', label: 'المصدر' },
            { key: 'orderCount', label: 'طلبات' },
            { key: 'grossOrderValue', label: 'GMV', money: true },
            { key: 'deliveryFees', label: 'توصيل', money: true },
            { key: 'commissions', label: 'عمولة', money: true },
            { key: 'platformRevenue', label: 'إيراد منصة', money: true },
            { key: 'cancelledCount', label: 'ملغى' },
            { key: 'cancellationRate', label: 'نسبة إلغاء %' },
            { key: 'refundedGross', label: 'استرداد', money: true },
          ]}
        />
      )}

      {tab === 'refunds' && (
        <Card className="p-4">
          {refundsQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : refundsQuery.data ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">ملغى</p>
                <p className="text-xl font-bold">{refundsQuery.data.cancelledOrderCount}</p>
              </div>
              <div>
                <p className="text-gray-500">نسبة الإلغاء %</p>
                <p className="text-xl font-bold">{refundsQuery.data.cancellationRate}</p>
              </div>
              <div>
                <p className="text-gray-500">مسترد</p>
                <p className="text-xl font-bold">{refundsQuery.data.refundedOrderCount}</p>
              </div>
              <div>
                <p className="text-gray-500">قيمة مستردة (معلوماتي)</p>
                <p className="text-xl font-bold">{money(Number(refundsQuery.data.refundedGross))}</p>
              </div>
              <p className="col-span-full text-xs text-amber-700">{refundsQuery.data.limitation}</p>
            </div>
          ) : (
            <EmptyState />
          )}
        </Card>
      )}

      {tab === 'anomalies' && (
        <ReportTable
          loading={anomaliesQuery.isLoading}
          rows={anomaliesQuery.data?.rows}
          columns={[
            { key: 'anomalyCode', label: 'الرمز' },
            { key: 'severity', label: 'الشدة' },
            { key: 'entityType', label: 'النوع' },
            { key: 'entityId', label: 'المعرّف' },
            { key: 'message', label: 'الرسالة' },
            { key: 'detectedAt', label: 'الوقت' },
          ]}
        />
      )}
    </div>
  );
}

function ReportTable({
  loading,
  rows,
  columns,
  note,
}: {
  loading: boolean;
  rows?: Array<Record<string, unknown>>;
  columns: Array<{
    key: string;
    label: string;
    money?: boolean;
    render?: (row: Record<string, unknown>) => ReactNode;
  }>;
  note?: string;
}) {
  if (loading) return <Skeleton className="h-48 w-full rounded-xl" />;
  if (!rows?.length) return <EmptyState />;
  return (
    <Card className="p-4 overflow-x-auto">
      {note && <p className="text-xs text-gray-500 mb-3">{note}</p>}
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-gray-500 border-b">
            {columns.map((c) => (
              <th key={c.key} className="py-2 text-start whitespace-nowrap">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-gray-50">
              {columns.map((c) => (
                <td key={c.key} className="py-2 whitespace-nowrap">
                  {c.render
                    ? c.render(r)
                    : c.money
                      ? money(Number(r[c.key] ?? 0))
                      : String(r[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
