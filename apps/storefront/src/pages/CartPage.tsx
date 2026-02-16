import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import { formatPrice, formatAddonNameWithPlacement } from '@nmd/core';
import { Button } from '@nmd/ui';
import { useAppStore } from '../store/app';
import { useCartStore } from '../store/cart';
import { priceCart } from '../lib/pricing';

const api = new MockApiClient();

export default function CartPage() {
  const tenantId = useAppStore((s) => s.tenantId) ?? 'default';
  const tenantSlug = useAppStore((s) => s.tenantSlug) ?? tenantId;
  const items = useCartStore((s) => s.getItems(tenantId));
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const { data: campaigns } = useQuery({
    queryKey: ['campaigns', tenantId],
    queryFn: () => api.getCampaigns(tenantId),
    enabled: !!tenantId,
  });

  const { priced, subtotal, discountTotal, total } = priceCart(items, campaigns ?? []);

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center" dir="rtl">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-neutral-600 mb-6"
        >
          سلة التسوق فارغة
        </motion.p>
        <Link to={tenantSlug ? `/${tenantSlug}` : '/'}>
          <Button variant="outline">العودة للتسوق</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4" dir="rtl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">السلة</h1>

      <div className="grid lg:grid-cols-[1fr,320px] gap-8">
        {/* Product list */}
        <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white">
          {priced.map(({ item, finalPrice, campaignDiscount, priceBeforeDiscount }, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex gap-4 p-4 border-b border-neutral-200 last:border-b-0"
            >
              <img
                src={item.imageUrl ?? 'https://placehold.co/96x96?text=No+Image'}
                alt={item.productName}
                className="w-20 h-20 md:w-24 md:h-24 object-cover rounded-lg flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 line-clamp-2">{item.productName}</h3>
                {item.selectedOptions.length > 0 && (
                  <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">
                    {item.selectedOptions
                      .map((s) => {
                        const g = item.optionGroups.find((g) => g.id === s.optionGroupId);
                        const ids = 'optionItemIds' in s ? s.optionItemIds : [];
                        const placements = 'optionPlacements' in s ? (s.optionPlacements ?? {}) : {};
                        return ids
                          .map((id) => {
                            const name = g?.items.find((i) => i.id === id)?.name;
                            if (!name) return '';
                            return formatAddonNameWithPlacement(name, placements[id]);
                          })
                          .filter(Boolean)
                          .join('، ');
                      })
                      .filter(Boolean)
                      .join(' • ')}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateQuantity(tenantId, item.id, Math.max(0, item.quantity - 1))
                    }
                    className="w-8 h-8 rounded-lg border border-neutral-200 hover:bg-neutral-50 flex items-center justify-center text-neutral-600"
                    aria-label="تقليل الكمية"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(tenantId, item.id, item.quantity + 1)}
                    className="w-8 h-8 rounded-lg border border-neutral-200 hover:bg-neutral-50 flex items-center justify-center text-neutral-600"
                    aria-label="زيادة الكمية"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex flex-col items-end justify-between">
                <button
                  type="button"
                  onClick={() => removeItem(tenantId, item.id)}
                  className="text-neutral-400 hover:text-red-500 transition-colors p-1 -m-1"
                  aria-label="إزالة"
                >
                  <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                </button>
                <div className="text-end">
                  {campaignDiscount > 0 && (
                    <p className="text-xs text-neutral-400 line-through">
                      {formatPrice(priceBeforeDiscount * item.quantity)}
                    </p>
                  )}
                  <p className="font-semibold text-gray-900">
                    {formatPrice(finalPrice * item.quantity)}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Order summary */}
        <div className="lg:sticky lg:top-24 self-start">
          <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-neutral-600">
                <span>المجموع الفرعي</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {discountTotal > 0 && (
                <div className="flex justify-between text-neutral-600">
                  <span>الخصم</span>
                  <span className="text-primary">-{formatPrice(discountTotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-neutral-600">
                <span>التوصيل</span>
                <span>يُحسب عند الدفع</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-neutral-200">
                <span className="font-semibold text-gray-900">المجموع النهائي</span>
                <span className="text-lg font-bold text-gray-900">{formatPrice(total)}</span>
              </div>
            </div>
            <Link to={tenantSlug ? `/${tenantSlug}/checkout` : '/checkout'} className="block mt-4">
              <Button className="w-full h-12 rounded-xl">
                إتمام الطلب
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
