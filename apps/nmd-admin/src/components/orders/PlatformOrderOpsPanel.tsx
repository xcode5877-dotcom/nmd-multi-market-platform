import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Modal, useToast } from '@nmd/ui';
import { MockApiClient } from '@nmd/mock';
import { AlertTriangle, Shield } from 'lucide-react';
import { useEmergencyMode } from '../../contexts/EmergencyModeContext';
import {
  canUsePlatformOrderOps,
  formatOrderStatusLabel,
  getPlatformOrderActions,
  type PlatformOrderAction,
  type PlatformOrderActionId,
  type PlatformOrderLike,
} from '../../lib/platform-order-ops';

const api = new MockApiClient();
const USE_API = !!import.meta.env.VITE_MOCK_API_URL;

type Props = {
  order: PlatformOrderLike;
  userRole?: string;
  /** Query keys to invalidate after success */
  invalidateKeys?: string[][];
  compact?: boolean;
};

export default function PlatformOrderOpsPanel({
  order,
  userRole,
  invalidateKeys = [],
  compact = false,
}: Props) {
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const emergency = useEmergencyMode();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [pendingAction, setPendingAction] = useState<PlatformOrderActionId | null>(null);

  const actions = getPlatformOrderActions(order);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['order', order.id] });
    for (const key of invalidateKeys) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  };

  const runMutation = useMutation({
    mutationFn: async (actionId: PlatformOrderActionId) => {
      const orderId = order.id!;
      const tenantId = order.tenantId!;

      switch (actionId) {
        case 'receive':
          return api.updateOrderStatus(orderId, 'CONFIRMED');
        case 'preparing':
          return api.updateOrderStatus(orderId, 'PREPARING');
        case 'ready':
          return api.markOrderReady(tenantId, orderId);
        case 'handed_to_driver':
          return api.markOrderHandedToDriver(tenantId, orderId);
        case 'pickup_complete':
          return api.updateOrderStatus(orderId, 'COMPLETED');
        case 'cancel':
          return api.updateOrderStatus(orderId, 'CANCELLED');
        default:
          throw new Error('Unknown action');
      }
    },
    onSuccess: (_data, actionId) => {
      invalidate();
      const label = getPlatformOrderActions(order).find((a) => a.id === actionId)?.label ?? 'تم';
      addToast(`${label} — تم بنجاح`, 'success');
      setPendingAction(null);
      setCancelOpen(false);
      setCancelReason('');
    },
    onError: (err) => {
      addToast(err instanceof Error ? err.message : 'فشل تنفيذ الإجراء', 'error');
      setPendingAction(null);
    },
  });

  if (!USE_API || !canUsePlatformOrderOps(userRole)) return null;
  if (!order.id || !order.tenantId) return null;
  if (actions.length === 0) return null;

  const isRootAdmin = userRole === 'ROOT_ADMIN';
  const needsEmergencyForReady = isRootAdmin && !(emergency?.enabled && emergency?.reason?.trim());

  const handleAction = (action: PlatformOrderAction) => {
    if (action.id === 'cancel') {
      setCancelOpen(true);
      return;
    }
    if (action.id === 'ready' && needsEmergencyForReady) {
      addToast('فعّل وضع الطوارئ مع سبب (ROOT) لتعليم الطلب جاهزاً', 'error');
      return;
    }
    setPendingAction(action.id);
    runMutation.mutate(action.id);
  };

  const confirmCancel = () => {
    if (!cancelReason.trim()) {
      addToast('أدخل سبب الإلغاء', 'error');
      return;
    }
    setPendingAction('cancel');
    runMutation.mutate('cancel');
  };

  const handedAt = order.deliveryTimeline?.handedToDriverAt;

  return (
    <section className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex items-start gap-2 rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2 text-sm text-indigo-900">
        <Shield className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">تشغيل المنصة — متجر بدون جهاز</p>
          <p className="text-xs text-indigo-700 mt-0.5">
            الحالة: {formatOrderStatusLabel(order.status)}
            {handedAt && ' · تم التسليم للسائق'}
          </p>
        </div>
      </div>

      {needsEmergencyForReady && actions.some((a) => a.id === 'ready') && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          «جاهز للتسليم» يتطلب وضع الطوارئ (ROOT) — SUPER_ADMIN معفى.
        </p>
      )}

      {order.status === 'READY' &&
        order.fulfillmentType === 'DELIVERY' &&
        !order.courierId && (
          <p className="text-xs text-gray-600 bg-gray-50 border rounded-lg px-3 py-2">
            لتسليم الطلب للسائق: عيّن سائقاً أولاً من صفحة التوزيع.
          </p>
        )}

      <div className={`flex flex-wrap gap-2 ${compact ? '' : 'pt-1'}`}>
        {actions
          .filter((a) => a.id !== 'cancel')
          .map((action) => (
            <Button
              key={action.id}
              size={compact ? 'sm' : 'md'}
              variant={action.variant === 'primary' ? 'primary' : 'outline'}
              disabled={runMutation.isPending}
              onClick={() => handleAction(action)}
              title={action.hint}
            >
              {runMutation.isPending && pendingAction === action.id ? 'جاري...' : action.label}
            </Button>
          ))}
        {actions.find((a) => a.id === 'cancel') && (
          <Button
            size={compact ? 'sm' : 'md'}
            variant="outline"
            className="text-red-700 border-red-200 hover:bg-red-50"
            disabled={runMutation.isPending}
            onClick={() => handleAction(actions.find((a) => a.id === 'cancel')!)}
          >
            إلغاء / رفض
          </Button>
        )}
      </div>

      <Modal open={cancelOpen} onClose={() => !runMutation.isPending && setCancelOpen(false)} title="إلغاء / رفض الطلب">
        <div className="space-y-4" dir="rtl">
          <div className="flex gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p>إلغاء الطلب لا يعني إرجاع الدفع تلقائيًا — لا يتم استرداد فيزا/بطاقة من هنا.</p>
          </div>
          {(order.paymentMethod === 'CARD' ||
            (order as { payment?: { method?: string } }).payment?.method === 'CARD') && (
            <p className="text-sm text-gray-600">طلب بطاقة — راجع بوابة الدفع يدوياً إن لزم.</p>
          )}
          <label className="block text-sm">
            <span className="text-gray-700">سبب الإلغاء (للتشغيل الداخلي)</span>
            <textarea
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[80px]"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="مثال: المتجر مغلق / نفاد المخزون"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={runMutation.isPending}>
              تراجع
            </Button>
            <Button
              variant="primary"
              className="bg-red-600 hover:bg-red-700"
              onClick={confirmCancel}
              disabled={runMutation.isPending || !cancelReason.trim()}
            >
              {runMutation.isPending && pendingAction === 'cancel' ? 'جاري...' : 'تأكيد الإلغاء'}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
