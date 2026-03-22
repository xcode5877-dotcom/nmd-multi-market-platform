import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, useToast, ConfirmDialog } from '@nmd/ui';
import { MockApiClient } from '@nmd/mock';
import { formatPrice, formatDateTimeGregorian } from '@nmd/core';
import { useTenant } from '../contexts/TenantContext';
import { useAuth } from '../../contexts/AuthContext';
import StoreStatusToggle from '../../components/StoreStatusToggle';
import { Trash2 } from 'lucide-react';

const api = new MockApiClient();
const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

function isSuperAdmin(role: string | undefined): boolean {
  return role === 'SUPER_ADMIN';
}

interface OrderExt {
  id: string;
  tenantId: string;
  status?: string;
  readyAt?: string;
  createdAt?: string;
  total?: number;
  fulfillmentType?: string;
  deliveryAssignmentMode?: string;
  fallbackTriggeredAt?: string;
}

export default function TenantOrdersPage() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { user } = useAuth();
  const { tenantId, tenant } = useTenant();
  const superAdmin = isSuperAdmin(user?.role);
  const [deleteTarget, setDeleteTarget] = useState<OrderExt | null>(null);
  const [hardDeleting, setHardDeleting] = useState(false);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['orders', tenantId],
    queryFn: () => api.listOrdersByTenant(tenantId!),
    enabled: !!MOCK_API_URL && !!tenantId,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['leads', tenant?.slug ?? tenantId],
    queryFn: () => api.listLeads(tenant?.slug),
    enabled: !!MOCK_API_URL && !!tenantId,
  });

  const myTenantId = tenantId ? String(tenantId).trim() : '';
  const professionalLeads = (leads as { id: string; tenantId?: string; type: string; contactType?: string; timestamp: string; metadata?: Record<string, unknown> }[]).filter(
    (l) => myTenantId !== '' && l.tenantId != null && String(l.tenantId).trim() === myTenantId && l.type === 'PROFESSIONAL_CONTACT'
  );

  const ordersAndLeads = [
    ...(orders as OrderExt[]).map((o) => ({ ...o, isLead: false })),
    ...professionalLeads.map((l) => ({
      id: l.id,
      tenantId: l.tenantId!,
      status: 'PROFESSIONAL_CONTACT',
      createdAt: l.timestamp,
      total: undefined,
      isLead: true,
      contactType: l.contactType,
      metadata: l.metadata,
    })),
  ].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());

  const markReadyMutation = useMutation({
    mutationFn: (orderId: string) => api.markOrderReady(tenantId!, orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', tenantId] });
      addToast('تم تعليم الطلب جاهزاً', 'success');
    },
    onError: (e) => addToast(e instanceof Error ? e.message : 'فشل', 'error'),
  });

  const handleHardDelete = async () => {
    if (!deleteTarget || !MOCK_API_URL) return;
    setHardDeleting(true);
    try {
      await api.hardDeleteOrder(deleteTarget.id);
      queryClient.invalidateQueries({ queryKey: ['orders', tenantId] });
      setDeleteTarget(null);
      addToast('تم حذف الطلب نهائياً', 'success');
    } catch {
      addToast('فشل حذف الطلب', 'error');
    } finally {
      setHardDeleting(false);
    }
  };

  const tenantType = (tenant as { tenantType?: string })?.tenantType ?? 'SHOP';
  const isRestaurant = tenantType === 'RESTAURANT';
  const allowFallback = (tenant as { allowMarketCourierFallback?: boolean })?.allowMarketCourierFallback ?? false;


  if (!MOCK_API_URL || !tenantId) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">الطلبات</h1>
        <Card className="p-6">
          <p className="text-sm text-gray-500">يتطلب الاتصال بواجهة برمجة التطبيقات</p>
        </Card>
      </div>
    );
  }

  const operationalStatus = (tenant as { operationalStatus?: 'open' | 'closed' | 'busy' })?.operationalStatus ?? 'open';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">الطلبات</h1>
        {tenantId && (
          <StoreStatusToggle
            tenantId={tenantId}
            currentStatus={operationalStatus}
            emphasizeClosed
            variant="full"
          />
        )}
      </div>
      {allowFallback && (
        <p className="text-sm text-amber-600 mb-4">⚠️ تفعيل الانتقال لتوصيل السوق عند التأخر</p>
      )}
      <Card className="p-4">
        {isLoading ? (
          <p className="text-gray-500 py-8 text-center">جاري التحميل...</p>
        ) : ordersAndLeads.length === 0 ? (
          <p className="text-gray-500 py-8 text-center">لا توجد طلبات أو اتصالات</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-start font-medium text-gray-700">الطلب</th>
                  <th className="px-4 py-2 text-start font-medium text-gray-700">التاريخ</th>
                  <th className="px-4 py-2 text-start font-medium text-gray-700">الإجمالي</th>
                  <th className="px-4 py-2 text-start font-medium text-gray-700">الحالة</th>
                  {isRestaurant && <th className="px-4 py-2 text-start font-medium text-gray-700">جاهز في</th>}
                  <th className="px-4 py-2 text-start font-medium text-gray-700">إجراء</th>
                  {superAdmin && <th className="px-4 py-2 text-start font-medium text-gray-700 w-10" aria-label="حذف نهائي" />}
                </tr>
              </thead>
              <tbody>
                {ordersAndLeads.map((o) => {
                  const isLead = (o as { isLead?: boolean }).isLead;
                  const contactType = (o as { contactType?: string }).contactType;
                  const statusLabel = isLead
                    ? (contactType === 'call' ? 'اتصال مهني (هاتف)' : 'اتصال مهني (واتساب)')
                    : (o.status ?? '-');
                  const readyAt = (o as OrderExt).readyAt ? new Date((o as OrderExt).readyAt ?? 0) : null;
                  const now = new Date();
                  const minsLeft = readyAt ? Math.max(0, Math.round((readyAt.getTime() - now.getTime()) / 60000)) : null;
                  const canMarkReady = !isLead && isRestaurant && o.status !== 'READY' && o.status !== 'OUT_FOR_DELIVERY' && o.status !== 'DELIVERED' && o.status !== 'CANCELED';
                  return (
                    <tr key={o.id} className={`border-t border-gray-100 ${isLead ? 'bg-emerald-50/50' : ''}`}>
                      <td className="px-4 py-2 font-mono text-xs">{o.id.slice(0, 8)}</td>
                      <td className="px-4 py-2 text-gray-600">{o.createdAt ? formatDateTimeGregorian(o.createdAt) : '-'}</td>
                      <td className="px-4 py-2">{isLead ? '—' : formatPrice(o.total ?? 0)}</td>
                      <td className="px-4 py-2">
                        <span className={isLead ? 'text-emerald-700 font-medium' : o.status === 'READY' ? 'text-green-600 font-medium' : ''}>
                          {statusLabel}
                        </span>
                        {(o as OrderExt).fallbackTriggeredAt && (
                          <span className="ms-1 text-xs text-amber-600" title="انتقل لتوصيل السوق">↗</span>
                        )}
                      </td>
                      {isRestaurant && (
                        <td className="px-4 py-2">
                          {isLead ? '-' : o.status === 'READY' ? (
                            <span className="text-green-600">جاهز</span>
                          ) : minsLeft !== null ? (
                            <span className={minsLeft <= 0 ? 'text-amber-600' : 'text-gray-600'}>{minsLeft} د</span>
                          ) : (
                            '-'
                          )}
                        </td>
                      )}
                      <td className="px-4 py-2">
                        {canMarkReady && (
                          <Button
                            size="sm"
                            onClick={() => markReadyMutation.mutate(o.id)}
                            disabled={markReadyMutation.isPending}
                          >
                            جاهز للاستلام
                          </Button>
                        )}
                      </td>
                      {superAdmin && (
                        <td className="px-4 py-2">
                          {!isLead && (
                            <button
                              type="button"
                              className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                              onClick={() => setDeleteTarget(o as OrderExt)}
                              aria-label="حذف الطلب نهائياً"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleHardDelete}
        title="حذف الطلب نهائياً"
        message={deleteTarget ? 'هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء.' : ''}
        confirmLabel="حذف نهائياً"
        variant="danger"
        loading={hardDeleting}
        closeOnConfirm={false}
      />
    </div>
  );
}
