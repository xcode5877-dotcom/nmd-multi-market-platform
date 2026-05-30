// UI_UPDATE_2026_03_19
import { useState, useEffect, useRef } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueries } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import { formatPrice, formatAddonNameWithPlacement, getOperationalStatus, roundMoney, type Order } from '@nmd/core';
import { Button, Input, useToast } from '@nmd/ui';
import confetti from 'canvas-confetti';
import { Banknote, CreditCard, Lock, Check, Loader2, Truck, Store, Pencil } from 'lucide-react';
import { getLastDelivery, saveLastDelivery } from '../lib/delivery-location';

/** Default address when customer does not type one; driver gets location via WhatsApp. */
const DEFAULT_DELIVERY_ADDRESS = 'دبورية - تواصل معي بالواتساب لتحديد الموقع';
import { useAppStore } from '../store/app';
import { useCartStore, ADDITIONAL_STORE_DELIVERY_FEE_NIS } from '../store/cart';
import { priceCart } from '../lib/pricing';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import { useGlobalAuthModal } from '../contexts/GlobalAuthModalContext';
import { useWinnerCoupon } from '../contexts/WinnerCouponContext';
const api = new MockApiClient();

/** Same flexible Arabic labels as ProductPage (restaurants and stores) */
const DELIVERY_LABEL = 'توصيل سريع ومباشر | يتم التنسيق فور تأكيد الطلب';

/** Now Market brand colors for confetti celebration */
const CONFETTI_COLORS = ['#FF4500', '#000000', '#FFFFFF'];

/** Fire confetti burst from center on order success. Respects prefers-reduced-motion. */
function fireOrderConfetti(): void {
  const opts = {
    particleCount: 120,
    spread: 100,
    origin: { x: 0.5, y: 0.5 },
    colors: CONFETTI_COLORS,
    startVelocity: 35,
    decay: 0.91,
    ticks: 220,
    disableForReducedMotion: true,
  };
  confetti(opts);
  setTimeout(() => {
    confetti({ ...opts, particleCount: 50, spread: 60, origin: { x: 0.25, y: 0.5 } });
  }, 120);
  setTimeout(() => {
    confetti({ ...opts, particleCount: 50, spread: 60, origin: { x: 0.75, y: 0.5 } });
  }, 240);
}
const STORE_POLICY_LABEL = 'نضمن لكم أفضل جودة. في حال وجود أي ملاحظة على الطلب، يرجى التواصل عبر الواتساب';

export default function CheckoutPage() {
  const navigate = useNavigate();
  const appTenantId = useAppStore((s) => s.tenantId) ?? 'default';
  const tenantSlug = useAppStore((s) => s.tenantSlug) ?? appTenantId;
  const storeType = useAppStore((s) => s.storeType);
  const getTenantIdsInCart = useCartStore((s) => s.getTenantIdsInCart);
  const getItems = useCartStore((s) => s.getItems);
  const getStoreCountInCart = useCartStore((s) => s.getStoreCountInCart);
  const getCartHasMultipleMarkets = useCartStore((s) => s.getCartHasMultipleMarkets);
  const repriceFromCatalog = useCartStore((s) => s.repriceFromCatalog);
  const clearCart = useCartStore((s) => s.clearCart);
  const addToast = useToast().addToast;
  const { customer, isLoading: authLoading } = useCustomerAuth();
  const { openAuthModal } = useGlobalAuthModal();
  const { markCouponApplied } = useWinnerCoupon();
  const authModalOpenedOnMountRef = useRef(false);

  const tenantIds = getTenantIdsInCart();
  const primaryTenantId = tenantIds[0] ?? appTenantId;

  const { data: deliverySettings } = useQuery({
    queryKey: ['delivery', primaryTenantId],
    queryFn: () => api.getDeliverySettings(primaryTenantId),
    enabled: !!primaryTenantId,
  });
  const { data: deliveryZones = [] } = useQuery({
    queryKey: ['delivery-zones', primaryTenantId],
    queryFn: () => api.getDeliveryZones(primaryTenantId),
    enabled: !!primaryTenantId,
  });
  const { data: tenant } = useQuery({
    queryKey: ['tenant', primaryTenantId],
    queryFn: () => api.getTenant(primaryTenantId),
    enabled: !!primaryTenantId,
  });

  const campaignsQueries = useQueries({
    queries: tenantIds.map((tid) => ({
      queryKey: ['campaigns', tid] as const,
      queryFn: () => api.getCampaigns(tid),
      enabled: !!tid,
    })),
  });
  const tenantQueries = useQueries({
    queries: tenantIds.map((tid) => ({
      queryKey: ['tenant', tid] as const,
      queryFn: () => api.getTenant(tid),
      enabled: !!tid,
    })),
  });

  const catalogQueries = useQueries({
    queries: tenantIds.map((tid) => ({
      queryKey: ['products', tid, 'checkout-reprice'] as const,
      queryFn: () => api.getProducts(tid),
      enabled: !!tid,
    })),
  });

  useEffect(() => {
    tenantIds.forEach((tid, i) => {
      const products = catalogQueries[i]?.data;
      if (products && products.length > 0) {
        repriceFromCatalog(tid, products);
      }
    });
  }, [tenantIds, catalogQueries, repriceFromCatalog]);

  const storeData = tenantIds.map((tid, i) => {
    const items = getItems(tid);
    const campaigns = campaignsQueries[i]?.data ?? [];
    const result = priceCart(items, campaigns);
    const tenantName = (tenantQueries[i]?.data as { name?: string } | undefined)?.name ?? tid.slice(0, 8);
    return {
      tenantId: tid,
      tenantName,
      items,
      priced: result.priced,
      subtotal: result.subtotal,
      discountTotal: result.discountTotal,
      total: result.total,
      merchantSubtotal: result.merchantSubtotal,
      merchantTotal: result.merchantTotal,
    };
  });

  const itemsTotal = storeData.reduce((s, d) => s + d.total, 0);
  const subtotalAll = storeData.reduce((s, d) => s + d.subtotal, 0);
  const merchantSubtotalAll = storeData.reduce((s, d) => s + d.merchantSubtotal, 0);
  const discountTotalAll = storeData.reduce((s, d) => s + d.discountTotal, 0);
  const storeCount = getStoreCountInCart();

  const [fulfillmentType, setFulfillmentType] = useState<'PICKUP' | 'DELIVERY'>('DELIVERY');
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState(DEFAULT_DELIVERY_ADDRESS);
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ id: string; code: string; type: string; value: number; discountAmount: number } | null>(null);
  const [couponError, setCouponError] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);
  const [applyingCodeId, setApplyingCodeId] = useState<string | null>(null);
  const lastDelivery = getLastDelivery(primaryTenantId);

  const zones = deliveryZones.filter((z) => z.isActive);

  const cardComingSoon = (tenant?.paymentCapabilities?.card ?? false) === false;
  const deliveryMode = deliverySettings?.modes?.delivery ?? true;
  const pickupMode = deliverySettings?.modes?.pickup ?? true;
  const baseDeliveryFee = deliverySettings?.deliveryFee ?? 0;
  const selectedZone = zones.find((z) => z.id === selectedZoneId);
  const baseZoneFee = fulfillmentType === 'DELIVERY' ? (selectedZone?.fee ?? baseDeliveryFee) : 0;
  const additionalStoreFee = storeCount > 1 ? (storeCount - 1) * ADDITIONAL_STORE_DELIVERY_FEE_NIS : 0;
  const deliveryFee = fulfillmentType === 'DELIVERY' ? baseZoneFee + additionalStoreFee : 0;
  const couponDiscount = appliedCoupon?.discountAmount ?? 0;
  const totalWithDelivery = itemsTotal + deliveryFee - couponDiscount;
  /** Display-only: whole numbers (Math.floor). Cart lines use server displayPrice when repricing is on. */
  const displayTotal = Math.floor(totalWithDelivery);

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

  const cartHasMultipleMarkets = getCartHasMultipleMarkets();
  const operationalStatus = tenant ? getOperationalStatus(tenant) : 'open';
  const orderPolicy = (tenant?.orderPolicy as 'accept_always' | 'accept_only_when_open') ?? 'accept_only_when_open';
  const canPlaceOrder = (operationalStatus !== 'closed' || orderPolicy === 'accept_always') && !cartHasMultipleMarkets;
  const isBusy = operationalStatus === 'busy';
  const showBusyBanner = isBusy && !!tenant?.busyBannerEnabled;
  const busyBannerText = tenant?.busyBannerText ?? 'المحل مشغول حالياً، قد يستغرق الطلب وقتاً أطول';

  const applyCoupon = async () => {
    const code = couponCodeInput.trim();
    if (!code) return;
    await applyCouponWithCode(code);
  };

  const applyCouponWithCode = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setCouponError('');
    setCouponLoading(true);
    setApplyingCodeId(trimmed.toUpperCase());
    try {
      const result = await api.validateCoupon({
        code: trimmed,
        tenantId: primaryTenantId,
        cartStoreIds: tenantIds,
        subtotal: merchantSubtotalAll,
        customerPhone: (customer?.phone ?? customerPhone.trim()) || undefined,
      });
      if (result.valid && result.coupon) {
        setAppliedCoupon(result.coupon);
        setCouponCodeInput(trimmed.toUpperCase());
        setCouponError('');
        markCouponApplied();
      } else {
        setAppliedCoupon(null);
        setCouponError(!result.valid && 'error' in result ? result.error : 'الكود غير صحيح');
      }
    } catch (e) {
      setAppliedCoupon(null);
      const err = e as Error & { status?: number };
      if (err?.message === 'UNAUTHORIZED' || err?.message?.includes('401')) {
        addToast('يرجى تسجيل الدخول لاستخدام الكود', 'error');
        openAuthModal();
        return;
      }
      setCouponError('الكود غير صحيح');
    } finally {
      setCouponLoading(false);
      setApplyingCodeId(null);
    }
  };

  const { data: customerRewards = [] } = useQuery({
    queryKey: ['customer-rewards'],
    queryFn: () => api.getCustomerRewards(),
    enabled: !!customer,
  });

  const createOrder = useMutation({
    mutationFn: async (): Promise<{ firstOrder: Order | undefined; orderGroupId: string }> => {
      const orderGroupId = crypto.randomUUID();
      const created: Order[] = [];
      for (let i = 0; i < tenantIds.length; i++) {
        const tid = tenantIds[i];
        const row = storeData[i];
        if (!row || row.priced.length === 0) continue;
        const isFirstOrder = i === 0;
        const orderDeliveryFee = fulfillmentType === 'DELIVERY' && isFirstOrder ? deliveryFee : 0;
        const order = await api.createOrder(tid, {
          tenantId: tid,
          items: row.priced.map((p) => ({
            ...p.item,
            totalPrice: roundMoney(p.merchantFinalPrice * p.item.quantity),
          })),
          fulfillmentType,
          paymentMethod: 'CASH',
          notes: notes.trim() || undefined,
          customerName: (customer?.name ?? customerName.trim()) || undefined,
          customerPhone: (customer?.phone ?? customerPhone.trim()) || undefined,
          deliveryAddress: addressText || undefined,
          deliveryLocation: undefined,
          orderGroupId,
          delivery: {
            method: fulfillmentType,
            zoneId: selectedZone?.id,
            zoneName: selectedZone?.name,
            fee: fulfillmentType === 'DELIVERY' ? orderDeliveryFee : undefined,
            addressText: addressText,
          },
          ...(isFirstOrder && appliedCoupon
            ? { couponId: appliedCoupon.id, couponDiscountAmount: appliedCoupon.discountAmount }
            : {}),
        });
        created.push(order);
      }
      return { firstOrder: created[0], orderGroupId };
    },
    onSuccess: ({ firstOrder }) => {
      if (!firstOrder) return;
      fireOrderConfetti();
      if (fulfillmentType === 'DELIVERY' && addressText && selectedZone?.id) {
        saveLastDelivery(primaryTenantId, {
          lat: 0,
          lng: 0,
          address: addressText,
          zoneId: selectedZone.id,
        });
      }
      for (const tid of tenantIds) clearCart(tid);
      addToast('تم إرسال طلبك بنجاح', 'success');
      navigate(tenantSlug ? `/${tenantSlug}/order/${firstOrder.id}/success` : `/order/${firstOrder.id}/success`);
    },
    onError: () => {
      addToast('حدث خطأ، يرجى المحاولة مرة أخرى', 'error');
    },
  });

  const isAuthenticated = !!customer;

  const handleSubmit = () => {
    setTouched({ name: true, phone: true, address: true, zone: true });
    if (cartHasMultipleMarkets) {
      addToast('لا يمكن الجمع بين متاجر من أسواق مختلفة في طلب واحد. يرجى إتمام الطلب من متجر واحد أو متاجر من نفس السوق فقط.', 'error');
      return;
    }
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

  if (storeType === 'PROFESSIONAL') {
    return <Navigate to={tenantSlug ? `/${tenantSlug}` : '/'} replace />;
  }

  if (!pickupMode && !deliveryMode) {
    return (
      <div className="max-w-2xl mx-auto p-8 pt-6 md:pt-8 text-center text-neutral-500 bg-white min-h-full" dir="rtl">
        لا يوجد طريقة توصيل متاحة
      </div>
    );
  }

  if (tenantIds.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-8 pt-6 md:pt-8 text-center bg-white min-h-full" dir="rtl">
        <p className="text-neutral-600 mb-6">لا توجد عناصر في السلة</p>
        <Button onClick={() => navigate(tenantSlug ? `/${tenantSlug}` : '/')}>العودة للتسوق</Button>
      </div>
    );
  }

  const totalDiscount = discountTotalAll + couponDiscount;

  return (
    <div
      className="max-w-5xl mx-auto p-4 pt-6 md:pt-4 bg-white min-h-full pb-[200px] md:pb-8"
      dir="rtl"
    >
      {/* Simple header: breadcrumb / welcome */}
      <p className="text-sm text-neutral-500 mb-4">
        {customer?.name ? `مرحباً، ${customer.name}` : customer?.phone ? `مرحباً، ${customer.phone}` : 'إتمام الطلب'}
      </p>

      {showBusyBanner && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-medium">
          {busyBannerText}
        </div>
      )}

      {cartHasMultipleMarkets && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border-2 border-red-300 text-red-800 font-medium" role="alert">
          لا يمكن الجمع بين متاجر من أسواق مختلفة في طلب واحد. يرجى إتمام الطلب من متجر واحد أو متاجر من نفس السوق فقط.
        </div>
      )}
      {!cartHasMultipleMarkets && !canPlaceOrder && (
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
          <div className="space-y-4">
            {/* Delivery: big horizontal buttons */}
            <div className="p-4 rounded-xl bg-white border border-neutral-200/80 shadow-sm">
              <div className="flex gap-3">
                {deliveryMode && (
                  <button
                    type="button"
                    onClick={() => isAuthenticated && (setFulfillmentType('DELIVERY'), zones.length > 0 && setSelectedZoneId(zones[0]?.id ?? ''))}
                    disabled={!isAuthenticated}
                    className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      fulfillmentType === 'DELIVERY'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-neutral-200 hover:border-neutral-300 text-gray-600'
                    } ${!isAuthenticated ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <Truck className="w-8 h-8" strokeWidth={2} />
                    <span className="font-semibold text-sm">توصيل</span>
                  </button>
                )}
                {pickupMode && (
                  <button
                    type="button"
                    onClick={() => isAuthenticated && setFulfillmentType('PICKUP')}
                    disabled={!isAuthenticated}
                    className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      fulfillmentType === 'PICKUP'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-neutral-200 hover:border-neutral-300 text-gray-600'
                    } ${!isAuthenticated ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <Store className="w-8 h-8" strokeWidth={2} />
                    <span className="font-semibold text-sm">استلام</span>
                  </button>
                )}
              </div>
            </div>

          {/* Address & Notes: compact card */}
          <div className="p-4 rounded-xl bg-white border border-neutral-200/80 shadow-sm space-y-3">
            {!isAuthenticated && (
              <button
                type="button"
                onClick={() => openAuthModal()}
                className="w-full text-sm text-primary hover:underline py-1"
              >
                تسجيل الدخول للمتابعة
              </button>
            )}
            {fulfillmentType === 'DELIVERY' && lastDelivery?.address && isAuthenticated && (
              <button
                type="button"
                onClick={() => {
                  setAddress(lastDelivery.address);
                  if (lastDelivery.zoneId) setSelectedZoneId(lastDelivery.zoneId);
                  setTouched((t) => ({ ...t, address: true }));
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg border-2 border-primary bg-primary/10 text-primary font-medium text-sm hover:bg-primary/20 transition-colors"
              >
                <span role="img" aria-hidden>🏠</span>
                التوصيل لنفس عنوان الطلب الأخير
              </button>
            )}

            {fulfillmentType === 'DELIVERY' && isAuthenticated && (
              <>
                <div className="flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-neutral-400 shrink-0" />
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, address: true }))}
                    placeholder={DEFAULT_DELIVERY_ADDRESS}
                    rows={1}
                    disabled={!isAuthenticated}
                    className={`flex-1 min-w-0 text-sm py-1.5 px-2 rounded-lg border bg-transparent text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-primary resize-none ${
                      touched.address && !addressValid ? 'border-red-500' : 'border-neutral-200'
                    }`}
                    style={{ minHeight: 36 }}
                  />
                </div>
                {touched.address && !addressValid && (
                  <p className="text-xs text-red-600">مطلوب للتوصيل</p>
                )}
                {zones.length > 0 && (
                  <select
                    value={selectedZoneId}
                    onChange={(e) => setSelectedZoneId(e.target.value)}
                    disabled={!isAuthenticated}
                    className="w-full h-9 text-sm ps-2 pe-2 rounded-lg border border-neutral-200 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">اختر المنطقة</option>
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.name} - {formatPrice(z.fee)}
                        {z.etaMinutes ? ` (${z.etaMinutes} د)` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}

            <div className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-neutral-400 shrink-0" />
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظات (اختياري)"
                disabled={!isAuthenticated}
                className="flex-1 min-w-0 text-sm py-1.5 px-2 rounded-lg border border-neutral-200 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Payment: card */}
          <div className="p-4 rounded-xl bg-white border border-neutral-200/80 shadow-sm">
            <p className="text-xs font-medium text-neutral-500 mb-2">طريقة الدفع</p>
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
                  className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 bg-white opacity-75 cursor-not-allowed"
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
          </div>
        </div>

        {/* Order summary — unified platform style (no store branding) */}
        <div className="lg:sticky lg:top-24 self-start">
          <div className="p-4 rounded-xl border border-neutral-200 bg-white shadow-sm" data-unified-cart-summary>
            <h2 className="text-sm font-medium text-gray-900 mb-3">ملخص الطلب</h2>

            {cardComingSoon && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4" dir="rtl">
                الدفع نقداً عند الاستلام حالياً. الدفع بالبطاقة قريباً.
              </p>
            )}

            <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
              {storeData.flatMap((row) =>
                row.priced.map(({ item, finalPrice }) => (
                  <div
                    key={`${row.tenantId}-${item.id}`}
                    className="flex justify-between items-start gap-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-gray-700 line-clamp-1 block">
                        {item.productName} ×{' '}
                        {(item as { isWeightBased?: boolean }).isWeightBased === true ||
                        ((item as { quantityStep?: number }).quantityStep ?? 1) < 1
                          ? item.quantity
                          : Math.round(item.quantity)}
                        {(() => {
                          const isW = (item as { isWeightBased?: boolean }).isWeightBased === true ||
                            ((item as { quantityStep?: number }).quantityStep ?? 1) < 1;
                          const u = (item as { unitName?: string }).unitName ?? 'حبة';
                          if (!isW || ['حبة', 'pcs'].includes((u ?? '').trim().toLowerCase())) return null;
                          return ` ${u}`;
                        })()}
                      </span>
                      {storeData.length > 1 && (
                        <span className="text-[11px] text-neutral-400">{row.tenantName}</span>
                      )}
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
                      {formatPrice(roundMoney(finalPrice * item.quantity))}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Suggested winner coupon(s) */}
            {customerRewards.length > 0 && (
              <div className="border-t border-neutral-200 pt-3 pb-2">
                <p className="text-xs font-medium text-amber-800 mb-2 ms-1">كود مقترح لك</p>
                <div className="flex flex-wrap gap-2">
                  {customerRewards.map((r) => {
                    const isApplying = applyingCodeId === r.code.toUpperCase();
                    const isApplied = appliedCoupon?.code === r.code;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => !isApplied && !isApplying && applyCouponWithCode(r.code)}
                        disabled={couponLoading || isApplied}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isApplied
                            ? 'bg-green-50 border-2 border-green-500 text-green-800 cursor-default'
                            : isApplying
                              ? 'bg-amber-50 border border-amber-200 text-amber-900 opacity-80'
                              : 'bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100 disabled:opacity-60'
                        }`}
                      >
                        {isApplying ? (
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />
                        ) : isApplied ? (
                          <Check className="w-4 h-4 shrink-0 text-green-600" aria-hidden />
                        ) : null}
                        <span className="font-mono" dir="ltr">{r.code}</span>
                        <span className={isApplied ? 'text-green-700' : 'text-amber-700'}>
                          {r.type === 'PERCENT' ? `${r.value}%` : formatPrice(r.value)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Coupon code */}
            <div className="border-t border-neutral-200 pt-3 pb-3">
              <label className="block text-sm font-medium text-gray-700 mb-1 ms-1">كود الخصم</label>
              <div className="flex gap-2">
                <Input
                  value={couponCodeInput}
                  onChange={(e) => { setCouponCodeInput(e.target.value.toUpperCase()); setCouponError(''); }}
                  placeholder="أدخل الكود"
                  disabled={!!appliedCoupon || couponLoading}
                  className="flex-1"
                  dir="ltr"
                />
                <Button
                  type="button"
                  onClick={applyCoupon}
                  disabled={!couponCodeInput.trim() || !!appliedCoupon || couponLoading}
                  loading={couponLoading}
                  className="bg-primary text-white font-bold rounded-xl shadow-sm hover:opacity-90 active:scale-95 transition-all"
                >
                  تطبيق
                </Button>
              </div>
              {appliedCoupon && (
                <p className="text-sm text-green-600 mt-1.5">تم تطبيق الخصم</p>
              )}
              {couponError && (
                <p className="text-sm text-red-600 mt-1.5">{couponError}</p>
              )}
            </div>

            <div className="space-y-2.5 text-sm border-t border-neutral-200 pt-4">
              <div className="flex justify-between text-gray-700">
                <span>المجموع</span>
                <span className="font-medium">{formatPrice(subtotalAll)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>الخصم</span>
                  <span className="font-medium">-{formatPrice(totalDiscount)}</span>
                </div>
              )}
              {fulfillmentType === 'DELIVERY' && deliveryFee > 0 && (
                <>
                  {storeCount === 1 ? (
                    <div className="flex justify-between text-gray-700">
                      <span>رسوم التوصيل</span>
                      <span className="font-medium">{formatPrice(deliveryFee)}</span>
                    </div>
                  ) : (
                    <>
                      {baseZoneFee > 0 && (
                        <div className="flex justify-between text-gray-600 text-xs">
                          <span>رسوم التوصيل (أساسي)</span>
                          <span>{formatPrice(baseZoneFee)}</span>
                        </div>
                      )}
                      {additionalStoreFee > 0 && (
                        <div className="flex justify-between text-gray-600 text-xs">
                          <span>رسوم متجر إضافي (× {storeCount - 1})</span>
                          <span>{formatPrice(additionalStoreFee)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-gray-700 font-medium">
                        <span>إجمالي رسوم التوصيل</span>
                        <span>{formatPrice(deliveryFee)}</span>
                      </div>
                    </>
                  )}
                </>
              )}
              <div className="flex justify-between items-center pt-3 border-t border-neutral-100">
                <span className="font-semibold text-gray-900 text-base">الإجمالي</span>
                <span className="text-2xl font-bold text-primary">
                  {formatPrice(displayTotal)}
                </span>
              </div>
              <div className="pt-3 space-y-1.5 text-neutral-500 text-xs border-t border-neutral-100 mt-3" dir="rtl">
                <p>{DELIVERY_LABEL}</p>
                <p>{STORE_POLICY_LABEL}</p>
              </div>
            </div>

            <Button
              className="w-full h-12 rounded-xl mt-4 hidden md:flex font-semibold"
              onClick={handleSubmit}
              loading={createOrder.isPending}
              disabled={!formValid || !canPlaceOrder}
            >
              {cartHasMultipleMarkets
                ? 'السلة تحتوي متاجر من أسواق مختلفة'
                : !canPlaceOrder
                  ? 'لا نقبل الطلبات حالياً'
                  : !isAuthenticated
                    ? 'تسجيل الدخول وإتمام الطلب'
                    : 'تأكيد الطلب'}
            </Button>
          </div>
        </div>
        </div>
      </div>

      {/* Footer: absolute floor of the app — zero gap, solid white, nothing beneath */}
      <div
        className="md:hidden border-t border-neutral-200"
        dir="rtl"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 99999,
          backgroundColor: '#ffffff',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <Button
            className="h-11 min-w-[140px] rounded-xl font-semibold text-sm shrink-0"
            onClick={handleSubmit}
            loading={createOrder.isPending}
            disabled={!formValid || !canPlaceOrder}
          >
            {cartHasMultipleMarkets
              ? 'السلة تحتوي متاجر من أسواق مختلفة'
              : !canPlaceOrder
                ? 'لا نقبل الطلبات حالياً'
                : !isAuthenticated
                  ? 'تسجيل الدخول وإتمام الطلب'
                  : 'تأكيد الطلب'}
          </Button>
          <div className="flex flex-col items-end min-w-0">
            <p className="text-[10px] text-gray-500 leading-tight truncate max-w-full">
              {[
                `المجموع ${formatPrice(subtotalAll)}`,
                totalDiscount > 0 && `خصم -${formatPrice(totalDiscount)}`,
                fulfillmentType === 'DELIVERY' && deliveryFee > 0 && `توصيل ${formatPrice(deliveryFee)}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <p className="font-bold text-lg text-primary mt-0.5">
              الإجمالي {formatPrice(displayTotal)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
