import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, useParams, useLocation } from 'react-router-dom';
import { ThemeProvider, ToastProvider, LayoutShell } from '@nmd/ui';
import { useQuery } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import { PLATFORM_BRANDING } from '@nmd/core';
import { getTenantSlugOrId, persistTenant } from './lib/tenant';
import { useAppStore } from './store/app';
import { CustomerAuthProvider } from './contexts/CustomerAuthContext';
import { GlobalAuthModalProvider } from './contexts/GlobalAuthModalContext';
import { WinnerCouponProvider } from './contexts/WinnerCouponContext';
import { MerchantAuthProvider } from './contexts/MerchantAuthContext';
import { NativeBridgeProvider, useNativeBridge } from './contexts/NativeBridgeContext';
import { CustomerNotificationProvider } from './contexts/CustomerNotificationContext';
import { TenantBroadcastListener } from './components/TenantBroadcastListener';
import { InstallBanner } from './components/InstallBanner';
import { OrderTrackingWidget } from './components/OrderTrackingWidget';
import { ContestPopUp } from './components/ContestPopUp';
import WinnerCouponReminder from './components/WinnerCouponReminder';
import RootLayout from './layouts/RootLayout';

/** True when route is mall/city (platform), not a tenant store (/:slug). Forces platform brand colors. */
function isPlatformRoute(pathname: string): boolean {
  const p = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  const first = p.split('/').filter(Boolean)[0] ?? '';
  if (!first) return true; // "/"
  if (first === 'order' || first === 'merchant' || first === 'my-activity' || first === 'my-account' || first === 'lucky-wheel') return true;
  if (first === 'daburiyya' || first === 'dabburiyya' || first === 'iksal') return true;
  if (first === 'p') return true; // /p/:productId
  return false;
}

const Layout = lazy(() => import('./layouts/Layout'));
const LandingLayout = lazy(() => import('./layouts/LandingLayout'));
const MarketLayout = lazy(() => import('./layouts/MarketLayout'));
const MarketsPickerPage = lazy(() => import('./pages/MarketsPickerPage'));
const MarketHomePage = lazy(() => import('./pages/MarketHomePage'));
const MarketStoresPage = lazy(() => import('./pages/MarketStoresPage'));
const MarketSectionPage = lazy(() => import('./pages/MarketSectionPage'));
const LegacyProductRedirect = lazy(() => import('./pages/LegacyProductRedirect'));
const HomePage = lazy(() => import('./pages/HomePage'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const OrderSuccessPage = lazy(() => import('./pages/OrderSuccessPage'));
const OrderPrintPage = lazy(() => import('./pages/OrderPrintPage'));
const LegacyOrderSuccessRedirect = lazy(() => import('./pages/LegacyOrderSuccessRedirect'));
const MyActivityPage = lazy(() => import('./pages/MyActivityPage'));
const MyAccountPage = lazy(() => import('./pages/MyAccountPage'));
const LuckyWheelPage = lazy(() => import('./pages/LuckyWheelPage'));
const MerchantDashboardPage = lazy(() => import('./pages/MerchantDashboardPage'));

const api = new MockApiClient();

function TenantGate() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const tenantSlugOrId = tenantSlug ?? getTenantSlugOrId();
  const setTenant = useAppStore((s) => s.setTenant);

  useEffect(() => {
    if (tenantSlugOrId) setTenant(null, null, null, null, null);
  }, [tenantSlugOrId, setTenant]);

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant', tenantSlugOrId],
    queryFn: () => api.getTenant(tenantSlugOrId!),
    enabled: !!tenantSlugOrId,
    staleTime: 0,
  });

  useEffect(() => {
    if (tenant) {
      const storeType = (tenant as { storeType?: 'RESTAURANT' | 'PROFESSIONAL'; businessType?: string }).storeType ?? 'RESTAURANT';
      const businessType = (tenant as { businessType?: string }).businessType;
      const useProfessionalLayout = storeType === 'PROFESSIONAL' || businessType === 'SERVICE';
      const effectiveStoreType = useProfessionalLayout ? 'PROFESSIONAL' : storeType;
      const marketId = (tenant as { marketId?: string }).marketId ?? null;
      setTenant(tenant.id, tenant.slug, tenant.name, tenant.type ?? 'GENERAL', effectiveStoreType, marketId);
      persistTenant(tenant.slug);
    }
  }, [tenant, setTenant]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">المتجر غير موجود</p>
      </div>
    );
  }

  return (
    <ThemeProvider key={tenant.id} branding={tenant.branding} dir="rtl">
      <LayoutShell layoutStyle={tenant.branding.layoutStyle}>
        <Routes>
              <Route element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="p/:productId" element={<ProductPage />} />
                <Route path="c/:categoryId" element={<CategoryPage />} />
                <Route path="category/:categoryId" element={<CategoryPage />} />
                <Route path="products" element={<ProductsPage />} />
                <Route path="cart" element={<CartPage />} />
                <Route path="checkout" element={<CheckoutPage />} />
                <Route path="my-activity" element={<MyActivityPage />} />
                <Route path="my-account" element={<MyAccountPage />} />
                <Route path="order/:orderId/success" element={<OrderSuccessPage />} />
              </Route>
            </Routes>
      </LayoutShell>
    </ThemeProvider>
  );
}

function PlatformThemeGate({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  if (!isPlatformRoute(pathname)) return <>{children}</>;
  return (
    <ThemeProvider key="platform" branding={PLATFORM_BRANDING} dir="rtl">
      {children}
    </ThemeProvider>
  );
}

/** When running inside the native app (UA NMD-Native-App), register for push (order status). */
function NativePushRegistration() {
  const { isNativeApp } = useNativeBridge();
  useEffect(() => {
    if (!isNativeApp) return;
    const fn = (window as unknown as { __NMD_NATIVE_REGISTER_PUSH__?: () => void }).__NMD_NATIVE_REGISTER_PUSH__;
    if (typeof fn === 'function') fn();
  }, [isNativeApp]);
  return null;
}

function AppContent() {
  return (
    <ToastProvider>
      <CustomerAuthProvider>
        <CustomerNotificationProvider>
        <WinnerCouponProvider>
        <MerchantAuthProvider>
        <GlobalAuthModalProvider>
          <PlatformThemeGate>
          <Suspense fallback={<PageSkeleton />}>
            <NativePushRegistration />
            <TenantBroadcastListener />
            <InstallBanner />
            <OrderTrackingWidget />
            <ContestPopUp />
            <WinnerCouponReminder />
            <Routes>
              <Route element={<RootLayout />}>
                <Route path="/order/:orderId/print" element={<OrderPrintPage />} />
                <Route path="/order/:orderId/success" element={<LegacyOrderSuccessRedirect />} />
                <Route path="/merchant/dashboard" element={<MerchantDashboardPage />} />
                <Route path="/" element={<LandingLayout />}>
                  <Route index element={<MarketsPickerPage />} />
                  <Route path="lucky-wheel" element={<LuckyWheelPage />} />
                  <Route path="my-activity" element={<MyActivityPage />} />
                  <Route path="my-account" element={<MyAccountPage />} />
                </Route>
                <Route path="/daburiyya" element={<MarketLayout />}>
                  <Route index element={<MarketHomePage />} />
                  <Route path="stores" element={<MarketStoresPage />} />
                  <Route path="section/:pillarType" element={<MarketSectionPage />} />
                </Route>
                <Route path="/dabburiyya" element={<MarketLayout />}>
                  <Route index element={<MarketHomePage />} />
                  <Route path="stores" element={<MarketStoresPage />} />
                  <Route path="section/:pillarType" element={<MarketSectionPage />} />
                </Route>
                <Route path="/iksal" element={<MarketLayout />}>
                  <Route index element={<MarketHomePage />} />
                  <Route path="stores" element={<MarketStoresPage />} />
                  <Route path="section/:pillarType" element={<MarketSectionPage />} />
                </Route>
                <Route path="/p/:productId" element={<LegacyProductRedirect />} />
                <Route path="/:tenantSlug/*" element={<TenantGate />} />
              </Route>
            </Routes>
          </Suspense>
          </PlatformThemeGate>
        </GlobalAuthModalProvider>
        </MerchantAuthProvider>
        </WinnerCouponProvider>
        </CustomerNotificationProvider>
      </CustomerAuthProvider>
    </ToastProvider>
  );
}

function PageSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-40 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}

/** Prevent "Add to Home Screen" banner from covering the bottom nav (PWA install prompt). */
function PreventInstallBanner() {
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  return null;
}

export default function App() {
  return (
    <NativeBridgeProvider>
      <PreventInstallBanner />
      <AppContent />
    </NativeBridgeProvider>
  );
}
