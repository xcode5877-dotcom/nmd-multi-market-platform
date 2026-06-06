import { ReactNode, useLayoutEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  canAccessRoute,
  canViewModule,
  getSafeDashboardRoute,
  isExternalAdminRedirect,
  ROUTE_MODULE_MAP,
  type AdminAppContext,
  type AdminModule,
} from '@nmd/core';
import { MockApiClient } from '@nmd/mock';
import type { SuperAdminNavSection } from '../config/superAdminNav';
import { SUPER_ADMIN_NAV_SECTIONS } from '../config/superAdminNav';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';
const api = new MockApiClient();

type MeLike = { role?: string; tenantSlug?: string };

type PermissionRouteProps = {
  children: ReactNode;
  /** Route path for permission check (defaults to current location if omitted). */
  route?: string;
};

function RedirectSpinner() {
  return <div className="p-8 text-gray-500">جاري التحويل...</div>;
}

/** In-app or cross-app redirect to the role-safe dashboard (no disabled UI). */
export function AdminSafeRedirect({
  me,
  context = 'nmd-admin',
}: {
  me: MeLike;
  context?: AdminAppContext;
}) {
  const to = getSafeDashboardRoute(me.role, context, me.tenantSlug);

  useLayoutEffect(() => {
    if (isExternalAdminRedirect(to)) window.location.replace(to);
  }, [to]);

  if (isExternalAdminRedirect(to)) return <RedirectSpinner />;
  return <Navigate to={to} replace />;
}

/** Redirects unauthorized roles to their safe dashboard — no disabled UI. */
export function PermissionRoute({ children, route }: PermissionRouteProps) {
  const { data: me, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.getMe(),
    enabled: !!MOCK_API_URL,
  });

  if (!MOCK_API_URL) return <>{children}</>;
  if (isLoading || !me) return <div className="p-8 text-gray-500">جاري التحميل...</div>;

  const checkPath = route ?? window.location.pathname;
  if (!canAccessRoute(me.role, checkPath)) {
    return <AdminSafeRedirect me={me} context="nmd-admin" />;
  }

  return <>{children}</>;
}

export function filterSuperAdminNavSections(role: string | undefined): SuperAdminNavSection[] {
  return SUPER_ADMIN_NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      const module: AdminModule = ROUTE_MODULE_MAP[item.to] ?? 'dashboard';
      return canViewModule(role, module);
    }),
  })).filter((section) => section.items.length > 0);
}

export {
  canAccessRoute,
  canViewModule,
  canEditField,
  getSafeDashboardRoute,
  getTenantMerchantPortalUrl,
  isExternalAdminRedirect,
} from '@nmd/core';
