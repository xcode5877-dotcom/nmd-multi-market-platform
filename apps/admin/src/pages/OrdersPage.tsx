import { useState, useMemo, useEffect, Fragment } from 'react';
import type { Order } from '@nmd/core';
import { Card, Button, DataTable, Drawer, InlineBadge, PageHeader, FiltersBar, EmptyState, ConfirmDialog, useToast, Modal } from '@nmd/ui';
import { Package, Bell, MessageCircle, FileText, Phone, Truck, Trash2 } from 'lucide-react';
import { useAdminContext } from '../context/AdminContext';
import { useAuth } from '../contexts/AuthContext';
import { isPlatformAdmin, isSuperAdmin } from '../lib/is-platform-admin';
import { broadcastTenantUpdate } from '../lib/tenant-broadcast';
import { listOrdersByTenant, updateOrderStatus } from '@nmd/mock';
import { buildWhatsAppMessage, buildWhatsAppUrl, buildOrderActionLinksSection, formatPrice, formatDateTimeGregorian, formatAddonNameWithPlacement, isValidWhatsAppPhone } from '@nmd/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { MockApiClient } from '@nmd/mock';

const api = new MockApiClient();
const USE_API = !!import.meta.env.VITE_MOCK_API_URL;

const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'] as const;
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'جديد',
  CONFIRMED: 'تم التواصل',
  PREPARING: 'قيد التحضير',
  READY: 'جاهز للاستلام',
  COMPLETED: 'تم التسليم',
  CANCELLED: 'ملغي',
};

/** Manual status options for merchants. "تم التسليم" is only shown as the next action (e.g. after READY for pickup), not always. */
const MANUAL_STATUS_BUTTONS: { status: Order['status']; label: string }[] = [
  { status: 'CONFIRMED', label: 'تم التواصل' },
  { status: 'PREPARING', label: 'قيد التحضير' },
  { status: 'READY', label: 'جاهز' },
];

/** Next actionable step. PICKUP READY → handover to COMPLETED (no courier). */
function getNextOrderAction(status: string, fulfillmentType?: string): { label: string; nextStatus: Order['status'] } | null {
  switch (status) {
    case 'PENDING':
      return { label: 'بدء التحضير', nextStatus: 'PREPARING' };
    case 'CONFIRMED':
      return { label: 'بدء التحضير', nextStatus: 'PREPARING' };
    case 'PREPARING':
      return { label: 'الطلب جاهز', nextStatus: 'READY' };
    case 'READY':
      if (fulfillmentType === 'PICKUP') return { label: 'تم تسليم الطلب للزبون', nextStatus: 'COMPLETED' };
      return null;
    case 'COMPLETED':
      return null;
    default:
      return null;
  }
}


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
  return formatDateTimeGregorian(date);
}

/** Pill-style status badge: Blue = on the stove (Preparing), Green = on the counter (Ready) */
function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-amber-500 text-white',
    CONFIRMED: 'bg-amber-500 text-white',
    PREPARING: 'bg-blue-500 text-white',
    READY: 'bg-emerald-500 text-white',
    COMPLETED: 'bg-emerald-600 text-white',
    CANCELLED: 'bg-slate-500 text-white',
  };
  const label = STATUS_LABELS[status] ?? status;
  const className = styles[status] ?? 'bg-slate-500 text-white';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

type OrderWithAmounts = Order & { merchantAmount?: number; platformDeliveryFee?: number; subtotal?: number; delivery?: { fee?: number }; items?: { totalPrice?: number }[]; assignedDriver?: { name: string; phone?: string }; fulfillmentType?: string };

function OrderCard({
  order,
  tenant,
  showGrandTotal,
  onViewDetails,
  onStatusChange,
  isSuperAdmin,
  onRequestHardDelete,
}: {
  order: OrderWithAmounts;
  tenant: import('@nmd/core').Tenant | null | undefined;
  showGrandTotal: boolean;
  onViewDetails: () => void;
  onStatusChange: (order: Order, status: Order['status']) => void;
  isSuperAdmin?: boolean;
  onRequestHardDelete?: (order: Order) => void;
}) {
  const idStr = String((order as { id?: unknown }).id ?? '');
  const itemsArr = Array.isArray((order as { items?: unknown }).items) ? (order as { items: unknown[] }).items : [];
  const { merchantAmount, grandTotal } = getOrderAmounts(order);
  const amountDisplay = formatPrice(showGrandTotal ? grandTotal : merchantAmount);
  const orderActionsBase = import.meta.env.VITE_ORDER_ACTIONS_BASE_URL ?? (typeof window !== 'undefined' ? `${window.location.origin}/merchant` : 'https://nmd.marketing/merchant');
  const message = tenant ? buildWhatsAppMessage(order, tenant) + buildOrderActionLinksSection(order.id, orderActionsBase) : '';
  const storePhone = tenant?.branding?.whatsappPhone ?? '';
  const canOpenWhatsApp = isValidWhatsAppPhone(storePhone);
  const waUrl = canOpenWhatsApp ? buildWhatsAppUrl(storePhone, message) : null;
  const nextAction = getNextOrderAction(order.status, order.fulfillmentType);
  const assignedDriver = order.assignedDriver;
  const isPickup = order.fulfillmentType === 'PICKUP';

  const statusCardStyle =
    order.status === 'PREPARING'
      ? 'border-blue-200 bg-blue-50/60'
      : order.status === 'READY'
        ? 'border-emerald-200 bg-emerald-50/60'
        : 'border-slate-200 bg-white';
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onViewDetails}
      onKeyDown={(e) => e.key === 'Enter' && onViewDetails()}
      className={`rounded-xl border p-4 shadow-sm transition-shadow hover:shadow-md text-right flex flex-col gap-3 ${statusCardStyle}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-medium text-slate-600">{idStr.slice(0, 8) || '—'}</span>
        <div className="flex items-center gap-1.5">
          {isSuperAdmin && onRequestHardDelete && (
            <button
              type="button"
              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
              onClick={(e) => { e.stopPropagation(); onRequestHardDelete(order); }}
              aria-label="حذف الطلب نهائياً"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <StatusPill status={order.status} />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-1">
        <span className="font-bold text-lg sm:text-xl text-slate-900">{order.customerName || '—'}</span>
        <span className="text-sm text-slate-500">{formatTimeAgo(order.createdAt)}</span>
      </div>
      {order.status === 'READY' && !isPickup && (
        <div className="flex items-center justify-between gap-2 py-1 px-2 rounded-lg bg-slate-50 border border-slate-100">
          {assignedDriver ? (
            <>
              <span className="text-sm font-medium text-slate-700">{assignedDriver.name}</span>
              {assignedDriver.phone && (
                <a
                  href={`tel:${assignedDriver.phone}`}
                  className="flex items-center gap-1 text-sm text-primary font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Phone className="w-4 h-4" />
                  اتصال
                </a>
              )}
            </>
          ) : (
            <span className="text-sm text-slate-600">في انتظار السائق</span>
          )}
        </div>
      )}
      {order.status === 'READY' && isPickup && (
        <div className="py-1 px-2 rounded-lg bg-violet-50 border border-violet-100">
          <span className="text-sm font-medium text-violet-800">جاهز للاستلام من المحل</span>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-lg sm:text-xl font-bold text-emerald-600">{amountDisplay}</span>
        <span className="text-sm text-slate-600">
          {itemsArr.length} {itemsArr.length === 1 ? 'منتج' : 'منتجات'}
        </span>
      </div>
      <div className="flex flex-col gap-2 pt-1 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
        {/* Details opens the Drawer on the same page (no redirect) */}
        {/* Manual status buttons — always visible for merchants */}
        <div className="flex flex-wrap gap-1.5">
          {MANUAL_STATUS_BUTTONS.map(({ status, label }) => (
            <Button
              key={status}
              variant={order.status === status ? 'primary' : 'outline'}
              size="sm"
              className="text-xs h-8 px-2.5 rounded-lg"
              onClick={() => onStatusChange(order, status)}
              disabled={order.status === status}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          {nextAction && (
            <Button
              variant="primary"
              size="sm"
              className="flex-1 gap-1.5 py-2.5 text-sm font-medium"
              onClick={() => onStatusChange(order, nextAction.nextStatus)}
            >
              <Truck className="w-4 h-4 shrink-0" />
              {nextAction.label}
            </Button>
          )}
          {waUrl && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 bg-[#25D366]/10 text-[#25D366] border-[#25D366]/30 hover:bg-[#25D366]/20 gap-1.5 py-2.5 text-sm font-medium"
              onClick={() => window.open(waUrl, '_blank')}
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              واتساب
            </Button>
          )}
          <Button variant="outline" size="sm" className="shrink-0 gap-1.5 py-2.5 text-sm font-medium min-w-[7rem]" onClick={(e) => { e.stopPropagation(); onViewDetails(); }}>
            <FileText className="w-4 h-4 shrink-0" />
            التفاصيل
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProductThumb({ src }: { src?: string | null }) {
  const [failed, setFailed] = useState(false);
  const showImg = src && !failed;
  return (
    <div className="w-10 h-10 rounded-md overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
      {showImg ? (
        <img
          src={src}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Package className="w-5 h-5 text-gray-400" aria-hidden />
      )}
    </div>
  );
}

function getOrderAmounts(order: Order & { merchantAmount?: number; platformDeliveryFee?: number; subtotal?: number; delivery?: { fee?: number }; items?: { totalPrice?: number }[] }): { merchantAmount: number; platformDeliveryFee: number; grandTotal: number } {
  const merchantAmount = order.merchantAmount ?? order.subtotal ?? (order.items ?? []).reduce((s, i) => s + (Number(i.totalPrice) || 0), 0);
  const platformDeliveryFee = order.platformDeliveryFee ?? order.delivery?.fee ?? 0;
  const grandTotal = Number(order.total) || merchantAmount + platformDeliveryFee;
  return { merchantAmount, platformDeliveryFee, grandTotal };
}

type StoreOperationalStatus = 'open' | 'busy' | 'closed';

export default function OrdersPage() {
  const { tenantId } = useAdminContext();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const addToast = useToast().addToast;
  const showGrandTotal = isPlatformAdmin(user?.role);
  const superAdmin = isSuperAdmin(user?.role);
  const [filter, setFilter] = useState<'today' | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<StoreOperationalStatus | null>(null);
  const [hardDeleting, setHardDeleting] = useState(false);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const listOptions = useMemo(() => {
    if (USE_API) {
      const from = filter === 'today' ? todayIso : dateFrom || undefined;
      const to = filter === 'today' ? todayIso : dateTo || undefined;
      return { from, to, search: search.trim() || undefined };
    }
    return undefined;
  }, [USE_API, filter, todayIso, dateFrom, dateTo, search]);

  const { data: tenant } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => api.getTenant(tenantId),
    enabled: !!tenantId,
  });

  const operationalStatus = (tenant as { operationalStatus?: StoreOperationalStatus } | null)?.operationalStatus ?? 'open';

  const handleQuickStatusChange = async (status: StoreOperationalStatus) => {
    if (!tenantId || status === operationalStatus) return;
    setStatusUpdating(status);
    try {
      await api.updateOperationalSettingsApi(tenantId, { operationalStatus: status });
      queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['tenant-by-id', tenantId] });
      broadcastTenantUpdate(tenantId);
      addToast('تم تحديث حالة المحل بنجاح', 'success');
    } catch {
      addToast('فشل تحديث حالة المحل', 'error');
    } finally {
      setStatusUpdating(null);
    }
  };

  const { data: ordersData = [] } = useQuery({
    queryKey: ['orders', tenantId, refresh, listOptions?.from, listOptions?.to, listOptions?.search],
    queryFn: () => api.listOrdersByTenant(tenantId, listOptions),
    enabled: !!tenantId && USE_API,
  });

  const ordersLocal = useMemo(() => listOrdersByTenant(tenantId), [tenantId, refresh]);
  let orders = USE_API ? ordersData : ordersLocal;
  if (!USE_API) {
    if (filter === 'today') {
      const today = new Date().toDateString();
      orders = orders.filter((o) => new Date(o.createdAt).toDateString() === today);
    } else if (dateFrom || dateTo) {
      const fromMs = dateFrom ? new Date(dateFrom).setHours(0, 0, 0, 0) : -Infinity;
      const toMs = dateTo ? new Date(dateTo).setHours(23, 59, 59, 999) : Infinity;
      orders = orders.filter((o) => {
        const t = new Date(o.createdAt).getTime();
        return t >= fromMs && t <= toMs;
      });
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const digits = q.replace(/\D/g, '');
      orders = orders.filter(
        (o) =>
          String((o as { id?: unknown }).id ?? '').toLowerCase().includes(q) ||
          (o.customerName ?? '').toLowerCase().includes(q) ||
          (digits.length >= 4 ? (o.customerPhone ?? '').replace(/\D/g, '').includes(digits) : (o.customerPhone ?? '').toLowerCase().includes(q))
      );
    }
  }
  orders = orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (statusFilter) orders = orders.filter((o) => o.status === statusFilter);

  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const id = (location.state as { highlightOrderId?: string } | null)?.highlightOrderId;
    if (id && orders.length > 0) {
      const order = orders.find((o) => (o as { id?: string }).id === id);
      if (order) setSelectedOrder(order);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, orders, navigate]);

  const handleStatus = async (order: Order, status: Order['status']) => {
    if (USE_API) {
      await api.updateOrderStatus(order.id, status);
      queryClient.invalidateQueries({ queryKey: ['orders', tenantId] });
    } else {
      updateOrderStatus(order.id, status);
      setRefresh((r) => r + 1);
    }
    setCancelTarget(null);
    if (selectedOrder?.id === order.id) setSelectedOrder(null);
  };

  const handleHardDelete = async () => {
    if (!deleteTarget || !USE_API) return;
    setHardDeleting(true);
    try {
      const base = (import.meta.env.VITE_MOCK_API_URL ?? '').replace(/\/$/, '');
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('nmd-access-token') : null;
      const res = await fetch(`${base}/orders/${encodeURIComponent(deleteTarget.id)}/hard-delete`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(String(res.status));
      queryClient.invalidateQueries({ queryKey: ['orders', tenantId] });
      queryClient.invalidateQueries({ queryKey: ['orders-board', tenantId] });
      setSelectedOrder(null);
      setDeleteTarget(null);
      addToast('تم حذف الطلب نهائياً', 'success');
    } catch {
      addToast('فشل حذف الطلب', 'error');
    } finally {
      setHardDeleting(false);
    }
  };

  const rows: Record<string, React.ReactNode>[] = orders.map((o, i) => {
    const idStr = String((o as { id?: unknown }).id ?? '');
    const hasValidId = idStr.length > 0;
    if (!hasValidId && i < 3) console.warn('[OrdersPage] Order with missing/non-string id:', o);
    const itemsArr = Array.isArray((o as { items?: unknown }).items) ? (o as { items: { imageUrl?: string | null }[] }).items : [];
    const firstItem = itemsArr[0];
    const firstImg = firstItem && 'imageUrl' in firstItem ? firstItem.imageUrl : undefined;
    return {
    orderId: (
      <span className="font-mono text-sm font-medium">{hasValidId ? idStr.slice(0, 8) : '—'}</span>
    ),
    date: (
      <span className="text-gray-500 text-sm">{formatDateTimeGregorian(o.createdAt)}</span>
    ),
    customer: (
      <div className="text-sm">
        <span className="font-medium text-gray-900">{o.customerName || '—'}</span>
        {o.customerPhone && (
          <span className="block text-gray-500 text-xs" dir="ltr">{o.customerPhone}</span>
        )}
      </div>
    ),
    items: (
      <div className="flex items-center gap-2">
        <ProductThumb src={firstImg} />
        <span className="text-sm text-gray-600">
          {itemsArr.length} {itemsArr.length === 1 ? 'منتج' : 'منتجات'}
        </span>
      </div>
    ),
    total: (() => {
      const { merchantAmount, grandTotal } = getOrderAmounts(o as Order & { merchantAmount?: number; platformDeliveryFee?: number; subtotal?: number; delivery?: { fee?: number }; items?: { totalPrice?: number }[] });
      return <span className="font-bold text-primary">{formatPrice(showGrandTotal ? grandTotal : merchantAmount)}</span>;
    })(),
    status: (
      <span className="inline-flex items-center gap-1.5">
        <InlineBadge status={o.status} />
        {(o as { lastStatusNotification?: { status: string } }).lastStatusNotification && (
          <span
            className="inline-flex items-center text-gray-500"
            title="Notification triggered automatically"
          >
            <Bell className="w-4 h-4" aria-hidden />
          </span>
        )}
      </span>
    ),
    actions: hasValidId ? (
      <div className="flex gap-1.5 flex-wrap items-center" onClick={(e) => e.stopPropagation()}>
        {MANUAL_STATUS_BUTTONS.map(({ status, label }) => (
          <Button
            key={status}
            variant={o.status === status ? 'primary' : 'outline'}
            size="sm"
            className="text-xs h-7 px-2 rounded-lg"
            onClick={() => handleStatus(o, status)}
            disabled={o.status === status}
          >
            {label}
          </Button>
        ))}
        {getNextOrderAction(o.status, (o as OrderWithAmounts).fulfillmentType) && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 px-2 rounded-lg border-gray-300 hover:border-primary hover:bg-primary/5"
            onClick={() => handleStatus(o, getNextOrderAction(o.status, (o as OrderWithAmounts).fulfillmentType)!.nextStatus)}
          >
            {getNextOrderAction(o.status, (o as OrderWithAmounts).fulfillmentType)!.label}
          </Button>
        )}
        {o.status !== 'CANCELLED' && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2 rounded-lg text-red-600 hover:bg-red-50"
            onClick={() => setCancelTarget(o)}
          >
            إلغاء
          </Button>
        )}
        {superAdmin && USE_API && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2 rounded-lg text-red-600 hover:bg-red-50"
            onClick={() => { setDeleteTarget(o); setSelectedOrder(null); }}
            aria-label="حذف الطلب نهائياً"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    ) : null,
  };
  });

  return (
    <div>
      <PageHeader
        title="الطلبات"
        subtitle={filter === 'today' ? 'طلبات اليوم' : 'جميع الطلبات'}
      />
      {tenantId && (
        <div className="mb-4 overflow-x-auto">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-slate-600 shrink-0" aria-hidden>حالة المحل</span>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                type="button"
                disabled={!!statusUpdating}
                onClick={() => handleQuickStatusChange('open')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  operationalStatus === 'open'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-200 shadow-sm'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-emerald-300 hover:bg-emerald-50/50'
                }`}
              >
                {statusUpdating === 'open' ? (
                  <span className="inline-block w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" aria-hidden />
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" aria-hidden />
                )}
                مفتوح
              </button>
              <button
                type="button"
                disabled={!!statusUpdating}
                onClick={() => handleQuickStatusChange('busy')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  operationalStatus === 'busy'
                    ? 'bg-amber-50 border-amber-500 text-amber-700 ring-2 ring-amber-200 shadow-sm'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-amber-300 hover:bg-amber-50/50'
                }`}
              >
                {statusUpdating === 'busy' ? (
                  <span className="inline-block w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" aria-hidden />
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" aria-hidden />
                )}
                مشغول
              </button>
              <button
                type="button"
                disabled={!!statusUpdating}
                onClick={() => handleQuickStatusChange('closed')}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                  operationalStatus === 'closed'
                    ? 'bg-red-50 border-red-500 text-red-700 ring-2 ring-red-200 shadow-sm'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-red-300 hover:bg-red-50/50'
                }`}
              >
                {statusUpdating === 'closed' ? (
                  <span className="inline-block w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" aria-hidden />
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" aria-hidden />
                )}
                مغلق
              </button>
            </div>
          </div>
        </div>
      )}
      <FiltersBar
        search={
          <input
            type="text"
            placeholder="بحث بالاسم أو الجوال أو رقم الطلب"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded px-3 py-2 text-sm w-full max-w-[220px]"
            dir="rtl"
          />
        }
        chips={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant={filter === 'today' ? 'primary' : 'outline'} size="sm" onClick={() => setFilter('today')}>
              اليوم
            </Button>
            <Button variant={filter === 'all' ? 'primary' : 'outline'} size="sm" onClick={() => setFilter('all')}>
              الكل
            </Button>
            {filter === 'all' && (
              <>
                <label className="flex items-center gap-1.5 text-sm text-gray-600">
                  من
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="border rounded px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-sm text-gray-600">
                  إلى
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="border rounded px-2 py-1.5 text-sm"
                  />
                </label>
              </>
            )}
          </div>
        }
        selects={
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded px-3 py-2 text-sm min-w-[140px]"
          >
            <option value="">كل الحالات</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        }
      />
      <Card>
        <div className="p-4">
          {orders.length === 0 ? (
            <EmptyState variant="no-data" title="لا توجد طلبات" />
          ) : (
            <>
              {/* Mobile & tablet: card layout. sm/md = 1 col, lg = 2 col. Hidden on xl (table shown). */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 xl:hidden">
                {orders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order as OrderWithAmounts}
                    tenant={tenant}
                    showGrandTotal={showGrandTotal}
                    onViewDetails={() => setSelectedOrder(order)}
                    onStatusChange={handleStatus}
                    isSuperAdmin={superAdmin}
                    onRequestHardDelete={superAdmin && USE_API ? (o) => { setDeleteTarget(o); setSelectedOrder(null); } : undefined}
                  />
                ))}
              </div>
              {/* Desktop xl: table */}
              <div className="hidden xl:block">
                <DataTable
                  columns={[
                    { key: 'orderId', label: 'رقم' },
                    { key: 'date', label: 'التاريخ' },
                    { key: 'customer', label: 'العميل' },
                    { key: 'items', label: 'العناصر' },
                    { key: 'total', label: showGrandTotal ? 'المجموع الكلي' : 'حصة التاجر' },
                    { key: 'status', label: 'الحالة' },
                    { key: 'actions', label: 'إجراءات', className: 'min-w-[280px]' },
                  ]}
                  rows={rows}
                  onRowClick={(_row, index) => setSelectedOrder(orders[index])}
                  emptyMessage="لا توجد طلبات"
                />
              </div>
            </>
          )}
        </div>
      </Card>
      <Drawer
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={selectedOrder ? `طلب #${String((selectedOrder as { id?: unknown }).id ?? '').slice(0, 8) || '—'}` : ''}
        side="start"
        contentClassName="w-full max-w-full md:max-w-sm"
      >
        {selectedOrder && (
          <OrderDrawerContent
            order={selectedOrder as OrderWithAmounts}
            tenant={tenant}
            onStatusChange={() => {
              if (USE_API) queryClient.invalidateQueries({ queryKey: ['orders', tenantId] });
              else setRefresh((r) => r + 1);
              setSelectedOrder(null);
            }}
            useApi={USE_API}
            showGrandTotal={showGrandTotal}
            isPlatformAdmin={showGrandTotal}
            isSuperAdmin={superAdmin}
            onRequestHardDelete={() => {
              if (selectedOrder) {
                setDeleteTarget(selectedOrder);
                setSelectedOrder(null);
              }
            }}
          />
        )}
      </Drawer>
      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => { if (cancelTarget) handleStatus(cancelTarget, 'CANCELLED'); }}
        title="إلغاء الطلب"
        message={cancelTarget ? `هل أنت متأكد من إلغاء الطلب #${String((cancelTarget as { id?: unknown }).id ?? '').slice(0, 8) || '—'}؟` : ''}
        confirmLabel="إلغاء الطلب"
        variant="danger"
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleHardDelete}
        title="حذف الطلب نهائياً"
        message={deleteTarget ? 'هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء.' : ''}
        confirmLabel="حذف نهائياً"
        variant="danger"
        loading={hardDeleting}
      />
    </div>
  );
}

const MOCK_AVAILABLE_DRIVERS = [
  { id: 'd1', name: 'سائق ١', phone: '+966501234567' },
  { id: 'd2', name: 'سائق ٢', phone: '+966509876543' },
  { id: 'd3', name: 'سائق ٣', phone: '+966551112233' },
];

function OrderDrawerContent({
  order,
  tenant,
  onStatusChange,
  useApi,
  showGrandTotal,
  isPlatformAdmin: isPlatformAdminUser,
  isSuperAdmin,
  onRequestHardDelete,
}: {
  order: OrderWithAmounts;
  tenant: import('@nmd/core').Tenant | null | undefined;
  onStatusChange: () => void;
  useApi?: boolean;
  showGrandTotal?: boolean;
  isPlatformAdmin?: boolean;
  isSuperAdmin?: boolean;
  onRequestHardDelete?: () => void;
}) {
  const { merchantAmount, platformDeliveryFee, grandTotal } = getOrderAmounts(order);
  const [updating, setUpdating] = useState(false);
  const [assignDriverOpen, setAssignDriverOpen] = useState(false);
  const addToast = useToast().addToast;
  const assignedDriver = order.assignedDriver;
  const nextAction = getNextOrderAction(order.status, order.fulfillmentType);
  const showAssignDriver = isPlatformAdminUser && order.status === 'READY' && order.fulfillmentType !== 'PICKUP' && !assignedDriver;
  const orderActionsBase = import.meta.env.VITE_ORDER_ACTIONS_BASE_URL ?? (typeof window !== 'undefined' ? `${window.location.origin}/merchant` : 'https://nmd.marketing/merchant');
  const message = tenant
    ? buildWhatsAppMessage(order, tenant) + buildOrderActionLinksSection(order.id, orderActionsBase)
    : '';
  const storePhone = tenant?.branding?.whatsappPhone ?? '';
  const canOpenWhatsApp = isValidWhatsAppPhone(storePhone);
  const waUrl = canOpenWhatsApp ? buildWhatsAppUrl(storePhone, message) : null;
  const printUrl = tenant ? `/order/${order.id}/print?tenant=${tenant.slug}` : `/order/${order.id}/print`;

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message);
    addToast('تم نسخ الرسالة', 'success');
  };

  const handleCopyPhone = () => {
    const phone = order.customerPhone?.trim() ?? '';
    if (phone) {
      navigator.clipboard.writeText(phone);
      addToast('تم نسخ رقم الهاتف', 'success');
    }
  };

  const handleStatus = async (status: Order['status']) => {
    setUpdating(true);
    if (useApi) {
      await api.updateOrderStatus(order.id, status);
    } else {
      updateOrderStatus(order.id, status);
    }
    onStatusChange();
    setUpdating(false);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0" dir="rtl">
      <div className="flex-1 overflow-auto space-y-4">
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700">معلومات العميل</h3>
          <div>
            <p className="text-xs text-gray-500">الاسم</p>
            <p className="font-medium text-lg sm:text-base">{order.customerName || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">الجوال</p>
            <p dir="ltr" className="font-medium text-lg sm:text-base">{order.customerPhone || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">طريقة الاستلام</p>
            <p className="font-medium">
              {order.fulfillmentType === 'DELIVERY' ? 'توصيل' : 'استلام من المحل'}
            </p>
          </div>
        {order.fulfillmentType === 'DELIVERY' && (() => {
          const d = (order as { delivery?: { zoneName?: string; fee?: number; addressText?: string } }).delivery;
          const addr = d?.addressText || order.deliveryAddress;
          return (
            <>
              {d?.zoneName && (
                <div>
                  <p className="text-xs text-gray-500">المنطقة</p>
                  <p>{d.zoneName}</p>
                </div>
              )}
              {d?.fee != null && (
                <div>
                  <p className="text-xs text-gray-500">رسوم التوصيل</p>
                  <p>{formatPrice(d.fee)}</p>
                </div>
              )}
              {addr && (
                <div>
                  <p className="text-xs text-gray-500">العنوان</p>
                  <p>{addr}</p>
                </div>
              )}
            </>
          );
        })()}
        {order.notes && (
          <div>
            <p className="text-xs text-gray-500">ملاحظات</p>
            <p className="text-sm text-gray-600">{order.notes}</p>
          </div>
        )}
        {order.status === 'READY' && order.fulfillmentType === 'DELIVERY' && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs text-gray-500 mb-1">السائق</p>
            {assignedDriver ? (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-medium text-slate-900">{assignedDriver.name}</span>
                {assignedDriver.phone && (
                  <a
                    href={`tel:${assignedDriver.phone}`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary font-medium text-sm"
                  >
                    <Phone className="w-4 h-4" />
                    اتصال
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-600">في انتظار السائق</p>
            )}
          </div>
        )}
        {order.status === 'READY' && order.fulfillmentType === 'PICKUP' && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs text-gray-500 mb-1">طريقة الاستلام</p>
            <p className="text-sm font-medium text-violet-700">جاهز للاستلام من المحل</p>
          </div>
        )}
        {(order as { whatsappNotification?: { status: string; at: string; orderStatus?: string; error?: string } }).whatsappNotification && (() => {
          const wa = (order as { whatsappNotification?: { status: string; at: string; orderStatus?: string; error?: string } }).whatsappNotification!;
          const atDate = wa.at ? new Date(wa.at).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' }) : '';
          return (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-1">إشعار واتساب (آخر تحديث)</p>
              {wa.status === 'sent' ? (
                <p className="text-sm text-emerald-600">تم الإرسال {atDate}</p>
              ) : (
                <p className="text-sm text-red-600">فشل الإرسال {atDate}{wa.error ? ` — ${wa.error}` : ''}</p>
              )}
            </div>
          );
        })()}
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">العناصر</p>
        <ul className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50/50">
          {(order.items ?? []).map((item, i) => {
            const variantLabelsNode = (item.selectedOptions ?? [])
              .map((s, gIdx) => {
                const g = item.optionGroups?.find((x) => x.id === s.optionGroupId);
                const ids = 'optionItemIds' in s ? s.optionItemIds : [];
                const placements = 'optionPlacements' in s ? (s.optionPlacements ?? {}) : {};
                return (
                  <span key={s.optionGroupId ?? gIdx} className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5">
                    {ids.map((id, idx) => {
                      const name = g?.items?.find((opt) => opt.id === id)?.name ?? id;
                      const placement = (placements[id] ?? 'WHOLE') as 'WHOLE' | 'LEFT' | 'RIGHT';
                      return (
                        <Fragment key={id}>
                          {idx > 0 && <span className="text-gray-400 mx-0.5">/</span>}
                          <span>{formatAddonNameWithPlacement(name, placement)}</span>
                        </Fragment>
                      );
                    })}
                  </span>
                );
              })
              .reduce<React.ReactNode[]>((acc, el, idx) => (idx === 0 ? [el] : [...acc, ' | ', el]), []);
            return (
              <li key={i} className="flex justify-between items-start text-sm gap-3">
                <ProductThumb src={(item as { imageUrl?: string }).imageUrl} />
                <div className="min-w-0 flex-1">
                  <span>{item.productName} × {item.quantity}</span>
                  {variantLabelsNode.length > 0 && (
                    <span className="block text-xs text-gray-500 mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0.5">{variantLabelsNode}</span>
                  )}
                </div>
                <span className="font-medium flex-shrink-0">{formatPrice(item.totalPrice)}</span>
              </li>
            );
          })}
        </ul>
        <div className="space-y-1 mt-2 pt-2 border-t border-gray-200">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">المجموع (منتجات)</span>
            <span>{formatPrice(merchantAmount)}</span>
          </div>
          {platformDeliveryFee > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">رسوم التوصيل</span>
              <span>{formatPrice(platformDeliveryFee)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-1">
            <span className="font-semibold text-gray-900">{showGrandTotal ? 'المجموع الكلي' : 'حصة التاجر (صافي المنتجات)'}</span>
            <span className="font-bold text-primary text-xl sm:text-lg">{formatPrice(showGrandTotal ? grandTotal : merchantAmount)}</span>
          </div>
        </div>
      </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-200">
          {waUrl && (
            <Button
              variant="outline"
              size="sm"
              className="bg-[#25D366]/10 text-[#25D366] border-[#25D366]/30 hover:bg-[#25D366]/20"
              onClick={() => window.open(waUrl, '_blank')}
            >
              فتح واتساب
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleCopyMessage}>
            نسخ رسالة واتساب
          </Button>
          {order.customerPhone && (
            <Button variant="outline" size="sm" onClick={handleCopyPhone}>
              نسخ رقم الهاتف
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => window.open(printUrl, '_blank')}>
            طباعة
          </Button>
        </div>
      </div>

      {/* Sticky footer: manual status buttons (always visible) + next action + Assign Driver + Cancel */}
      <div className="shrink-0 pt-4 pb-2 border-t border-gray-200 bg-white -mx-4 px-4 mt-auto">
        <p className="text-sm font-medium text-gray-700 mb-2">تعيين الحالة يدوياً</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {MANUAL_STATUS_BUTTONS.map(({ status, label }) => (
            <Button
              key={status}
              variant={order.status === status ? 'primary' : 'outline'}
              size="sm"
              onClick={() => handleStatus(status)}
              disabled={updating || order.status === status}
              className="gap-1"
            >
              {label}
            </Button>
          ))}
        </div>
        <p className="text-sm font-medium text-gray-700 mb-2">تغيير الحالة</p>
        <div className="flex flex-wrap gap-2">
          {nextAction && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleStatus(nextAction.nextStatus)}
              disabled={updating}
              className="gap-1.5"
            >
              <Truck className="w-4 h-4" />
              {nextAction.label}
            </Button>
          )}
          {showAssignDriver && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAssignDriverOpen(true)}
              className="gap-1.5"
            >
              <Truck className="w-4 h-4" />
              تعيين سائق يدوياً
            </Button>
          )}
          {order.status !== 'CANCELLED' && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600"
              onClick={() => handleStatus('CANCELLED')}
              disabled={updating}
            >
              إلغاء
            </Button>
          )}
        </div>
        {isSuperAdmin && useApi && onRequestHardDelete && (
          <div className="pt-3 mt-3 border-t border-red-100">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={onRequestHardDelete}
            >
              <Trash2 className="w-4 h-4 ml-1" />
              حذف الطلب نهائياً
            </Button>
          </div>
        )}
      </div>

      <Modal
        open={assignDriverOpen}
        onClose={() => setAssignDriverOpen(false)}
        title="تعيين سائق"
      >
        <ul className="space-y-2">
          {MOCK_AVAILABLE_DRIVERS.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-slate-100 text-right"
                onClick={() => {
                  addToast('تم تعيين السائق (واجهة تجريبية)', 'success');
                  setAssignDriverOpen(false);
                }}
              >
                <span className="font-medium">{d.name}</span>
                <a href={`tel:${d.phone}`} className="text-sm text-primary" onClick={(e) => e.stopPropagation()}>
                  <Phone className="w-4 h-4 inline ml-1" />
                  {d.phone}
                </a>
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
