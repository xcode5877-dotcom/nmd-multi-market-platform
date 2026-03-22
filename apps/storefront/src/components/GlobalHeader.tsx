import { useState } from 'react';
import { Link, useParams, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, User, ArrowRight } from 'lucide-react';
import { useCartStore } from '../store/cart';
import { useAppStore } from '../store/app';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import { useGlobalAuthModal } from '../contexts/GlobalAuthModalContext';
import { PLATFORM_BRANDING } from '@nmd/core';

const GLOBAL_HEADER_HEIGHT_PX = 56;

export const GLOBAL_HEADER_HEIGHT = GLOBAL_HEADER_HEIGHT_PX;

/**
 * Single shared header for the entire platform (landing, markets, all storefronts).
 * Fixed-height white bar: centered NMD logo, search, user icon, cart. No login/logout (only in /my-account).
 * Store logos live in each store's main content (Outlet), not in the header.
 */
export function GlobalHeader() {
  const [searchExpanded, setSearchExpanded] = useState(false);
  const { tenantSlug } = useParams<{ tenantSlug?: string }>();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const tenantSlugFromStore = useAppStore((s) => s.tenantSlug);
  const { customer } = useCustomerAuth();
  const { openAuthModal } = useGlobalAuthModal();

  const totalCount = useCartStore((s) => {
    const ids = s.getTenantIdsInCart();
    return ids.reduce((sum, id) => sum + (s.getItems(id)?.reduce((n, i) => n + i.quantity, 0) ?? 0), 0);
  });

  const firstTenantInCart = useCartStore((s) => s.getTenantIdsInCart()[0] ?? null);
  const currentSlug = tenantSlug ?? tenantSlugFromStore ?? firstTenantInCart;
  const cartHref = currentSlug ? `/${currentSlug}/cart` : '/';

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 w-full m-0 z-[9999] border-b border-[#0f766e]/20 shadow-sm isolate pt-[env(safe-area-inset-top)]"
        style={{
          minHeight: GLOBAL_HEADER_HEIGHT_PX,
          backgroundColor: PLATFORM_BRANDING.primaryColor,
        }}
        data-global-header
      >
        <div
          className="relative flex items-center justify-between w-full max-w-6xl mx-auto px-4 sm:px-6"
          style={{ minHeight: GLOBAL_HEADER_HEIGHT_PX }}
        >
          {/* Left: Back button — fixed width, more gap from logo */}
          <div className="flex items-center justify-start min-w-[96px] shrink-0">
            {pathname !== '/' && (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="back-btn-header w-10 h-10 flex items-center justify-center rounded-full border-2 border-white/50 bg-white/20 hover:bg-white/30 active:scale-90 transition-all"
                style={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)' }}
                aria-label="رجوع"
              >
                <ArrowRight className="w-5 h-5 text-white" strokeWidth={2} />
              </button>
            )}
          </div>

          {/* Center: Logo — perfectly centered via absolute positioning */}
          <Link
            to="/"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-auto"
            onClick={() => setSearchExpanded(false)}
            style={{ touchAction: 'manipulation' }}
          >
            {PLATFORM_BRANDING.logoUrl ? (
              <img
                src={PLATFORM_BRANDING.logoUrl}
                alt="NMD"
                className="h-10 w-auto max-h-[50px] object-contain"
                loading="eager"
              />
            ) : (
              <span className="font-bold text-xl sm:text-2xl truncate max-w-[180px] sm:max-w-[220px] text-white">
                NMD
              </span>
            )}
          </Link>

          {/* Right: Icons — gap-5, extra min-width to prevent search/logo overlap */}
          <div className="flex items-center justify-end gap-5 min-w-[130px] shrink-0">
            <button
              type="button"
              onClick={() => setSearchExpanded((e) => !e)}
              className="p-2 rounded-full hover:bg-white/10 active:bg-white/20 transition-colors touch-manipulation"
              aria-label="بحث"
            >
              <Search className="w-5 h-5 text-white" strokeWidth={2} />
            </button>
            <Link
              to="/my-account"
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              aria-label={customer ? 'حسابي' : 'تسجيل الدخول'}
              onClick={customer ? undefined : (e) => { e.preventDefault(); openAuthModal(); }}
            >
              <User className="w-5 h-5 text-white" strokeWidth={2} />
            </Link>
            <Link
              to={cartHref}
              className="relative p-2 rounded-full hover:bg-white/10 transition-colors"
              aria-label={totalCount > 0 ? `سلة التسوق ${totalCount} منتج` : 'سلة التسوق (فارغة)'}
            >
              <ShoppingCart className="w-5 h-5 text-white" strokeWidth={2} />
              {totalCount > 0 && (
                <span
                  className="absolute top-0.5 end-0.5 text-[#0f766e] text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 bg-white"
                >
                  {totalCount > 99 ? '99+' : totalCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {searchExpanded && (
          <div className="border-t border-white/20 bg-white/95 px-3 sm:px-4 py-3">
            <div className="max-w-xl mx-auto">
              <div className="relative rounded-full border-2 border-[#0f766e]/30 bg-white shadow-sm overflow-hidden">
                <Search className="absolute top-1/2 -translate-y-1/2 end-4 w-5 h-5 pointer-events-none" style={{ color: '#0f766e' }} />
                <input
                  type="search"
                  placeholder="بحث في المنصة..."
                  autoFocus
                  className="w-full h-11 pe-12 ps-5 rounded-full border-0 bg-transparent text-sm placeholder:text-gray-500 focus:outline-none focus:ring-0"
                  style={{ color: '#0a0a0a' }}
                />
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}

/** Alias for shared layout usage (Landing, Market, Stores). */
export const GlobalAppHeader = GlobalHeader;
