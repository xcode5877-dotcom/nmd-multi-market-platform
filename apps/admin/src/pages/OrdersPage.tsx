import { useState, useMemo } from 'react';
import type { Order } from '@nmd/core';
import { Card, Button, DataTable, Drawer, InlineBadge, PageHeader, FiltersBar, EmptyState, ConfirmDialog, useToast } from '@nmd/ui';
import { Package, Bell } from 'lucide-react';
import { useAdminContext } from '../context/AdminContext';
import { useAuth } from '../contexts/AuthContext';
import { isPlatformAdmin } from '../lib/is-platform-admin';
import { listOrdersByTenant, updateOrderStatus } from '@nmd/mock';
import { buildWhatsAppMessage, buildWhatsAppUrl, buildOrderActionLinksSection, formatPrice, formatDateTimeGregorian, formatAddonNameWithPlacement, isValidWhatsAppPhone } from '@nmd/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';

const api = new MockApiClient();
const USE_API = !!import.meta.env.VITE_MOCK_API_URL;

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

const SOFT_LAUNCH_STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const;
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'جديد',
  CONFIRMED: 'تم التواصل',
  COMPLETED: 'تم التسليم',
  CANCELLED: 'ملغي',
};

export default function OrdersPage() {
  const { tenantId } = useAdminContext();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const showGrandTotal = isPlatformAdmin(user?.role);
  const [filter, setFilter] = useState<'today' | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);

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
      <div className="flex gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
        {o.status !== 'CONFIRMED' && o.status !== 'CANCELLED' && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 px-2 rounded-lg border-gray-300 hover:border-primary hover:bg-primary/5"
            onClick={() => handleStatus(o, 'CONFIRMED')}
          >
            تم التواصل
          </Button>
        )}
        {o.status !== 'COMPLETED' && o.status !== 'CANCELLED' && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 px-2 rounded-lg border-gray-300 hover:border-primary hover:bg-primary/5"
            onClick={() => handleStatus(o, 'COMPLETED')}
          >
            تم التسليم
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
            {SOFT_LAUNCH_STATUSES.map((s) => (
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
            <DataTable
              columns={[
                { key: 'orderId', label: 'رقم' },
                { key: 'date', label: 'التاريخ' },
                { key: 'customer', label: 'العميل' },
                { key: 'items', label: 'العناصر' },
                { key: 'total', label: showGrandTotal ? 'المجموع الكلي' : 'حصة التاجر' },
                { key: 'status', label: 'الحالة' },
                { key: 'actions', label: 'إجراءات', className: 'w-48' },
              ]}
              rows={rows}
              onRowClick={(_row, index) => setSelectedOrder(orders[index])}
              emptyMessage="لا توجد طلبات"
            />
          )}
        </div>
      </Card>
      <Drawer
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={selectedOrder ? `طلب #${String((selectedOrder as { id?: unknown }).id ?? '').slice(0, 8) || '—'}` : ''}
        side="start"
      >
        {selectedOrder && (
          <OrderDrawerContent
            order={selectedOrder}
            tenant={tenant}
            onStatusChange={() => {
              if (USE_API) queryClient.invalidateQueries({ queryKey: ['orders', tenantId] });
              else setRefresh((r) => r + 1);
              setSelectedOrder(null);
            }}
            useApi={USE_API}
            showGrandTotal={showGrandTotal}
          />
        )}
      </Drawer>
      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => cancelTarget && handleStatus(cancelTarget, 'CANCELLED')}
        title="إلغاء الطلب"
        message={cancelTarget ? `هل أنت متأكد من إلغاء الطلب #${String((cancelTarget as { id?: unknown }).id ?? '').slice(0, 8) || '—'}؟` : ''}
        confirmLabel="إلغاء الطلب"
        variant="danger"
      />
    </div>
  );
}

function OrderDrawerContent({
  order,
  tenant,
  onStatusChange,
  useApi,
  showGrandTotal,
}: {
  order: Order & { merchantAmount?: number; platformDeliveryFee?: number; subtotal?: number; delivery?: { fee?: number }; items?: { totalPrice?: number }[] };
  tenant: import('@nmd/core').Tenant | null | undefined;
  onStatusChange: () => void;
  useApi?: boolean;
  showGrandTotal?: boolean;
}) {
  const { merchantAmount, platformDeliveryFee, grandTotal } = getOrderAmounts(order);
  const [updating, setUpdating] = useState(false);
  const addToast = useToast().addToast;
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
    <div className="space-y-4" dir="rtl">
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-700">معلومات العميل</h3>
        <div>
          <p className="text-xs text-gray-500">الاسم</p>
          <p className="font-medium">{order.customerName || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">الجوال</p>
          <p dir="ltr" className="font-medium">{order.customerPhone || '—'}</p>
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
            const variantLabels = (item.selectedOptions ?? [])
              .map((s) => {
                const g = item.optionGroups?.find((x) => x.id === s.optionGroupId);
                const ids = 'optionItemIds' in s ? s.optionItemIds : [];
                const placements = 'optionPlacements' in s ? (s.optionPlacements ?? {}) : {};
                return ids
                  .map((id) => {
                    const name = g?.items?.find((opt) => opt.id === id)?.name;
                    if (!name) return '';
                    return formatAddonNameWithPlacement(name, placements[id]);
                  })
                  .filter(Boolean)
                  .join('، ');
              })
              .filter(Boolean)
              .join(' | ');
            return (
              <li key={i} className="flex justify-between items-start text-sm gap-3">
                <ProductThumb src={(item as { imageUrl?: string }).imageUrl} />
                <div className="min-w-0 flex-1">
                  <span>{item.productName} × {item.quantity}</span>
                  {variantLabels && (
                    <span className="block text-xs text-gray-500 mt-0.5">{variantLabels}</span>
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
            <span className="font-bold text-primary text-lg">{formatPrice(showGrandTotal ? grandTotal : merchantAmount)}</span>
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

      <div className="pt-4 border-t border-gray-200">
        <p className="text-sm font-medium text-gray-700 mb-2">تغيير الحالة</p>
        <div className="flex flex-wrap gap-2">
          {SOFT_LAUNCH_STATUSES.filter((s) => s !== 'CANCELLED').map((s) => (
            <Button
              key={s}
              variant={order.status === s ? 'primary' : 'outline'}
              size="sm"
              onClick={() => handleStatus(s)}
              disabled={updating}
            >
              {STATUS_LABELS[s]}
            </Button>
          ))}
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
      </div>
    </div>
  );
}
