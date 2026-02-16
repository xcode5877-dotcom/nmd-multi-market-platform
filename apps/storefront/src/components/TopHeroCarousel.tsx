import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { StorefrontHero, StorefrontBanner } from '@nmd/core';

type HeroSlide = { type: 'hero'; hero: StorefrontHero };
type BannerSlide = { type: 'banner'; banner: StorefrontBanner };
type Slide = HeroSlide | BannerSlide;

interface TopHeroCarouselProps {
  hero?: StorefrontHero | null;
  banners?: StorefrontBanner[] | null;
}

const SLIDE_HEIGHT = 'aspect-[3/1] min-h-[160px]';
const CTA_CLASS = 'mt-4 px-6 py-2 rounded-full bg-white text-gray-900 font-medium hover:bg-gray-100 transition-colors';

const DEFAULT_HERO: StorefrontHero = {
  title: 'مرحباً بك',
  subtitle: 'اكتشف أفضل المنتجات لدينا',
  ctaText: 'تسوق الآن',
  ctaLink: '#',
  ctaHref: '#',
};

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

export function TopHeroCarousel({ hero, banners }: TopHeroCarouselProps) {
  const navigate = useNavigate();
  const slides = useMemo(() => buildSlides(hero ?? null, banners ?? []), [hero, banners]);
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
          <div className={`relative rounded-2xl overflow-hidden bg-gray-100 ${SLIDE_HEIGHT}`}>
            <img src={h.imageUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 flex flex-col justify-center items-center bg-black/40 p-6 text-white text-center">
              <h1 className="text-2xl md:text-4xl font-bold">{h.title}</h1>
              {h.subtitle && <p className="text-lg mt-2 opacity-90">{h.subtitle}</p>}
              {h.ctaText && ctaLink && (
                <button
                  type="button"
                  onClick={() => {
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
        <div className={`rounded-2xl bg-gradient-to-b from-primary/5 to-transparent p-6 md:p-8 flex flex-col justify-center ${SLIDE_HEIGHT}`}>
          <h1 className="text-2xl md:text-4xl font-bold text-gray-900 mb-2">{h.title}</h1>
          <p className="text-lg text-gray-600 mb-4">{h.subtitle}</p>
          {h.ctaText && ctaLink && (
            <button
              type="button"
              onClick={() => {
                if (ctaLink.startsWith('/')) navigate(ctaLink);
                else window.location.href = ctaLink;
              }}
              className="inline-block w-fit px-6 py-2 rounded-full bg-primary text-white font-medium hover:opacity-90 transition-opacity"
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
      <div className={`relative rounded-2xl overflow-hidden bg-gray-100 ${SLIDE_HEIGHT}`}>
        <img src={b.imageUrl} alt={b.title ?? ''} className="w-full h-full object-cover" />
        {countdownStr && (
          <div className="absolute top-3 start-3 z-10">
            <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-black/60 text-white backdrop-blur-sm">
              ينتهي خلال {countdownStr}
            </span>
          </div>
        )}
        {(b.title || b.subtitle || b.ctaText) && (
          <div className="absolute inset-0 flex flex-col justify-center items-center bg-black/30 p-6 text-white text-center">
            {b.title && <h2 className="text-xl md:text-2xl font-bold">{b.title}</h2>}
            {b.subtitle && <p className="text-sm md:text-base mt-1">{b.subtitle}</p>}
            {b.ctaText && href && (
              <button
                type="button"
                onClick={() => {
                  if (href.startsWith('/')) navigate(href);
                  else window.location.href = href;
                }}
                className={`mt-3 ${CTA_CLASS}`}
              >
                {b.ctaText}
              </button>
            )}
          </div>
        )}
      </div>
    );
    return content;
  };

  return (
    <div className="relative">
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
