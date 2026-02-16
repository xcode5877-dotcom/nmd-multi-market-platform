import { useQuery } from '@tanstack/react-query';
import { useAdminContext } from '../context/AdminContext';
import { listOrdersByTenant, updateOrderStatus } from '@nmd/mock';
import type { Order } from '@nmd/core';
import { Card, PageHeader } from '@nmd/ui';
import { formatPrice } from '@nmd/core';

const COLS = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'] as const;
const COL_LABELS: Record<string, string> = {
  PENDING: 'جديد',
  CONFIRMED: 'مؤكد',
  PREPARING: 'تحضير',
  READY: 'جاهز',
  COMPLETED: 'مكتمل',
};

export default function OrdersBoardPage() {
  const { tenantId } = useAdminContext();
  const { data: orders, refetch } = useQuery({
    queryKey: ['orders-board', tenantId],
    queryFn: () => Promise.resolve(listOrdersByTenant(tenantId)),
    enabled: !!tenantId,
    refetchInterval: 5000,
  });

  const byStatus = (status: string) => (orders ?? []).filter((o) => o.status === status);

  return (
    <div>
      <PageHeader title="لوحة الطلبات" subtitle="اسحب الطلبات أو انقر للتنقل بين المراحل" />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 overflow-x-auto pb-4">
        {COLS.map((status) => (
          <div key={status} className="min-w-[200px] flex flex-col">
            <div className="flex items-center justify-between mb-3 px-1">
              <h2 className="font-semibold text-sm text-gray-700">{COL_LABELS[status]}</h2>
              <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                {byStatus(status).length}
              </span>
            </div>
            <div className="flex-1 min-h-[120px] rounded-lg bg-gray-100/50 p-2 space-y-2 flex flex-col">
              {byStatus(status).map((o) => (
                <OrderCard key={o.id} order={o} onAdvance={() => refetch()} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderCard({ order, onAdvance }: { order: Order; onAdvance: () => void }) {
  const idx = COLS.indexOf(order.status as typeof COLS[number]);
  const nextStatus = idx >= 0 && idx < COLS.length - 1 ? COLS[idx + 1] : null;

  const handleAdvance = () => {
    if (nextStatus) {
      updateOrderStatus(order.id, nextStatus);
      onAdvance();
    }
  };

  return (
    <Card className="p-3 text-sm hover:shadow-md transition-shadow">
      <div className="font-mono font-medium">{order.id.slice(0, 8)}</div>
      <div className="text-primary font-bold text-base mt-0.5">{formatPrice(order.total)}</div>
      <div className="text-xs text-gray-500 mt-1">{order.items.length} صنف</div>
      {nextStatus && (
        <button
          onClick={handleAdvance}
          className="mt-2 w-full py-1.5 text-xs bg-primary text-white rounded-[var(--radius)] font-medium"
        >
          ← {COL_LABELS[nextStatus]}
        </button>
      )}
    </Card>
  );
}
