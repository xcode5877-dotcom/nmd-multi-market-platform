import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Skeleton, Modal, Input } from '@nmd/ui';
import { formatPrice } from '@nmd/core';
import { Wallet, Gift, Check, X, Download, Banknote } from 'lucide-react';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';
const API_KEY = import.meta.env.VITE_API_KEY ?? '';

type DriverRow = {
  courierId: string;
  name: string;
  marketId: string;
  hourlyRate: number;
  hoursWorked: number;
  deliveryEarnings: number;
  commissionEarnings: number;
  bonuses: number;
  expenses: number;
  hourlyPay: number;
  netTotal: number;
  ordersCount: number;
  outstandingBalance: number;
};

type PlatformSummary = {
  today: { netTotal: number };
  week: { netTotal: number };
  month: { netTotal: number };
  outstandingBalance: number;
};

type PayrollResponse = {
  from: string;
  to: string;
  platformSummary: PlatformSummary;
  drivers: DriverRow[];
};

type PendingExpense = {
  id: string;
  courierId: string;
  courierName: string;
  category: string;
  amount: number;
  note?: string | null;
  status: string;
  createdAt: string;
};

const RANGE_OPTIONS = [
  { id: 'today', label: 'اليوم', period: 'today' },
  { id: 'week', label: 'الأسبوع', period: 'week' },
  { id: 'month', label: 'الشهر', period: 'month' },
] as const;

function getToken(): string | null {
  return localStorage.getItem('nmd-access-token');
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${MOCK_API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(API_KEY ? { 'x-api-key': API_KEY } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function escapeCsvCell(value: string | number): string {
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildPayrollCsv(data: PayrollResponse): string {
  const header = [
    'driverName',
    'periodStart',
    'periodEnd',
    'hours',
    'hourlyRate',
    'deliveryEarnings',
    'commissionEarnings',
    'bonuses',
    'approvedExpenses',
    'netTotal',
    'outstandingBalance',
  ];
  const rows = data.drivers.map((d) =>
    [
      d.name,
      data.from,
      data.to,
      d.hoursWorked.toFixed(2),
      d.hourlyRate,
      d.deliveryEarnings.toFixed(2),
      d.commissionEarnings.toFixed(2),
      d.bonuses.toFixed(2),
      d.expenses.toFixed(2),
      d.netTotal.toFixed(2),
      d.outstandingBalance.toFixed(2),
    ].map(escapeCsvCell).join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

function downloadCsv(filename: string, content: string): void {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DriverPayrollFinancePage() {
  const qc = useQueryClient();
  const [rangeId, setRangeId] = useState<(typeof RANGE_OPTIONS)[number]['id']>('week');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [bonusCourier, setBonusCourier] = useState<DriverRow | null>(null);
  const [bonusAmount, setBonusAmount] = useState('');
  const [bonusReason, setBonusReason] = useState('');
  const [settleCourier, setSettleCourier] = useState<DriverRow | null>(null);
  const [settleNotes, setSettleNotes] = useState('');
  const [settleError, setSettleError] = useState<string | null>(null);

  const period = RANGE_OPTIONS.find((r) => r.id === rangeId)?.period ?? 'week';
  const queryKey = ['driver-payroll', period, customFrom, customTo];

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams();
      if (customFrom && customTo) {
        params.set('from', customFrom);
        params.set('to', customTo);
      } else {
        params.set('period', period);
      }
      return adminFetch<PayrollResponse>(`/admin/driver-payroll?${params}`);
    },
    enabled: !!MOCK_API_URL,
  });

  const { data: pendingExpenses = [] } = useQuery({
    queryKey: ['pending-courier-expenses'],
    queryFn: () => adminFetch<PendingExpense[]>('/admin/courier-expenses?status=PENDING'),
    enabled: !!MOCK_API_URL,
  });

  const bonusMutation = useMutation({
    mutationFn: () =>
      adminFetch(`/admin/couriers/${bonusCourier!.courierId}/bonus`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(bonusAmount), reason: bonusReason }),
      }),
    onSuccess: () => {
      setBonusCourier(null);
      setBonusAmount('');
      setBonusReason('');
      qc.invalidateQueries({ queryKey });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => adminFetch(`/admin/courier-expenses/${id}/approve`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-courier-expenses'] });
      qc.invalidateQueries({ queryKey });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => adminFetch(`/admin/courier-expenses/${id}/reject`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pending-courier-expenses'] }),
  });

  const settlePeriod = data ? { from: data.from, to: data.to } : null;

  const { data: settlePreview, isLoading: settlePreviewLoading } = useQuery({
    queryKey: ['settle-preview', settleCourier?.courierId, settlePeriod?.from, settlePeriod?.to],
    queryFn: () =>
      adminFetch<{
        hoursWorked: number;
        hourlyPay: number;
        deliveryEarnings: number;
        commissionEarnings: number;
        bonuses: number;
        expenses: number;
        grossAmount: number;
        netAmount: number;
      }>(
        `/admin/drivers/${settleCourier!.courierId}/payroll-settlement/preview?periodStart=${settlePeriod!.from}&periodEnd=${settlePeriod!.to}`
      ),
    enabled: !!settleCourier && !!settlePeriod,
  });

  const settleMutation = useMutation({
    mutationFn: () =>
      adminFetch(`/admin/drivers/${settleCourier!.courierId}/payroll-settlement`, {
        method: 'POST',
        body: JSON.stringify({
          periodStart: settlePeriod!.from,
          periodEnd: settlePeriod!.to,
          notes: settleNotes.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      setSettleCourier(null);
      setSettleNotes('');
      setSettleError(null);
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ['payroll-settlement-history'] });
    },
    onError: (e: Error) => setSettleError(e.message),
  });

  const totals = useMemo(
    () =>
      (data?.drivers ?? []).reduce(
        (acc, d) => ({
          hours: acc.hours + d.hoursWorked,
          delivery: acc.delivery + d.deliveryEarnings,
          commission: acc.commission + d.commissionEarnings,
          bonuses: acc.bonuses + d.bonuses,
          expenses: acc.expenses + d.expenses,
          net: acc.net + d.netTotal,
          outstanding: acc.outstanding + d.outstandingBalance,
        }),
        { hours: 0, delivery: 0, commission: 0, bonuses: 0, expenses: 0, net: 0, outstanding: 0 }
      ),
    [data]
  );

  const handleExportCsv = () => {
    if (!data) return;
    const csv = buildPayrollCsv(data);
    downloadCsv(`driver-payroll-${data.from}-${data.to}.csv`, csv);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-teal-600" />
            مالية السائقين
          </h2>
          <p className="text-sm text-gray-500 mt-1">تتبع الدخل والدوام — عرض فقط، بدون صرف رواتب</p>
        </div>
        <Button size="sm" variant="outline" onClick={handleExportCsv} disabled={!data?.drivers?.length}>
          <Download className="w-4 h-4 ml-1" />
          تصدير CSV
        </Button>
      </div>

      {data?.platformSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3 border-teal-100 bg-teal-50/50">
            <p className="text-xs text-gray-500">صافي اليوم</p>
            <p className="text-lg font-bold">{formatPrice(data.platformSummary.today.netTotal)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-gray-500">صافي الأسبوع</p>
            <p className="text-lg font-bold">{formatPrice(data.platformSummary.week.netTotal)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-gray-500">صافي الشهر</p>
            <p className="text-lg font-bold">{formatPrice(data.platformSummary.month.netTotal)}</p>
          </Card>
          <Card className="p-3 border-amber-200 bg-amber-50/60">
            <p className="text-xs text-gray-600">المستحق غير المدفوع</p>
            <p className="text-lg font-bold text-amber-900">{formatPrice(data.platformSummary.outstandingBalance)}</p>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-end">
        {RANGE_OPTIONS.map((r) => (
          <Button key={r.id} size="sm" variant={rangeId === r.id && !customFrom ? 'primary' : 'outline'} onClick={() => { setRangeId(r.id); setCustomFrom(''); setCustomTo(''); }}>
            {r.label}
          </Button>
        ))}
        <div className="flex gap-2 items-center ml-auto">
          <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="w-36" />
          <span className="text-gray-400">—</span>
          <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="w-36" />
        </div>
      </div>

      {data && (
        <p className="text-xs text-gray-500">
          الفترة المعروضة: {data.from} → {data.to}
        </p>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
        {[
          { label: 'ساعات', value: totals.hours.toFixed(1) },
          { label: 'أرباح توصيل', value: formatPrice(totals.delivery) },
          { label: 'عمولات', value: formatPrice(totals.commission) },
          { label: 'مكافآت', value: formatPrice(totals.bonuses) },
          { label: 'مصاريف', value: formatPrice(totals.expenses) },
          { label: 'صافي الفترة', value: formatPrice(totals.net) },
          { label: 'مستحق غير مدفوع', value: formatPrice(totals.outstanding) },
        ].map((c) => (
          <Card key={c.label} className="p-3">
            <p className="text-xs text-gray-500">{c.label}</p>
            <p className="text-lg font-bold tabular-nums">{c.value}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-right text-gray-500">
              <th className="p-3 font-medium">السائق</th>
              <th className="p-3 font-medium">ساعات</th>
              <th className="p-3 font-medium">أجر/س</th>
              <th className="p-3 font-medium">توصيل</th>
              <th className="p-3 font-medium">عمولة</th>
              <th className="p-3 font-medium">مكافآت</th>
              <th className="p-3 font-medium">مصاريف</th>
              <th className="p-3 font-medium">صافي</th>
              <th className="p-3 font-medium">مستحق</th>
              <th className="p-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}><td colSpan={10} className="p-3"><Skeleton className="h-8 w-full" /></td></tr>
              ))}
            {isError && (
              <tr><td colSpan={10} className="p-6 text-center text-red-600">تعذّر تحميل البيانات</td></tr>
            )}
            {(data?.drivers ?? []).map((d) => (
              <tr key={d.courierId} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">
                  <Link to={`/drivers/${d.courierId}`} className="text-teal-700 hover:underline">
                    {d.name}
                  </Link>
                </td>
                <td className="p-3 tabular-nums">{d.hoursWorked.toFixed(1)}</td>
                <td className="p-3 tabular-nums">₪{d.hourlyRate}</td>
                <td className="p-3 tabular-nums">{formatPrice(d.deliveryEarnings)}</td>
                <td className="p-3 tabular-nums">{formatPrice(d.commissionEarnings)}</td>
                <td className="p-3 tabular-nums">{formatPrice(d.bonuses)}</td>
                <td className="p-3 tabular-nums text-amber-800">{formatPrice(d.expenses)}</td>
                <td className="p-3 tabular-nums font-bold">{formatPrice(d.netTotal)}</td>
                <td className="p-3 tabular-nums text-amber-900 font-medium">{formatPrice(d.outstandingBalance)}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" onClick={() => { setSettleCourier(d); setSettleError(null); }}>
                      <Banknote className="w-3.5 h-3.5 ml-1" />
                      تسوية
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setBonusCourier(d)}>
                      <Gift className="w-3.5 h-3.5 ml-1" />
                      مكافأة
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {pendingExpenses.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">مصاريف بانتظار الموافقة ({pendingExpenses.length})</h3>
          <div className="space-y-2">
            {pendingExpenses.map((ex) => (
              <div key={ex.id} className="flex flex-wrap items-center justify-between gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
                <div>
                  <p className="font-medium">{ex.courierName} — {ex.category}</p>
                  <p className="text-sm text-gray-600">{formatPrice(ex.amount)} {ex.note ? `· ${ex.note}` : ''}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="primary" onClick={() => approveMutation.mutate(ex.id)} disabled={approveMutation.isPending}>
                    <Check className="w-4 h-4" />
                    موافقة
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => rejectMutation.mutate(ex.id)} disabled={rejectMutation.isPending}>
                    <X className="w-4 h-4" />
                    رفض
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={!!settleCourier} onClose={() => { setSettleCourier(null); setSettleError(null); }} title="تسوية راتب">
        {settleCourier && settlePeriod && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              السائق: <strong>{settleCourier.name}</strong> · الفترة: {settlePeriod.from} → {settlePeriod.to}
            </p>
            {settlePreviewLoading && <Skeleton className="h-24 w-full" />}
            {settlePreview && (
              <div className="grid grid-cols-2 gap-2 text-sm bg-gray-50 rounded-lg p-3">
                <div>ساعات: <strong>{settlePreview.hoursWorked.toFixed(1)}</strong></div>
                <div>أجر ساعي: <strong>{formatPrice(settlePreview.hourlyPay)}</strong></div>
                <div>توصيل: <strong>{formatPrice(settlePreview.deliveryEarnings)}</strong></div>
                <div>عمولات: <strong>{formatPrice(settlePreview.commissionEarnings)}</strong></div>
                <div>مكافآت: <strong>{formatPrice(settlePreview.bonuses)}</strong></div>
                <div>مصاريف: <strong>{formatPrice(settlePreview.expenses)}</strong></div>
                <div className="col-span-2 pt-2 border-t font-bold text-teal-800">
                  صافي التسوية: {formatPrice(settlePreview.netAmount)}
                </div>
              </div>
            )}
            <label className="block text-sm">
              ملاحظات (اختياري)
              <Input value={settleNotes} onChange={(e) => setSettleNotes(e.target.value)} className="mt-1" />
            </label>
            {settleError && <p className="text-sm text-red-600">{settleError}</p>}
            <Button
              variant="primary"
              className="w-full"
              disabled={!settlePreview || settleMutation.isPending}
              onClick={() => settleMutation.mutate()}
            >
              تأكيد التسوية
            </Button>
          </div>
        )}
      </Modal>

      <Modal open={!!bonusCourier} onClose={() => setBonusCourier(null)} title="إضافة مكافأة">
        {bonusCourier && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">السائق: <strong>{bonusCourier.name}</strong></p>
            <label className="block text-sm">
              المبلغ (₪)
              <Input type="number" min={0} step="0.01" value={bonusAmount} onChange={(e) => setBonusAmount(e.target.value)} className="mt-1" />
            </label>
            <label className="block text-sm">
              السبب
              <Input value={bonusReason} onChange={(e) => setBonusReason(e.target.value)} className="mt-1" placeholder="مثال: أداء ممتاز" />
            </label>
            <Button
              variant="primary"
              className="w-full"
              disabled={!bonusAmount || !bonusReason.trim() || bonusMutation.isPending}
              onClick={() => bonusMutation.mutate()}
            >
              إضافة مكافأة
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
