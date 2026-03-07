import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../api';
import { useCourierEvents } from '../hooks/useCourierEvents';
import { useElapsedTimer } from '../hooks/useElapsedTimer';
import { Package, Clock, CheckCircle2, MapPin, Phone } from 'lucide-react';

function mapsUrl(location?: { lat: number; lng: number } | null, address?: string): string {
  if (location?.lat != null && location?.lng != null) {
    return `https://www.google.com/maps?q=${location.lat},${location.lng}`;
  }
  const q = encodeURIComponent((address ?? '').trim() || '');
  return q ? `https://www.google.com/maps/search/?api=1&query=${q}` : '#';
}

function whatsappUrl(phone: string): string {
  const p = phone.replace(/\D/g, '');
  return p ? `https://wa.me/${p.startsWith('972') ? p : '972' + p.replace(/^0/, '')}` : '#';
}

const CURRENCY_SYMBOL: Record<string, string> = { ILS: '₪', SAR: 'ر.س', USD: '$' };

export type CourierOrder = {
  id?: string;
  tenantId?: string;
  courierId?: string;
  status?: string;
  deliveryStatus?: string;
  customerName?: string;
  customerPhone?: string;
  currency?: string;
  orderTotal?: number;
  paymentMethod?: 'CASH' | 'CARD';
  amountToCollect?: number;
  cashChangeFor?: number;
  tenant?: { name?: string; phone?: string; address?: string; location?: { lat: number; lng: number } };
  customer?: { name?: string; phone?: string; deliveryAddress?: string; deliveryLocation?: { lat: number; lng: number }; deliveryZoneName?: string };
  deliveryZoneName?: string;
  deliveryTimeline?: {
    assignedAt?: string;
    acknowledgedAt?: string;
    handedToDriverAt?: string;
    pickedUpAt?: string;
    deliveredAt?: string;
    closedAt?: string;
    durations?: Record<string, number>;
  };
};

type UxStep = 'NEW' | 'IN_PROGRESS' | 'PICKED_UP' | 'DELIVERED';

function getUxStep(o: CourierOrder): UxStep {
  const ds = o.deliveryStatus ?? 'UNASSIGNED';
  if (ds === 'DELIVERED') return 'DELIVERED';
  if (ds === 'PICKED_UP') return 'PICKED_UP';
  if (ds === 'IN_PROGRESS') return 'IN_PROGRESS';
  return 'NEW'; // ASSIGNED or UNASSIGNED
}

function formatTime(iso: string | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

const STEP_LABELS: Record<UxStep, string> = {
  NEW: 'جديد',
  IN_PROGRESS: 'قيد التنفيذ',
  PICKED_UP: 'خارج للتوصيل',
  DELIVERED: 'تم التسليم',
};

const STEP_BADGE_CLASS: Record<UxStep, string> = {
  NEW: 'bg-amber-100 text-amber-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  PICKED_UP: 'bg-purple-100 text-purple-800',
  DELIVERED: 'bg-green-100 text-green-800',
};

const VALID_ACTIONS = ['ACKNOWLEDGE', 'PICKED_UP', 'DELIVERED', 'FINISH'] as const;
const ACTION_ALIASES: Record<string, string> = { START: 'ACKNOWLEDGE', ACCEPT: 'ACKNOWLEDGE' };

const ACTION_LABELS: Record<string, string> = {
  ACKNOWLEDGE: 'بدء التوصيل',
  PICKED_UP: 'تم الاستلام',
  DELIVERED: 'تم التسليم',
  FINISH: 'إنهاء',
};

const ACTIVE_DELIVERY_STATUSES = ['ASSIGNED', 'IN_PROGRESS', 'PICKED_UP'];
const COMPLETED_DELIVERY_STATUSES = ['DELIVERED', 'FINISH'];

function isActiveOrder(o: CourierOrder): boolean {
  const ds = o.deliveryStatus ?? 'UNASSIGNED';
  return ACTIVE_DELIVERY_STATUSES.includes(ds);
}

function isCompletedOrder(o: CourierOrder): boolean {
  const ds = o.deliveryStatus ?? 'UNASSIGNED';
  return COMPLETED_DELIVERY_STATUSES.includes(ds);
}

/** Returns the single allowed action for this order, or null if UNASSIGNED. Uses deliveryStatus only. */
function getAllowedCourierAction(order: CourierOrder): string | null {
  const ds = order.deliveryStatus ?? 'UNASSIGNED';
  if (ds === 'UNASSIGNED') return null;
  if (ds === 'ASSIGNED') return 'ACKNOWLEDGE';
  if (ds === 'IN_PROGRESS') return 'PICKED_UP';
  if (ds === 'PICKED_UP') return 'DELIVERED';
  if (ds === 'DELIVERED') return 'FINISH';
  return null;
}

/** Area/zone first (bold, larger), then address secondary. */
function DeliveryLocationDisplay({ order }: { order: CourierOrder }) {
  const zoneName = order.deliveryZoneName ?? order.customer?.deliveryZoneName ?? '';
  const address = order.customer?.deliveryAddress ?? (order as { deliveryAddress?: string }).deliveryAddress ?? '';
  const primary = zoneName || address;
  const secondary = zoneName && address ? address : null;
  return (
    <div>
      {primary && <p className="font-bold text-base text-gray-900">{primary}</p>}
      {secondary && <p className="text-xs text-gray-500 mt-0.5">{secondary}</p>}
      {!primary && <p className="text-sm text-gray-500">—</p>}
    </div>
  );
}

/** Compact card for open-market available order: show key info + Accept button. */
function AvailableOrderCard({
  order,
  onAccept,
  isPending,
}: {
  order: CourierOrder;
  onAccept: () => void;
  isPending: boolean;
}) {
  const tenant = order.tenant ?? { name: '', phone: undefined, address: undefined };
  const customer = order.customer ?? { name: order.customerName ?? '', deliveryAddress: (order as { deliveryAddress?: string }).deliveryAddress ?? '' };
  const curr = order.currency ?? 'ILS';
  const sym = CURRENCY_SYMBOL[curr] ?? curr;
  const total = order.orderTotal ?? (order as { total?: number }).total ?? 0;
  const statusLabel = order.status === 'READY' ? 'جاهز' : order.status === 'PREPARING' ? 'قيد التحضير' : order.status ?? '—';

  return (
    <div className="p-4 bg-white rounded-xl shadow-sm border border-amber-200 bg-amber-50/30">
      <div className="flex justify-between items-start gap-2">
        <p className="font-mono text-xl font-bold text-gray-900">#{order.id?.slice(0, 8)}</p>
        <span className="text-xs px-2 py-0.5 rounded font-medium bg-amber-100 text-amber-800">{statusLabel}</span>
      </div>
      <div className="mt-2 space-y-2 text-sm">
        <p><span className="text-gray-500">من:</span> <strong>{tenant.name || '—'}</strong></p>
        <div>
          <p><span className="text-gray-500">إلى:</span> <strong>{customer.name || '—'}</strong></p>
          <div className="mt-1">
            <DeliveryLocationDisplay order={order} />
          </div>
        </div>
        <p className="font-medium text-teal-700">{sym}{total}</p>
      </div>
      <button
        type="button"
        onClick={onAccept}
        disabled={isPending}
        className="mt-3 w-full py-2.5 px-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
      >
        {isPending ? 'جاري الاستلام...' : 'استلم الطلب'}
      </button>
    </div>
  );
}

function OrderCard({
  order,
  allowedAction,
  onAction,
  isPending,
}: {
  order: CourierOrder;
  allowedAction: string | null;
  onAction: (order: CourierOrder, action: string) => void;
  isPending: boolean;
}) {
  const step = getUxStep(order);
  const tl = order.deliveryTimeline ?? {};
  const timerStart = tl.acknowledgedAt ?? tl.assignedAt;
  const elapsed = useElapsedTimer(timerStart);

  const tenant = order.tenant ?? { name: '', phone: undefined, address: undefined, location: undefined };
  const customer = order.customer ?? { name: order.customerName ?? '', phone: order.customerPhone ?? '', deliveryAddress: (order as { deliveryAddress?: string }).deliveryAddress ?? '', deliveryLocation: undefined };
  const pickupAddr = tenant.address ?? tenant.name ?? '';
  const dropoffAddr = customer.deliveryAddress ?? '';
  const curr = order.currency ?? 'ILS';
  const sym = CURRENCY_SYMBOL[curr] ?? curr;
  const total = order.orderTotal ?? (order as { total?: number }).total ?? 0;
  const method = order.paymentMethod ?? 'CASH';
  const toCollect = order.amountToCollect ?? (method === 'CASH' ? total : 0);

  const handedToDriverAt = order.deliveryTimeline?.handedToDriverAt;
  const preparationLabel = order.status === 'PREPARING' ? 'قيد التحضير' : 'جاهز وفي الانتظار';
  const canStartDelivery = allowedAction === 'PICKED_UP' && !!handedToDriverAt;

  return (
    <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="flex justify-between items-start">
        <p className="font-mono text-xl font-bold text-gray-900">#{order.id?.slice(0, 8)}</p>
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${STEP_BADGE_CLASS[step]}`}>
          {STEP_LABELS[step]}
        </span>
      </div>

      <div className="mt-3 space-y-2">
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5">
          <p className="text-xs font-medium text-amber-800 mb-1">استلام</p>
          <p className="text-sm font-medium text-gray-900">{tenant.name || '—'}</p>
          <p className="text-xs text-amber-700 mt-0.5">حالة التحضير: {preparationLabel}</p>
          {pickupAddr && <p className="text-xs text-gray-600">{pickupAddr}</p>}
          <div className="mt-1.5 flex gap-2 flex-wrap">
            <a href={mapsUrl(tenant.location, pickupAddr)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium">
              <MapPin className="w-4 h-4" /> التوجه للمحل
            </a>
            <a href={mapsUrl(tenant.location, pickupAddr)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-teal-600 hover:underline">
              خرائط
            </a>
            {tenant.phone && (
              <a href={`tel:${tenant.phone}`} className="inline-flex items-center gap-1 text-xs text-teal-600 hover:underline">
                <Phone className="w-3.5 h-3.5" /> اتصال
              </a>
            )}
          </div>
        </div>
        <div className="rounded-lg bg-green-50 border border-green-200 p-2.5">
          <p className="text-xs font-medium text-green-800 mb-1">توصيل</p>
          <p className="text-sm font-medium text-gray-900">{customer.name || '—'}</p>
          {customer.phone && (
            <div className="flex gap-2 mt-0.5">
              <a href={`tel:${customer.phone}`} className="text-xs text-teal-600 hover:underline">اتصال</a>
              <a href={whatsappUrl(customer.phone)} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-600 hover:underline">واتساب</a>
            </div>
          )}
          <div className="mt-1">
            {order.deliveryZoneName || (customer as { deliveryZoneName?: string }).deliveryZoneName ? (
              <>
                <p className="font-bold text-base text-gray-900">{order.deliveryZoneName ?? (customer as { deliveryZoneName?: string }).deliveryZoneName}</p>
                {dropoffAddr && <p className="text-xs text-gray-500 mt-0.5">{dropoffAddr}</p>}
              </>
            ) : (
              dropoffAddr && <p className="text-sm text-gray-700">{dropoffAddr}</p>
            )}
          </div>
          <a href={mapsUrl(customer.deliveryLocation, dropoffAddr)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-teal-600 hover:underline mt-1">
            <MapPin className="w-3.5 h-3.5" /> خرائط
          </a>
        </div>
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-2.5">
          <p className="text-xs font-medium text-gray-700 mb-1">الدفع</p>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">الإجمالي:</span>
            <span>{sym}{total}</span>
          </div>
          <div className="flex justify-between text-sm mt-0.5">
            <span className="text-gray-600">الطريقة:</span>
            <span>{method === 'CASH' ? 'نقداً' : 'بطاقة'}</span>
          </div>
          {method === 'CASH' && toCollect > 0 && (
            <div className="flex justify-between text-sm mt-1 pt-1 border-t border-gray-200">
              <span className="font-medium text-gray-800">المبلغ المستلم:</span>
              <span className="font-bold text-teal-700">{sym}{toCollect}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
        <Clock className="w-3.5 h-3.5" />
        <span>{formatTime(tl.assignedAt)}</span>
        <span>→</span>
        <span>{formatTime(tl.acknowledgedAt)}</span>
        <span>→</span>
        <span>{formatTime(tl.pickedUpAt)}</span>
        <span>→</span>
        <span>{formatTime(tl.deliveredAt)}</span>
      </div>

      {timerStart && step !== 'DELIVERED' && (
        <div className="mt-2 flex items-center gap-1.5 text-sm text-teal-700 font-medium">
          <Clock className="w-4 h-4" />
          {elapsed}
        </div>
      )}

      {allowedAction && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onAction(order, allowedAction)}
            disabled={isPending || (allowedAction === 'PICKED_UP' && !handedToDriverAt)}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg disabled:opacity-50 flex flex-col items-center justify-center gap-0.5 ${
              allowedAction === 'PICKED_UP'
                ? canStartDelivery
                  ? 'bg-teal-600 hover:bg-teal-700 text-white'
                  : 'bg-white border-2 border-teal-400 text-teal-700 hover:bg-teal-50'
                : allowedAction === 'DELIVERED'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : allowedAction === 'FINISH'
                    ? 'bg-gray-600 hover:bg-gray-700 text-white'
                    : 'bg-teal-600 hover:bg-teal-700 text-white'
            }`}
          >
            <span className="flex items-center gap-1.5">
              {allowedAction === 'FINISH' && <CheckCircle2 className="w-4 h-4" />}
              {ACTION_LABELS[allowedAction] ?? allowedAction}
            </span>
            {allowedAction === 'PICKED_UP' && !canStartDelivery && (
              <span className="text-xs opacity-90">انتظر تسليم الطلب من المحل</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default function CourierOrdersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [finishOrder, setFinishOrder] = useState<CourierOrder | null>(null);
  const [finishNotes, setFinishNotes] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useCourierEvents((event) => {
    if (event.type === 'order_assigned' || event.type === 'order_unassigned') {
      queryClient.invalidateQueries({ queryKey: ['courier-orders'] });
      queryClient.invalidateQueries({ queryKey: ['courier-orders-available'] });
    }
    if (event.type === 'order_ready' && event.orderId) {
      queryClient.invalidateQueries({ queryKey: ['courier-orders-available'] });
      setToastMessage(`Order #${event.orderId.slice(0, 8)} is READY for pickup! Grab it now! 🚀`);
    }
  });

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['courier-orders'],
    queryFn: () => apiFetch<CourierOrder[]>('/courier/orders'),
    enabled: !!user,
    refetchInterval: 6000,
  });

  const { data: availableOrders = [], isLoading: availableLoading } = useQuery({
    queryKey: ['courier-orders-available'],
    queryFn: () => apiFetch<CourierOrder[]>('/courier/orders/available'),
    enabled: !!user,
    refetchInterval: 4000,
  });

  const statusMutation = useMutation({
    mutationFn: async ({ orderId, action, notes }: { orderId: string; action: string; notes?: string }) => {
      const normalized = ACTION_ALIASES[action] ?? action;
      if (import.meta.env.DEV && !VALID_ACTIONS.includes(normalized as (typeof VALID_ACTIONS)[number])) {
        console.warn(`[CourierOrdersPage] Unknown action requested: "${action}" (normalized: "${normalized}")`);
      }
      const body: { action: string; notes?: string } = { action: normalized };
      if (notes != null && notes !== '') body.notes = notes;
      try {
        return await apiFetch(`/courier/orders/${orderId}/status`, { method: 'POST', body });
      } catch (err) {
        const e = err as Error & { status?: number; code?: string; details?: unknown };
        if (e?.status === 409) {
          const code = e?.code;
          if (import.meta.env.DEV) {
            console.warn('[CourierOrdersPage] 409 conflict', { status: e.status, code, details: e.details });
          }
          const msg =
            code === 'ORDER_TAKEN'
              ? 'متأخر! هذا الطلب أخذه بطل آخر.'
              : code === 'CONCURRENCY_CONFLICT'
                ? 'Order changed. Refreshing…'
                : code === 'INVALID_TRANSITION'
                  ? 'Order is not in a valid state for this action. Refreshing…'
                  : 'Conflict. Refreshing…';
          setToastMessage(msg);
          void queryClient.invalidateQueries({ queryKey: ['courier-orders'] });
          void queryClient.invalidateQueries({ queryKey: ['courier-orders-available'] });
          return { __handled409: true } as unknown;
        }
        throw err;
      }
    },
    onSuccess: (data) => {
      if ((data as { __handled409?: boolean })?.__handled409) return;
      queryClient.invalidateQueries({ queryKey: ['courier-orders'] });
      queryClient.invalidateQueries({ queryKey: ['courier-orders-available'] });
      setFinishOrder(null);
      setFinishNotes('');
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (orderId: string) => apiFetch<CourierOrder>(`/courier/orders/${orderId}/accept`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courier-orders'] });
      queryClient.invalidateQueries({ queryKey: ['courier-orders-available'] });
    },
    onError: (err: Error & { status?: number; code?: string }) => {
      if (err?.status === 409 && err?.code === 'ORDER_TAKEN') {
        setToastMessage('متأخر! هذا الطلب أخذه بطل آخر.');
        queryClient.invalidateQueries({ queryKey: ['courier-orders'] });
        queryClient.invalidateQueries({ queryKey: ['courier-orders-available'] });
      } else {
        setToastMessage(err?.message ?? 'فشل في استلام الطلب');
      }
    },
  });

  const handleOrderAction = (order: CourierOrder, action: string) => {
    if (action === 'FINISH') {
      setFinishOrder(order);
      return;
    }
    if (!order.id) return;
    const allowed = getAllowedCourierAction(order);
    if (allowed !== action) return;
    statusMutation.mutate({ orderId: order.id, action });
  };

  const handleFinish = () => {
    if (!finishOrder?.id) return;
    if (getAllowedCourierAction(finishOrder) !== 'FINISH') return;
    statusMutation.mutate({ orderId: finishOrder.id, action: 'FINISH', notes: finishNotes.trim() || undefined });
  };

  if (!user) return null;

  const allOrders = orders.filter((o) => o.status !== 'CANCELED');
  const activeOrders = allOrders.filter(isActiveOrder);
  const completedOrders = allOrders.filter(isCompletedOrder);
  const displayOrders = activeTab === 'active' ? activeOrders : completedOrders;

  const handleAccept = (order: CourierOrder) => {
    if (!order.id) return;
    acceptMutation.mutate(order.id);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-teal-600 text-white p-4 shadow">
        <Link to="/" className="text-sm text-teal-100 hover:text-white">
          ← رجوع
        </Link>
        <h1 className="text-lg font-bold mt-1">طلباتي والتوصيل</h1>
      </header>

      <main className="p-4 max-w-md mx-auto">
        <section className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">طلبات متاحة للاستلام</h2>
          {availableLoading && availableOrders.length === 0 ? (
            <p className="text-gray-500 text-sm py-2">جاري التحميل...</p>
          ) : availableOrders.length === 0 ? (
            <p className="text-gray-500 text-sm py-2">لا توجد طلبات متاحة حالياً. ستظهر هنا الطلبات الجاهزة أو قيد التحضير.</p>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-3">أول من يضغط «استلم» يحصل على الطلب ({availableOrders.length})</p>
              <div className="space-y-3">
                {availableOrders.map((o) => (
                  <AvailableOrderCard
                    key={o.id}
                    order={o}
                    onAccept={() => handleAccept(o)}
                    isPending={acceptMutation.isPending}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        <h2 className="text-sm font-semibold text-gray-700 mb-2">طلباتي المعيّنة</h2>
        <div className="flex gap-1 mb-4 p-1 bg-gray-200 rounded-lg">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'active' ? 'bg-white text-teal-700 shadow' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            نشط ({activeOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'completed' ? 'bg-white text-teal-700 shadow' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            منتهي ({completedOrders.length})
          </button>
        </div>

        {isLoading ? (
          <p className="text-gray-500 text-center py-8">جاري التحميل...</p>
        ) : displayOrders.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {activeTab === 'active' ? 'لا توجد طلبات نشطة حالياً' : 'لا توجد طلبات منتهية'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {activeTab === 'active' ? 'ستظهر هنا عند تعيين طلب لك' : 'الطلبات المكتملة تظهر هنا'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayOrders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                allowedAction={getAllowedCourierAction(o)}
                onAction={handleOrderAction}
                isPending={statusMutation.isPending}
              />
            ))}
          </div>
        )}
      </main>

      {finishOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-4 z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">إنهاء الطلب</h3>
            <p className="text-sm text-gray-500 mt-1">#{finishOrder.id?.slice(0, 8)} — {finishOrder.customer?.name ?? finishOrder.customerName ?? '—'}</p>
            <textarea
              placeholder="ملاحظات (اختياري)"
              value={finishNotes}
              onChange={(e) => setFinishNotes(e.target.value)}
              className="mt-4 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
              rows={3}
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => { setFinishOrder(null); setFinishNotes(''); }}
                className="flex-1 py-2 px-3 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
              >
                إلغاء
              </button>
              <button
                onClick={handleFinish}
                disabled={statusMutation.isPending}
                className="flex-1 py-2 px-3 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50"
              >
                تأكيد
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className={`fixed bottom-4 left-4 right-4 mx-auto max-w-md px-4 py-3 rounded-xl shadow-xl text-sm text-center z-50 font-medium ${
          toastMessage.includes('READY') || toastMessage.includes('Grab it')
            ? 'bg-emerald-600 text-white border-2 border-emerald-400 animate-pulse'
            : 'bg-amber-800 text-white'
        }`}>
          {toastMessage}
        </div>
      )}
    </div>
  );
}
