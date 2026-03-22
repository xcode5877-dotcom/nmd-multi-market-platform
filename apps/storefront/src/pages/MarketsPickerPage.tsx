import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Skeleton } from '@nmd/ui';
import { Store, Truck, Shield, Headphones } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { isAndroidOrMobileApp } from '../lib/platform';

/**
 * Market selection (landing) page. Rendered inside RootLayout (global header + cart icon)
 * and LandingLayout (CartBar when cart has items, announcement, footer hidden here).
 * - Android/Mobile app: vertical list + fade masks; header/cart visible.
 * - Web/Desktop: original slider/pager (centered grid, smooth scroll, floating animation).
 */

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

interface Market {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  isActive: boolean;
  sortOrder?: number;
}

const FALLBACK_MARKETS: Market[] = [
  { id: 'market-dabburiyya', name: 'سوق دبورية الرقمي', slug: 'daburiyya', isActive: true, sortOrder: 0 },
  { id: 'market-iksal', name: 'سوق إكسال الرقمي', slug: 'iksal', isActive: true, sortOrder: 1 },
];

/** High-quality circular thumbnail per market */
const MARKET_IMAGES: Record<string, string> = {
  daburiyya: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop&q=80',
  dabburiyya: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop&q=80',
  iksal: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=400&h=400&fit=crop&q=80',
};

function getMarketImage(market: { slug: string; imageUrl?: string }): string {
  if (market.imageUrl?.trim()) return market.imageUrl.trim();
  return MARKET_IMAGES[market.slug] ?? `https://picsum.photos/seed/${market.slug}/400/400`;
}

/** Glow color per market: emerald for Daburiyya, azure for Iksal */
function getMarketGlow(slug: string): string {
  const s = slug.toLowerCase();
  if (s === 'daburiyya' || s === 'dabburiyya') return 'emerald';
  if (s === 'iksal') return 'azure';
  return 'primary';
}

/** Parallax factor: mesh moves slower than scroll (0.15 = 15% of scroll distance) */
const PARALLAX_FACTOR = 0.15;

/** Floating animation for desktop slider cards */
const FLOATING_TRANSITION = {
  y: { repeat: Infinity, repeatType: 'reverse' as const, duration: 2.8, ease: 'easeInOut' as const },
};

/** Android bubble: idle bobbing duration (slightly different per index for organic feel) */
function getBubbleBobDuration(index: number) {
  return 4.2 + index * 0.4;
}

/** Android bubble: bobbing delay so they're out of phase */
function getBubbleBobDelay(index: number) {
  return index * 0.7;
}

export default function MarketsPickerPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);
  const [scrollOffset, setScrollOffset] = useState({ x: 0, y: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!MOCK_API_URL) {
      setMarkets(FALLBACK_MARKETS);
      setLoading(false);
      return;
    }
    fetch(`${MOCK_API_URL}/markets`)
      .then((r) => r.json())
      .then((data: Market[]) => setMarkets((data ?? []).length > 0 ? data : FALLBACK_MARKETS))
      .catch(() => setMarkets(FALLBACK_MARKETS))
      .finally(() => setLoading(false));
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollOffset({ x: el.scrollLeft, y: el.scrollTop });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    handleScroll();
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll, markets.length]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 relative overflow-hidden flex items-center justify-center p-4" dir="rtl">
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
          <div className="absolute -top-40 -end-20 w-[320px] h-[320px] rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute top-1/2 -start-32 w-[280px] h-[280px] rounded-full bg-secondary/5 blur-3xl" />
        </div>
          <div className="grid grid-cols-2 gap-4 max-w-lg mx-auto">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className={`w-32 h-32 sm:w-40 sm:h-40 rounded-full shrink-0 ${i % 2 === 1 ? 'translate-y-6' : ''}`} />
          ))}
        </div>
      </div>
    );
  }

  if (markets.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-8" dir="rtl">
        <div className="text-center rounded-3xl bg-white/90 shadow-xl border border-gray-100 p-12 max-w-md">
          <Store className="w-14 h-14 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">لا توجد أسواق حالياً</h2>
          <p className="text-gray-600">قريباً سنضيف أسواق جديدة</p>
        </div>
      </div>
    );
  }

  const sortedMarkets = [...markets].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
  const meshX = scrollOffset.x * PARALLAX_FACTOR;
  const meshY = scrollOffset.y * PARALLAX_FACTOR;
  const useMobileLayout = isAndroidOrMobileApp();

  return (
    <div
      className={`flex flex-col overflow-hidden w-full p-0 m-0 ${useMobileLayout ? 'h-full min-h-0' : 'min-h-screen'}`}
      style={{ backgroundColor: '#ffffff', width: '100%', margin: 0, padding: 0 }}
      dir="rtl"
      onMouseLeave={() => setHoveredSlug(null)}
      role="main"
      aria-label="اختر وجهتك"
    >
      {!useMobileLayout && (
        /* Parallax orbs — web only */
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
          <motion.div
            className="absolute -top-40 -end-20 w-[320px] h-[320px] rounded-full blur-3xl"
            style={{ x: meshX * 0.5, y: meshY * 0.5 }}
            animate={{
              backgroundColor:
                hoveredSlug === 'daburiyya' || hoveredSlug === 'dabburiyya'
                  ? 'rgba(16, 185, 129, 0.1)'
                  : hoveredSlug === 'iksal'
                    ? 'rgba(14, 165, 233, 0.1)'
                    : 'rgba(0, 160, 160, 0.06)',
            }}
            transition={{ duration: 0.5 }}
          />
          <motion.div
            className="absolute top-1/2 -start-32 w-[280px] h-[280px] rounded-full blur-3xl"
            style={{ x: -meshX * 0.3, y: meshY * 0.3 }}
            animate={{
              backgroundColor:
                hoveredSlug === 'iksal'
                  ? 'rgba(14, 165, 233, 0.08)'
                  : hoveredSlug === 'daburiyya' || hoveredSlug === 'dabburiyya'
                    ? 'rgba(16, 185, 129, 0.08)'
                    : 'rgba(212, 165, 116, 0.05)',
            }}
            transition={{ duration: 0.5 }}
          />
        </div>
      )}

      {/* Centered title — mt-8 on Android so bubbles aren't cramped under header */}
      <motion.h1
        className={`flex flex-col items-center text-center font-semibold text-gray-900 z-10 shrink-0 tracking-tight ${useMobileLayout ? 'text-xl pt-6 pb-3 mt-8' : 'text-2xl sm:text-3xl pt-8 pb-4'}`}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        اختر وجهتك
        <span
          aria-hidden
          className="mt-2 h-1.5 w-16 rounded-full bg-primary/30"
        />
      </motion.h1>

      {useMobileLayout ? (
        /* Android only: full-bleed image bubbles, centered in fixed viewport (no scroll) */
        <div
          className="flex-1 min-h-0 flex items-center justify-center max-w-screen-xl mx-auto w-full px-4 py-2 pb-[max(1rem,env(safe-area-inset-bottom))]"
          style={{ minHeight: 0 }}
        >
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 max-w-sm mx-auto">
            {sortedMarkets.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  type: 'spring',
                  stiffness: 260,
                  damping: 20,
                  delay: i * 0.1,
                }}
                className="flex flex-col items-center gap-2"
              >
                <motion.button
                  type="button"
                  onClick={() => navigate(`/${m.slug}`)}
                  aria-label={`اختر ${m.name}`}
                  animate={{ y: [0, -6, 0] }}
                  transition={{
                    repeat: Infinity,
                    repeatType: 'reverse',
                    duration: getBubbleBobDuration(i),
                    ease: 'easeInOut',
                    delay: getBubbleBobDelay(i),
                  }}
                  whileTap={{ scale: 1.06, opacity: 0.92 }}
                  className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full touch-manipulation overflow-hidden border border-white/40 bg-white/10 shadow-md transition-all duration-300 ease-out hover:border-primary/70 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/70 focus-visible:ring-offset-neutral-50 flex-shrink-0 cursor-pointer"
                  style={{
                    backgroundImage: `url(${getMarketImage(m)})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  {/* Subtle glossy highlight overlay */}
                  <span
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{
                      background:
                        'linear-gradient(145deg, rgba(255,255,255,0.35) 0%, transparent 50%)',
                    }}
                    aria-hidden
                  />
                </motion.button>
                <span className="font-semibold text-lg text-gray-900 text-center max-w-[8rem] leading-tight">
                  {m.name}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      ) : (
        /* Web/Desktop: original slider/pager — centered grid, scroll-smooth, floating animation */
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto scroll-smooth min-h-0 px-4 pt-4 pb-28"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <div className="min-h-full flex items-center justify-center py-6">
            <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 md:gap-10">
              {sortedMarkets.map((m, i) => {
                const glow = getMarketGlow(m.slug);
                const isHovered = hoveredSlug === m.slug;
                const isDimmed = hoveredSlug != null && hoveredSlug !== m.slug;
                return (
                  <motion.div
                    key={m.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: isDimmed ? 0.45 : 1, scale: 1 }}
                    transition={{ opacity: { duration: 0.25 }, delay: i * 0.06 }}
                    className="flex flex-col items-center justify-center gap-3"
                  >
                    <motion.button
                      type="button"
                      onClick={() => navigate(`/${m.slug}`)}
                      onMouseEnter={() => setHoveredSlug(m.slug)}
                      onMouseLeave={() => setHoveredSlug(null)}
                      aria-label={`اختر ${m.name}`}
                      className="group relative w-36 h-36 sm:w-44 sm:h-44 md:w-52 md:h-52 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary shrink-0 touch-manipulation cursor-pointer transition-all duration-300 ease-out"
                      animate={{ y: [0, -6, 0] }}
                      transition={{ ...FLOATING_TRANSITION, delay: i * 0.35 }}
                      whileHover={{ scale: 1.08, zIndex: 50 }}
                      whileTap={{ scale: 0.96 }}
                    >
                      <span
                        className={`absolute -inset-3 rounded-full blur-2xl opacity-50 transition-opacity duration-300 ${
                          glow === 'emerald' ? 'bg-emerald-400/50' : glow === 'azure' ? 'bg-sky-400/50' : 'bg-primary/40'
                        } ${isHovered ? 'opacity-70' : ''}`}
                        aria-hidden
                      />
                      <span className="absolute inset-0 rounded-full overflow-hidden border border-transparent bg-white/20 backdrop-blur-xl shadow-md transition-all duration-300 ease-out group-hover:border-primary/70 group-hover:shadow-lg">
                        <img src={getMarketImage(m)} alt="" className="w-full h-full object-cover" loading="eager" />
                      </span>
                    </motion.button>
                    <span className="text-sm sm:text-base font-semibold text-gray-900 text-center w-36 sm:w-44 max-w-[11rem] leading-tight">
                      {m.name}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Fixed decorative footer at bottom (web only; Android stays minimal) */}
      {!useMobileLayout && (
      <footer className="fixed bottom-0 inset-x-0 z-20 py-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-teal-100/60 bg-white/40 backdrop-blur-sm">
        <div className="max-w-md mx-auto flex items-center justify-center gap-8 sm:gap-12 text-teal-700/70">
          <span className="flex flex-col items-center gap-1.5" aria-hidden>
            <Truck className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={1.5} />
            <span className="text-[10px] sm:text-xs font-medium">توصيل</span>
          </span>
          <span className="flex flex-col items-center gap-1.5" aria-hidden>
            <Shield className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={1.5} />
            <span className="text-[10px] sm:text-xs font-medium">آمن</span>
          </span>
          <span className="flex flex-col items-center gap-1.5" aria-hidden>
            <Headphones className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={1.5} />
            <span className="text-[10px] sm:text-xs font-medium">دعم</span>
          </span>
        </div>
      </footer>
      )}
    </div>
  );
}
