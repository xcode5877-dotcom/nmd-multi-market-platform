import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminContext } from '../context/AdminContext';
import { listOrdersByTenant, updateOrderStatus } from '@nmd/mock';
import { MockApiClient } from '@nmd/mock';
import type { Order } from '@nmd/core';
import { Card, PageHeader, Button } from '@nmd/ui';
import { formatPrice } from '@nmd/core';
import { Phone, Truck, Clock } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';

const USE_API = !!import.meta.env.VITE_MOCK_API_URL;
const api = new MockApiClient();

/** SLA: READY without courier — 3m = warning, 5m = panic */
const READY_WARNING_MS = 3 * 60 * 1000;
const READY_PANIC_MS = 5 * 60 * 1000;

/** Active board: only orders that are not finished (hide COMPLETED & CANCELLED) */
const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'] as const;

function formatTimeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'الآن';
  if (diffMins < 60) return `منذ ${diffMins} د`;
  if (diffHours < 24) return `منذ ${diffHours} س`;
  if (diffDays < 7) return `منذ ${diffDays} يوم`;
  return new Date(date).toLocaleDateString('ar-SA', { dateStyle: 'short' });
}

/** Format elapsed ms as MM:SS for waiting timer */
function formatWaitingElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getMerchantShare(order: Order & { merchantAmount?: number; subtotal?: number; items?: { totalPrice?: number }[] }): number {
  return order.merchantAmount ?? order.subtotal ?? (order.items ?? []).reduce((s, i) => s + (Number(i.totalPrice) || 0), 0);
}

/** Next step for the magic button. PICKUP READY → handover to COMPLETED (no courier). */
function getBoardAction(order: Order & { fulfillmentType?: string }): { label: string; nextStatus: Order['status']; variant: 'orange' | 'blue' | 'green' } | null {
  const status = order.status;
  const isPickup = (order as { fulfillmentType?: string }).fulfillmentType === 'PICKUP';
  switch (status) {
    case 'PENDING':
    case 'CONFIRMED':
      return { label: 'بدء التحضير', nextStatus: 'PREPARING', variant: 'orange' };
    case 'PREPARING':
      return { label: 'الطلب جاهز', nextStatus: 'READY', variant: 'blue' };
    case 'READY':
      if (isPickup) return { label: 'تم تسليم الطلب للزبون', nextStatus: 'COMPLETED', variant: 'green' };
      return null;
    default:
      return null;
  }
}

type OrderWithDriver = Order & {
  readyAt?: string;
  courierId?: string;
  deliveryStatus?: string;
  deliveryTimeline?: { handedToDriverAt?: string };
  fulfillmentType?: string;
  assignedDriver?: { name: string; phone?: string };
};

/** True if order has a driver assigned or in transit */
function isWithDriver(o: OrderWithDriver): boolean {
  return !!(o.courierId || (o.deliveryStatus && ['ASSIGNED', 'IN_PROGRESS', 'PICKED_UP'].includes(o.deliveryStatus)));
}

/** Elapsed ms since order became READY (no courier). Only for DELIVERY; PICKUP has no waiting. */
function getReadyWaitingMs(order: OrderWithDriver): number | null {
  if (order.status !== 'READY' || isWithDriver(order)) return null;
  if ((order as { fulfillmentType?: string }).fulfillmentType === 'PICKUP') return null;
  const since = order.readyAt ?? order.createdAt;
  if (!since) return null;
  return Date.now() - new Date(since).getTime();
}

export default function OrdersBoardPage() {
  const { tenantId } = useAdminContext();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const { data: allOrders, refetch } = useQuery({
    queryKey: ['orders-board', tenantId],
    queryFn: () => (USE_API ? api.listOrdersByTenant(tenantId) : Promise.resolve(listOrdersByTenant(tenantId))),
    enabled: !!tenantId,
    refetchInterval: 5000,
  });

  useEffect(() => {
    const hasReadyWaiting = (allOrders ?? []).some((o) => {
      const ord = o as OrderWithDriver;
      return ord.status === 'READY' && (ord as { fulfillmentType?: string }).fulfillmentType !== 'PICKUP' && !isWithDriver(ord);
    });
    if (!hasReadyWaiting) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [allOrders]);

  const activeOrders = (allOrders ?? []).filter(
    (o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED'
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const { preparing, readyForPickup, waitingDriver, withDriver } = useMemo(() => {
    const preparing: OrderWithDriver[] = [];
    const readyForPickup: OrderWithDriver[] = [];
    const waitingDriver: OrderWithDriver[] = [];
    const withDriver: OrderWithDriver[] = [];
    for (const o of activeOrders as OrderWithDriver[]) {
      const isPickup = (o as { fulfillmentType?: string }).fulfillmentType === 'PICKUP';
      if (isWithDriver(o)) withDriver.push(o);
      else if (o.status === 'READY' && isPickup) readyForPickup.push(o);
      else if (o.status === 'READY') waitingDriver.push(o);
      else preparing.push(o);
    }
    const sortByCreated = (a: OrderWithDriver, b: OrderWithDriver) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    preparing.sort(sortByCreated);
    readyForPickup.sort(sortByCreated);
    waitingDriver.sort(sortByCreated);
    withDriver.sort(sortByCreated);
    return { preparing, readyForPickup, waitingDriver, withDriver };
  }, [activeOrders]);

  const handleAdvance = (order: Order, nextStatus: Order['status']) => {
    if (USE_API) {
      api.updateOrderStatus(order.id, nextStatus).then(() => {
        queryClient.invalidateQueries({ queryKey: ['orders-board', tenantId] });
      });
    } else {
      updateOrderStatus(order.id, nextStatus);
      refetch();
    }
  };

  return (
    <div>
      <PageHeader
        title="لوحة الطلبات"
        subtitle="الطلبات النشطة فقط — المكتمل والملغي يظهران في سجل الطلبات"
      />
      {activeOrders.length === 0 ? (
        <Card className="p-8 text-center text-slate-600 shadow-sm border border-slate-100">
          <p className="font-medium">لا توجد طلبات نشطة</p>
          <p className="text-sm mt-1">الطلبات المكتملة والملغاة تظهر في صفحة الطلبات → سجل الطلبات</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {preparing.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-600 mb-3">قيد التحضير</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {preparing.map((o) => (
                  <BoardOrderCard key={o.id} order={o} onAdvance={handleAdvance} now={now} />
                ))}
              </div>
            </section>
          )}
          {readyForPickup.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-600 mb-3">جاهز للاستلام من المحل</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {readyForPickup.map((o) => (
                  <BoardOrderCard key={o.id} order={o} onAdvance={handleAdvance} now={now} />
                ))}
              </div>
            </section>
          )}
          {waitingDriver.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-600 mb-3">في انتظار السائق</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {waitingDriver.map((o) => (
                  <BoardOrderCard key={o.id} order={o} onAdvance={handleAdvance} now={now} />
                ))}
              </div>
            </section>
          )}
          {withDriver.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-600 mb-3">مع السائق</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {withDriver.map((o) => (
                  <BoardOrderCard
                    key={o.id}
                    order={o}
                    onAdvance={handleAdvance}
                    onHandedToDriver={USE_API ? (order) => api.markOrderHandedToDriver(tenantId!, order.id).then(() => queryClient.invalidateQueries({ queryKey: ['orders-board', tenantId] })) : undefined}
                    now={now}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function BoardOrderCard({
  order,
  onAdvance,
  onHandedToDriver,
  now,
}: {
  order: OrderWithDriver;
  onAdvance: (order: Order, nextStatus: Order['status']) => void;
  onHandedToDriver?: (order: Order) => void | Promise<unknown>;
  now: number;
}) {
  const action = getBoardAction(order);
  const merchantShare = getMerchantShare(order);
  const itemsCount = order.items?.length ?? 0;
  const assignedDriver = order.assignedDriver;
  const waitingMs = getReadyWaitingMs(order);
  const isWarning = waitingMs != null && waitingMs >= READY_WARNING_MS && waitingMs < READY_PANIC_MS;
  const isPanic = waitingMs != null && waitingMs >= READY_PANIC_MS;
  const isWithDriverSection = isWithDriver(order);
  const deliveryStatus = order.deliveryStatus;
  const handedAt = order.deliveryTimeline?.handedToDriverAt;
  const driverArrivedOrInProgress = deliveryStatus === 'IN_PROGRESS';
  const [handing, setHanding] = useState(false);

  const statusBaseStyle =
    order.status === 'PREPARING'
      ? 'border-blue-200 bg-blue-50/70'
      : order.status === 'READY'
        ? 'border-emerald-200 bg-emerald-50/70'
        : 'border-slate-100 bg-white';
  const cardClass = [
    'p-4 shadow-sm border flex flex-col gap-3 text-right transition-colors',
    isPanic && '!border-red-500 !bg-red-50/80 animate-pulse',
    isWarning && !isPanic && '!border-amber-400 !bg-amber-50/80',
    driverArrivedOrInProgress && isWithDriverSection && '!border-blue-500 !bg-blue-50/80 animate-pulse',
    !isWarning && !isPanic && !driverArrivedOrInProgress && statusBaseStyle,
  ].filter(Boolean).join(' ');

  const isPickup = (order as { fulfillmentType?: string }).fulfillmentType === 'PICKUP';

  return (
    <Card className={cardClass}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xl font-bold text-slate-800">#{order.id.slice(0, 8)}</span>
        <div className="flex items-center gap-2">
          {isPickup && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-violet-100 text-violet-800 text-xs font-medium border border-violet-200">
              استلام من المحل
            </span>
          )}
          <span className="text-sm text-slate-500">{formatTimeAgo(order.createdAt)}</span>
        </div>
      </div>
      <div className="font-bold text-lg text-slate-900">{order.customerName || '—'}</div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">{itemsCount} {itemsCount === 1 ? 'صنف' : 'صنوف'}</span>
        <span className="font-bold text-emerald-600">{formatPrice(merchantShare)}</span>
      </div>

      {order.status === 'READY' && !isPickup && (
        <div className={`flex items-center justify-between gap-2 py-2 px-3 rounded-lg border ${
          isPanic ? 'bg-red-100 border-red-200' : isWarning ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'
        }`}>
          {assignedDriver ? (
            <>
              <div>
                <p className="text-sm font-medium text-slate-700">{assignedDriver.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">السائق في الطريق...</p>
              </div>
              {assignedDriver.phone && (
                <a
                  href={`tel:${assignedDriver.phone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white font-medium text-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Phone className="w-4 h-4" />
                  اتصال
                </a>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-slate-600">في انتظار السائق</span>
              {waitingMs != null && (
                <span className={`inline-flex items-center gap-1 text-sm font-mono font-medium ${
                  isPanic ? 'text-red-700' : isWarning ? 'text-amber-800' : 'text-slate-600'
                }`}>
                  <Clock className="w-4 h-4" />
                  انتظار: {formatWaitingElapsed(waitingMs)}
                </span>
              )}
            </div>
          )}
        </div>
      )}
      {isWithDriverSection && order.status === 'READY' && !handedAt && onHandedToDriver && (
        <Button
          variant="primary"
          size="sm"
          className="w-full py-3 font-semibold gap-2 bg-blue-600 hover:bg-blue-700 text-white border-0"
          disabled={handing}
          onClick={async () => {
            setHanding(true);
            try {
              await onHandedToDriver(order);
            } finally {
              setHanding(false);
            }
          }}
        >
          <Truck className="w-4 h-4 shrink-0" />
          {handing ? 'جاري...' : 'تم التسليم للسائق'}
        </Button>
      )}
      {isWithDriverSection && order.status === 'READY' && handedAt && (
        <div className="py-2 px-3 rounded-lg border bg-emerald-50 border-emerald-200">
          <span className="text-sm font-medium text-emerald-800">تم التسليم للسائق — يمكنه بدء التوصيل</span>
        </div>
      )}
      {order.status === 'READY' && isPickup && (
        <div className="py-2 px-3 rounded-lg border bg-violet-50 border-violet-100">
          <span className="text-sm font-medium text-violet-800">جاهز للاستلام من المحل</span>
        </div>
      )}

      {action && (
        <Button
          variant="primary"
          size="sm"
          className={`w-full py-3 font-semibold gap-2 ${
            action.variant === 'green'
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-0'
              : action.variant === 'orange'
                ? 'bg-amber-500 hover:bg-amber-600 text-white border-0'
                : 'bg-blue-600 hover:bg-blue-700 text-white border-0'
          }`}
          onClick={() => onAdvance(order, action.nextStatus)}
        >
          {action.variant === 'green' ? null : <Truck className="w-4 h-4 shrink-0" />}
          {action.label}
        </Button>
      )}
    </Card>
  );
}
