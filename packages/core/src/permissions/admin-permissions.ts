/** Platform admin roles — shared by nmd-admin, merchant admin, and mock-api. */

export type AdminRole =
  | 'ROOT_ADMIN'
  | 'SUPER_ADMIN'
  | 'MARKET_ADMIN'
  | 'TENANT_ADMIN'
  | 'COURIER'
  | 'CUSTOMER';

export type AdminModule =
  | 'dashboard'
  | 'orders'
  | 'orderBoard'
  | 'products'
  | 'categories'
  | 'options'
  | 'campaigns'
  | 'storeSettings'
  | 'workingHours'
  | 'coupons'
  | 'settlementSummary'
  | 'settlementLedger'
  | 'settlementPayments'
  | 'platformFee'
  | 'commission'
  | 'markupExempt'
  | 'homeBuilder'
  | 'pushBroadcast'
  | 'globalRewards'
  | 'drivers'
  | 'marketsList'
  | 'allTenants'
  | 'marketOverview'
  | 'marketStores'
  | 'marketOrders'
  | 'marketReports'
  | 'marketBanners'
  | 'marketDispatch'
  | 'marketCouriers'
  | 'marketFinance'
  | 'marketPlatformFee'
  | 'platformSettings'
  | 'platformFees'
  | 'platformEconomics'
  | 'superAdminReports'
  | 'customers'
  | 'deliveryLeads'
  | 'audit'
  | 'contests'
  | 'staff'
  | 'branding'
  | 'homepage'
  | 'deliveryZones'
  | 'platformCatalog'
  | 'modifierIcons'
  | 'luckyWheel'
  | 'externalOrders'
  | 'monitoring';

export type EditableField =
  | 'markupExempt'
  | 'platformFee'
  | 'commissionType'
  | 'commissionValue'
  | 'financialConfig'
  | 'marketId'
  | 'enabled'
  | 'deliveryFeeModel'
  | 'loyaltyBonus';

export function isPlatformSuperAdmin(role: string | undefined): boolean {
  return role === 'ROOT_ADMIN' || role === 'SUPER_ADMIN';
}

export function isMarketAdminRole(role: string | undefined): boolean {
  return role === 'MARKET_ADMIN';
}

export function isTenantAdminRole(role: string | undefined): boolean {
  return role === 'TENANT_ADMIN';
}

export function isStaffAdminRole(role: string | undefined): boolean {
  return isPlatformSuperAdmin(role) || isMarketAdminRole(role) || isTenantAdminRole(role);
}

const MARKET_ADMIN_MODULES: ReadonlySet<AdminModule> = new Set([
  'dashboard',
  'marketOverview',
  'marketStores',
  'marketOrders',
  'marketReports',
  'marketBanners',
  'marketDispatch',
  'marketCouriers',
  'deliveryLeads',
  'customers',
  'storeSettings',
  'orders',
  'products',
  'categories',
  'options',
  'workingHours',
  'branding',
  'homepage',
  'deliveryZones',
]);

const TENANT_ADMIN_MODULES: ReadonlySet<AdminModule> = new Set([
  'dashboard',
  'orders',
  'orderBoard',
  'products',
  'categories',
  'options',
  'campaigns',
  'storeSettings',
  'workingHours',
  'coupons',
  'settlementSummary',
  'staff',
  'branding',
  'homepage',
  'deliveryLeads',
  'customers',
]);

/** Nav item path → module (nmd-admin super nav + shared routes). */
export const ROUTE_MODULE_MAP: Record<string, AdminModule> = {
  '/monitoring': 'monitoring',
  '/economics': 'platformEconomics',
  '/markets': 'marketsList',
  '/tenants': 'allTenants',
  '/platform-fees': 'platformFees',
  '/categories': 'platformCatalog',
  '/pillars': 'platformCatalog',
  '/system/templates': 'platformCatalog',
  '/delivery-leads': 'deliveryLeads',
  '/drivers': 'drivers',
  '/drivers/couriers': 'drivers',
  '/drivers/markets': 'drivers',
  '/drivers/reports': 'superAdminReports',
  '/drivers/finance': 'settlementPayments',
  '/external-orders': 'externalOrders',
  '/contests': 'contests',
  '/rewards': 'globalRewards',
  '/coupons': 'coupons',
  '/lucky-wheel': 'luckyWheel',
  '/push-notifications': 'pushBroadcast',
  '/home-builder': 'homeBuilder',
  '/modifier-icons': 'modifierIcons',
  '/customers': 'customers',
  '/settings': 'platformSettings',
  '/settings/payments': 'platformSettings',
  '/settings/category-policies': 'platformSettings',
  '/settings/home-layout': 'homeBuilder',
  '/audit': 'audit',
  '/plans': 'platformSettings',
  '/modules': 'platformSettings',
  '/api': 'platformSettings',
  '/tenant': 'dashboard',
  '/tenant/products': 'products',
  '/tenant/orders': 'orders',
  '/tenant/delivery-zones': 'deliveryZones',
  '/tenant/customers': 'customers',
  '/tenant/account/security': 'storeSettings',
};

/** Merchant admin (/merchant) path → module. */
export const MERCHANT_ROUTE_MODULE_MAP: Record<string, AdminModule> = {
  '/': 'dashboard',
  '/orders': 'orders',
  '/orders/board': 'orderBoard',
  '/leads': 'deliveryLeads',
  '/catalog/products': 'products',
  '/catalog/categories': 'categories',
  '/catalog/options': 'options',
  '/campaigns': 'campaigns',
  '/settings/store': 'storeSettings',
  '/settings/settlement': 'settlementSummary',
  '/settings/staff': 'staff',
  '/settings/delivery': 'deliveryZones',
  '/branding': 'branding',
  '/homepage': 'homepage',
};

export function canViewModule(role: string | undefined, module: AdminModule): boolean {
  if (!role) return false;
  if (isPlatformSuperAdmin(role)) return true;
  if (isMarketAdminRole(role)) return MARKET_ADMIN_MODULES.has(module);
  if (isTenantAdminRole(role)) return TENANT_ADMIN_MODULES.has(module);
  return false;
}

export function canEditField(role: string | undefined, field: EditableField): boolean {
  if (!role) return false;
  if (isPlatformSuperAdmin(role)) return true;
  if (field === 'markupExempt' || field === 'platformFee' || field === 'financialConfig') return false;
  if (field === 'commissionType' || field === 'commissionValue' || field === 'deliveryFeeModel') return false;
  if (field === 'loyaltyBonus') return isMarketAdminRole(role);
  if (field === 'marketId' || field === 'enabled') return isMarketAdminRole(role);
  if (isTenantAdminRole(role)) {
    return field !== 'markupExempt' && field !== 'platformFee' && field !== 'financialConfig';
  }
  return false;
}

function normalizeRoutePath(route: string): string {
  const path = route.split('?')[0]?.trim() ?? '/';
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path || '/';
}

function resolveRouteModule(route: string, map: Record<string, AdminModule>): AdminModule | undefined {
  const normalized = normalizeRoutePath(route);
  if (map[normalized]) return map[normalized];
  if (normalized.startsWith('/markets/') && normalized.includes('/tenants/')) {
    if (normalized.includes('/settings/delivery')) return 'deliveryZones';
    return 'marketStores';
  }
  if (normalized.match(/^\/markets\/[^/]+\/orders/)) return 'marketOrders';
  if (normalized.match(/^\/markets\/[^/]+\/dispatch/)) return 'marketDispatch';
  if (normalized.match(/^\/markets\/[^/]+\/finance/)) return 'marketFinance';
  if (normalized.match(/^\/markets\/[^/]+\/platform-fee/)) return 'marketPlatformFee';
  if (normalized.match(/^\/markets\/[^/]+\/reports/)) return 'marketReports';
  if (normalized.match(/^\/markets\/[^/]+\/banners/)) return 'marketBanners';
  if (normalized.match(/^\/markets\/[^/]+\/layout/)) return 'marketBanners';
  if (normalized.match(/^\/markets\/[^/]+\/tenants/)) return 'marketStores';
  if (normalized.match(/^\/markets\/[^/]+$/)) return 'marketOverview';
  if (normalized.startsWith('/tenants/') && normalized.endsWith('/settlement')) return 'settlementLedger';
  if (normalized.startsWith('/tenants/')) return 'allTenants';
  if (normalized.startsWith('/tenant/')) {
    const sub = normalized.replace(/^\/tenant/, '') || '/';
    return map[`/tenant${sub === '/' ? '' : sub}`] ?? map['/tenant'] ?? 'dashboard';
  }
  if (normalized.startsWith('/drivers/')) return 'drivers';
  if (normalized.startsWith('/settings/')) return 'platformSettings';
  if (normalized.startsWith('/campaigns')) return 'campaigns';
  if (normalized.startsWith('/catalog/')) {
    const merchantMap = MERCHANT_ROUTE_MODULE_MAP;
    return merchantMap[normalized];
  }
  return undefined;
}

export function canAccessRoute(role: string | undefined, route: string): boolean {
  if (!role || role === 'CUSTOMER' || role === 'COURIER') return false;
  if (isPlatformSuperAdmin(role)) return true;

  const nmdModule = resolveRouteModule(route, ROUTE_MODULE_MAP);
  const merchantModule = resolveRouteModule(route, MERCHANT_ROUTE_MODULE_MAP);
  const module = nmdModule ?? merchantModule;
  if (!module) return isMarketAdminRole(role) || isTenantAdminRole(role);

  return canViewModule(role, module);
}

export type AdminAppContext = 'nmd-admin' | 'merchant';

/** Cross-app URL for store owners (outside /market-admin router basename). */
export function getTenantMerchantPortalUrl(tenantSlug?: string | null): string {
  const base = '/merchant';
  const slug = tenantSlug?.trim();
  if (slug) return `${base}?tenant=${encodeURIComponent(slug)}`;
  return base;
}

export function isExternalAdminRedirect(path: string): boolean {
  return path.startsWith('/merchant');
}

export function getSafeDashboardRoute(
  role: string | undefined,
  context: AdminAppContext = 'nmd-admin',
  tenantSlug?: string | null
): string {
  if (isPlatformSuperAdmin(role)) return '/monitoring';
  if (isMarketAdminRole(role)) return '/markets';
  if (isTenantAdminRole(role)) {
    if (context === 'merchant') return '/';
    return getTenantMerchantPortalUrl(tenantSlug);
  }
  return '/login';
}

/** TENANT_ADMIN allowed keys on PATCH/PUT /tenants/:id (store owner self-service). */
export const TENANT_ADMIN_TENANT_PATCH_FIELDS = [
  'name',
  'about',
  'phone',
  'whatsappPhone',
  'officeHours',
  'openTime',
  'closeTime',
  'forceClosed',
  'operationalStatus',
  'overrideStatus',
  'orderPolicy',
  'businessHours',
  'busyBannerEnabled',
  'busyBannerText',
  'bookingEnabled',
  'storeType',
  'addressLine',
  'location',
  'supportsWeightSelling',
  'paymentMethods',
  'paymentCapabilities',
  'banners',
  'hero',
  'logoUrl',
  'primaryColor',
  'secondaryColor',
  'fontFamily',
  'radiusScale',
  'layoutStyle',
  'collections',
] as const;

export type TenantPatchField = (typeof TENANT_ADMIN_TENANT_PATCH_FIELDS)[number];

export function filterTenantPatchForRole(
  role: string | undefined,
  updates: Record<string, unknown>
): Record<string, unknown> {
  if (isPlatformSuperAdmin(role)) return updates;
  if (isMarketAdminRole(role)) {
    const allowed = [
      'marketCategory',
      'isListedInMarket',
      'marketSortOrder',
      'marketId',
      'pillarId',
      'subCategoryId',
      'supportsWeightSelling',
      'overrideStatus',
    ];
    return Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));
  }
  if (isTenantAdminRole(role)) {
    return Object.fromEntries(
      Object.entries(updates).filter(([k]) =>
        (TENANT_ADMIN_TENANT_PATCH_FIELDS as readonly string[]).includes(k)
      )
    );
  }
  return {};
}

export function stripProtectedCategoryFields<T extends { markupExempt?: boolean }>(
  role: string | undefined,
  categories: T[],
  existing: T[]
): T[] {
  if (isPlatformSuperAdmin(role)) return categories;
  const existingById = new Map(existing.map((c) => [(c as { id?: string }).id, c]));
  return categories.map((cat) => {
    const id = (cat as { id?: string }).id;
    const prev = id ? existingById.get(id) : undefined;
    if (!canEditField(role, 'markupExempt')) {
      return { ...cat, markupExempt: prev?.markupExempt ?? false };
    }
    return cat;
  });
}
