import { Navigate } from 'react-router-dom';
import { getTenantSlugOrId } from '../lib/tenant';
import TenantSelectPage from './TenantSelectPage';

/**
 * Root path /. If tenant from ?tenant= or localStorage, redirect to /:tenantSlug.
 * Else show tenant selection.
 */
export default function RootRedirect() {
  const tenantSlug = getTenantSlugOrId();

  if (tenantSlug) {
    return <Navigate to={`/${tenantSlug}`} replace />;
  }

  return <TenantSelectPage />;
}
