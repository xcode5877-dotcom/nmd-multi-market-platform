import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import { formatPrice, formatAddonNameWithPlacement } from '@nmd/core';

const api = new MockApiClient();

export default function OrderPrintPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const tenantSlug = searchParams.get('tenant') ?? '';

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ['public-order', orderId],
    queryFn: async () => {
      const o = await api.getPublicOrder(orderId!);
      if (!o) throw new Error('NOT_FOUND');
      return o;
    },
    enabled: !!orderId,
    retry: false,
  });

  const { data: tenant } = useQuery({
    queryKey: ['tenant', tenantSlug || order?.tenantId],
    queryFn: () => api.getTenant(tenantSlug || order!.tenantId),
    enabled: !!order,
  });

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <p>جاري التحميل...</p>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600">تعذر تحميل الطلب.</p>
      </div>
    );
  }

  return (
    <div className="order-print p-8 max-w-2xl mx-auto">
      <style>{`
        @media print {
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          .order-print { padding: 0; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="border border-gray-300 rounded-lg p-6">
        <div className="text-center border-b border-gray-200 pb-4 mb-4">
          <h1 className="text-xl font-bold">{tenant?.name ?? 'المتجر'}</h1>
          <p className="text-gray-600">طلب #{order.id.slice(0, 8)}</p>
          <p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleString('ar-SA')}</p>
        </div>
        <div className="space-y-2 text-sm">
          <p><span className="font-medium">نوع التوصيل:</span> {order.fulfillmentType === 'DELIVERY' ? 'توصيل' : 'استلام'}</p>
          {order.customerName && <p><span className="font-medium">الاسم:</span> {order.customerName}</p>}
          {order.customerPhone && <p><span className="font-medium">الجوال:</span> {order.customerPhone}</p>}
          {order.deliveryAddress && <p><span className="font-medium">العنوان:</span> {order.deliveryAddress}</p>}
        </div>
        <div className="mt-4 border-t border-gray-200 pt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-start py-2">المنتج</th>
                <th className="text-start py-2">الكمية</th>
                <th className="text-end py-2">السعر</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => {
                const optParts = (item.selectedOptions ?? [])
                  .flatMap((s) => {
                    const g = item.optionGroups?.find((x) => x.id === s.optionGroupId);
                    const ids = 'optionItemIds' in s ? s.optionItemIds : [];
                    const placements = 'optionPlacements' in s ? (s.optionPlacements ?? {}) : {};
                    return ids
                      .map((id) => {
                        const name = g?.items?.find((i) => i.id === id)?.name;
                        if (!name) return '';
                        return formatAddonNameWithPlacement(name, placements[id]);
                      })
                      .filter(Boolean);
                  })
                  .filter(Boolean);
                const optsStr = optParts.length > 0 ? ` (${optParts.join('، ')})` : '';
                return (
                  <tr key={item.id} className="border-b">
                    <td className="py-2">{item.productName}{optsStr}</td>
                    <td className="py-2">{item.quantity}</td>
                    <td className="py-2 text-end">{formatPrice(item.totalPrice)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 border-t border-gray-200 pt-4 flex justify-between font-bold">
          <span>الإجمالي</span>
          <span>{formatPrice(order.total)}</span>
        </div>
        {order.notes && (
          <p className="mt-4 text-sm text-gray-600">ملاحظات: {order.notes}</p>
        )}
      </div>
      <div className="no-print mt-6 text-center">
        <button onClick={() => window.print()} className="px-4 py-2 bg-primary text-white rounded">
          طباعة
        </button>
      </div>
    </div>
  );
}
