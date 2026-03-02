import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MessageCircle } from 'lucide-react';
import type { Product } from '@nmd/core';
import { formatMoney } from '@nmd/core';
import { useTheme } from '@nmd/ui';
import { useAppStore } from '../store/app';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import { useGlobalAuthModal } from '../contexts/GlobalAuthModalContext';
import { trackProfessionalContact } from '../lib/trackLead';

interface ServiceCardProps {
  product: Product;
  tenantSlug: string;
  /** 'book' = احجز موعد, 'inquire' = استفسر الآن */
  actionType?: 'book' | 'inquire';
}

function ServiceCardInner({ product, tenantSlug, actionType = 'inquire' }: ServiceCardProps) {
  const { branding } = useTheme();
  const tenantId = useAppStore((s) => s.tenantId);
  const { customer } = useCustomerAuth();
  const { openAuthModal } = useGlobalAuthModal();
  const whatsapp = branding?.whatsappPhone;
  const hasPrice = (product.basePrice ?? 0) > 0;
  const waUrl = whatsapp
    ? `https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(
        `مرحباً، أود الاستفسار عن خدمة: ${product.name}`
      )}`
    : null;

  const actionLabel = actionType === 'book' ? 'احجز موعد' : 'استفسر الآن';
  const ActionIcon = actionType === 'book' ? Calendar : MessageCircle;

  return (
    <article
      className="bg-white rounded-xl border border-gray-100 hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col"
      dir="rtl"
    >
      <div className="flex flex-col sm:flex-row">
        {/* Image */}
        <div className="sm:w-32 flex-shrink-0 h-32 sm:h-auto bg-gray-50">
          <img
            src={product.images?.[0]?.url ?? product.imageUrl ?? 'https://placehold.co/128x128?text=خدمة'}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
        {/* Content */}
        <div className="flex-1 p-4 flex flex-col justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{product.name}</h3>
            {product.description && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{product.description}</p>
            )}
            {hasPrice && (
              <p className="text-sm text-primary font-medium mt-2">
                يبدأ من {formatMoney(product.basePrice)}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/${tenantSlug}/p/${product.id}`}
              className="text-sm font-medium text-gray-600 hover:text-primary transition-colors"
            >
              تفاصيل الخدمة
            </Link>
            {waUrl && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  if (!tenantId) return;
                  const doRedirect = async (c?: { id: string }) => {
                    await trackProfessionalContact(tenantId, 'whatsapp', c?.id);
                    window.open(waUrl, '_blank', 'noopener,noreferrer');
                  };
                  if (customer) doRedirect(customer);
                  else openAuthModal({ onSuccess: doRedirect });
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#25D366] text-white text-sm font-medium hover:opacity-90 transition-opacity cursor-pointer"
              >
                <ActionIcon size={16} />
                {actionLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export const ServiceCard = memo(ServiceCardInner);
