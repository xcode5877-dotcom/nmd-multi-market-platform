import { Route } from 'react-router-dom';
import TenantHomePage from './pages/TenantHomePage';
import TenantProductsPage from './pages/TenantProductsPage';
import TenantDeliveryZonesPage from './pages/TenantDeliveryZonesPage';
import TenantOrdersPage from './pages/TenantOrdersPage';
import TenantSecurityPage from './pages/TenantSecurityPage';

/**
 * Tenant portal nested route elements. Use as children of Route path="tenant".
 * All routes are tenant-scoped; tenantId comes from token, never from URL.
 * Export for use in App.tsx; can be moved to standalone app later.
 */
export const tenantRouteElements = (
  <>
    <Route index element={<TenantHomePage />} />
    <Route path="products" element={<TenantProductsPage />} />
    <Route path="delivery-zones" element={<TenantDeliveryZonesPage />} />
    <Route path="orders" element={<TenantOrdersPage />} />
    <Route path="account/security" element={<TenantSecurityPage />} />
  </>
);
