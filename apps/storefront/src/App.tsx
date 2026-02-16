import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, useParams } from 'react-router-dom';
import { ThemeProvider, ToastProvider, LayoutShell } from '@nmd/ui';
import { useQuery } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import { getTenantSlugOrId, persistTenant } from './lib/tenant';
import { useAppStore } from './store/app';
import { CustomerAuthProvider } from './contexts/CustomerAuthContext';

const Layout = lazy(() => import('./layouts/Layout'));
const RootRedirect = lazy(() => import('./pages/RootRedirect'));
const LegacyProductRedirect = lazy(() => import('./pages/LegacyProductRedirect'));
const HomePage = lazy(() => import('./pages/HomePage'));
const CategoryPage = lazy(() => import('./pages/CategoryPage'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const CartPage = lazy(() => import('./pages/CartPage'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage'));
const OrderSuccessPage = lazy(() => import('./pages/OrderSuccessPage'));
const OrderPrintPage = lazy(() => import('./pages/OrderPrintPage'));
const LegacyOrderSuccessRedirect = lazy(() => import('./pages/LegacyOrderSuccessRedirect'));

const api = new MockApiClient();

function TenantGate() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const tenantSlugOrId = tenantSlug ?? getTenantSlugOrId();
  const setTenant = useAppStore((s) => s.setTenant);

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant', tenantSlugOrId],
    queryFn: () => api.getTenant(tenantSlugOrId!),
    enabled: !!tenantSlugOrId,
  });

  useEffect(() => {
    if (tenant) {
      setTenant(tenant.id, tenant.slug, tenant.name, tenant.type ?? 'GENERAL');
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
    <ThemeProvider branding={tenant.branding} dir="rtl">
      <LayoutShell layoutStyle={tenant.branding.layoutStyle}>
        <ToastProvider>
          <CustomerAuthProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<HomePage />} />
                <Route path="p/:productId" element={<ProductPage />} />
                <Route path="c/:categoryId" element={<CategoryPage />} />
                <Route path="cart" element={<CartPage />} />
                <Route path="checkout" element={<CheckoutPage />} />
                <Route path="order/:orderId/success" element={<OrderSuccessPage />} />
              </Route>
            </Routes>
          </CustomerAuthProvider>
        </ToastProvider>
      </LayoutShell>
    </ThemeProvider>
  );
}

function AppContent() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        <Route path="/order/:orderId/print" element={<OrderPrintPage />} />
        <Route path="/order/:orderId/success" element={<LegacyOrderSuccessRedirect />} />
        <Route path="/" element={<RootRedirect />} />
        <Route path="/p/:productId" element={<LegacyProductRedirect />} />
        <Route path="/:tenantSlug/*" element={<TenantGate />} />
      </Routes>
    </Suspense>
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

export default function App() {
  return <AppContent />;
}
