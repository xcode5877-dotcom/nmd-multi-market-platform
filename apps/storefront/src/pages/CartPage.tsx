import { Link, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { useQueries } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import { formatPrice, formatAddonNameWithPlacement, roundMoney } from '@nmd/core';
import { Button } from '@nmd/ui';
import { useAppStore } from '../store/app';
import { useCartStore } from '../store/cart';
import { priceCart } from '../lib/pricing';
import { isAndroidOrMobileApp } from '../lib/platform';

const api = new MockApiClient();

export default function CartPage() {
  const tenantSlug = useAppStore((s) => s.tenantSlug);
  const storeType = useAppStore((s) => s.storeType);
  const carts = useCartStore((s) => s.carts);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const tenantIds = Object.keys(carts).filter((id) => (carts[id]?.length ?? 0) > 0);
  const getItems = (tenantId: string) => carts[tenantId] ?? [];

  if (storeType === 'PROFESSIONAL') {
    return <Navigate to={tenantSlug ? `/${tenantSlug}` : '/'} replace />;
  }
  const campaignsQueries = useQueries({
    queries: tenantIds.map((id) => ({
      queryKey: ['campaigns', id],
      queryFn: () => api.getCampaigns(id),
      enabled: !!id,
    })),
  });
  const tenantQueries = useQueries({
    queries: tenantIds.map((id) => ({
      queryKey: ['tenant', id],
      queryFn: () => api.getTenant(id),
      enabled: !!id,
    })),
  });

  const storeData = tenantIds.map((tenantId, i) => {
    const items = getItems(tenantId);
    const campaigns = campaignsQueries[i]?.data ?? [];
    const { priced, subtotal, discountTotal, total } = priceCart(items, campaigns);
    const tenant = tenantQueries[i]?.data;
    const tenantName = (tenant as { name?: string })?.name ?? tenantId.slice(0, 8);
    return { tenantId, tenantName, items, priced, subtotal, discountTotal, total };
  });
  const totalAll = storeData.reduce((s, d) => s + d.total, 0);
  const totalItems = storeData.reduce((s, d) => s + d.items.length, 0);

  const isAndroid = isAndroidOrMobileApp();
  if (totalItems === 0) {
    return (
      <div className={`max-w-2xl mx-auto p-8 pt-6 md:pt-8 text-center bg-white min-h-full ${isAndroid ? 'pb-40' : ''}`} dir="rtl">
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

  const checkoutSlug = tenantSlug ?? (tenantQueries[0]?.data as { slug?: string } | undefined)?.slug ?? '';
  const checkoutPath = checkoutSlug ? `/${checkoutSlug}/checkout` : '/checkout';

  return (
    <div
      className={`max-w-5xl mx-auto p-4 pt-6 md:pt-4 bg-white min-h-full ${isAndroid ? 'pb-40' : ''}`}
      dir="rtl"
    >
      <h1 className="text-xl font-semibold text-gray-900 mb-6">سلة التسوق</h1>

      <div className="grid lg:grid-cols-[1fr,320px] gap-8">
        {/* Item list: single market identity; items are the hero */}
        <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white">
          {storeData.map(({ tenantId, tenantName, priced }) => (
            <div key={tenantId}>
              {storeData.length > 1 && (
                <div className="px-4 py-1.5 border-b border-neutral-100 text-xs text-neutral-500">
                  من {tenantName}
                </div>
              )}
              <AnimatePresence initial={false}>
                {priced.map(({ item, finalPrice, campaignDiscount, priceBeforeDiscount }, i) => (
                  <motion.div
                    key={`${tenantId}-${item.id}`}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.18 } }}
                    transition={{ delay: i * 0.03, layout: { duration: 0.2 } }}
                    className="flex gap-4 p-4 border-b border-neutral-200 last:border-b-0"
                  >
                  <img
                    src={item.imageUrl ?? 'https://placehold.co/96x96?text=No+Image'}
                    alt={item.productName}
                    loading="lazy"
                    decoding="async"
                    className="w-20 h-20 md:w-24 md:h-24 object-cover rounded-lg flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 line-clamp-2">{item.productName}</h3>
                    {storeData.length > 1 && (
                      <p className="text-[11px] text-neutral-400 mt-0.5">{tenantName}</p>
                    )}
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
                      {(() => {
                        const isWeightBased =
                          (item as { isWeightBased?: boolean }).isWeightBased === true ||
                          ((item as { quantityStep?: number }).quantityStep ?? 1) < 1;
                        const step = isWeightBased
                          ? (item as { quantityStep?: number }).quantityStep ?? 1
                          : 1;
                        const unit = isWeightBased
                          ? (item as { unitName?: string }).unitName ?? 'حبة'
                          : 'حبة';
                        const showUnitLabel =
                          isWeightBased &&
                          !['حبة', 'pcs'].includes((unit ?? '').trim().toLowerCase());
                        const minQ = step > 0 ? step : 1;
                        const displayQty = isWeightBased ? item.quantity : Math.round(item.quantity);
                        return (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                const next = isWeightBased
                                  ? roundMoney(Math.max(minQ, item.quantity - step))
                                  : Math.max(1, Math.round(item.quantity) - 1);
                                updateQuantity(tenantId, item.id, next <= 0 ? 0 : next);
                              }}
                              className="w-8 h-12 rounded-lg border border-neutral-200 hover:bg-white hover:border-neutral-300 flex items-center justify-center text-neutral-600"
                              aria-label="تقليل الكمية"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={minQ}
                              step={step}
                              value={displayQty}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                if (Number.isNaN(v)) return;
                                const q =
                                  v <= 0 ? 0 : isWeightBased ? roundMoney(Math.max(minQ, v)) : Math.max(1, Math.round(v));
                                updateQuantity(tenantId, item.id, q);
                              }}
                              className="w-14 h-12 text-center text-sm font-medium border border-neutral-200 rounded-lg p-0 leading-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              aria-label="الكمية المطلوبة"
                            />
                            {showUnitLabel && <span className="text-sm text-neutral-600 min-w-[2.5rem]">{unit}</span>}
                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(
                                  tenantId,
                                  item.id,
                                  isWeightBased ? roundMoney(item.quantity + step) : Math.round(item.quantity) + 1
                                )
                              }
                              className="w-8 h-12 rounded-lg border border-neutral-200 hover:bg-white hover:border-neutral-300 flex items-center justify-center text-neutral-600"
                              aria-label="زيادة الكمية"
                            >
                              +
                            </button>
                          </>
                        );
                      })()}
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
                          {formatPrice(roundMoney(priceBeforeDiscount * item.quantity))}
                        </p>
                      )}
                      <p className="font-semibold text-gray-900">
                        {formatPrice(roundMoney(finalPrice * item.quantity))}
                      </p>
                    </div>
                  </div>
                </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {/* Order summary — unified platform style (no store branding) */}
        <div className="lg:sticky lg:top-24 self-start">
          <div className="p-4 rounded-xl border border-neutral-200 bg-white shadow-sm" data-unified-cart-summary>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-neutral-600">
                <span>المجموع الفرعي</span>
                <span>{formatPrice(totalAll)}</span>
              </div>
              <div className="flex justify-between text-neutral-600">
                <span>التوصيل</span>
                <span>يُحسب عند الدفع</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-neutral-200">
                <span className="font-semibold text-gray-900">المجموع النهائي</span>
                <span className="text-lg font-bold text-gray-900">{formatPrice(totalAll)}</span>
              </div>
            </div>
            <Link to={checkoutPath} className="block mt-4">
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
