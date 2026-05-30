import { useQuery } from '@tanstack/react-query';
import { Drawer } from '@nmd/ui';
import { MockApiClient } from '@nmd/mock';
import { formatDateGregorian } from '@nmd/core';
import PlatformOrderOpsPanel from './PlatformOrderOpsPanel';
import { canUsePlatformOrderOps, formatOrderStatusLabel } from '../../lib/platform-order-ops';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';
const api = new MockApiClient();

type Props = {
  orderId: string | null;
  onClose: () => void;
  userRole?: string;
  storeName?: string;
  invalidateKeys?: string[][];
};

export default function OrderPlatformOpsDrawer({
  orderId,
  onClose,
  userRole,
  storeName,
  invalidateKeys = [],
}: Props) {
  const { data: order, isLoading, isError } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => api.getOrder(orderId!),
    enabled: !!orderId && !!MOCK_API_URL,
  });

  if (!canUsePlatformOrderOps(userRole)) return null;

  return (
    <Drawer open={!!orderId} onClose={onClose} title="تشغيل الطلب" contentClassName="md:max-w-md">
      {!orderId ? null : isLoading ? (
        <div className="py-8 text-center text-gray-500">جاري التحميل...</div>
      ) : isError || !order ? (
        <div className="py-8 text-center text-red-600">تعذر تحميل الطلب</div>
      ) : (
        <div className="space-y-4" dir="rtl">
          <div className="rounded-lg border bg-gray-50 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">المعرّف</span>
              <span className="font-mono text-xs">{order.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">المحل</span>
              <span>{storeName ?? order.tenantId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">الحالة</span>
              <span className="font-medium">{formatOrderStatusLabel(order.status)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">التاريخ</span>
              <span>{order.createdAt ? formatDateGregorian(order.createdAt) : '—'}</span>
            </div>
          </div>
          <PlatformOrderOpsPanel
            order={order as Parameters<typeof PlatformOrderOpsPanel>[0]['order']}
            userRole={userRole}
            invalidateKeys={[...invalidateKeys, ['order', orderId!]]}
          />
        </div>
      )}
    </Drawer>
  );
}
