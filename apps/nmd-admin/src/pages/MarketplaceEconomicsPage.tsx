import { useMemo, useState, useCallback, type ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Banknote,
  CreditCard,
  Flame,
  Percent,
  PieChart,
  Target,
  TrendingDown,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react';
import { Badge, Card } from '@nmd/ui';
import { MockApiClient } from '@nmd/mock';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch, apiHeaders } from '../api';
import PlatformFeeDisabledBanner from '../components/platform-fee/PlatformFeeDisabledBanner';
import EconomicsDateRange from '../components/economics/EconomicsDateRange';
import EconomicsCostStructurePanel from '../components/economics/EconomicsCostStructurePanel';
import EconomicsSimulationPanel from '../components/economics/EconomicsSimulationPanel';
import {
  buildTenantContextMap,
  computeMarketRows,
  computeOverviewMetrics,
  computePaymentAnalytics,
  computeProfitabilityEstimates,
  computeStoreRows,
  computeUnitEconomics,
  filterOrdersByRange,
  formatMoney,
  formatPct,
  getDateRange,
  normalizeOrders,
  STORE_CLASS_BADGE,
  STORE_CLASS_LABELS,
  type DateRangePreset,
  type RawOrder,
} from '../lib/economics';
import { isPlatformAdminRole } from '../lib/platform-fee';
import { monthlyOperationalTotal, loadOperationalCosts } from '../lib/economics-costs';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';
const api = new MockApiClient();

type MarketRecord = { id: string; name: string; platformFeeConfig?: unknown };

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  heat,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: ComponentType<{ className?: string }>;
  accent: string;
  heat?: 'good' | 'warn' | 'bad';
}) {
  const heatRing =
    heat === 'good' ? 'ring-emerald-200' : heat === 'warn' ? 'ring-amber-200' : heat === 'bad' ? 'ring-red-200' : '';
  return (
    <Card className={`border-s-4 ${accent} ${heatRing} ring-1`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm text-gray-500">{label}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
            {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
          </div>
          <Icon className="w-5 h-5 text-gray-400 shrink-0" />
        </div>
      </div>
    </Card>
  );
}

function BarCompare({ label, a, b, aLabel, bLabel }: { label: string; a: number; b: number; aLabel: string; bLabel: string }) {
  const total = a + b || 1;
  const aPct = Math.round((a / total) * 100);
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="text-gray-500">{aLabel} {aPct}% · {bLabel} {100 - aPct}%</span>
      </div>
      <div className="h-3 rounded-full overflow-hidden flex bg-gray-100">
        <div className="bg-teal-500 transition-all" style={{ width: `${aPct}%` }} />
        <div className="bg-indigo-500 transition-all" style={{ width: `${100 - aPct}%` }} />
      </div>
    </div>
  );
}

export default function MarketplaceEconomicsPage() {
  const { user } = useAuth();
  const platformAdmin = isPlatformAdminRole(user?.role);

  const [preset, setPreset] = useState<DateRangePreset>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [monthlyCosts, setMonthlyCosts] = useState(() => monthlyOperationalTotal(loadOperationalCosts()));
  const [storeSearch, setStoreSearch] = useState('');

  const onCostTotalChange = useCallback((total: number) => setMonthlyCosts(total), []);

  const { from, to } = useMemo(() => getDateRange(preset, customFrom, customTo), [preset, customFrom, customTo]);

  const { data: ordersRaw = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['economics-orders'],
    queryFn: () => apiFetch<RawOrder[]>('/orders'),
    enabled: !!MOCK_API_URL && platformAdmin,
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.listTenants(),
    enabled: !!MOCK_API_URL && platformAdmin,
  });

  const { data: marketsData = [] } = useQuery({
    queryKey: ['markets'],
    queryFn: () =>
      fetch(`${MOCK_API_URL}/markets?all=true`, { headers: apiHeaders() }).then((r) => r.json()),
    enabled: !!MOCK_API_URL && platformAdmin,
  });
  const markets: MarketRecord[] = Array.isArray(marketsData) ? marketsData : [];

  const tenantCtx = useMemo(
    () =>
      buildTenantContextMap(
        tenants as Parameters<typeof buildTenantContextMap>[0],
        markets as Parameters<typeof buildTenantContextMap>[1]
      ),
    [tenants, markets]
  );

  const filteredOrders = useMemo(
    () => filterOrdersByRange(ordersRaw, from, to),
    [ordersRaw, from, to]
  );

  const settings = useMemo(
    () => ({
      gatewayPct: 2.8,
      avgDeliveryCost: 15,
      simPercentage: 4,
      simMinFee: 2.5,
      simMaxFee: 12,
      simFixedFee: 0,
    }),
    []
  );

  const normalized = useMemo(
    () => normalizeOrders(filteredOrders, tenantCtx, settings),
    [filteredOrders, tenantCtx, settings]
  );

  const overview = useMemo(
    () => computeOverviewMetrics(normalized, monthlyCosts, from, to),
    [normalized, monthlyCosts, from, to]
  );

  const unit = useMemo(() => computeUnitEconomics(overview, normalized), [overview, normalized]);
  const marketRows = useMemo(() => computeMarketRows(normalized, markets), [normalized, markets]);
  const storeRows = useMemo(() => computeStoreRows(normalized, tenantCtx), [normalized, tenantCtx]);
  const payment = useMemo(() => computePaymentAnalytics(normalized), [normalized]);
  const profitability = useMemo(
    () => computeProfitabilityEstimates(overview, monthlyCosts, from, to),
    [overview, monthlyCosts, from, to]
  );

  const filteredStores = useMemo(() => {
    const q = storeSearch.trim().toLowerCase();
    if (!q) return storeRows;
    return storeRows.filter(
      (s) =>
        s.tenantName.toLowerCase().includes(q) ||
        (s.marketName ?? '').toLowerCase().includes(q)
    );
  }, [storeRows, storeSearch]);

  if (!platformAdmin) {
    return <div className="p-4 text-amber-700">هذه الصفحة متاحة لـ ROOT_ADMIN و SUPER_ADMIN فقط.</div>;
  }

  if (!MOCK_API_URL) {
    return (
      <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
        يتطلب VITE_MOCK_API_URL لتشغيل لوحة الاقتصاديات.
      </div>
    );
  }

  if (ordersLoading) {
    return <div className="text-gray-500 py-8">جاري تحميل بيانات الطلبات...</div>;
  }

  return (
    <div className="space-y-8 pb-12" dir="rtl">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <PieChart className="w-7 h-7 text-indigo-600" />
            اقتصاديات المنصة
          </h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            ذكاء تشغيلي للربحية — قراءة فقط. لا محاسبة رسمية ولا تفعيل رسوم.
          </p>
        </div>
        <EconomicsDateRange
          preset={preset}
          customFrom={customFrom}
          customTo={customTo}
          onPresetChange={setPreset}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
        />
      </div>

      <PlatformFeeDisabledBanner />

      <div className="px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700">
        <strong>تنبيه:</strong> الأرقام تقديرية تشغيلية. «إيراد المنصة المُفعّل» = صفر حتى تفعيل{' '}
        <code className="text-xs bg-slate-200 px-1 rounded">PLATFORM_FEE_ENABLED</code>.
        <Link to="/platform-fees" className="text-indigo-600 hover:underline ms-2">
          إدارة رسوم المنصة ←
        </Link>
      </div>

      {/* 1. Overview KPIs */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">مؤشرات عامة</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-3">
          <KpiCard label="GMV" value={formatMoney(overview.gmv)} sub={`${overview.orderCount} طلب`} icon={Activity} accent="border-s-emerald-500" />
          <KpiCard label="متوسط الطلب" value={formatMoney(overview.avgOrderValue)} icon={Wallet} accent="border-s-sky-500" />
          <KpiCard
            label="دخل التوصيل"
            value={formatMoney(overview.deliveryRevenue)}
            sub="رسوم التوصيل المدفوعة من العميل"
            icon={TrendingUp}
            accent="border-s-teal-500"
          />
          <KpiCard
            label="تكلفة التوصيل المقدرة"
            value={formatMoney(overview.deliveryCostTotal)}
            sub={`₪${settings.avgDeliveryCost} / طلب توصيل`}
            icon={Truck}
            accent="border-s-orange-500"
          />
          <KpiCard
            label="هامش التوصيل"
            value={formatMoney(overview.deliveryMarginTotal)}
            heat={overview.deliveryMarginTotal >= 0 ? 'good' : 'bad'}
            sub="دخل التوصيل − تكلفة التوصيل"
            icon={TrendingUp}
            accent="border-s-cyan-500"
          />
          <KpiCard label="تعرّض الكوبونات" value={formatMoney(overview.couponExposure)} icon={TrendingDown} accent="border-s-amber-500" heat="warn" />
          <KpiCard
            label="نقد vs فيزا"
            value={formatPct(overview.cashRatio * 100)}
            sub={`${overview.cashOrders} نقد · ${overview.cardOrders} فيزا`}
            icon={Banknote}
            accent="border-s-indigo-500"
          />
          <KpiCard
            label="إيراد منصة (مُعدّ)"
            value={formatMoney(overview.configuredPlatformRevenue)}
            sub="إذا فُعّلت الإعدادات"
            icon={Percent}
            accent="border-s-violet-500"
          />
          <KpiCard
            label="إيراد منصة (فعلي)"
            value={formatMoney(overview.actualPlatformRevenue)}
            sub="حاليًا ≈ 0"
            icon={Percent}
            accent="border-s-gray-400"
          />
          <KpiCard
            label="صافي المساهمة"
            value={formatMoney(overview.estimatedNetContribution)}
            heat={overview.estimatedNetContribution >= 0 ? 'good' : 'bad'}
            sub="رسوم + توصيل − تكاليف − كوبون − تشغيل"
            icon={Target}
            accent="border-s-emerald-600"
          />
          <KpiCard
            label="حرق تقديري"
            value={formatMoney(overview.estimatedBurn)}
            heat={overview.estimatedBurn > 0 ? 'bad' : 'good'}
            icon={Flame}
            accent="border-s-red-500"
          />
          <KpiCard
            label="تكلفة بوابة (تقدير)"
            value={formatMoney(overview.gatewayCostEstimate)}
            sub={`${settings.gatewayPct}% على فيزا`}
            icon={CreditCard}
            accent="border-s-rose-500"
          />
        </div>
      </section>

      {/* 2. Cost structure */}
      <section>
        <EconomicsCostStructurePanel orderCount={overview.orderCount} onTotalChange={onCostTotalChange} />
      </section>

      {/* 3. Unit economics */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">اقتصاديات الوحدة (متوسط / طلب)</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: 'رسوم منصة (مُعدّ)', value: unit.avgProjectedPlatformRevenue },
            { label: 'دخل التوصيل', value: unit.avgDeliveryRevenue },
            { label: 'تكلفة التوصيل', value: -unit.avgDeliveryCost },
            { label: 'هامش التوصيل', value: unit.avgDeliveryMargin },
            { label: 'بوابة دفع', value: -unit.avgGatewayCost },
            { label: 'كوبون', value: -unit.avgCouponCost },
            { label: 'تخصيص تشغيلي', value: -unit.avgOperationalAllocation },
            { label: 'صافي المساهمة / طلب', value: unit.avgContributionPerOrder, highlight: true },
          ].map((row) => (
            <Card
              key={row.label}
              className={row.highlight ? 'bg-emerald-50 border-emerald-200 ring-1 ring-emerald-100' : ''}
            >
              <div className="p-4 text-center">
                <p className="text-xs text-gray-500">{row.label}</p>
                <p className={`text-lg font-bold mt-1 ${row.highlight ? 'text-emerald-800' : 'text-gray-900'}`}>
                  {formatMoney(row.value)}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* 4. Simulation */}
      <section>
        <EconomicsSimulationPanel
          overview={overview}
          normalized={normalized}
          monthlyOperationalCosts={monthlyCosts}
          periodDays={profitability.periodDays}
        />
      </section>

      {/* 5. Market / store analytics */}
      <section className="grid xl:grid-cols-2 gap-6">
        <Card>
          <div className="p-5 border-b">
            <h2 className="text-lg font-semibold">تحليل الأسواق</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-start p-3 font-medium">السوق</th>
                  <th className="p-3 font-medium">GMV</th>
                  <th className="p-3 font-medium">طلبات</th>
                  <th className="p-3 font-medium">إيراد مُعدّ</th>
                  <th className="p-3 font-medium">مساهمة</th>
                </tr>
              </thead>
              <tbody>
                {marketRows.map((m) => (
                  <tr key={m.marketId} className="border-t border-gray-100">
                    <td className="p-3 font-medium">{m.marketName}</td>
                    <td className="p-3">{formatMoney(m.gmv)}</td>
                    <td className="p-3">{m.orderCount}</td>
                    <td className="p-3">{formatMoney(m.projectedRevenue)}</td>
                    <td className={`p-3 font-medium ${m.estimatedContribution >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                      {formatMoney(m.estimatedContribution)}
                    </td>
                  </tr>
                ))}
                {marketRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-500">
                      لا طلبات في الفترة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className="p-5 border-b flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">تحليل المتاجر</h2>
            <input
              type="search"
              placeholder="بحث..."
              value={storeSearch}
              onChange={(e) => setStoreSearch(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 sticky top-0">
                <tr>
                  <th className="text-start p-3 font-medium">المتجر</th>
                  <th className="p-3 font-medium">GMV</th>
                  <th className="p-3 font-medium">سلة</th>
                  <th className="p-3 font-medium">رسوم مُعدّة</th>
                  <th className="p-3 font-medium">تصنيف</th>
                </tr>
              </thead>
              <tbody>
                {filteredStores.slice(0, 50).map((s) => {
                  const badge = STORE_CLASS_BADGE[s.classification];
                  return (
                    <tr key={s.tenantId} className="border-t border-gray-100">
                      <td className="p-3">
                        <div className="font-medium">{s.tenantName}</div>
                        <div className="text-xs text-gray-500">{s.marketName ?? '—'}</div>
                      </td>
                      <td className="p-3">{formatMoney(s.gmv)}</td>
                      <td className="p-3">{formatMoney(s.avgBasket)}</td>
                      <td className="p-3">{formatMoney(s.projectedFeeRevenue)}</td>
                      <td className="p-3">
                        <Badge variant={badge.variant} className={badge.className}>
                          {STORE_CLASS_LABELS[s.classification]}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      {/* 6. Payment analytics */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">تحليل الدفع</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-5 space-y-4">
            <BarCompare
              label="توزيع الطلبات"
              a={payment.cashOrders}
              b={payment.cardOrders}
              aLabel="نقد"
              bLabel="فيزا"
            />
            <BarCompare
              label="توزيع GMV"
              a={payment.cashGmv}
              b={payment.cardGmv}
              aLabel="نقد"
              bLabel="فيزا"
            />
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-lg bg-teal-50">
                <p className="text-xs text-teal-700">متوسط تذكرة نقد</p>
                <p className="font-bold text-teal-900">{formatMoney(payment.avgCashTicket)}</p>
              </div>
              <div className="p-3 rounded-lg bg-indigo-50">
                <p className="text-xs text-indigo-700">متوسط تذكرة فيزا</p>
                <p className="font-bold text-indigo-900">{formatMoney(payment.avgCardTicket)}</p>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="font-medium text-gray-900 mb-3">تعرّض رسوم البطاقة</h3>
            <p className="text-2xl font-bold text-rose-700">{formatMoney(payment.estimatedGatewayCosts)}</p>
            <p className="text-sm text-gray-500 mt-2">تقدير {settings.gatewayPct}% على طلبات الفيزا</p>
            <div className="mt-4 p-4 rounded-lg bg-amber-50 border border-amber-100">
              <p className="text-sm font-medium text-amber-900">طلبات فيزا صغيرة (&lt; ₪80)</p>
              <p className="text-lg font-bold text-amber-800 mt-1">
                {payment.smallCardOrders} طلب · {formatMoney(payment.smallCardGmv)} GMV
              </p>
              <p className="text-xs text-amber-700 mt-1">قد تضر بالاقتصاديات بسبب رسوم البوابة الثابتة النسبية</p>
            </div>
          </Card>
        </div>
      </section>

      {/* 7. Profitability estimates */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">تقديرات الربحية</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-4 border-s-4 border-s-red-400">
            <p className="text-sm text-gray-500">معدل الحرق الشهري</p>
            <p className="text-xl font-bold text-red-700">{formatMoney(profitability.burnRateMonthly)}</p>
          </Card>
          <Card className="p-4 border-s-4 border-s-amber-400">
            <p className="text-sm text-gray-500">نقطة التعادل (طلب/شهر)</p>
            <p className="text-xl font-bold text-amber-800">
              {profitability.breakEvenOrdersPerMonth > 0
                ? profitability.breakEvenOrdersPerMonth.toLocaleString('ar')
                : '—'}
            </p>
          </Card>
          <Card className="p-4 border-s-4 border-s-emerald-400">
            <p className="text-sm text-gray-500">هامش مساهمة %</p>
            <p className="text-xl font-bold text-emerald-800">{formatPct(profitability.projectedMarginPct)}</p>
          </Card>
          <Card className="p-4 border-s-4 border-s-violet-400">
            <p className="text-sm text-gray-500">إيراد منصة % من GMV</p>
            <p className="text-xl font-bold text-violet-800">{formatPct(profitability.projectedContributionPct)}</p>
          </Card>
        </div>
      </section>
    </div>
  );
}
