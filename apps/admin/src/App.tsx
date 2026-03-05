import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider, ToastProvider, LayoutShell } from '@nmd/ui';
import { useQuery } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import type { Tenant } from '@nmd/core';
import { AdminProvider } from './context/AdminContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { getInitialTenant } from './store/admin-tenant';

const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const TenantSelectPage = lazy(() => import('./pages/TenantSelectPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const OrdersPage = lazy(() => import('./pages/OrdersPage'));
const OrdersBoardPage = lazy(() => import('./pages/OrdersBoardPage'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const OptionsPage = lazy(() => import('./pages/OptionsPage'));
const CampaignsPage = lazy(() => import('./pages/CampaignsPage'));
const CampaignEditPage = lazy(() => import('./pages/CampaignEditPage'));
const DeliverySettingsPage = lazy(() => import('./pages/DeliverySettingsPage'));
const StaffPage = lazy(() => import('./pages/StaffPage'));
const BrandingPage = lazy(() => import('./pages/BrandingPage'));
const HomepageManagerPage = lazy(() => import('./pages/HomepageManagerPage'));
const StoreSettingsPage = lazy(() => import('./pages/StoreSettingsPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'));
const LeadsPage = lazy(() => import('./pages/LeadsPage'));
const OrderActionPage = lazy(() => import('./pages/OrderActionPage'));

const api = new MockApiClient();
const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

/** Must match main.tsx BrowserRouter basename. Used to read path from window so we don't overwrite path with stale location.pathname. */
const MERCHANT_BASENAME = '/merchant';

function getPathnameFromWindow(): string {
  const full = window.location.pathname;
  if (full === MERCHANT_BASENAME || full === `${MERCHANT_BASENAME}/`) return '/';
  if (full.startsWith(`${MERCHANT_BASENAME}/`)) return full.slice(MERCHANT_BASENAME.length) || '/';
  return full || '/';
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  const location = useLocation();
  if (!MOCK_API_URL) return <>{children}</>;
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!token) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }
  return <>{children}</>;
}

const SPINNER = (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
  </div>
);

function AdminApp() {
  // All hooks first — no early returns before any of these
  const { token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const { data: me } = useQuery({
    queryKey: ['me', token],
    queryFn: () => api.getMe(),
    enabled: !!MOCK_API_URL && !!token,
  });

  const tenantId = me?.tenantId ?? null;

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant-by-id', tenantId],
    queryFn: () => api.getTenant(tenantId!) as Promise<Tenant | null>,
    enabled: !!MOCK_API_URL && !!tenantId,
  });

  useEffect(() => {
    if (!MOCK_API_URL || !tenant || !navigate) return;
    const authSlug = tenant.slug;
    if (!authSlug) return;
    const params = new URLSearchParams(location.search);
    const urlTenant = params.get('tenant');
    const needSync = (urlTenant && urlTenant !== authSlug) || !urlTenant;
    if (!needSync) return;
    params.set('tenant', authSlug);
    const search = `?${params.toString()}`;
    // Defer so we run after any NavLink navigation (e.g. to /homepage); then use path from window so we don't overwrite with stale location.pathname
    const id = setTimeout(() => {
      const pathname = getPathnameFromWindow();
      navigate({ pathname, search }, { replace: true });
    }, 0);
    return () => clearTimeout(id);
  }, [tenant, location.pathname, location.search, MOCK_API_URL, navigate]);

  // Logic after all hooks
  if (me?.mustChangePassword) {
    return (
      <Suspense fallback={SPINNER}>
        <ChangePasswordPage />
      </Suspense>
    );
  }

  if (!MOCK_API_URL) {
    return <AdminAppLegacy />;
  }

  if (!token) return null;

  if (isLoading) {
    return SPINNER;
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">غير مصرح — لا يمكن الوصول لهذا المتجر</p>
      </div>
    );
  }

  return (
    <ThemeProvider branding={tenant.branding} dir="rtl">
      <LayoutShell layoutStyle={tenant.branding.layoutStyle}>
        <ToastProvider>
          <AdminProvider value={{ tenantId: tenant.id, tenantType: tenant.type ?? 'GENERAL' }}>
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
              <Routes>
                <Route path="/" element={<AdminLayout />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="leads" element={<LeadsPage />} />
                  <Route path="orders" element={<OrdersPage />} />
                  <Route path="orders/board" element={<OrdersBoardPage />} />
                  <Route path="catalog/categories" element={<CategoriesPage />} />
                  <Route path="catalog/products" element={<ProductsPage />} />
                  <Route path="catalog/options" element={<OptionsPage />} />
                  <Route path="campaigns" element={<CampaignsPage />} />
                  <Route path="campaigns/new" element={<CampaignEditPage />} />
                  <Route path="campaigns/:id/edit" element={<CampaignEditPage />} />
                  <Route path="settings/delivery" element={<DeliverySettingsPage />} />
                  <Route path="settings/store" element={<StoreSettingsPage />} />
                  <Route path="settings/staff" element={<StaffPage />} />
                  <Route path="branding" element={<BrandingPage />} />
                  <Route path="homepage" element={<HomepageManagerPage key={location.pathname + location.search} />} />
                </Route>
              </Routes>
            </Suspense>
          </AdminProvider>
        </ToastProvider>
      </LayoutShell>
    </ThemeProvider>
  );
}

function AdminAppLegacy() {
  const location = useLocation();
  const tenantSlugOrId = getInitialTenant();
  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant', tenantSlugOrId],
    queryFn: () => api.getTenant(tenantSlugOrId!),
    enabled: !!tenantSlugOrId,
  });

  if (!tenantSlugOrId) return <TenantSelectPage />;
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
    <ThemeProvider branding={tenant.branding} dir="rtl">
      <LayoutShell layoutStyle={tenant.branding.layoutStyle}>
        <ToastProvider>
          <AdminProvider value={{ tenantId: tenant.id, tenantType: tenant.type ?? 'GENERAL' }}>
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
              <Routes>
                <Route path="/" element={<AdminLayout />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="leads" element={<LeadsPage />} />
                  <Route path="orders" element={<OrdersPage />} />
                  <Route path="orders/board" element={<OrdersBoardPage />} />
                  <Route path="catalog/categories" element={<CategoriesPage />} />
                  <Route path="catalog/products" element={<ProductsPage />} />
                  <Route path="catalog/options" element={<OptionsPage />} />
                  <Route path="campaigns" element={<CampaignsPage />} />
                  <Route path="campaigns/new" element={<CampaignEditPage />} />
                  <Route path="campaigns/:id/edit" element={<CampaignEditPage />} />
                  <Route path="settings/delivery" element={<DeliverySettingsPage />} />
                  <Route path="settings/store" element={<StoreSettingsPage />} />
                  <Route path="settings/staff" element={<StaffPage />} />
                  <Route path="branding" element={<BrandingPage />} />
                  <Route path="homepage" element={<HomepageManagerPage key={location.pathname + location.search} />} />
                </Route>
              </Routes>
            </Suspense>
          </AdminProvider>
        </ToastProvider>
      </LayoutShell>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/order-actions/:orderId/:action" element={<AuthGuard><Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" /></div>}><OrderActionPage /></Suspense></AuthGuard>} />
          <Route path="/*" element={<AuthGuard><AdminApp /></AuthGuard>} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
