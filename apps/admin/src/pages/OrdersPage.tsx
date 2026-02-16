import { useState, useMemo } from 'react';
import type { Order } from '@nmd/core';
import { Card, Button, DataTable, Drawer, InlineBadge, PageHeader, FiltersBar, EmptyState, ConfirmDialog, useToast } from '@nmd/ui';
import { useAdminContext } from '../context/AdminContext';
import { listOrdersByTenant, updateOrderStatus } from '@nmd/mock';
import { buildWhatsAppMessage, buildWhatsAppUrl, formatPrice, formatAddonNameWithPlacement, isValidWhatsAppPhone } from '@nmd/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';

const api = new MockApiClient();
const USE_API = !!import.meta.env.VITE_MOCK_API_URL;

const SOFT_LAUNCH_STATUSES = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const;
const STATUS_LABELS: Record<string, string> = {
  PENDING: 'جديد',
  CONFIRMED: 'تم التواصل',
  COMPLETED: 'تم التسليم',
  CANCELLED: 'ملغي',
};

export default function OrdersPage() {
  const { tenantId } = useAdminContext();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'today' | 'all'>('today');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);

  const { data: tenant } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => api.getTenant(tenantId),
    enabled: !!tenantId,
  });

  const { data: ordersData = [] } = useQuery({
    queryKey: ['orders', tenantId, refresh],
    queryFn: () => api.listOrdersByTenant(tenantId),
    enabled: !!tenantId && USE_API,
  });

  const ordersLocal = useMemo(() => listOrdersByTenant(tenantId), [tenantId, refresh]);
  let orders = USE_API ? ordersData : ordersLocal;
  if (filter === 'today') {
    const today = new Date().toDateString();
    orders = orders.filter((o) => new Date(o.createdAt).toDateString() === today);
  }
  orders = orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (statusFilter) orders = orders.filter((o) => o.status === statusFilter);
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    orders = orders.filter(
      (o) =>
        String((o as { id?: unknown }).id ?? '').toLowerCase().includes(q) ||
        (o.customerName ?? '').toLowerCase().includes(q) ||
        (o.customerPhone ?? '').replace(/\D/g, '').includes(q.replace(/\D/g, ''))
    );
  }

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
    const itemsArr = Array.isArray((o as { items?: unknown }).items) ? (o as { items: unknown[] }).items : [];
    return {
    orderId: (
      <span className="font-mono text-sm font-medium">{hasValidId ? idStr.slice(0, 8) : '—'}</span>
    ),
    date: (
      <span className="text-gray-500 text-sm">{new Date(o.createdAt).toLocaleString('ar-SA')}</span>
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
      <span className="text-sm text-gray-600">
        {itemsArr.length} {itemsArr.length === 1 ? 'منتج' : 'منتجات'}
      </span>
    ),
    total: <span className="font-bold text-primary">{formatPrice(o.total)}</span>,
    status: <InlineBadge status={o.status} />,
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
          <div className="flex gap-2">
            <Button variant={filter === 'today' ? 'primary' : 'outline'} size="sm" onClick={() => setFilter('today')}>
              اليوم
            </Button>
            <Button variant={filter === 'all' ? 'primary' : 'outline'} size="sm" onClick={() => setFilter('all')}>
              الكل
            </Button>
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
                { key: 'total', label: 'المجموع' },
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
}: {
  order: Order;
  tenant: import('@nmd/core').Tenant | null | undefined;
  onStatusChange: () => void;
  useApi?: boolean;
}) {
  const [updating, setUpdating] = useState(false);
  const addToast = useToast().addToast;
  const message = tenant ? buildWhatsAppMessage(order, tenant) : '';
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
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">العناصر</p>
        <ul className="space-y-2 border border-gray-200 rounded-lg p-3 bg-gray-50/50">
          {order.items.map((item, i) => {
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
              <li key={i} className="flex justify-between items-start text-sm gap-2">
                <div className="min-w-0">
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
        <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-200">
          <span className="font-semibold text-gray-900">المجموع</span>
          <span className="font-bold text-primary text-lg">{formatPrice(order.total)}</span>
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
