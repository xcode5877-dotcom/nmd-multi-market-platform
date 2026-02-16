import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import { formatPrice, formatAddonNameWithPlacement, buildWhatsAppMessage, buildWhatsAppUrl, isValidWhatsAppPhone } from '@nmd/core';
import { Button, Input, useToast } from '@nmd/ui';
import { Banknote, CreditCard, Lock } from 'lucide-react';
import { useAppStore } from '../store/app';
import { useCartStore } from '../store/cart';
import { priceCart } from '../lib/pricing';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import { OtpLoginModal } from '../components/OtpLoginModal';

const api = new MockApiClient();

export default function CheckoutPage() {
  const navigate = useNavigate();
  const tenantId = useAppStore((s) => s.tenantId) ?? 'default';
  const tenantSlug = useAppStore((s) => s.tenantSlug) ?? tenantId;
  const items = useCartStore((s) => s.getItems(tenantId));
  const clearCart = useCartStore((s) => s.clearCart);
  const addToast = useToast().addToast;
  const { customer, logout } = useCustomerAuth();
  const [otpModalOpen, setOtpModalOpen] = useState(false);

  const { data: campaigns } = useQuery({
    queryKey: ['campaigns', tenantId],
    queryFn: () => api.getCampaigns(tenantId),
    enabled: !!tenantId,
  });
  const { data: deliverySettings } = useQuery({
    queryKey: ['delivery', tenantId],
    queryFn: () => api.getDeliverySettings(tenantId),
    enabled: !!tenantId,
  });
  const { data: deliveryZones = [] } = useQuery({
    queryKey: ['delivery-zones', tenantId],
    queryFn: () => api.getDeliveryZones(tenantId),
    enabled: !!tenantId,
  });
  const { data: tenant } = useQuery({
    queryKey: ['tenant', tenantId],
    queryFn: () => api.getTenant(tenantId),
    enabled: !!tenantId,
  });

  const { priced, subtotal, discountTotal, total } = priceCart(items, campaigns ?? []);

  const [fulfillmentType, setFulfillmentType] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const zones = deliveryZones.filter((z) => z.isActive);
  const cardComingSoon = (tenant?.paymentCapabilities?.card ?? false) === false;
  const deliveryMode = deliverySettings?.modes?.delivery ?? true;
  const pickupMode = deliverySettings?.modes?.pickup ?? true;
  const baseDeliveryFee = deliverySettings?.deliveryFee ?? 0;
  const selectedZone = zones.find((z) => z.id === selectedZoneId);
  const deliveryFee = fulfillmentType === 'DELIVERY' ? (selectedZone?.fee ?? baseDeliveryFee) : 0;
  const totalWithDelivery = total + deliveryFee;

  const needsAddress = fulfillmentType === 'DELIVERY';
  const needsZone = fulfillmentType === 'DELIVERY' && zones.length > 0;
  const zoneValid = !needsZone || selectedZoneId.length > 0;
  const addressText = needsAddress ? address.trim() : undefined;

  useEffect(() => {
    if (customer?.phone && !customerPhone) setCustomerPhone(customer.phone);
  }, [customer?.phone, customerPhone]);

  const nameValid = customerName.trim().length > 0;
  const phoneValid = customerPhone.trim().length > 0;
  const addressValid = !needsAddress || address.trim().length > 0;
  const formValid = nameValid && phoneValid && addressValid && zoneValid;

  const createOrder = useMutation({
    mutationFn: () =>
      api.createOrder(tenantId, {
        tenantId,
        items: priced.map((p) => ({
          ...p.item,
          totalPrice: p.finalPrice * p.item.quantity,
        })),
        fulfillmentType,
        paymentMethod: 'CASH',
        notes: notes.trim() || undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        deliveryAddress: addressText || undefined,
        delivery: {
          method: fulfillmentType,
          zoneId: selectedZone?.id,
          zoneName: selectedZone?.name,
          fee: fulfillmentType === 'DELIVERY' ? deliveryFee : undefined,
          addressText: addressText,
        },
      }),
    onSuccess: (order) => {
      clearCart(tenantId);
      const storePhone = tenant?.branding?.whatsappPhone ?? '';
      if (isValidWhatsAppPhone(storePhone) && tenant) {
        addToast('تم إنشاء الطلب بنجاح', 'success');
        const message = buildWhatsAppMessage(order, tenant);
        const waUrl = buildWhatsAppUrl(storePhone, message);
        window.open(waUrl, '_blank', 'noopener,noreferrer');
      } else {
        addToast('تم حفظ الطلب، واتساب غير مُهيأ', 'info');
      }
      navigate(tenantSlug ? `/${tenantSlug}/order/${order.id}/success` : `/order/${order.id}/success`);
    },
    onError: () => {
      addToast('حدث خطأ، يرجى المحاولة مرة أخرى', 'error');
    },
  });

  const handleSubmit = () => {
    setTouched({ name: true, phone: true, address: true, zone: true });
    if (!formValid) return;
    createOrder.mutate();
  };

  if (!pickupMode && !deliveryMode) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-neutral-500" dir="rtl">
        لا يوجد طريقة توصيل متاحة
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center" dir="rtl">
        <p className="text-neutral-600 mb-6">لا توجد عناصر في السلة</p>
        <Button onClick={() => navigate(tenantSlug ? `/${tenantSlug}` : '/')}>العودة للتسوق</Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4" dir="rtl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">إتمام الطلب</h1>

      <div className="grid lg:grid-cols-[1fr,320px] gap-8">
        {/* Form */}
        <div className="space-y-6">
          {/* Delivery method */}
          <section>
            <h2 className="text-sm font-medium text-gray-900 mb-3">طريقة الاستلام</h2>
            <div className="flex gap-6">
              {pickupMode && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="fulfillment"
                    value="PICKUP"
                    checked={fulfillmentType === 'PICKUP'}
                    onChange={() => setFulfillmentType('PICKUP')}
                    className="w-4 h-4 text-primary border-neutral-300"
                  />
                  <span className="text-sm text-gray-700">استلام من المحل</span>
                </label>
              )}
              {deliveryMode && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="fulfillment"
                    value="DELIVERY"
                    checked={fulfillmentType === 'DELIVERY'}
                    onChange={() => {
                      setFulfillmentType('DELIVERY');
                      setSelectedZoneId(zones[0]?.id ?? '');
                    }}
                    className="w-4 h-4 text-primary border-neutral-300"
                  />
                  <span className="text-sm text-gray-700">توصيل للمنزل</span>
                </label>
              )}
            </div>
          </section>

          {/* Customer info */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-900">معلومات العميل</h2>
              {customer ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">مرحباً، {customer.phone}</span>
                  <button
                    type="button"
                    onClick={logout}
                    className="text-xs text-primary hover:underline"
                  >
                    تسجيل الخروج
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setOtpModalOpen(true)}
                  className="text-xs text-primary hover:underline"
                >
                  تسجيل الدخول
                </button>
              )}
            </div>
            <Input
              label="الاسم الكامل"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
              placeholder="الاسم الكامل"
              error={touched.name && !nameValid ? 'مطلوب' : undefined}
            />
            <Input
              label="رقم الجوال"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
              placeholder="05xxxxxxxx"
              error={touched.phone && !phoneValid ? 'مطلوب' : undefined}
            />

            {fulfillmentType === 'DELIVERY' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 ms-1">
                  العنوان (مطلوب للتوصيل)
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, address: true }))}
                  placeholder="الشارع، الحي، المدينة"
                  rows={3}
                  className={`w-full ps-3 pe-3 py-2 rounded-[var(--radius)] border bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none ${
                    touched.address && !addressValid ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {touched.address && !addressValid && (
                  <p className="text-sm text-red-600 mt-1">مطلوب للتوصيل</p>
                )}
              </div>
            )}

            {fulfillmentType === 'DELIVERY' && zones.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 ms-1">
                  المنطقة
                </label>
                <select
                  value={selectedZoneId}
                  onChange={(e) => setSelectedZoneId(e.target.value)}
                  className="w-full h-10 ps-3 pe-3 rounded-[var(--radius)] border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">اختر المنطقة</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} - {formatPrice(z.fee)}
                      {z.etaMinutes ? ` (${z.etaMinutes} د)` : ''}
                    </option>
                  ))}
                </select>
                {touched.zone && !zoneValid && (
                  <p className="text-sm text-red-600 mt-1">اختر المنطقة</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 ms-1">
                ملاحظات (اختياري)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظات إضافية للطلب"
                rows={3}
                className="w-full ps-3 pe-3 py-2 rounded-[var(--radius)] border border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              />
            </div>
          </section>

          {/* Payment method */}
          <section>
            <h2 className="text-sm font-medium text-gray-900 mb-3">طريقة الدفع</h2>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 bg-white cursor-pointer hover:border-primary/50">
                <input
                  type="radio"
                  name="payment"
                  value="CASH"
                  checked
                  readOnly
                  className="w-4 h-4 text-primary border-neutral-300"
                />
                <Banknote className="w-5 h-5 text-emerald-600" />
                <div>
                  <span className="text-sm font-medium text-gray-900">نقداً عند الاستلام</span>
                  <span className="block text-xs text-neutral-500">الدفع نقداً عند الاستلام أو الاستلام</span>
                </div>
              </label>
              {cardComingSoon && (
                <div
                  className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 bg-neutral-50 opacity-75 cursor-not-allowed"
                  title="Coming soon"
                >
                  <input type="radio" name="payment" disabled className="w-4 h-4" />
                  <CreditCard className="w-5 h-5 text-neutral-400" />
                  <Lock className="w-4 h-4 text-neutral-400" />
                  <div>
                    <span className="text-sm font-medium text-neutral-600">الدفع بالبطاقة</span>
                    <span className="block text-xs text-neutral-500">قريباً</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Order summary */}
        <div className="lg:sticky lg:top-24 self-start">
          <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50/50">
            <h2 className="text-sm font-medium text-gray-900 mb-3">ملخص الطلب</h2>

            {cardComingSoon && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4" dir="rtl">
                الدفع نقداً عند الاستلام حالياً. الدفع بالبطاقة قريباً.
              </p>
            )}

            <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
              {priced.map(({ item, finalPrice }) => (
                <div
                  key={item.id}
                  className="flex justify-between items-start gap-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-gray-700 line-clamp-1 block">
                      {item.productName} × {item.quantity}
                    </span>
                    {item.selectedOptions.length > 0 && (
                      <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">
                        {item.selectedOptions
                          .map((s) => {
                            const grp = item.optionGroups.find((x) => x.id === s.optionGroupId);
                            const ids = 'optionItemIds' in s ? s.optionItemIds : [];
                            const placements = 'optionPlacements' in s ? (s.optionPlacements ?? {}) : {};
                            return ids
                              .map((id) => {
                                const name = grp?.items.find((i) => i.id === id)?.name;
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
                  </div>
                  <span className="font-medium flex-shrink-0">
                    {formatPrice(finalPrice * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2 text-sm border-t border-neutral-200 pt-3">
              <div className="flex justify-between text-neutral-600">
                <span>المجموع الفرعي</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              {discountTotal > 0 && (
                <div className="flex justify-between text-primary">
                  <span>الخصم</span>
                  <span>-{formatPrice(discountTotal)}</span>
                </div>
              )}
              {fulfillmentType === 'DELIVERY' && deliveryFee > 0 && (
                <div className="flex justify-between text-neutral-600">
                  <span>رسوم التوصيل</span>
                  <span>{formatPrice(deliveryFee)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-2">
                <span className="font-semibold text-gray-900">المجموع النهائي</span>
                <span className="text-lg font-bold text-gray-900">
                  {formatPrice(totalWithDelivery)}
                </span>
              </div>
            </div>

            <Button
              className="w-full h-12 rounded-xl mt-4"
              onClick={handleSubmit}
              loading={createOrder.isPending}
              disabled={!formValid}
            >
              إتمام الطلب
            </Button>
          </div>
        </div>
      </div>
      <OtpLoginModal open={otpModalOpen} onClose={() => setOtpModalOpen(false)} />
    </div>
  );
}
