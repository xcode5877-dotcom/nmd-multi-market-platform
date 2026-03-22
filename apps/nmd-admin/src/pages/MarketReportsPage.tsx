import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Modal, Input, useToast, Tabs, TabsList, TabsTrigger, TabsContent } from '@nmd/ui';
import { MockApiClient } from '@nmd/mock';
import { formatPrice } from '@nmd/core';
import { ArrowLeft, BarChart3, Store, Trophy, Wallet, Banknote } from 'lucide-react';
import { useState, useMemo } from 'react';
import { apiHeaders } from '../api';

const api = new MockApiClient();
const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

const RANGE_OPTIONS = [
  { id: 'today', label: 'اليوم', getRange: () => { const d = new Date(); const s = d.toISOString().slice(0, 10); return { from: s, to: s }; } },
  { id: '7d', label: '7 أيام', getRange: () => { const to = new Date(); const from = new Date(to); from.setDate(from.getDate() - 6); return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }; } },
  { id: 'month', label: 'الشهر', getRange: () => { const d = new Date(); const to = d.toISOString().slice(0, 10); const from = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); return { from, to }; } },
  { id: 'custom', label: 'مخصص', getRange: () => null },
];

export default function MarketReportsPage() {
  const { id: marketId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addToast = useToast().addToast;
  const [rangeId, setRangeId] = useState('7d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [activeTab, setActiveTab] = useState('daily');
  const [settleModal, setSettleModal] = useState<{ courierId: string; courierName: string } | null>(null);
  const [settleAmount, setSettleAmount] = useState('');

  const { from, to } = useMemo(() => {
    if (rangeId === 'custom') return { from: customFrom || undefined, to: customTo || undefined };
    const opt = RANGE_OPTIONS.find((r) => r.id === rangeId);
    const r = opt?.getRange();
    return r ?? { from: undefined, to: undefined };
  }, [rangeId, customFrom, customTo]);

  const { data: market } = useQuery({
    queryKey: ['market', marketId],
    queryFn: () => fetch(`${MOCK_API_URL}/markets/${marketId}`, { headers: apiHeaders() }).then((r) => (r.ok ? r.json() : Promise.reject(new Error('Not found')))),
    enabled: !!marketId && !!MOCK_API_URL,
  });

  const { data: dailySummary, isLoading: dailyLoading, isError: dailyError } = useQuery({
    queryKey: ['reports-daily', marketId, from, to],
    queryFn: () => api.getReportsDailySummary(marketId!, from, to),
    enabled: !!marketId && !!MOCK_API_URL,
  });

  const { data: merchantPerf, isLoading: merchantLoading, isError: merchantError } = useQuery({
    queryKey: ['reports-merchant', marketId, from, to],
    queryFn: () => api.getReportsMerchantPerformance(marketId!, from, to),
    enabled: !!marketId && !!MOCK_API_URL,
  });

  const { data: driverLeaderboard, isLoading: driverLoading, isError: driverError } = useQuery({
    queryKey: ['reports-leaderboard', marketId, from, to],
    queryFn: () => api.getReportsDriverLeaderboard(marketId!, from, to),
    enabled: !!marketId && !!MOCK_API_URL,
  });

  const { data: settlementLog, isLoading: settlementLoading, isError: settlementError } = useQuery({
    queryKey: ['reports-settlement', marketId],
    queryFn: () => api.getReportsSettlementLog(marketId!),
    enabled: !!marketId && !!MOCK_API_URL,
  });

  const settleMutation = useMutation({
    mutationFn: ({ courierId, totalCollected }: { courierId: string; totalCollected: number }) => api.settleCourier(courierId, totalCollected),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports-settlement', marketId] });
      addToast('تم تسجيل التسوية', 'success');
      setSettleModal(null);
      setSettleAmount('');
    },
    onError: (e) => addToast(e instanceof Error ? e.message : 'فشل', 'error'),
  });

  const handleSettle = () => {
    if (!settleModal) return;
    const num = parseFloat(settleAmount);
    if (Number.isNaN(num) || num < 0) {
      addToast('أدخل مبلغاً صالحاً', 'error');
      return;
    }
    settleMutation.mutate({ courierId: settleModal.courierId, totalCollected: num });
  };

  if (!marketId || !MOCK_API_URL) {
    return (
      <div className="py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate('/markets')}>Back</Button>
        <p className="p-4 text-amber-800">Set VITE_MOCK_API_URL</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/markets/${marketId}`)}><ArrowLeft className="w-4 h-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">التقارير المالية والتسويات</h1>
          <p className="text-sm text-gray-500">{market?.name ?? ''}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        {RANGE_OPTIONS.map((r) => (
          <Button key={r.id} size="sm" variant={rangeId === r.id ? 'primary' : 'outline'} onClick={() => setRangeId(r.id)}>{r.label}</Button>
        ))}
        {rangeId === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 px-2 rounded border border-gray-300 text-sm" />
            <span className="text-gray-500">–</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9 px-2 rounded border border-gray-300 text-sm" />
          </div>
        )}
      </div>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="daily">ملخص يومي</TabsTrigger>
          <TabsTrigger value="merchant">أداء المحلات</TabsTrigger>
          <TabsTrigger value="driver">ترتيب السائقين</TabsTrigger>
          <TabsTrigger value="settlement">سجل التسويات</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="mt-4">
          <Card className="p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5" /> ملخص يومي</h2>
            {dailyLoading ? <div className="animate-pulse h-32 bg-gray-100 rounded flex items-center justify-center text-gray-500">جاري التحميل...</div> : dailyError ? <p className="text-red-600">فشل تحميل البيانات</p> : dailySummary ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-gray-50"><div className="text-xs text-gray-500">إجمالي الطلبات</div><div className="text-xl font-bold">{dailySummary.totalOrders}</div></div>
                <div className="p-3 rounded-lg bg-blue-50"><div className="text-xs text-blue-700">توصيل</div><div className="text-xl font-bold text-blue-800">{dailySummary.deliveryOrders}</div></div>
                <div className="p-3 rounded-lg bg-amber-50"><div className="text-xs text-amber-700">استلام</div><div className="text-xl font-bold text-amber-800">{dailySummary.pickupOrders}</div></div>
                <div className="p-3 rounded-lg bg-gray-50"><div className="text-xs text-gray-500">إجمالي الإيرادات</div><div className="text-xl font-bold">{formatPrice(dailySummary.totalRevenue)}</div></div>
                <div className="p-3 rounded-lg bg-gray-50"><div className="text-xs text-gray-500">مبيعات المحلات</div><div className="text-lg font-semibold">{formatPrice(dailySummary.totalMerchantSales)}</div></div>
                <div className="p-3 rounded-lg bg-gray-50"><div className="text-xs text-gray-500">رسوم التوصيل</div><div className="text-lg font-semibold">{formatPrice(dailySummary.totalDeliveryFees)}</div></div>
                <div className="p-3 rounded-lg bg-emerald-50 col-span-2"><div className="flex items-center gap-1 text-xs text-emerald-700"><Banknote className="w-4 h-4" /> التدفق النقدي</div><div className="text-xl font-bold text-emerald-800">{formatPrice(dailySummary.dailyCashFlow)}</div></div>
              </div>
            ) : <p className="text-gray-500">لا توجد بيانات</p>}
          </Card>
        </TabsContent>

        <TabsContent value="merchant" className="mt-4">
          <Card className="p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Store className="w-5 h-5" /> أداء المحلات</h2>
            {merchantLoading ? <div className="animate-pulse h-32 bg-gray-100 rounded flex items-center justify-center text-gray-500">جاري التحميل...</div> : merchantError ? <p className="text-red-600">فشل تحميل البيانات</p> : merchantPerf && merchantPerf.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead><tr className="border-b border-gray-200"><th className="px-4 py-2 font-medium text-gray-700">المحل</th><th className="px-4 py-2 font-medium text-gray-700">الطلبات</th><th className="px-4 py-2 font-medium text-gray-700">مبيعات</th><th className="px-4 py-2 font-medium text-gray-700">رسوم التوصيل</th></tr></thead>
                  <tbody>
                    {merchantPerf.map((row) => (
                      <tr key={row.tenantId} className="border-b border-gray-100"><td className="px-4 py-2 font-medium">{row.tenantName}</td><td className="px-4 py-2">{row.orderCount}</td><td className="px-4 py-2">{formatPrice(row.sales)}</td><td className="px-4 py-2">{formatPrice(row.deliveryFees)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-gray-500">لا توجد بيانات</p>}
          </Card>
        </TabsContent>

        <TabsContent value="driver" className="mt-4">
          <Card className="p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Trophy className="w-5 h-5" /> ترتيب السائقين</h2>
            {driverLoading ? <div className="animate-pulse h-32 bg-gray-100 rounded flex items-center justify-center text-gray-500">جاري التحميل...</div> : driverError ? <p className="text-red-600">فشل تحميل البيانات</p> : driverLeaderboard && driverLeaderboard.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead><tr className="border-b border-gray-200"><th className="px-4 py-2 font-medium text-gray-700">الترتيب</th><th className="px-4 py-2 font-medium text-gray-700">السائق</th><th className="px-4 py-2 font-medium text-gray-700">التوصيلات</th><th className="px-4 py-2 font-medium text-gray-700">كوبا</th><th className="px-4 py-2 font-medium text-gray-700">المبلغ المحصل (كاش)</th><th className="px-4 py-2 font-medium text-gray-700">المطلوب تسليمه</th><th className="px-4 py-2 font-medium text-gray-700">إجراء</th></tr></thead>
                  <tbody>
                    {driverLeaderboard.map((row) => {
                      const float = row.initialFloat ?? 300;
                      const cash = row.totalCashCollected ?? 0;
                      const totalDue = float + cash;
                      return (
                        <tr key={row.courierId} className="border-b border-gray-100">
                          <td className="px-4 py-2 font-bold">#{row.rank}</td>
                          <td className="px-4 py-2 font-medium">{row.courierName}</td>
                          <td className="px-4 py-2">{row.deliveryCount}</td>
                          <td className="px-4 py-2">{formatPrice(float)}</td>
                          <td className="px-4 py-2">{formatPrice(cash)}</td>
                          <td className="px-4 py-2 font-bold text-emerald-700">{formatPrice(totalDue)}</td>
                          <td className="px-4 py-2"><Button size="sm" variant="outline" onClick={() => setSettleModal({ courierId: row.courierId, courierName: row.courierName })}>تسوية</Button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-gray-500">لا يوجد سائقون أو لا توجد توصيلات</p>}
          </Card>
        </TabsContent>

        <TabsContent value="settlement" className="mt-4">
          <Card className="p-6">
            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Wallet className="w-5 h-5" /> سجل تسويات الكوبا</h2>
            {settlementLoading ? <div className="animate-pulse h-32 bg-gray-100 rounded flex items-center justify-center text-gray-500">جاري التحميل...</div> : settlementError ? <p className="text-red-600">فشل تحميل البيانات</p> : settlementLog && settlementLog.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead><tr className="border-b border-gray-200"><th className="px-4 py-2 font-medium text-gray-700">التاريخ</th><th className="px-4 py-2 font-medium text-gray-700">السائق</th><th className="px-4 py-2 font-medium text-gray-700">المبلغ</th></tr></thead>
                  <tbody>
                    {settlementLog.map((e) => (
                      <tr key={e.id} className="border-b border-gray-100"><td className="px-4 py-2">{e.timestamp ? new Date(e.timestamp).toLocaleString('ar-EG') : '—'}</td><td className="px-4 py-2">{e.courierName ?? e.courierId}</td><td className="px-4 py-2 font-semibold">{formatPrice(e.totalCollected)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-gray-500">لا توجد تسويات</p>}
          </Card>
        </TabsContent>
      </Tabs>

      {settleModal && (
        <Modal open={!!settleModal} onClose={() => { setSettleModal(null); setSettleAmount(''); }} title={'تسوية كوبا — ' + settleModal.courierName}>
          <div className="space-y-4"><Input label="المبلغ المسلّم" type="number" min={0} value={settleAmount} onChange={(e) => setSettleAmount(e.target.value)} placeholder="0" /></div>
          <div className="mt-6 flex gap-2 justify-end">
            <Button variant="outline" onClick={() => { setSettleModal(null); setSettleAmount(''); }}>إلغاء</Button>
            <Button onClick={handleSettle} loading={settleMutation.isPending}>تسجيل التسوية</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
