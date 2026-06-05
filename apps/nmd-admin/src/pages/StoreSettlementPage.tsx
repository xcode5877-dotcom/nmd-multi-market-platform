import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Wallet } from 'lucide-react';
import { Card, Button, Input, useToast } from '@nmd/ui';
import { apiFetch } from '../api';
import { formatMoney } from '../lib/economics';

type SettlementReport = {
  period: { from: string; to: string };
  totalCustomerSales: number;
  merchantBaseSubtotal: number;
  platformCommission: number;
  deliveryFees: number;
  pickupCommissionOwedByStore: number;
  deliveryCommissionCollected: number;
  storePaymentsToPlatform: number;
  platformPaymentsToStore: number;
  remainingStoreBalance: number;
  merchantLiability: number;
  orderCount: number;
};

const PRESETS = [
  { id: 'today', label: 'اليوم' },
  { id: 'week', label: 'أسبوع' },
  { id: 'month', label: 'شهر' },
  { id: 'custom', label: 'مخصص' },
] as const;

export default function StoreSettlementPage() {
  const { id: tenantId } = useParams<{ id: string }>();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState<(typeof PRESETS)[number]['id']>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');

  const queryKey = ['settlement-report', tenantId, preset, customFrom, customTo];
  const qs =
    preset === 'custom' && customFrom
      ? `from=${customFrom}&to=${customTo || customFrom}`
      : `preset=${preset}`;

  const { data: report, isLoading } = useQuery({
    queryKey,
    queryFn: () => apiFetch<SettlementReport>(`/tenants/${tenantId}/settlement/summary?${qs}`),
    enabled: !!tenantId,
  });

  const payMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/admin/settlement/stores/${tenantId}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(payAmount),
          paymentMethod: 'CASH',
          note: payNote || undefined,
          direction: 'STORE_TO_PLATFORM',
        }),
      }),
    onSuccess: () => {
      addToast('تم تسجيل الدفعة', 'success');
      setPayAmount('');
      setPayNote('');
      queryClient.invalidateQueries({ queryKey: ['settlement-report', tenantId] });
    },
    onError: (e) => addToast(e instanceof Error ? e.message : 'فشل', 'error'),
  });

  const rows = useMemo(
    () =>
      report
        ? [
            { label: 'إجمالي مبيعات الزبائن', value: report.totalCustomerSales },
            { label: 'أساس التاجر (منتجات)', value: report.merchantBaseSubtotal },
            { label: 'عمولة Now Market', value: report.platformCommission },
            { label: 'رسوم التوصيل', value: report.deliveryFees },
            { label: 'عمولة استلام (مستحق على المتجر)', value: report.pickupCommissionOwedByStore },
            { label: 'عمولة توصيل (محصّلة)', value: report.deliveryCommissionCollected },
            { label: 'مدفوعات المتجر لـ Now Market', value: report.storePaymentsToPlatform },
            { label: 'مدفوعات Now Market للمتجر', value: report.platformPaymentsToStore },
            { label: 'الرصيد المتبقي على المتجر', value: report.remainingStoreBalance, highlight: true },
            { label: 'مستحقات التاجر (دفع إلكتروني)', value: report.merchantLiability },
          ]
        : [],
    [report]
  );

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto" dir="rtl">
      <Link to={`/tenants/${tenantId}`} className="inline-flex items-center gap-1 text-sm text-gray-600 mb-4">
        <ArrowLeft className="w-4 h-4" /> العودة للمتجر
      </Link>
      <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-4">
        <Wallet className="w-5 h-5" /> تسوية المتجر
      </h1>

      <div className="flex flex-wrap gap-2 mb-4">
        {PRESETS.map((p) => (
          <Button
            key={p.id}
            variant={preset === p.id ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setPreset(p.id)}
          >
            {p.label}
          </Button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="flex flex-wrap gap-2 mb-4">
          <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
        </div>
      )}

      <Card className="p-4 mb-6">
        {isLoading ? (
          <p className="text-gray-500">جاري التحميل...</p>
        ) : !report ? (
          <p className="text-gray-500">لا توجد بيانات</p>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="text-gray-500 mb-2">طلبات مكتملة: {report.orderCount}</p>
            {rows.map((r) => (
              <div
                key={r.label}
                className={`flex justify-between ${r.highlight ? 'font-bold text-primary pt-2 border-t' : ''}`}
              >
                <span className="text-gray-600">{r.label}</span>
                <span className="tabular-nums">{formatMoney(r.value)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-3">تسجيل دفعة من المتجر</h2>
        <div className="grid gap-3 max-w-sm">
          <Input
            type="number"
            min={0}
            step={1}
            placeholder="المبلغ ₪"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
          />
          <Input placeholder="ملاحظة" value={payNote} onChange={(e) => setPayNote(e.target.value)} />
          <Button
            onClick={() => payMutation.mutate()}
            disabled={payMutation.isPending || !payAmount || Number(payAmount) <= 0}
          >
            {payMutation.isPending ? 'جاري الحفظ...' : 'تسجيل دفعة STORE → Now Market'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
