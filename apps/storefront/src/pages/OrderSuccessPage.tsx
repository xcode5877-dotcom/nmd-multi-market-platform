import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useEffect } from 'react';
import { MockApiClient } from '@nmd/mock';
import { Button } from '@nmd/ui';
import { buildWhatsAppMessage, buildWhatsAppUrl, buildWhatsAppDeepLink, isValidWhatsAppPhone } from '@nmd/core';
import { openWhatsAppOrderLink } from '../lib/whatsapp';
import { setTrackingOrderId } from '../lib/order-tracking-storage';
import { useAppStore } from '../store/app';
import { MessageCircle, ArrowRight } from 'lucide-react';

const api = new MockApiClient();

export default function OrderSuccessPage() {
  const { orderId, tenantSlug: tenantSlugFromUrl } = useParams<{ orderId: string; tenantSlug?: string }>();
  const navigate = useNavigate();
  const storeTenantId = useAppStore((s) => s.tenantId) ?? '';
  const storeTenantSlug = useAppStore((s) => s.tenantSlug) ?? storeTenantId;
  const tenantSlugOrId = tenantSlugFromUrl ?? storeTenantSlug ?? storeTenantId;

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

  useEffect(() => {
    if (orderId) setTrackingOrderId(orderId);
  }, [orderId]);

  const { data: tenant, isLoading: tenantLoading, isError: tenantError } = useQuery({
    queryKey: ['tenant', tenantSlugOrId],
    queryFn: () => api.getTenant(tenantSlugOrId),
    enabled: !!tenantSlugOrId,
    retry: false,
  });

  // Start tracking this order so the floating tracker appears when they browse the store
  useEffect(() => {
    if (orderId) setTrackingOrderId(orderId);
  }, [orderId]);

  const { waUrl, deepLinkUrl } = useMemo(() => {
    if (!order || !tenant) return { waUrl: null as string | null, deepLinkUrl: null as string | null };
    const phone = tenant.branding?.whatsappPhone ?? '';
    if (!isValidWhatsAppPhone(phone)) return { waUrl: null, deepLinkUrl: null };
    const message = buildWhatsAppMessage(order, tenant);
    return {
      waUrl: buildWhatsAppUrl(phone, message),
      deepLinkUrl: buildWhatsAppDeepLink(phone, message),
    };
  }, [order, tenant]);

  if (isLoading || tenantLoading) {
    return (
      <div className="max-w-md mx-auto p-8 text-center" dir="rtl">
        <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full mx-auto" />
        <p className="text-gray-600 mt-4">جاري التحميل...</p>
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="max-w-md mx-auto p-8 text-center" dir="rtl">
        <p className="text-gray-600 mb-4">تعذر تحميل الطلب. قد يكون الرابط غير صحيح.</p>
        <Button className="mt-4" onClick={() => navigate(tenantSlugOrId ? `/${tenantSlugOrId}` : '/')}>
          العودة للتسوق
        </Button>
      </div>
    );
  }

  if (tenantError || !tenant) {
    return (
      <div className="max-w-md mx-auto p-8 text-center" dir="rtl">
        <p className="text-gray-600 mb-4">المتجر غير موجود</p>
        <Button className="mt-4" onClick={() => navigate(tenantSlugOrId ? `/${tenantSlugOrId}` : '/')}>العودة للتسوق</Button>
      </div>
    );
  }

  const handleWhatsApp = () => {
    if (!waUrl && !deepLinkUrl) return;
    openWhatsAppOrderLink(waUrl ?? '', deepLinkUrl ?? '');
  };

  return (
    <div className="max-w-md mx-auto p-6 md:p-10 min-h-[60vh] flex flex-col justify-center" dir="rtl">
      <div className="text-center mb-10">
        <div className="w-20 h-20 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center mx-auto mb-6 ring-4 ring-emerald-500/20">
          <span className="text-3xl font-bold">✓</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">تم استلام طلبك</h1>
        <p className="text-gray-600 mb-6">شكراً لثقتك. سنتواصل معك قريباً.</p>
        <div className="inline-block px-8 py-4 rounded-2xl bg-primary/10 border border-primary/20">
          <p className="text-xs text-gray-500 mb-1">رقم الطلب</p>
          <p className="text-2xl font-mono font-bold text-primary tracking-wider">
            {order.id.slice(0, 8)}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {(waUrl || deepLinkUrl) && (
          <Button
            className="w-full gap-2 justify-center bg-[#25D366] hover:bg-[#20bd5a] text-white py-3 text-base font-medium rounded-xl"
            onClick={handleWhatsApp}
          >
            <MessageCircle className="w-5 h-5" />
            فتح واتساب
          </Button>
        )}
        <Button
          onClick={() => navigate(tenant?.slug ? `/${tenant.slug}` : '/')}
          className="w-full gap-2 justify-center py-3 text-base font-medium rounded-xl"
        >
          <ArrowRight className="w-5 h-5" />
          العودة للتسوق
        </Button>
      </div>
    </div>
  );
}
