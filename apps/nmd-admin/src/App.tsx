import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { tenantRouteElements } from './tenant-portal/routes';
import { ThemeProvider, ToastProvider } from '@nmd/ui';
import { EmergencyModeProvider } from './contexts/EmergencyModeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';

const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const IndexOrRedirect = lazy(() => import('./components/RoleBasedRoute').then((m) => ({ default: m.IndexOrRedirect })));
const RedirectMarketAdminToTenants = lazy(() => import('./components/RoleBasedRoute').then((m) => ({ default: m.RedirectMarketAdminToTenants })));
const MarketsOrRedirect = lazy(() => import('./components/RoleBasedRoute').then((m) => ({ default: m.MarketsOrRedirect })));
const RootOnlyRoute = lazy(() => import('./components/RoleBasedRoute').then((m) => ({ default: m.RootOnlyRoute })));
const MarketRouteGuard = lazy(() => import('./components/MarketRouteGuard').then((m) => ({ default: m.MarketRouteGuard })));
const RequireTenant = lazy(() => import('./tenant-portal/guards/RequireTenant').then((m) => ({ default: m.RequireTenant })));
const TenantLayout = lazy(() => import('./tenant-portal/layouts/TenantLayout'));
const MarketsPage = lazy(() => import('./pages/MarketsPage'));
const MarketDetailPage = lazy(() => import('./pages/MarketDetailPage'));
const TenantsPage = lazy(() => import('./pages/TenantsPage'));
const TenantDetailPage = lazy(() => import('./pages/TenantDetailPage'));
const PlansPage = lazy(() => import('./pages/PlansPage'));
const ModulesPage = lazy(() => import('./pages/ModulesPage'));
const ApiIntegrationsPage = lazy(() => import('./pages/ApiIntegrationsPage'));
const SystemSettingsPage = lazy(() => import('./pages/SystemSettingsPage'));
const PaymentsSettingsPage = lazy(() => import('./pages/PaymentsSettingsPage'));
const SystemTemplatesPage = lazy(() => import('./pages/SystemTemplatesPage'));
const MonitoringPage = lazy(() => import('./pages/MonitoringPage'));
const AuditLogPage = lazy(() => import('./pages/AuditLogPage'));
const MarketDispatchPage = lazy(() => import('./pages/MarketDispatchPage'));
const MarketFinancePage = lazy(() => import('./pages/MarketFinancePage'));
const TenantDeliverySettingsPage = lazy(() => import('./pages/TenantDeliverySettingsPage'));

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  const location = useLocation();
  if (!MOCK_API_URL) return <>{children}</>;
  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!token) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }
  return <>{children}</>;
}

const NMD_THEME = {
  logoUrl: '/favicon.svg',
  primaryColor: '#4b5563',
  secondaryColor: '#9ca3af',
  fontFamily: '"Cairo", system-ui, sans-serif',
  radiusScale: 1,
  layoutStyle: 'default' as const,
};

export default function App() {
  return (
    <ThemeProvider branding={NMD_THEME} dir="rtl">
      <AuthProvider>
      <EmergencyModeProvider>
      <ToastProvider>
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<AuthGuard><AdminLayout /></AuthGuard>}>
              <Route index element={<IndexOrRedirect />} />
              <Route path="markets" element={<MarketsOrRedirect><MarketsPage /></MarketsOrRedirect>} />
              <Route path="markets/:id" element={<MarketRouteGuard><MarketDetailPage /></MarketRouteGuard>} />
              <Route path="markets/:id/tenants" element={<MarketRouteGuard><MarketDetailPage /></MarketRouteGuard>} />
              <Route path="markets/:id/orders" element={<MarketRouteGuard><MarketDetailPage /></MarketRouteGuard>} />
              <Route path="markets/:id/dispatch" element={<MarketRouteGuard><MarketDispatchPage /></MarketRouteGuard>} />
              <Route path="markets/:id/finance" element={<MarketRouteGuard><MarketFinancePage /></MarketRouteGuard>} />
              <Route path="markets/:id/couriers" element={<MarketRouteGuard><Navigate to="../dispatch" replace /></MarketRouteGuard>} />
              <Route path="tenants" element={<RedirectMarketAdminToTenants><TenantsPage /></RedirectMarketAdminToTenants>} />
              <Route path="tenants/:id" element={<RootOnlyRoute><TenantDetailPage /></RootOnlyRoute>} />
              <Route path="tenants/:id/settings/delivery" element={<RootOnlyRoute><TenantDeliverySettingsPage /></RootOnlyRoute>} />
              <Route path="markets/:id/tenants/:tenantId" element={<MarketRouteGuard><TenantDetailPage /></MarketRouteGuard>} />
              <Route path="markets/:id/tenants/:tenantId/settings/delivery" element={<MarketRouteGuard><TenantDeliverySettingsPage /></MarketRouteGuard>} />
              <Route path="plans" element={<RootOnlyRoute><PlansPage /></RootOnlyRoute>} />
              <Route path="modules" element={<RootOnlyRoute><ModulesPage /></RootOnlyRoute>} />
              <Route path="api" element={<RootOnlyRoute><ApiIntegrationsPage /></RootOnlyRoute>} />
              <Route path="settings" element={<RootOnlyRoute><SystemSettingsPage /></RootOnlyRoute>} />
              <Route path="settings/payments" element={<RootOnlyRoute><PaymentsSettingsPage /></RootOnlyRoute>} />
              <Route path="system/templates" element={<RootOnlyRoute><SystemTemplatesPage /></RootOnlyRoute>} />
              <Route path="monitoring" element={<RootOnlyRoute><MonitoringPage /></RootOnlyRoute>} />
              <Route path="audit" element={<RootOnlyRoute><AuditLogPage /></RootOnlyRoute>} />
              <Route path="tenant" element={<RequireTenant><TenantLayout /></RequireTenant>}>
                {tenantRouteElements}
                <Route path="settings/delivery" element={<TenantDeliverySettingsPage />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </ToastProvider>
      </EmergencyModeProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
