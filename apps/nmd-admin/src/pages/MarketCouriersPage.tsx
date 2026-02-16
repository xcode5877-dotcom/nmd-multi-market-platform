import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Modal, useToast, Skeleton } from '@nmd/ui';
import { MockApiClient } from '@nmd/mock';
import { ArrowLeft, MessageCircle, Phone, Copy } from 'lucide-react';
import { useState, useMemo } from 'react';
import { buildWhatsAppUrl } from '@nmd/core';

const api = new MockApiClient();
const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

export default function MarketCouriersPage() {
  const { id: marketId } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [addCourierModalOpen, setAddCourierModalOpen] = useState(false);
  const [newCourierName, setNewCourierName] = useState('');
  const [newCourierPhone, setNewCourierPhone] = useState('');

  const { data: market } = useQuery({
    queryKey: ['market', marketId],
    queryFn: () => fetch(`${MOCK_API_URL}/markets/${marketId}`, { headers: { Authorization: `Bearer ${localStorage.getItem('nmd-access-token')}` } }).then((r) => r.json()),
    enabled: !!marketId && !!MOCK_API_URL,
  });

  const { data: couriers = [], isLoading: couriersLoading } = useQuery({
    queryKey: ['market-couriers', marketId],
    queryFn: () => api.getMarketCouriers(marketId!),
    enabled: !!marketId && !!MOCK_API_URL,
  });

  const { data: allMarketOrders = [] } = useQuery({
    queryKey: ['market-orders', marketId],
    queryFn: () => api.getMarketOrders(marketId!),
    enabled: !!marketId && !!MOCK_API_URL,
  });

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const courierStats = useMemo(() => {
    const orders = allMarketOrders as { id?: string; courierId?: string; status?: string; deliveredAt?: string }[];
    const delivered = orders.filter((o) => o.status === 'DELIVERED' && o.courierId);
    const map = new Map<string, { deliveriesToday: number; deliveriesTotal: number }>();
    for (const c of couriers as { id: string }[]) {
      const byCourier = delivered.filter((o) => o.courierId === c.id);
      const deliveriesTotal = byCourier.length;
      const deliveriesToday = byCourier.filter((o) => (o.deliveredAt ?? '') >= todayStart).length;
      map.set(c.id, { deliveriesToday, deliveriesTotal });
    }
    return map;
  }, [allMarketOrders, couriers, todayStart]);

  const couriersList = couriers as { id: string; name: string; phone?: string; isOnline: boolean; isActive?: boolean; isAvailable?: boolean }[];
  const createCourierMutation = useMutation({
    mutationFn: () => api.createMarketCourier(marketId!, { name: newCourierName.trim(), phone: newCourierPhone.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market-couriers', marketId] });
      addToast('تم إضافة السائق', 'success');
      setAddCourierModalOpen(false);
      setNewCourierName('');
      setNewCourierPhone('');
    },
    onError: (e) => addToast(e instanceof Error ? e.message : 'فشل', 'error'),
  });

  const copyPhone = (phone: string) => {
    navigator.clipboard?.writeText(phone).then(() => addToast('تم نسخ الرقم', 'success')).catch(() => addToast('فشل النسخ', 'error'));
  };

  if (!marketId || !MOCK_API_URL) return null;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link to={`/markets/${marketId}/dispatch`} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" />
          رجوع للتوصيل
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">سائقو السوق - {market?.name ?? marketId}</h1>
      </div>

      <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-gray-600">سائقو السوق مع إحصائيات التوصيل</span>
          <Button size="sm" onClick={() => setAddCourierModalOpen(true)}>إضافة سائق</Button>
        </div>

        {couriersLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rectangular" className="h-16 w-full" />
            ))}
          </div>
        ) : couriersList.length === 0 ? (
          <p className="text-gray-500 py-8 text-center">لا يوجد سائقون</p>
        ) : (
          <div className="space-y-3">
            {couriersList.map((c) => {
              const stats = courierStats.get(c.id) ?? { deliveriesToday: 0, deliveriesTotal: 0 };
              const available = c.isOnline && c.isActive !== false && c.isAvailable !== false;
              const waUrl = c.phone ? buildWhatsAppUrl(c.phone.replace(/\D/g, '').replace(/^0/, '972'), `مرحباً ${c.name}`) : null;
              return (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
                  <div>
                    <span className="font-medium">{c.name}</span>
                    {c.phone && (
                      <span className="ms-2 text-sm text-gray-600">{c.phone}</span>
                    )}
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded ${available ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {available ? 'متاح' : 'غير متاح'}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                        {stats.deliveriesToday} اليوم
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {stats.deliveriesTotal} إجمالي
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {waUrl && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700"
                      >
                        <MessageCircle className="w-4 h-4" />
                        واتساب
                      </a>
                    )}
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1 px-2 py-1.5 rounded border border-gray-300 text-sm hover:bg-gray-50">
                        <Phone className="w-4 h-4" />
                        اتصال
                      </a>
                    )}
                    {c.phone && (
                      <button type="button" onClick={() => copyPhone(c.phone!)} className="p-1.5 rounded hover:bg-gray-100" title="نسخ الرقم">
                        <Copy className="w-4 h-4 text-gray-500" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal open={addCourierModalOpen} onClose={() => setAddCourierModalOpen(false)} title="إضافة سائق" size="sm">
        <div className="space-y-4">
          <input
            type="text"
            placeholder="الاسم"
            value={newCourierName}
            onChange={(e) => setNewCourierName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
          <input
            type="text"
            placeholder="رقم الجوال"
            value={newCourierPhone}
            onChange={(e) => setNewCourierPhone(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setAddCourierModalOpen(false)}>إلغاء</Button>
            <Button onClick={() => createCourierMutation.mutate()} disabled={!newCourierName.trim() || createCourierMutation.isPending}>
              {createCourierMutation.isPending ? 'جاري...' : 'إضافة'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
