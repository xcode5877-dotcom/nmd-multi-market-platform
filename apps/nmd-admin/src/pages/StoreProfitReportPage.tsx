import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, Button, Drawer, Skeleton } from '@nmd/ui';
import { formatPrice } from '@nmd/core';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  LineChart,
  RefreshCw,
  Smartphone,
  Store,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { apiFetch } from '../api';
import {
  adminReportErrorMessage,
  fetchAdminReportJson,
} from '../lib/adminReportFetch';

const PERIODS = [
  { id: 'today', label: 'اليوم' },
  { id: 'yesterday', label: 'أمس' },
  { id: 'week', label: 'هذا الأسبوع' },
  { id: 'month', label: 'هذا الشهر' },
  { id: 'custom', label: 'فترة مخصصة' },
] as const;

type PeriodId = (typeof PERIODS)[number]['id'];

type StoreProfitSourceTotals = {
  appOrderCount: number;
  externalOrderCount: number;
  totalOrderCount: number;
  appDeliveryProfit: number;
  appCommissionProfit: number;
  appTotalPlatformProfit: number;
  externalDeliveryProfit: number;
  externalTotalPlatformProfit: number;
  totalDeliveryProfit: number;
  totalCommissionProfit: number;
  totalPlatformProfit: number;
};

type StoreProfitRow = StoreProfitSourceTotals & {
  tenantId: string;
  storeName: string;
  marketId?: string;
};

type StoreProfitReport = {
  from: string;
  to: string;
  summary: StoreProfitSourceTotals;
  stores: StoreProfitRow[];
};

type TenantOption = { id: string; name: string };

function money(n: number | undefined | null): string {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
  return formatPrice(v);
}

function pct(part: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function buildQuery(
  period: PeriodId,
  customFrom: string,
  customTo: string,
  tenantId?: string
): string {
  const params = new URLSearchParams();
  if (period === 'custom') {
    if (customFrom) params.set('from', customFrom);
    if (customTo) params.set('to', customTo);
  } else {
    params.set('period', period);
  }
  if (tenantId) params.set('tenantId', tenantId);
  return `/admin/store-profit-report?${params.toString()}`;
}

function SummaryCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-xl font-bold mt-1 ${accent ?? 'text-gray-900'}`}>{value}</p>
      {hint && <p className="text-[11px] text-gray-400 mt-1 leading-snug">{hint}</p>}
    </div>
  );
}

function ProfitBreakdownBar({ summary }: { summary: StoreProfitSourceTotals }) {
  const total = summary.totalPlatformProfit;
  const appPct = pct(summary.appTotalPlatformProfit, total);
  const extPct = pct(summary.externalTotalPlatformProfit, total);

  if (total <= 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500 text-center">
        لا توجد أرباح في هذه الفترة لعرض التوزيع
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-800">توزيع أرباح المنصة</h3>
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-100">
        {appPct > 0 && (
          <div className="bg-sky-500 transition-all" style={{ width: `${appPct}%` }} title={`تطبيق ${appPct}%`} />
        )}
        {extPct > 0 && (
          <div className="bg-amber-500 transition-all" style={{ width: `${extPct}%` }} title={`خارجية ${extPct}%`} />
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-sky-500 shrink-0" />
          <span className="text-gray-600">طلبات التطبيق</span>
          <span className="font-semibold text-sky-700 ms-auto">{appPct}%</span>
          <span className="text-gray-500">({money(summary.appTotalPlatformProfit)})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
          <span className="text-gray-600">الطلبات الخارجية</span>
          <span className="font-semibold text-amber-700 ms-auto">{extPct}%</span>
          <span className="text-gray-500">({money(summary.externalTotalPlatformProfit)})</span>
        </div>
      </div>
    </div>
  );
}

function StoreDetailPanel({ row }: { row: StoreProfitRow }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Smartphone className="w-4 h-4 text-sky-600" />
          <h4 className="font-semibold text-sky-900">طلبات التطبيق</h4>
        </div>
        <dl className="grid grid-cols-2 gap-2">
          <div><dt className="text-gray-500 text-xs">عدد الطلبات</dt><dd className="font-semibold">{row.appOrderCount}</dd></div>
          <div><dt className="text-gray-500 text-xs">ربح التوصيل</dt><dd className="font-semibold text-blue-700">{money(row.appDeliveryProfit)}</dd></div>
          <div><dt className="text-gray-500 text-xs">عمولة المنصة</dt><dd className="font-semibold text-violet-700">{money(row.appCommissionProfit)}</dd></div>
          <div><dt className="text-gray-500 text-xs">إجمالي ربح التطبيق</dt><dd className="font-semibold text-emerald-700">{money(row.appTotalPlatformProfit)}</dd></div>
        </dl>
      </div>

      <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Truck className="w-4 h-4 text-amber-600" />
          <h4 className="font-semibold text-amber-900">الطلبات الخارجية</h4>
        </div>
        <dl className="grid grid-cols-2 gap-2">
          <div><dt className="text-gray-500 text-xs">عدد الطلبات</dt><dd className="font-semibold">{row.externalOrderCount}</dd></div>
          <div><dt className="text-gray-500 text-xs">ربح التوصيل فقط</dt><dd className="font-semibold text-amber-700">{money(row.externalDeliveryProfit)}</dd></div>
          <div className="col-span-2">
            <dt className="text-gray-500 text-xs">إجمالي ربح الطلبات الخارجية</dt>
            <dd className="font-semibold text-amber-800">{money(row.externalTotalPlatformProfit)}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-teal-600" />
          <h4 className="font-semibold text-gray-900">الإجمالي</h4>
        </div>
        <dl className="grid grid-cols-2 gap-2">
          <div><dt className="text-gray-500 text-xs">إجمالي عدد الطلبات</dt><dd className="font-semibold">{row.totalOrderCount}</dd></div>
          <div><dt className="text-gray-500 text-xs">إجمالي ربح التوصيل</dt><dd className="font-semibold text-blue-700">{money(row.totalDeliveryProfit)}</dd></div>
          <div><dt className="text-gray-500 text-xs">إجمالي العمولات</dt><dd className="font-semibold text-violet-700">{money(row.totalCommissionProfit)}</dd></div>
          <div><dt className="text-gray-500 text-xs">إجمالي ربح المنصة</dt><dd className="font-semibold text-emerald-700">{money(row.totalPlatformProfit)}</dd></div>
        </dl>
      </div>
    </div>
  );
}

function StoreCard({ row, onDetails }: { row: StoreProfitRow; onDetails: () => void }) {
  return (
    <div className="rounded-xl border border-gray-100 p-4 space-y-3 bg-white">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Store className="w-4 h-4 text-teal-600 shrink-0" />
          <span className="font-semibold text-gray-900 truncate">{row.storeName}</span>
        </div>
        <Button size="sm" variant="outline" onClick={onDetails}>
          تفاصيل
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-sky-50 rounded-lg p-2">
          <p className="text-gray-500">تطبيق ({row.appOrderCount})</p>
          <p className="font-bold text-sky-800">{money(row.appTotalPlatformProfit)}</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-2">
          <p className="text-gray-500">خارجية ({row.externalOrderCount})</p>
          <p className="font-bold text-amber-800">{money(row.externalTotalPlatformProfit)}</p>
        </div>
        <div className="col-span-2 bg-emerald-50 rounded-lg p-2 flex justify-between items-center">
          <span className="text-gray-600">إجمالي ربح المنصة</span>
          <span className="font-bold text-emerald-800">{money(row.totalPlatformProfit)}</span>
        </div>
      </div>
    </div>
  );
}

export default function StoreProfitReportPage() {
  const [period, setPeriod] = useState<PeriodId>('week');
  const [customFrom, setCustomFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [tenantFilter, setTenantFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drawerStore, setDrawerStore] = useState<StoreProfitRow | null>(null);

  const queryPath = useMemo(
    () => buildQuery(period, customFrom, customTo, tenantFilter || undefined),
    [period, customFrom, customTo, tenantFilter]
  );

  const { data: report, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['store-profit-report', queryPath],
    queryFn: () => fetchAdminReportJson<StoreProfitReport>(queryPath),
    retry: (count, err) => {
      const status = (err as { status?: number })?.status;
      if (status === 401 || status === 403 || status === 404) return false;
      return count < 1;
    },
  });

  const { data: tenants } = useQuery({
    queryKey: ['tenants-for-profit-report'],
    queryFn: () => apiFetch<TenantOption[]>('/tenants'),
  });

  const sortedTenants = useMemo(
    () => [...(tenants ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'ar')),
    [tenants]
  );

  const toggleExpand = (tenantId: string) => {
    setExpandedId((prev) => (prev === tenantId ? null : tenantId));
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/economics" className="text-sm text-teal-700 inline-flex items-center gap-1 mb-2">
            <ArrowRight className="w-4 h-4 rotate-180" />
            اقتصاديات المنصة
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <LineChart className="w-7 h-7 text-teal-600" />
            تقرير ربح المتاجر
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            فصل أرباح المنصة بين طلبات التطبيق (عمولة + توصيل) والطلبات الخارجية (ربح التوصيل فقط)
          </p>
        </div>
      </div>

      <Card>
        <div className="p-4 flex flex-wrap items-center gap-2 border-b border-gray-100">
          {PERIODS.map((p) => (
            <Button
              key={p.id}
              variant={period === p.id ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </Button>
          ))}
          {period === 'custom' && (
            <div className="flex items-center gap-2 text-sm">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5"
              />
              <span className="text-gray-400">→</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5"
              />
            </div>
          )}
          <select
            value={tenantFilter}
            onChange={(e) => setTenantFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm ms-auto min-w-[160px]"
          >
            <option value="">جميع المتاجر</option>
            {sortedTenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {report && (
            <span className="text-xs text-gray-500 w-full sm:w-auto">
              {report.from} → {report.to}
            </span>
          )}
        </div>

        {isLoading && (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        )}

        {isError && (
          <div className="p-8 text-center space-y-3">
            <p className="text-red-600">{adminReportErrorMessage(error)}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 ms-1" />
              إعادة المحاولة
            </Button>
          </div>
        )}

        {!isLoading && !isError && report && (report.stores?.length ?? 0) === 0 && (
          <div className="p-8 text-center text-gray-500">لا توجد بيانات بعد</div>
        )}

        {!isLoading && !isError && report && (report.stores?.length ?? 0) > 0 && (
          <>
            <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 border-b border-gray-100 bg-slate-50/80">
              <SummaryCard
                label="إجمالي أرباح المنصة"
                value={money(report.summary.totalPlatformProfit)}
                hint="مجموع أرباح التطبيق والخارجية"
                accent="text-emerald-700"
              />
              <SummaryCard
                label="أرباح طلبات التطبيق"
                value={money(report.summary.appTotalPlatformProfit)}
                hint={`${report.summary.appOrderCount} طلب`}
                accent="text-sky-700"
              />
              <SummaryCard
                label="أرباح الطلبات الخارجية"
                value={money(report.summary.externalTotalPlatformProfit)}
                hint="دخل التوصيل من الطلبات الخارجية"
                accent="text-amber-700"
              />
              <SummaryCard
                label="أرباح التوصيل"
                value={money(report.summary.totalDeliveryProfit)}
                hint="تطبيق + خارجية"
                accent="text-blue-700"
              />
              <SummaryCard
                label="عمولات التطبيق"
                value={money(report.summary.totalCommissionProfit)}
                hint="لا عمولة على الطلبات الخارجية"
                accent="text-violet-700"
              />
              <SummaryCard
                label="إجمالي عدد الطلبات"
                value={String(report.summary.totalOrderCount)}
                hint={`${report.summary.appOrderCount} تطبيق · ${report.summary.externalOrderCount} خارجية`}
              />
            </div>

            <div className="p-4 border-b border-gray-100">
              <ProfitBreakdownBar summary={report.summary} />
            </div>

            {isFetching && !isLoading && (
              <p className="px-4 py-2 text-xs text-gray-400">جاري تحديث البيانات...</p>
            )}

            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-gray-600">
                    <th className="text-start p-3 font-semibold">المتجر</th>
                    <th className="text-start p-3 font-semibold">طلبات التطبيق</th>
                    <th className="text-start p-3 font-semibold">ربح توصيل التطبيق</th>
                    <th className="text-start p-3 font-semibold">عمولة التطبيق</th>
                    <th className="text-start p-3 font-semibold">إجمالي ربح التطبيق</th>
                    <th className="text-start p-3 font-semibold">الطلبات الخارجية</th>
                    <th className="text-start p-3 font-semibold">ربح توصيل الخارجية</th>
                    <th className="text-start p-3 font-semibold">إجمالي ربح المنصة</th>
                    <th className="text-start p-3 font-semibold w-24" />
                  </tr>
                </thead>
                <tbody>
                  {report.stores.map((row) => (
                    <Fragment key={row.tenantId}>
                      <tr className="border-b border-gray-100 hover:bg-teal-50/40">
                        <td className="p-3 font-medium text-gray-900">
                          <div className="flex items-center gap-2 min-w-0 max-w-[200px]">
                            <Store className="w-4 h-4 text-teal-600 shrink-0" />
                            <span className="truncate" title={row.storeName}>{row.storeName}</span>
                          </div>
                        </td>
                        <td className="p-3">{row.appOrderCount}</td>
                        <td className="p-3 text-blue-700">{money(row.appDeliveryProfit)}</td>
                        <td className="p-3 text-violet-700">{money(row.appCommissionProfit)}</td>
                        <td className="p-3 text-sky-700 font-medium">{money(row.appTotalPlatformProfit)}</td>
                        <td className="p-3">{row.externalOrderCount}</td>
                        <td className="p-3 text-amber-700">{money(row.externalDeliveryProfit)}</td>
                        <td className="p-3 font-semibold text-emerald-700">{money(row.totalPlatformProfit)}</td>
                        <td className="p-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleExpand(row.tenantId)}
                          >
                            {expandedId === row.tenantId ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <>
                                تفاصيل
                                <ChevronDown className="w-4 h-4 ms-1" />
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                      {expandedId === row.tenantId && (
                        <tr className="bg-gray-50/80">
                          <td colSpan={9} className="p-4">
                            <StoreDetailPanel row={row} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden p-4 grid gap-3 sm:grid-cols-2">
              {report.stores.map((row) => (
                <StoreCard key={row.tenantId} row={row} onDetails={() => setDrawerStore(row)} />
              ))}
            </div>
          </>
        )}
      </Card>

      <Drawer
        open={!!drawerStore}
        onClose={() => setDrawerStore(null)}
        title={drawerStore ? `تفاصيل: ${drawerStore.storeName}` : ''}
      >
        {drawerStore && <StoreDetailPanel row={drawerStore} />}
      </Drawer>
    </div>
  );
}
