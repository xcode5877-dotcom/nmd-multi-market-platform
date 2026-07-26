import { useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Input, Select, Skeleton, useToast, Modal } from '@nmd/ui';
import { formatPrice } from '@nmd/core';
import {
  Wallet,
  ArrowLeft,
  Download,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { apiHeaders } from '../../api';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

type Dashboard = {
  driverCollectionsToday: number;
  pendingCollections: number;
  settledToday: number;
  deliveryFeesToday: number;
  platformCommissionsToday: number;
};

type DriverSummary = {
  courierId: string;
  courierName: string;
  marketId?: string;
  completedOrders: number;
  externalOrders: number;
  appOrders: number;
  deliveryFeesTotal: number;
  platformCommissionTotal: number;
  driverCollectionTotal: number;
  todayCollection: number;
  currentShiftCollection: number;
  outstandingCollection: number;
  settledCollection: number;
  pendingOrders: number;
  settledOrders: number;
};

type OrderRow = {
  orderId: string;
  isExternal: boolean;
  deliveryFee: number;
  platformCommission: number;
  driverCollectionAmount: number;
  orderTotal: number;
  restaurantShare: number;
  settlementStatus: 'PENDING' | 'SETTLED';
  settledAt?: string;
  createdAt?: string;
  deliveredAt?: string;
};

type SettlementRow = {
  id: string;
  courierId: string;
  courierName?: string;
  amount: number;
  deliveryFeesTotal: number;
  platformCommissionTotal: number;
  ordersCount: number;
  settledAt: string;
  settledBy: string;
  settlementReference?: string;
  settlementNotes?: string;
  shiftLabel?: string;
  status: string;
};

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${MOCK_API_URL}${path}`, { headers: apiHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

function exportDriversCsv(rows: DriverSummary[]): void {
  const headers = [
    'Driver',
    'Orders',
    'Delivery Fees',
    'Platform Commission',
    'Driver Collection',
    'Settlement Status',
    'Outstanding',
    'Settled',
  ];
  const lines = rows.map((r) => [
    r.courierName,
    r.completedOrders,
    r.deliveryFeesTotal,
    r.platformCommissionTotal,
    r.driverCollectionTotal,
    r.outstandingCollection > 0 ? 'Pending' : 'Settled',
    r.outstandingCollection,
    r.settledCollection,
  ]);
  const csv = [headers.join(','), ...lines.map((r) => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `driver-collections-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function DashboardCards({ data }: { data?: Dashboard }) {
  const cards = [
    { label: 'تحصيل السائقين اليوم', value: data?.driverCollectionsToday ?? 0 },
    { label: 'تحصيل معلّق', value: data?.pendingCollections ?? 0, tone: 'amber' },
    { label: 'تم التسوية اليوم', value: data?.settledToday ?? 0, tone: 'emerald' },
    { label: 'رسوم التوصيل اليوم', value: data?.deliveryFeesToday ?? 0 },
    { label: 'عمولة المنصة اليوم', value: data?.platformCommissionsToday ?? 0 },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {cards.map((c) => (
        <Card key={c.label} className="p-4">
          <p className="text-xs text-gray-500">{c.label}</p>
          <p
            className={`text-xl font-bold tabular-nums ${
              c.tone === 'amber'
                ? 'text-amber-800'
                : c.tone === 'emerald'
                  ? 'text-emerald-800'
                  : 'text-gray-900'
            }`}
          >
            {formatPrice(c.value)}
          </p>
        </Card>
      ))}
    </div>
  );
}

function DriverDetailPanel({ courierId }: { courierId: string }) {
  const { addToast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [settleOpen, setSettleOpen] = useState(false);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [shiftLabel, setShiftLabel] = useState('Morning');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['driver-collection-detail', courierId],
    queryFn: () =>
      fetchJson<{
        courier: { id: string; name: string };
        summary: DriverSummary | null;
        orders: OrderRow[];
        settlements: SettlementRow[];
        activeShiftStart: string | null;
      }>(`/admin/driver-collections/${courierId}`),
    enabled: !!MOCK_API_URL && !!courierId,
  });

  const settleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `${MOCK_API_URL}/admin/driver-collections/${courierId}/settle`,
        {
          method: 'POST',
          headers: { ...apiHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            settlementReference: reference || undefined,
            settlementNotes: notes || undefined,
            shiftLabel: shiftLabel || undefined,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'فشل التسوية');
      }
      return res.json();
    },
    onSuccess: () => {
      addToast('تم تسجيل التسوية', 'success');
      setSettleOpen(false);
      setReference('');
      setNotes('');
      qc.invalidateQueries({ queryKey: ['driver-collections'] });
      qc.invalidateQueries({ queryKey: ['driver-collection-detail', courierId] });
      qc.invalidateQueries({ queryKey: ['driver-collection-settlements'] });
    },
    onError: (e) => addToast(e instanceof Error ? e.message : 'فشل', 'error'),
  });

  const selected = data?.orders.find((o) => o.orderId === selectedOrderId);
  const summary = data?.summary;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => navigate('/drivers/collections')}
          className="inline-flex items-center gap-1 text-sm text-teal-700 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          كل السائقين
        </button>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            size="sm"
            disabled={!summary || summary.outstandingCollection <= 0}
            onClick={() => setSettleOpen(true)}
          >
            تسوية التحصيل
          </Button>
        </div>
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <Card className="p-5 space-y-3">
            <h2 className="text-xl font-bold text-gray-900">{data.courier.name}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-gray-500">الطلبات المكتملة</p>
                <p className="text-lg font-bold tabular-nums">{summary?.completedOrders ?? 0}</p>
              </div>
              <div>
                <p className="text-gray-500">رسوم التوصيل</p>
                <p className="text-lg font-bold">{formatPrice(summary?.deliveryFeesTotal ?? 0)}</p>
              </div>
              <div>
                <p className="text-gray-500">عمولة المنصة</p>
                <p className="text-lg font-bold">{formatPrice(summary?.platformCommissionTotal ?? 0)}</p>
              </div>
              <div>
                <p className="text-gray-500">تحصيل السائق</p>
                <p className="text-lg font-bold text-teal-800">
                  {formatPrice(summary?.driverCollectionTotal ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-gray-500">تحصيل اليوم</p>
                <p className="text-lg font-bold">{formatPrice(summary?.todayCollection ?? 0)}</p>
              </div>
              <div>
                <p className="text-gray-500">الوردية الحالية</p>
                <p className="text-lg font-bold">
                  {formatPrice(summary?.currentShiftCollection ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-gray-500">معلّق</p>
                <p className="text-lg font-bold text-amber-800">
                  {formatPrice(summary?.outstandingCollection ?? 0)}
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              إيراد المطعم مخفي هنا — يظهر فقط داخل تفاصيل الطلب.
            </p>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-3">الطلبات — عمود التحصيل (ليس إجمالي الطلب)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2">الطلب</th>
                    <th className="px-3 py-2">النوع</th>
                    <th className="px-3 py-2">تحصيل السائق</th>
                    <th className="px-3 py-2">الحالة</th>
                    <th className="px-3 py-2">تفاصيل</th>
                  </tr>
                </thead>
                <tbody>
                  {data.orders.map((o) => (
                    <tr key={o.orderId} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-mono text-xs">{o.orderId.slice(0, 12)}</td>
                      <td className="px-3 py-2">{o.isExternal ? 'خارجي' : 'تطبيق'}</td>
                      <td className="px-3 py-2 font-semibold text-teal-800">
                        {formatPrice(o.driverCollectionAmount)}
                        <span className="block text-[11px] text-gray-500 font-normal">
                          {o.isExternal
                            ? 'رسوم توصيل'
                            : 'توصيل + عمولة المنصة'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {o.settlementStatus === 'SETTLED' ? (
                          <span className="text-emerald-700 text-xs font-medium">تم التسوية</span>
                        ) : (
                          <span className="text-amber-700 text-xs font-medium">معلّق</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="text-teal-700 text-xs hover:underline"
                          onClick={() => setSelectedOrderId(o.orderId)}
                        >
                          عرض
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.orders.length === 0 && (
                <p className="text-center text-gray-500 py-6">لا توجد طلبات</p>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-3">سجل التسويات</h3>
            {data.settlements.length === 0 ? (
              <p className="text-sm text-gray-500">لا يوجد سجل بعد</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {data.settlements.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap justify-between gap-2 border border-gray-100 rounded-lg p-3"
                  >
                    <div>
                      <p className="font-medium">{formatPrice(s.amount)}</p>
                      <p className="text-xs text-gray-500">
                        {s.ordersCount} طلبات · {s.shiftLabel || '—'} ·{' '}
                        {new Date(s.settledAt).toLocaleString('ar')}
                      </p>
                      {s.settlementReference && (
                        <p className="text-xs text-gray-500">مرجع: {s.settlementReference}</p>
                      )}
                      {s.settlementNotes && (
                        <p className="text-xs text-gray-500">{s.settlementNotes}</p>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Settled
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelectedOrderId(null)}
        title="تفاصيل المحاسبة"
      >
        {selected && (
          <div className="space-y-2 text-sm">
            <Row label="إجمالي الطلب" value={formatPrice(selected.orderTotal)} />
            <Row label="رسوم التوصيل" value={formatPrice(selected.deliveryFee)} />
            <Row label="عمولة المنصة" value={formatPrice(selected.platformCommission)} />
            <Row
              label="تحصيل السائق"
              value={formatPrice(selected.driverCollectionAmount)}
              emphasis
            />
            <Row label="حصة المطعم" value={formatPrice(selected.restaurantShare)} />
            <p className="text-xs text-gray-500 pt-2">
              حصة المطعم للعرض التفصيلي فقط — ليست جزءاً من محاسبة السائق.
            </p>
          </div>
        )}
      </Modal>

      <Modal open={settleOpen} onClose={() => setSettleOpen(false)} title="تسوية تحصيل السائق">
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            المبلغ المعلّق:{' '}
            <strong>{formatPrice(summary?.outstandingCollection ?? 0)}</strong>
          </p>
          <div>
            <label className="text-xs text-gray-500">الوردية</label>
            <Input value={shiftLabel} onChange={(e) => setShiftLabel(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">مرجع التسوية</label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500">ملاحظات</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSettleOpen(false)}>
              إلغاء
            </Button>
            <Button
              loading={settleMutation.isPending}
              onClick={() => settleMutation.mutate()}
            >
              تأكيد التسوية
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Row({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-gray-50 py-1.5">
      <span className="text-gray-500">{label}</span>
      <span className={emphasis ? 'font-bold text-teal-800' : 'font-medium'}>{value}</span>
    </div>
  );
}

export default function DriverCollectionsPage() {
  const { driverId } = useParams<{ driverId?: string }>();
  const [preset, setPreset] = useState('today');
  const [settlementStatus, setSettlementStatus] = useState('ALL');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [search, setSearch] = useState('');

  const queryPath = useMemo(() => {
    const params = new URLSearchParams();
    if (preset === 'today' || preset === 'yesterday') params.set('preset', preset);
    if (preset === 'currentShift') params.set('currentShift', '1');
    if (preset === 'range') {
      if (customFrom) params.set('from', customFrom);
      if (customTo) params.set('to', customTo);
    }
    if (settlementStatus !== 'ALL') params.set('settlementStatus', settlementStatus);
    const q = params.toString();
    return `/admin/driver-collections${q ? `?${q}` : ''}`;
  }, [preset, settlementStatus, customFrom, customTo]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['driver-collections', queryPath],
    queryFn: () =>
      fetchJson<{ drivers: DriverSummary[]; dashboard: Dashboard }>(queryPath),
    enabled: !!MOCK_API_URL && !driverId,
  });

  const { data: history = [] } = useQuery({
    queryKey: ['driver-collection-settlements'],
    queryFn: () => fetchJson<SettlementRow[]>('/admin/driver-collections/settlements'),
    enabled: !!MOCK_API_URL && !driverId,
  });

  const drivers = useMemo(() => {
    const rows = data?.drivers ?? [];
    const q = search.trim();
    if (!q) return rows;
    return rows.filter((r) => r.courierName.includes(q) || r.courierId.includes(q));
  }, [data?.drivers, search]);

  if (driverId) {
    return <DriverDetailPanel courierId={driverId} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            محاسبة تحصيل السائقين
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            تحصيل Now Market فقط = رسوم التوصيل (+ عمولة المنصة لطلبات التطبيق). بدون إجمالي الطلب /
            إيراد المطعم.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportDriversCsv(drivers)}>
            <Download className="w-4 h-4" />
            تصدير
          </Button>
        </div>
      </div>

      <DashboardCards data={data?.dashboard} />

      <div className="flex flex-wrap gap-2 items-end">
        {[
          { id: 'today', label: 'اليوم' },
          { id: 'yesterday', label: 'أمس' },
          { id: 'currentShift', label: 'الوردية الحالية' },
          { id: 'range', label: 'نطاق تاريخ' },
        ].map((p) => (
          <Button
            key={p.id}
            size="sm"
            variant={preset === p.id ? 'primary' : 'outline'}
            onClick={() => setPreset(p.id)}
          >
            {p.label}
          </Button>
        ))}
        <Select
          value={settlementStatus}
          onChange={(e) => setSettlementStatus(e.target.value)}
          options={[
            { value: 'ALL', label: 'كل الحالات' },
            { value: 'PENDING', label: 'معلّق' },
            { value: 'SETTLED', label: 'تم التسوية' },
          ]}
        />
        <Input
          placeholder="بحث سائق..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        {preset === 'range' && (
          <>
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </>
        )}
      </div>

      <Card className="p-4">
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : isError ? (
          <p className="text-red-600 text-center py-6">فشل تحميل البيانات</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2">السائق</th>
                  <th className="px-3 py-2">مكتمل</th>
                  <th className="px-3 py-2">خارجي</th>
                  <th className="px-3 py-2">تطبيق</th>
                  <th className="px-3 py-2">رسوم التوصيل</th>
                  <th className="px-3 py-2">عمولة المنصة</th>
                  <th className="px-3 py-2">تحصيل السائق</th>
                  <th className="px-3 py-2">اليوم</th>
                  <th className="px-3 py-2">الوردية</th>
                  <th className="px-3 py-2">معلّق</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {drivers.map((r) => (
                  <tr key={r.courierId} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-medium">{r.courierName}</td>
                    <td className="px-3 py-2 tabular-nums">{r.completedOrders}</td>
                    <td className="px-3 py-2 tabular-nums">{r.externalOrders}</td>
                    <td className="px-3 py-2 tabular-nums">{r.appOrders}</td>
                    <td className="px-3 py-2">{formatPrice(r.deliveryFeesTotal)}</td>
                    <td className="px-3 py-2">{formatPrice(r.platformCommissionTotal)}</td>
                    <td className="px-3 py-2 font-semibold text-teal-800">
                      {formatPrice(r.driverCollectionTotal)}
                    </td>
                    <td className="px-3 py-2">{formatPrice(r.todayCollection)}</td>
                    <td className="px-3 py-2">{formatPrice(r.currentShiftCollection)}</td>
                    <td className="px-3 py-2 text-amber-800">
                      {formatPrice(r.outstandingCollection)}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        to={`/drivers/collections/${r.courierId}`}
                        className="text-teal-700 text-xs hover:underline"
                      >
                        تفاصيل
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {drivers.length === 0 && (
              <p className="text-center text-gray-500 py-8">لا توجد بيانات</p>
            )}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-3">سجل التسويات (لا يُحذف)</h3>
        {history.length === 0 ? (
          <p className="text-sm text-gray-500">لا يوجد سجل</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2">السائق</th>
                  <th className="px-3 py-2">المبلغ</th>
                  <th className="px-3 py-2">التاريخ</th>
                  <th className="px-3 py-2">المدير</th>
                  <th className="px-3 py-2">ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {history.slice(0, 50).map((s) => (
                  <tr key={s.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">{s.courierName ?? s.courierId}</td>
                    <td className="px-3 py-2 font-medium">{formatPrice(s.amount)}</td>
                    <td className="px-3 py-2 text-xs">
                      {new Date(s.settledAt).toLocaleString('ar')}
                    </td>
                    <td className="px-3 py-2 text-xs font-mono">{s.settledBy.slice(0, 10)}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {s.settlementNotes || s.settlementReference || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
