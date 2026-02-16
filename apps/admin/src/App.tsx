import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
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
const LoginPage = lazy(() => import('./pages/LoginPage'));

const api = new MockApiClient();
const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

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

function AdminApp() {
  const { token } = useAuth();
  const location = useLocation();

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
    if (!MOCK_API_URL || !tenant) return;
    const authSlug = tenant.slug;
    if (!authSlug) return;
    const params = new URLSearchParams(location.search);
    const urlTenant = params.get('tenant');
    if (urlTenant && urlTenant !== authSlug) {
      params.set('tenant', authSlug);
      window.history.replaceState(null, '', `/?${params.toString()}`);
    } else if (!urlTenant) {
      params.set('tenant', authSlug);
      window.history.replaceState(null, '', `/?${params.toString()}`);
    }
  }, [tenant, location.search, MOCK_API_URL]);

  if (!MOCK_API_URL) {
    return <AdminAppLegacy />;
  }

  if (!token) return null;

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
                  <Route path="orders" element={<OrdersPage />} />
                  <Route path="orders/board" element={<OrdersBoardPage />} />
                  <Route path="catalog/categories" element={<CategoriesPage />} />
                  <Route path="catalog/products" element={<ProductsPage />} />
                  <Route path="catalog/options" element={<OptionsPage />} />
                  <Route path="campaigns" element={<CampaignsPage />} />
                  <Route path="campaigns/new" element={<CampaignEditPage />} />
                  <Route path="campaigns/:id/edit" element={<CampaignEditPage />} />
                  <Route path="settings/delivery" element={<DeliverySettingsPage />} />
                  <Route path="settings/staff" element={<StaffPage />} />
                  <Route path="branding" element={<BrandingPage />} />
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
                  <Route path="orders" element={<OrdersPage />} />
                  <Route path="orders/board" element={<OrdersBoardPage />} />
                  <Route path="catalog/categories" element={<CategoriesPage />} />
                  <Route path="catalog/products" element={<ProductsPage />} />
                  <Route path="catalog/options" element={<OptionsPage />} />
                  <Route path="campaigns" element={<CampaignsPage />} />
                  <Route path="campaigns/new" element={<CampaignEditPage />} />
                  <Route path="campaigns/:id/edit" element={<CampaignEditPage />} />
                  <Route path="settings/delivery" element={<DeliverySettingsPage />} />
                  <Route path="settings/staff" element={<StaffPage />} />
                  <Route path="branding" element={<BrandingPage />} />
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
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<AuthGuard><AdminApp /></AuthGuard>} />
      </Routes>
    </AuthProvider>
  );
}
