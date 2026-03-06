import { useState, useEffect, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import { formatPrice, formatAddonNameWithPlacement, buildWhatsAppMessage, buildWhatsAppUrl, buildWhatsAppDeepLink, isValidWhatsAppPhone, getOperationalStatus } from '@nmd/core';
import { openWhatsAppOrderLink } from '../lib/whatsapp';
import { Button, Input, useToast } from '@nmd/ui';
import { Banknote, CreditCard, Lock } from 'lucide-react';
import { useAppStore } from '../store/app';
import { useCartStore } from '../store/cart';
import { priceCart } from '../lib/pricing';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import { useGlobalAuthModal } from '../contexts/GlobalAuthModalContext';

const api = new MockApiClient();

/** Same flexible Arabic labels as ProductPage (restaurants and stores) */
const DELIVERY_LABEL = 'توصيل سريع ومباشر | يتم التنسيق فور تأكيد الطلب';
const STORE_POLICY_LABEL = 'نضمن لكم أفضل جودة. في حال وجود أي ملاحظة على الطلب، يرجى التواصل مع المتجر مباشرة عبر الواتساب';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const tenantId = useAppStore((s) => s.tenantId) ?? 'default';
  const tenantSlug = useAppStore((s) => s.tenantSlug) ?? tenantId;
  const storeType = useAppStore((s) => s.storeType);
  if (storeType === 'PROFESSIONAL') {
    return <Navigate to={tenantSlug ? `/${tenantSlug}` : '/'} replace />;
  }
  const items = useCartStore((s) => s.getItems(tenantId));
  const clearCart = useCartStore((s) => s.clearCart);
  const addToast = useToast().addToast;
  const { customer, isLoading: authLoading, logout } = useCustomerAuth();
  const { openAuthModal } = useGlobalAuthModal();
  const authModalOpenedOnMountRef = useRef(false);

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
    if (!authLoading && !customer && !authModalOpenedOnMountRef.current) {
      authModalOpenedOnMountRef.current = true;
      openAuthModal();
    }
  }, [authLoading, customer, openAuthModal]);

  useEffect(() => {
    if (customer?.phone) setCustomerPhone(customer.phone);
    if (customer?.name) setCustomerName(customer.name ?? '');
  }, [customer?.phone, customer?.name]);

  const nameValid = customerName.trim().length > 0;
  const phoneValid = customerPhone.trim().length > 0;
  const addressValid = !needsAddress || address.trim().length > 0;
  const formValid = nameValid && phoneValid && addressValid && zoneValid;

  const operationalStatus = tenant ? getOperationalStatus(tenant) : 'open';
  const orderPolicy = (tenant?.orderPolicy as 'accept_always' | 'accept_only_when_open') ?? 'accept_only_when_open';
  const canPlaceOrder = operationalStatus !== 'closed' || orderPolicy === 'accept_always';
  const isBusy = operationalStatus === 'busy';
  const showBusyBanner = isBusy && !!tenant?.busyBannerEnabled;
  const busyBannerText = tenant?.busyBannerText ?? 'المحل مشغول حالياً، قد يستغرق الطلب وقتاً أطول';

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
        customerName: (customer?.name ?? customerName.trim()) || undefined,
        customerPhone: (customer?.phone ?? customerPhone.trim()) || undefined,
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
        const itemsWithNames = priced.map((p) => ({
          ...p.item,
          totalPrice: p.finalPrice * p.item.quantity,
          productName: p.item.productName ?? 'منتج',
        }));
        const orderForWa = {
          ...order,
          items: (order.items?.length ?? 0) > 0
            ? order.items.map((oi, idx) => {
                const fromPriced = priced[idx];
                return {
                  ...oi,
                  productName: (oi as { productName?: string }).productName ?? fromPriced?.item.productName ?? 'منتج',
                  quantity: oi.quantity ?? fromPriced?.item.quantity ?? 1,
                  totalPrice: oi.totalPrice ?? (fromPriced ? fromPriced.finalPrice * fromPriced.item.quantity : 0),
                };
              })
            : itemsWithNames,
          total: order.total ?? totalWithDelivery,
          deliveryAddress: order.deliveryAddress ?? addressText,
          customerName: order.customerName ?? customerName.trim(),
          customerPhone: order.customerPhone ?? customerPhone.trim(),
          delivery: order.delivery ?? (fulfillmentType === 'DELIVERY' ? { method: 'DELIVERY', zoneName: selectedZone?.name, fee: deliveryFee, addressText } : undefined),
        };
        const message = buildWhatsAppMessage(orderForWa, tenant);
        const waUrl = buildWhatsAppUrl(storePhone, message);
        const deepLinkUrl = buildWhatsAppDeepLink(storePhone, message);
        if (waUrl || deepLinkUrl) openWhatsAppOrderLink(waUrl ?? '', deepLinkUrl ?? '');
      } else {
        addToast('تم حفظ الطلب، واتساب غير مُهيأ', 'info');
      }
      navigate(tenantSlug ? `/${tenantSlug}/order/${order.id}/success` : `/order/${order.id}/success`);
    },
    onError: () => {
      addToast('حدث خطأ، يرجى المحاولة مرة أخرى', 'error');
    },
  });

  const isAuthenticated = !!customer;

  const handleSubmit = () => {
    setTouched({ name: true, phone: true, address: true, zone: true });
    if (!formValid) return;
    if (!isAuthenticated) {
      addToast('يرجى تسجيل الدخول لتأكيد الطلب', 'info');
      openAuthModal({
        onSuccess: (loggedInCustomer) => {
          if (loggedInCustomer?.phone && !customerPhone.trim()) setCustomerPhone(loggedInCustomer.phone);
          if (loggedInCustomer?.name && !customerName.trim()) setCustomerName(loggedInCustomer.name);
        },
      });
      return;
    }
    createOrder.mutate();
  };

  if (!pickupMode && !deliveryMode) {
    return (
      <div className="max-w-2xl mx-auto p-8 pt-6 md:pt-8 text-center text-neutral-500" dir="rtl">
        لا يوجد طريقة توصيل متاحة
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-8 pt-6 md:pt-8 text-center" dir="rtl">
        <p className="text-neutral-600 mb-6">لا توجد عناصر في السلة</p>
        <Button onClick={() => navigate(tenantSlug ? `/${tenantSlug}` : '/')}>العودة للتسوق</Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 pt-6 md:pt-4" dir="rtl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">إتمام الطلب</h1>

      {showBusyBanner && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-medium">
          {busyBannerText}
        </div>
      )}

      {!canPlaceOrder && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border-2 border-red-300 text-red-800 font-medium">
          عذراً، المتجر لا يستقبل طلبات في الوقت الحالي.
        </div>
      )}

      <div className="relative">
        {!authLoading && !isAuthenticated && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-white/90 backdrop-blur-sm"
            aria-hidden="false"
          >
            <p className="text-gray-700 font-medium mb-4">يرجى تسجيل الدخول للمتابعة وإتمام الطلب</p>
            <Button onClick={() => openAuthModal()} className="shrink-0">
              تسجيل الدخول
            </Button>
          </div>
        )}
        <div className="grid lg:grid-cols-[1fr,320px] gap-8">
          {/* Form */}
          <div className="space-y-6">
            {/* Delivery method */}
            <section>
              <h2 className="text-sm font-medium text-gray-900 mb-3">طريقة الاستلام</h2>
              <div className="flex gap-6">
                {pickupMode && (
                  <label className={`flex items-center gap-2 ${isAuthenticated ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                    <input
                      type="radio"
                      name="fulfillment"
                      value="PICKUP"
                      checked={fulfillmentType === 'PICKUP'}
                      onChange={() => setFulfillmentType('PICKUP')}
                      disabled={!isAuthenticated}
                      className="w-4 h-4 text-primary border-neutral-300"
                    />
                    <span className="text-sm text-gray-700">استلام من المحل</span>
                  </label>
                )}
                {deliveryMode && (
                  <label className={`flex items-center gap-2 ${isAuthenticated ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                    <input
                      type="radio"
                      name="fulfillment"
                      value="DELIVERY"
                      checked={fulfillmentType === 'DELIVERY'}
                      onChange={() => {
                        setFulfillmentType('DELIVERY');
                        setSelectedZoneId(zones[0]?.id ?? '');
                      }}
                      disabled={!isAuthenticated}
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
                  onClick={() => openAuthModal()}
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
              disabled={!isAuthenticated}
            />
            <Input
              label="رقم الجوال"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
              placeholder="05xxxxxxxx"
              error={touched.phone && !phoneValid ? 'مطلوب' : undefined}
              disabled={!isAuthenticated}
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
                  disabled={!isAuthenticated}
                  className={`w-full ps-3 pe-3 py-2 rounded-[var(--radius)] border bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none disabled:opacity-60 disabled:cursor-not-allowed ${
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
                  disabled={!isAuthenticated}
                  className="w-full h-10 ps-3 pe-3 rounded-[var(--radius)] border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
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
                disabled={!isAuthenticated}
                className="w-full ps-3 pe-3 py-2 rounded-[var(--radius)] border border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none disabled:opacity-60 disabled:cursor-not-allowed"
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
              <div className="pt-3 space-y-1.5 text-neutral-500 text-xs border-t border-neutral-100 mt-3" dir="rtl">
                <p>{DELIVERY_LABEL}</p>
                <p>{STORE_POLICY_LABEL}</p>
              </div>
            </div>

            <Button
              className="w-full h-12 rounded-xl mt-4"
              onClick={handleSubmit}
              loading={createOrder.isPending}
              disabled={!formValid || !canPlaceOrder}
            >
              {!canPlaceOrder
                ? 'لا نقبل الطلبات حالياً'
                : !isAuthenticated
                  ? 'تسجيل الدخول وإتمام الطلب'
                  : 'إتمام الطلب'}
            </Button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
