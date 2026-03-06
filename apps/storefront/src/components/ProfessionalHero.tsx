import { useState, useEffect, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTheme } from '@nmd/ui';
import { useAppStore } from '../store/app';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import { useGlobalAuthModal } from '../contexts/GlobalAuthModalContext';
import { postProfessionalLead } from '../lib/trackLead';
import { isStoreOpen, type StorefrontHero, type StorefrontBanner } from '@nmd/core';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
    </svg>
  );
}

const SLIDE_CONTAINER =
  'w-full overflow-hidden rounded-t-2xl bg-gray-100 h-[220px] md:h-[320px] md:min-h-[320px]';

type HeroSlide = { type: 'hero'; hero: StorefrontHero };
type BannerSlide = { type: 'banner'; banner: StorefrontBanner };
type Slide = HeroSlide | BannerSlide;

function buildSlides(hero: StorefrontHero | null | undefined, banners: StorefrontBanner[] | null | undefined): Slide[] {
  const slides: Slide[] = [];
  if (hero && (hero.title || hero.subtitle || hero.imageUrl)) {
    slides.push({ type: 'hero', hero });
  }
  const activeBanners = (banners ?? [])
    .filter((b) => (b.isActive ?? b.enabled ?? true) && b.imageUrl)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  activeBanners.forEach((banner) => slides.push({ type: 'banner', banner }));
  return slides;
}

interface ProfessionalHeroProps {
  tenant: {
    id?: string;
    name?: string;
    branding?: { logoUrl?: string; hero?: { title?: string } };
    about?: string;
    officeHours?: string;
    openTime?: string;
    closeTime?: string;
    forceClosed?: boolean;
  };
  /** Same data as TopHeroCarousel: hero + banners from branding */
  hero?: StorefrontHero | null;
  banners?: StorefrontBanner[] | null;
}

const FALLBACK_OPEN = '08:00';
const FALLBACK_CLOSE = '17:00';

export function ProfessionalHero({ tenant, hero: heroProp, banners }: ProfessionalHeroProps) {
  const name = tenant?.branding?.hero?.title || tenant?.name || '';
  const about = tenant?.about ?? '';
  const logoUrl = tenant?.branding?.logoUrl;
  const openTime = tenant?.openTime ?? FALLBACK_OPEN;
  const closeTime = tenant?.closeTime ?? FALLBACK_CLOSE;
  const tenantForStatus = {
    openTime: tenant?.openTime,
    closeTime: tenant?.closeTime,
    forceClosed: tenant?.forceClosed,
    operationalStatus: (tenant as { operationalStatus?: 'open' | 'closed' | 'busy' })?.operationalStatus,
    businessHours: (tenant as { businessHours?: import('@nmd/core').BusinessHours })?.businessHours,
  };
  const open = isStoreOpen(tenantForStatus as Parameters<typeof isStoreOpen>[0]);
  const { branding } = useTheme();
  const storeTenantId = useAppStore((s) => s.tenantId);
  const tenantId = (tenant as { id?: string })?.id ?? storeTenantId;
  const { customer } = useCustomerAuth();
  const { openAuthModal } = useGlobalAuthModal();
  const trackLeadMutation = useMutation({
    mutationFn: ({ tenantId, contactType, customerId, customerName, customerPhone }: { tenantId: string; contactType: 'whatsapp' | 'call'; customerId?: string; customerName?: string; customerPhone?: string }) =>
      postProfessionalLead(tenantId, contactType, customerId, customerName, customerPhone),
  });
  const whatsapp = branding?.whatsappPhone;
  const phone = branding?.phone ?? whatsapp;
  const waUrl = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, '')}` : null;
  const telUrl = phone ? `tel:${phone}` : null;

  const slides = useMemo(() => buildSlides(heroProp ?? null, banners ?? []), [heroProp, banners]);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length]);

  const hasSlides = slides.length > 0;
  const currentSlide = hasSlides ? slides[idx] : null;

  const renderSlide = () => {
    if (!currentSlide) return null;
    if (currentSlide.type === 'hero') {
      const h = currentSlide.hero;
      const imgUrl = h.imageUrl;
      const showContent = h.title || h.subtitle;
      return (
        <div className={`relative ${SLIDE_CONTAINER}`}>
          {imgUrl ? (
            <img
              src={imgUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover object-center"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/5" />
          )}
          <div className="absolute inset-0 bg-black/40 z-[1]" />
          {showContent && (
            <div className="absolute inset-0 z-[2] flex flex-col justify-center items-center text-center p-6">
              {h.title && (
                <h1 className="text-xl md:text-3xl font-bold text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.5)] max-w-[90%]">
                  {h.title}
                </h1>
              )}
              {h.subtitle && (
                <p className="mt-2 text-sm md:text-base text-white/95 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] max-w-[85%]">
                  {h.subtitle}
                </p>
              )}
            </div>
          )}
        </div>
      );
    }
    const b = currentSlide.banner;
    const showContent = b.title || b.subtitle;
    return (
      <div className={`relative ${SLIDE_CONTAINER}`}>
        <img
          src={b.imageUrl}
          alt={b.title ?? ''}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/40 z-[1]" />
        {showContent && (
          <div className="absolute inset-0 z-[2] flex flex-col justify-center items-center text-center p-6">
            {b.title && (
              <h2 className="text-xl md:text-3xl font-bold text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.5)] max-w-[90%]">
                {b.title}
              </h2>
            )}
            {b.subtitle && (
              <p className="mt-2 text-sm md:text-base text-white/95 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] max-w-[85%]">
                {b.subtitle}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <section
      className="mb-10 rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm"
      dir="rtl"
    >
      {/* Hero / Banner area: same data as TopHeroCarousel, with overlay + centered title & description */}
      {hasSlides ? (
        <div className="relative w-full">
          {renderSlide()}
          {slides.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIdx(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-colors shadow-sm ${i === idx ? 'bg-primary ring-2 ring-white/50' : 'bg-white/70 hover:bg-white'}`}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Fallback: no banners – high-quality placeholder with store name */
        <div className={`${SLIDE_CONTAINER} relative flex flex-col justify-center items-center text-center p-8 bg-gradient-to-br from-gray-800 to-gray-900`}>
          <div className="absolute inset-0 bg-black/30 z-[1]" />
          <div className="relative z-[2] text-white">
            <h1 className="text-2xl md:text-4xl font-bold [text-shadow:0_2px_8px_rgba(0,0,0,0.4)]">
              {name || 'متجرك'}
            </h1>
            <p className="mt-2 text-sm md:text-base text-white/90">
              مرحباً بك
            </p>
          </div>
        </div>
      )}

      {/* Profile + CTA block */}
      <div className="p-6 md:p-8 bg-gradient-to-b from-gray-50 to-white">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {logoUrl && (
            <div className="flex-shrink-0 w-24 h-24 rounded-2xl overflow-hidden border-2 border-gray-100 shadow-md">
              <img src={logoUrl} alt={name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">{name}</h2>
            {about && about.trim() !== '' && (
              <div className="mt-3 pt-4 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">نبذة عن المكتب</h3>
                <div
                  className="text-gray-600 leading-relaxed text-[15px] font-normal max-w-none prose prose-sm prose-p:my-1.5 prose-p:first:mt-0 prose-p:last:mb-0"
                  dangerouslySetInnerHTML={{ __html: about }}
                />
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                  open ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${open ? 'bg-green-500' : 'bg-red-500'}`} />
                {open ? 'مفتوح' : 'مغلق'}
              </span>
              <span className="text-sm text-gray-600">
                ساعات العمل: {openTime} – {closeTime}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {waUrl && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (!tenantId) return;
                const doRedirect = async (c?: { id: string; name?: string }) => {
                  await trackLeadMutation.mutateAsync({ tenantId, contactType: 'whatsapp', customerId: c?.id, customerName: c?.name, customerPhone: (c as { phone?: string })?.phone });
                  window.open(waUrl, '_blank', 'noopener,noreferrer');
                };
                if (customer) {
                  doRedirect(customer);
                } else {
                  openAuthModal({ onSuccess: doRedirect });
                }
              }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#25D366] text-white font-semibold text-base hover:opacity-90 active:opacity-95 transition-opacity shadow-md cursor-pointer"
            >
              <WhatsAppIcon className="w-5 h-5" />
              تواصل الآن عبر واتساب
            </button>
          )}
          {telUrl && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (!tenantId) return;
                const doRedirect = async (c?: { id: string; name?: string }) => {
                  await trackLeadMutation.mutateAsync({ tenantId, contactType: 'call', customerId: c?.id, customerName: c?.name, customerPhone: (c as { phone?: string })?.phone });
                  window.location.href = telUrl;
                };
                if (customer) {
                  doRedirect(customer);
                } else {
                  openAuthModal({ onSuccess: doRedirect });
                }
              }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#2563eb] text-white font-semibold text-base hover:opacity-90 active:opacity-95 transition-opacity shadow-md cursor-pointer"
            >
              <PhoneIcon className="w-5 h-5" />
              اتصال هاتفي
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
