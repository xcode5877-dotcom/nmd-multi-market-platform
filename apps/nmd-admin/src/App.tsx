import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { tenantRouteElements } from './tenant-portal/routes';
import { ThemeProvider, ToastProvider } from '@nmd/ui';
import { EmergencyModeProvider } from './contexts/EmergencyModeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NativeBridgeProvider } from './contexts/NativeBridgeContext';

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
const CategoryPoliciesPage = lazy(() => import('./pages/CategoryPoliciesPage'));
const HomeLayoutPage = lazy(() => import('./pages/HomeLayoutPage'));
const SystemTemplatesPage = lazy(() => import('./pages/SystemTemplatesPage'));
const MonitoringPage = lazy(() => import('./pages/MonitoringPage'));
const AuditLogPage = lazy(() => import('./pages/AuditLogPage'));
const MarketDispatchPage = lazy(() => import('./pages/MarketDispatchPage'));
const MarketFinancePage = lazy(() => import('./pages/MarketFinancePage'));
const MarketReportsPage = lazy(() => import('./pages/MarketReportsPage'));
const TenantDeliverySettingsPage = lazy(() => import('./pages/TenantDeliverySettingsPage'));
const CategoriesAdminPage = lazy(() => import('./pages/CategoriesAdminPage'));
const PillarCategoryManagerPage = lazy(() => import('./pages/PillarCategoryManagerPage'));
const LeadsPage = lazy(() => import('./pages/LeadsPage'));
const CustomersPage = lazy(() => import('./pages/CustomersPage'));
const ContestsPage = lazy(() => import('./pages/ContestsPage').then((m) => ({ default: m.ContestsPageWithGuard })));
const CouponsPage = lazy(() => import('./pages/CouponsPage'));
const LuckyWheelAdmin = lazy(() => import('./pages/LuckyWheelAdmin'));
const PushNotificationsPage = lazy(() => import('./pages/PushNotificationsPage'));
const RewardsPage = lazy(() => import('./pages/RewardsPage'));
const ExternalOrdersAdminPage = lazy(() => import('./pages/ExternalOrdersAdminPage'));
const DriversSectionLayout = lazy(() => import('./components/drivers/DriversSectionLayout'));
const DriversHubPage = lazy(() => import('./pages/drivers/DriversHubPage'));
const DriversReportsHubPage = lazy(() => import('./pages/drivers/DriversReportsHubPage'));
const DriversFinanceHubPage = lazy(() => import('./pages/drivers/DriversFinanceHubPage'));
const DriversMarketsHubPage = lazy(() => import('./pages/drivers/DriversMarketsHubPage'));
const DriversCouriersPage = lazy(() => import('./pages/drivers/DriversCouriersPage'));

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';
const LOADING = <div className="min-h-screen flex items-center justify-center">Loading...</div>;

const NMD_THEME = {
  logoUrl: '/favicon.svg',
  primaryColor: '#4b5563',
  secondaryColor: '#9ca3af',
  fontFamily: '"Cairo", system-ui, sans-serif',
  radiusScale: 1,
  layoutStyle: 'default' as const,
};

function Content() {
  const auth = useAuth();
  const location = useLocation();

  const returnTo = encodeURIComponent(location.pathname + location.search);
  const loginRedirect = <Navigate to={`/login?returnTo=${returnTo}`} replace />;

  const dashboardRoutes = (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<AdminLayout />}>
        <Route index element={<IndexOrRedirect />} />
        <Route path="markets" element={<MarketsOrRedirect><MarketsPage /></MarketsOrRedirect>} />
        <Route path="markets/:id" element={<MarketRouteGuard><MarketDetailPage /></MarketRouteGuard>} />
        <Route path="markets/:id/tenants" element={<MarketRouteGuard><MarketDetailPage /></MarketRouteGuard>} />
        <Route path="markets/:id/orders" element={<MarketRouteGuard><MarketDetailPage /></MarketRouteGuard>} />
        <Route path="markets/:id/dispatch" element={<MarketRouteGuard><MarketDispatchPage /></MarketRouteGuard>} />
        <Route path="markets/:id/finance" element={<MarketRouteGuard><MarketFinancePage /></MarketRouteGuard>} />
        <Route path="markets/:id/reports" element={<MarketRouteGuard><MarketReportsPage /></MarketRouteGuard>} />
        <Route path="markets/:id/banners" element={<MarketRouteGuard><MarketDetailPage /></MarketRouteGuard>} />
        <Route path="markets/:id/layout" element={<MarketRouteGuard><MarketDetailPage /></MarketRouteGuard>} />
        <Route path="markets/:id/couriers" element={<MarketRouteGuard><Navigate to="../dispatch" replace /></MarketRouteGuard>} />
        <Route path="tenants" element={<RedirectMarketAdminToTenants><TenantsPage /></RedirectMarketAdminToTenants>} />
        <Route path="categories" element={<RootOnlyRoute><CategoriesAdminPage /></RootOnlyRoute>} />
        <Route path="pillars" element={<RootOnlyRoute><PillarCategoryManagerPage /></RootOnlyRoute>} />
        <Route path="tenants/:id" element={<RootOnlyRoute><TenantDetailPage /></RootOnlyRoute>} />
        <Route path="tenants/:id/settings/delivery" element={<RootOnlyRoute><TenantDeliverySettingsPage /></RootOnlyRoute>} />
        <Route path="markets/:id/tenants/:tenantId" element={<MarketRouteGuard><TenantDetailPage /></MarketRouteGuard>} />
        <Route path="markets/:id/tenants/:tenantId/settings/delivery" element={<MarketRouteGuard><TenantDeliverySettingsPage /></MarketRouteGuard>} />
        <Route path="plans" element={<RootOnlyRoute><PlansPage /></RootOnlyRoute>} />
        <Route path="modules" element={<RootOnlyRoute><ModulesPage /></RootOnlyRoute>} />
        <Route path="api" element={<RootOnlyRoute><ApiIntegrationsPage /></RootOnlyRoute>} />
        <Route path="settings" element={<RootOnlyRoute><SystemSettingsPage /></RootOnlyRoute>} />
        <Route path="settings/payments" element={<RootOnlyRoute><PaymentsSettingsPage /></RootOnlyRoute>} />
        <Route path="settings/category-policies" element={<RootOnlyRoute><CategoryPoliciesPage /></RootOnlyRoute>} />
        <Route path="settings/home-layout" element={<RootOnlyRoute><HomeLayoutPage /></RootOnlyRoute>} />
        <Route path="system/templates" element={<RootOnlyRoute><SystemTemplatesPage /></RootOnlyRoute>} />
        <Route path="monitoring" element={<RootOnlyRoute><MonitoringPage /></RootOnlyRoute>} />
        <Route path="audit" element={<RootOnlyRoute><AuditLogPage /></RootOnlyRoute>} />
        <Route path="delivery-leads" element={<LeadsPage />} />
        <Route path="leads" element={<Navigate to="/delivery-leads" replace />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="contests" element={<ContestsPage />} />
        <Route path="coupons" element={<RootOnlyRoute><CouponsPage /></RootOnlyRoute>} />
        <Route path="lucky-wheel" element={<RootOnlyRoute><LuckyWheelAdmin /></RootOnlyRoute>} />
        <Route path="rewards" element={<RootOnlyRoute><RewardsPage /></RootOnlyRoute>} />
        <Route path="drivers" element={<RootOnlyRoute><DriversSectionLayout /></RootOnlyRoute>}>
          <Route index element={<DriversHubPage />} />
          <Route path="couriers" element={<DriversCouriersPage />} />
          <Route path="reports" element={<DriversReportsHubPage />} />
          <Route path="finance" element={<DriversFinanceHubPage />} />
          <Route path="markets" element={<DriversMarketsHubPage />} />
        </Route>
        <Route path="external-orders" element={<RootOnlyRoute><DriversSectionLayout /></RootOnlyRoute>}>
          <Route index element={<ExternalOrdersAdminPage />} />
        </Route>
        <Route path="push-notifications" element={<RootOnlyRoute><PushNotificationsPage /></RootOnlyRoute>} />
        <Route path="tenant" element={<RequireTenant><TenantLayout /></RequireTenant>}>
          {tenantRouteElements}
          <Route path="settings/delivery" element={<TenantDeliverySettingsPage />} />
        </Route>
      </Route>
    </Routes>
  );

  const content =
    !MOCK_API_URL ? (
      dashboardRoutes
    ) : auth.isLoading ? (
      LOADING
    ) : !auth.token ? (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={loginRedirect} />
      </Routes>
    ) : (
      dashboardRoutes
    );

  return content;
}

export default function App() {
  return (
    <ThemeProvider branding={NMD_THEME} dir="rtl">
      <AuthProvider>
        <EmergencyModeProvider>
          <NativeBridgeProvider>
            <ToastProvider>
              <Suspense fallback={LOADING}>
                <Content />
              </Suspense>
            </ToastProvider>
          </NativeBridgeProvider>
        </EmergencyModeProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
