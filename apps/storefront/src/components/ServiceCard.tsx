import { memo } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import type { Product } from '@nmd/core';
import { formatMoney } from '@nmd/core';
import { getCustomerListPrice } from '../lib/customer-price';
import { useTheme } from '@nmd/ui';
import { useAppStore } from '../store/app';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import { useGlobalAuthModal } from '../contexts/GlobalAuthModalContext';
import { postProfessionalLead } from '../lib/trackLead';
import { PROFESSIONAL_ACCENT } from '../lib/professionalTheme';

interface ServiceCardProps {
  product: Product;
  tenantSlug: string;
  actionType?: 'book' | 'inquire';
}

function ServiceCardInner({ product, tenantSlug, actionType = 'inquire' }: ServiceCardProps) {
  const { branding } = useTheme();
  const tenantId = useAppStore((s) => s.tenantId);
  const { customer } = useCustomerAuth();
  const { openAuthModal } = useGlobalAuthModal();
  const trackLeadMutation = useMutation({
    mutationFn: ({
      tenantId,
      contactType,
      customerId,
      customerName,
      customerPhone,
    }: {
      tenantId: string;
      contactType: 'whatsapp' | 'call';
      customerId?: string;
      customerName?: string;
      customerPhone?: string;
    }) => postProfessionalLead(tenantId, contactType, customerId, customerName, customerPhone),
  });
  const whatsapp = branding?.whatsappPhone;
  const listPrice = getCustomerListPrice(product);
  const hasPrice = listPrice > 0;
  const waUrl = whatsapp
    ? `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
        `مرحباً، أود الاستفسار عن خدمة: ${product.name}`
      )}`
    : null;

  const actionLabel = actionType === 'book' ? 'احجز موعد' : 'استفسر الآن';

  return (
    <article
      className="bg-white rounded-lg border border-gray-200/95 overflow-hidden flex flex-col shadow-none hover:shadow-sm transition-shadow duration-200"
      dir="rtl"
    >
      <div className="flex flex-col sm:flex-row sm:items-stretch">
        <div className="sm:w-36 flex-shrink-0 h-36 sm:min-h-[140px] bg-slate-50 border-b sm:border-b-0 sm:border-s border-gray-100">
          <img
            src={product.images?.[0]?.url ?? product.imageUrl ?? 'https://placehold.co/128x128?text=خدمة'}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 p-5 flex flex-col min-h-0">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900 tracking-tight leading-snug">{product.name}</h3>
            {product.description && (
              <p className="text-sm text-gray-600 mt-2 leading-relaxed line-clamp-3">{product.description}</p>
            )}
          </div>

          <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            {hasPrice ? (
              <p className="text-base font-semibold tabular-nums" style={{ color: PROFESSIONAL_ACCENT }}>
                يبدأ من {formatMoney(listPrice)}
              </p>
            ) : (
              <span className="text-sm text-gray-400">السعر عند الطلب</span>
            )}
            <div className="flex flex-wrap items-center gap-3 sm:justify-end">
              <Link
                to={`/${tenantSlug}/p/${product.id}`}
                className="text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors underline-offset-4 hover:underline"
              >
                تفاصيل الخدمة
              </Link>
              {waUrl && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    if (!tenantId) return;
                    const doRedirect = async (c?: { id: string; name?: string }) => {
                      await trackLeadMutation.mutateAsync({
                        tenantId,
                        contactType: 'whatsapp',
                        customerId: c?.id,
                        customerName: c?.name,
                        customerPhone: (c as { phone?: string })?.phone,
                      });
                      window.open(waUrl, '_blank', 'noopener,noreferrer');
                    };
                    if (customer) doRedirect(customer);
                    else openAuthModal({ onSuccess: doRedirect });
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border-2 bg-transparent transition-colors hover:bg-[#00695C]/8 active:bg-[#00695C]/12"
                  style={{ borderColor: PROFESSIONAL_ACCENT, color: PROFESSIONAL_ACCENT }}
                >
                  <MessageCircle size={16} strokeWidth={2} />
                  {actionLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

export const ServiceCard = memo(ServiceCardInner);
