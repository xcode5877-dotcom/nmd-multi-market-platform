import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { StorefrontHero, StorefrontBanner } from '@nmd/core';
import { useAppStore } from '../store/app';
import { trackLead } from '../lib/trackLead';

const HERO_TITLE_STYLE_MOBILE = { fontSize: '1.25rem', lineHeight: 1.2 } as const;
const HERO_TITLE_STYLE_DESKTOP = { fontSize: '2rem', lineHeight: 1.2 } as const;

function useHeroTitleStyle() {
  const [style, setStyle] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
      ? HERO_TITLE_STYLE_DESKTOP
      : HERO_TITLE_STYLE_MOBILE
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const fn = () => setStyle(mq.matches ? HERO_TITLE_STYLE_DESKTOP : HERO_TITLE_STYLE_MOBILE);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return style;
}

type HeroSlide = { type: 'hero'; hero: StorefrontHero };
type BannerSlide = { type: 'banner'; banner: StorefrontBanner };
type Slide = HeroSlide | BannerSlide;

interface TopHeroCarouselProps {
  hero?: StorefrontHero | null;
  banners?: StorefrontBanner[] | null;
}

// Responsive adaptive: mobile fixed height, desktop cinematic aspect. Full width, overflow hidden.
const SLIDE_CONTAINER =
  'w-full overflow-hidden rounded-2xl bg-gray-100 h-[250px] md:h-auto md:aspect-[21/9] md:min-h-[320px]';
const CTA_CLASS =
  'mt-2 md:mt-3 px-3 py-2 md:px-4 rounded-lg text-sm font-medium bg-white text-gray-900 hover:bg-gray-100 transition-colors';

/** Legacy placeholder to treat as empty — Admin-set content takes priority. */
const LEGACY_PLACEHOLDER = 'اكتشف أفضل المنتجات لدينا';

/** Fallback when no hero/banners from API. Use Now Market only when API title is empty. */
const FALLBACK_TITLE = 'Now Market';

const DEFAULT_HERO: StorefrontHero = {
  title: FALLBACK_TITLE,
  subtitle: FALLBACK_TITLE,
  ctaText: 'تسوق الآن',
  ctaLink: '#',
  ctaHref: '#',
};

function effectiveTitle(title: string | undefined | null): string {
  const t = (title ?? '').trim();
  if (!t || t === LEGACY_PLACEHOLDER) return FALLBACK_TITLE;
  return t;
}

function effectiveSubtitle(subtitle: string | undefined | null): string {
  const s = (subtitle ?? '').trim();
  if (!s || s === LEGACY_PLACEHOLDER) return FALLBACK_TITLE;
  return s;
}

function buildSlides(hero: StorefrontHero | null | undefined, banners: StorefrontBanner[] | null | undefined): Slide[] {
  const slides: Slide[] = [];
  if (hero) {
    slides.push({ type: 'hero', hero });
  }
  const activeBanners = (banners ?? [])
    .filter((b) => (b.isActive ?? b.enabled ?? true) && b.imageUrl)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  activeBanners.forEach((banner) => slides.push({ type: 'banner', banner }));
  if (slides.length === 0 && hero === undefined) {
    slides.push({ type: 'hero', hero: DEFAULT_HERO });
  }
  return slides;
}

function formatCountdown(expiresAt: string, now: number): string | null {
  const end = new Date(expiresAt).getTime();
  const diff = end - now;
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function withImageCacheBust(url: string, v: number): string {
  if (!url) return url;
  return `${url}${url.includes('?') ? '&' : '?'}v=${v}`;
}

export function TopHeroCarousel({ hero, banners }: TopHeroCarouselProps) {
  const navigate = useNavigate();
  const tenantId = useAppStore((s) => s.tenantId);
  const heroTitleStyle = useHeroTitleStyle();
  const slides = useMemo(() => buildSlides(hero ?? null, banners ?? []), [hero, banners]);
  const imgCacheBust = useRef(Date.now()).current;
  const [idx, setIdx] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (slides.length === 0) return null;

  const slide = slides[idx];
  const heroCtaLink = (h: StorefrontHero) => h.ctaHref ?? h.ctaLink ?? '#';

  const renderSlide = () => {
    if (slide.type === 'hero') {
      const h = slide.hero;
      const ctaLink = heroCtaLink(h);
      if (h.imageUrl) {
        return (
          <div className={`relative ${SLIDE_CONTAINER}`}>
            <img
              src={withImageCacheBust(h.imageUrl, imgCacheBust)}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover object-center"
              style={{ objectFit: 'cover', objectPosition: 'center' }}
            />
            <div className="absolute inset-x-0 bottom-0 h-2/3 z-10 bg-gradient-to-t from-black/55 to-transparent pointer-events-none" />
            <div className="absolute inset-0 z-10 flex flex-col justify-end items-end text-end p-4 md:p-6 pb-4 md:pb-6">
              <h1 className="font-bold text-white max-w-[90%] text-base md:text-2xl [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]" style={heroTitleStyle}>{effectiveTitle(h.title)}</h1>
              <p className="text-sm md:text-base mt-1 text-white/95 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] max-w-[90%]">{effectiveSubtitle(h.subtitle)}</p>
              {h.ctaText && ctaLink && (
                <button
                  type="button"
                  onClick={() => {
                    if (tenantId && !ctaLink.startsWith('/')) {
                      const type = ctaLink.includes('wa.me') ? 'whatsapp' : ctaLink.startsWith('tel:') ? 'call' : 'cta';
                      trackLead(tenantId, type);
                    }
                    if (ctaLink.startsWith('/')) navigate(ctaLink);
                    else window.location.href = ctaLink;
                  }}
                  className={CTA_CLASS}
                >
                  {h.ctaText}
                </button>
              )}
            </div>
          </div>
        );
      }
      return (
        <div className={`${SLIDE_CONTAINER} flex flex-col justify-center p-4 md:p-8 bg-gradient-to-b from-primary/5 to-transparent`}>
          <h1 className="font-bold text-gray-900 mb-2 text-base md:text-2xl" style={heroTitleStyle}>{effectiveTitle(h.title)}</h1>
          <p className="text-sm md:text-base text-gray-600 mb-4">{effectiveSubtitle(h.subtitle)}</p>
          {h.ctaText && ctaLink && (
            <button
              type="button"
              onClick={() => {
                if (tenantId && !ctaLink.startsWith('/')) {
                  const type = ctaLink.includes('wa.me') ? 'whatsapp' : ctaLink.startsWith('tel:') ? 'call' : 'cta';
                  trackLead(tenantId, type);
                }
                if (ctaLink.startsWith('/')) navigate(ctaLink);
                else window.location.href = ctaLink;
              }}
              className="inline-block w-fit px-4 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:opacity-90 transition-opacity"
            >
              {h.ctaText}
            </button>
          )}
        </div>
      );
    }
    const b = slide.banner;
    const href = b.ctaHref ?? b.link ?? '';
    const showCountdown = b.showCountdown !== false && b.expiresAt;
    const countdownStr = showCountdown && b.expiresAt ? formatCountdown(b.expiresAt, now) : null;
    const content = (
      <div className={`relative ${SLIDE_CONTAINER}`}>
        <img
          src={withImageCacheBust(b.imageUrl, imgCacheBust)}
          alt={b.title ?? ''}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover object-center"
          style={{ objectFit: 'cover', objectPosition: 'center' }}
        />
        {countdownStr && (
          <div className="absolute top-3 start-3 z-20">
            <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-black/60 text-white backdrop-blur-sm">
              ينتهي خلال {countdownStr}
            </span>
          </div>
        )}
        {(effectiveTitle(b.title) || effectiveSubtitle(b.subtitle) || b.ctaText) && (
          <>
            <div className="absolute inset-x-0 bottom-0 h-2/3 z-10 bg-gradient-to-t from-black/55 to-transparent pointer-events-none" />
            <div className="absolute inset-0 z-10 flex flex-col justify-end items-end text-end p-4 md:p-6 pb-4 md:pb-6">
              <h2 className="font-bold text-white max-w-[90%] text-base md:text-2xl [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]" style={heroTitleStyle}>{effectiveTitle(b.title)}</h2>
              <p className="text-sm md:text-base mt-1 text-white/95 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] max-w-[90%]">{effectiveSubtitle(b.subtitle)}</p>
              {b.ctaText && href && (
                <button
                  type="button"
                  onClick={() => {
                    if (tenantId && !href.startsWith('/')) {
                      const type = href.includes('wa.me') ? 'whatsapp' : href.startsWith('tel:') ? 'call' : 'cta';
                      trackLead(tenantId, type);
                    }
                    if (href.startsWith('/')) navigate(href);
                    else window.location.href = href;
                  }}
                  className={`mt-2 md:mt-3 ${CTA_CLASS}`}
                >
                  {b.ctaText}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    );
    return content;
  };

  return (
    <div className="relative w-full max-w-full">
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
  );
}
