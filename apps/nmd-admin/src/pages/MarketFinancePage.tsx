import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, Button } from '@nmd/ui';
import { MockApiClient } from '@nmd/mock';
import { ArrowLeft, Wallet, Package, Banknote, TrendingUp, Download, CreditCard } from 'lucide-react';
import { useState, useMemo } from 'react';
import { apiHeaders } from '../api';

const api = new MockApiClient();
const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

const RANGE_OPTIONS = [
  { id: 'today', label: 'اليوم', getRange: () => {
    const d = new Date();
    const s = d.toISOString().slice(0, 10);
    return { from: s, to: s };
  }},
  { id: '7d', label: '7 أيام', getRange: () => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 6);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }},
  { id: 'month', label: 'الشهر', getRange: () => {
    const d = new Date();
    const to = d.toISOString().slice(0, 10);
    const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
    return { from, to };
  }},
  { id: 'custom', label: 'مخصص', getRange: () => null },
];

function formatMoney(n: number): string {
  return new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + ' ₪';
}

type FinanceTenantRow = {
  tenantId: string;
  tenantName: string;
  orderCount: number;
  deliveredCount: number;
  gross: number;
  commission: number;
  netToMerchant: number;
};
type FinanceCourierRow = {
  courierId: string;
  courierName: string;
  deliveredCount: number;
  cashCollectedGross: number;
  outstandingGross: number;
  activeUncollectedGross?: number;
};

function exportTenantsCsv(tenants: FinanceTenantRow[], from?: string, to?: string): void {
  const headers = ['المستأجر', 'الطلبات', 'تم التسليم', 'إجمالي', 'العمولة', 'للمستأجر'];
  const rows = tenants.map((t) => [
    t.tenantName,
    t.orderCount,
    t.deliveredCount,
    t.gross,
    t.commission,
    t.netToMerchant,
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tenants-${from ?? 'all'}-${to ?? 'all'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function MarketFinancePage() {
  const { id: marketId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [rangeId, setRangeId] = useState('7d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [tableTab, setTableTab] = useState<'tenants' | 'couriers'>('tenants');

  const { from, to } = useMemo(() => {
    if (rangeId === 'custom') {
      return { from: customFrom || undefined, to: customTo || undefined };
    }
    const opt = RANGE_OPTIONS.find((r) => r.id === rangeId);
    const r = opt?.getRange();
    return r ?? { from: undefined, to: undefined };
  }, [rangeId, customFrom, customTo]);

  const { data: market } = useQuery({
    queryKey: ['market', marketId],
    queryFn: () => fetch(`${MOCK_API_URL}/markets/${marketId}`, { headers: apiHeaders() }).then((r) => (r.ok ? r.json() : Promise.reject(new Error('Not found')))),
    enabled: !!marketId && !!MOCK_API_URL,
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['market-finance-summary', marketId, from, to],
    queryFn: () => api.getMarketFinanceSummary(marketId!, from, to),
    enabled: !!marketId && !!MOCK_API_URL,
  });

  const { data: tenants, isLoading: tenantsLoading } = useQuery({
    queryKey: ['market-finance-tenants', marketId, from, to],
    queryFn: () => api.getMarketFinanceTenants(marketId!, from, to),
    enabled: !!marketId && !!MOCK_API_URL,
  });

  const { data: couriers, isLoading: couriersLoading } = useQuery({
    queryKey: ['market-finance-couriers', marketId, from, to],
    queryFn: () => api.getMarketFinanceCouriers(marketId!, from, to),
    enabled: !!marketId && !!MOCK_API_URL,
  });

  if (!marketId || !MOCK_API_URL) {
    return (
      <div className="py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate('/markets')} className="mb-4">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
          لتشغيل هذه الصفحة، ضبط VITE_MOCK_API_URL (مثال: http://localhost:5190)
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/markets/${marketId}`)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{market?.name ?? 'المالية'}</h1>
          <p className="text-sm text-gray-500">لوحة المالية</p>
        </div>
      </div>

      <div className="mb-4 px-4 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium">
        Payments: CASH only
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        {RANGE_OPTIONS.map((r) => (
          <Button
            key={r.id}
            size="sm"
            variant={rangeId === r.id ? 'primary' : 'outline'}
            onClick={() => setRangeId(r.id)}
          >
            {r.label}
          </Button>
        ))}
        {rangeId === 'custom' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-9 px-2 rounded border border-gray-300 text-sm"
            />
            <span className="text-gray-500">–</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-9 px-2 rounded border border-gray-300 text-sm"
            />
          </div>
        )}
      </div>

      {summaryLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
              <div className="h-6 bg-gray-200 rounded w-1/2" />
            </Card>
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
              <Wallet className="w-4 h-4" />
              إجمالي المبيعات
            </div>
            <div className="text-xl font-bold text-gray-900">{formatMoney(summary.gross)}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
              <Banknote className="w-4 h-4" />
              نقداً محصل
            </div>
            <div className="text-xl font-bold text-emerald-600">{formatMoney(summary.cashCollected)}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
              <TrendingUp className="w-4 h-4" />
              نقداً معلق
            </div>
            <div className="text-xl font-bold text-amber-600">{formatMoney(summary.outstandingCash)}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
              <Package className="w-4 h-4" />
              إجمالي العمولة
            </div>
            <div className="text-xl font-bold text-gray-900">{formatMoney(summary.commission)}</div>
          </Card>
          <Card className="p-4 opacity-50 bg-gray-50" title="Coming soon">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <CreditCard className="w-4 h-4" />
              Card Captured (Coming soon)
            </div>
            <div className="text-xl font-bold text-gray-400">{formatMoney(0)}</div>
          </Card>
          <Card className="p-4 opacity-50 bg-gray-50" title="Coming soon">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <CreditCard className="w-4 h-4" />
              Card Outstanding (Coming soon)
            </div>
            <div className="text-xl font-bold text-gray-400">{formatMoney(0)}</div>
          </Card>
        </div>
      ) : null}

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-3">
            <div className="text-xs text-gray-500">الطلبات</div>
            <div className="font-semibold">{summary.totalOrders}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-gray-500">تم التسليم</div>
            <div className="font-semibold">{summary.deliveredOrders}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-gray-500">توصيل نشط</div>
            <div className="font-semibold">{summary.activeDeliveryOrders}</div>
          </Card>
          <Card className="p-3">
            <div className="text-xs text-gray-500">طلبات نقدية</div>
            <div className="font-semibold">{summary.cashOrders}</div>
          </Card>
        </div>
      )}

      <Card>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={tableTab === 'tenants' ? 'primary' : 'outline'}
              onClick={() => setTableTab('tenants')}
            >
              المستأجرون
            </Button>
            <Button
              size="sm"
              variant={tableTab === 'couriers' ? 'primary' : 'outline'}
              onClick={() => setTableTab('couriers')}
            >
              السائقون
            </Button>
          </div>
          {tableTab === 'tenants' && tenants && tenants.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => exportTenantsCsv(tenants, from, to)}>
              <Download className="w-4 h-4 me-1" />
              تصدير CSV
            </Button>
          )}
        </div>
        {tableTab === 'tenants' && (
          tenantsLoading ? (
            <div className="p-12 text-center text-gray-500">جاري التحميل...</div>
          ) : tenants && tenants.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-start font-medium text-gray-700">المستأجر</th>
                    <th className="px-4 py-3 text-end font-medium text-gray-700">الطلبات</th>
                    <th className="px-4 py-3 text-end font-medium text-gray-700">تم التسليم</th>
                    <th className="px-4 py-3 text-end font-medium text-gray-700">إجمالي</th>
                    <th className="px-4 py-3 text-end font-medium text-gray-700">العمولة</th>
                    <th className="px-4 py-3 text-end font-medium text-gray-700">للمستأجر</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t: FinanceTenantRow) => (
                    <tr key={t.tenantId} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-medium">{t.tenantName}</td>
                      <td className="px-4 py-3 text-end">{t.orderCount}</td>
                      <td className="px-4 py-3 text-end">{t.deliveredCount}</td>
                      <td className="px-4 py-3 text-end">{formatMoney(t.gross)}</td>
                      <td className="px-4 py-3 text-end text-gray-600">{formatMoney(t.commission)}</td>
                      <td className="px-4 py-3 text-end font-medium">{formatMoney(t.netToMerchant)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500">لا توجد بيانات</div>
          )
        )}
        {tableTab === 'couriers' && (
          couriersLoading ? (
            <div className="p-12 text-center text-gray-500">جاري التحميل...</div>
          ) : couriers && couriers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-start font-medium text-gray-700">السائق</th>
                    <th className="px-4 py-3 text-end font-medium text-gray-700">تم التسليم</th>
                    <th className="px-4 py-3 text-end font-medium text-gray-700">نقداً محصل</th>
                    <th className="px-4 py-3 text-end font-medium text-gray-700">نقداً معلق</th>
                    <th className="px-4 py-3 text-end font-medium text-gray-700">قيد التوصيل</th>
                  </tr>
                </thead>
                <tbody>
                  {couriers.map((c: FinanceCourierRow) => (
                    <tr key={c.courierId} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-medium">{c.courierName}</td>
                      <td className="px-4 py-3 text-end">{c.deliveredCount}</td>
                      <td className="px-4 py-3 text-end text-emerald-600">{formatMoney(c.cashCollectedGross)}</td>
                      <td className="px-4 py-3 text-end text-amber-600">{formatMoney(c.outstandingGross)}</td>
                      <td className="px-4 py-3 text-end text-blue-600">{formatMoney(c.activeUncollectedGross ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500">لا توجد بيانات</div>
          )
        )}
      </Card>
    </div>
  );
}
