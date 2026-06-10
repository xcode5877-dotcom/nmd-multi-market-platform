import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation, NavLink, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Modal, useToast, Input, Select, ConfirmDialog, Drawer, OrderListFilters, OrderSourceBadge } from '@nmd/ui';
import { MockApiClient, type RegistryTenant } from '@nmd/mock';
import {
  formatAddonNameWithPlacement,
  formatDateGregorian,
  filterOrdersForList,
  DEFAULT_ORDER_SOURCE_FILTER,
  DEFAULT_ORDER_STATUS_FILTER,
  type OrderSourceFilter,
  type OrderStatusFilterKey,
} from '@nmd/core';
import { ArrowLeft, KeyRound, Upload, Trash2, Eye, Settings2 } from 'lucide-react';
import { apiHeaders, apiFetch, apiUpload, listCategories } from '../api';
import PlatformOrderOpsPanel from '../components/orders/PlatformOrderOpsPanel';
import OrderPlatformOpsDrawer from '../components/orders/OrderPlatformOpsDrawer';
import { canUsePlatformOrderOps, formatOrderStatusLabel } from '../lib/platform-order-ops';
import MarketBannersTab from './MarketBannersTab';
import MarketLayoutTab from './MarketLayoutTab';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

function PizzaSideIndicator({ placement }: { placement: 'WHOLE' | 'LEFT' | 'RIGHT' }) {
  const teal = '#14b8a6';
  const size = 14;
  return (
    <span
      className="relative inline-flex shrink-0 overflow-hidden rounded-full border border-slate-300"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {placement === 'WHOLE' && <span className="absolute inset-0" style={{ background: teal }} />}
      {placement === 'LEFT' && <span className="absolute inset-y-0 left-0 w-1/2" style={{ background: teal }} />}
      {placement === 'RIGHT' && <span className="absolute inset-y-0 right-0 w-1/2" style={{ background: teal }} />}
    </span>
  );
}

interface CategoryOption {
  id: string;
  title: string;
  legacyCode?: string;
}
function normalizeCategories(raw: unknown[]): CategoryOption[] {
  return raw.map((c) => {
    const o = c as Record<string, unknown>;
    const id = String(o?.id ?? '').trim();
    const title = String(o?.nameAr ?? o?.title ?? '').trim() || id;
    return { id, title, legacyCode: typeof o?.legacyCode === 'string' ? o.legacyCode : undefined };
  }).filter((c) => c.id);
}
function resolveCategoryId(tenantMc: string | undefined, categories: CategoryOption[]): string {
  const raw = (tenantMc ?? 'GENERAL').trim();
  if (!raw) return categories[0]?.id ?? raw;
  const byId = categories.find((c) => c.id === raw);
  if (byId) return byId.id;
  const byLegacy = categories.find((c) => c.legacyCode === raw);
  if (byLegacy) return byLegacy.id;
  return raw;
}

interface Market {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  branding?: { primaryColor?: string };
  isActive: boolean;
  sortOrder?: number;
}

interface OrderRow {
  id?: string;
  tenantId?: string;
  total?: number;
  status?: string;
  createdAt?: string;
  isExternal?: boolean;
}

const api = new MockApiClient();

export default function MarketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const activeTab = useMemo(() => {
    if (!id) return 'details';
    if (pathname.endsWith('/tenants')) return 'tenants';
    if (pathname.endsWith('/orders')) return 'orders';
    if (pathname.endsWith('/dispatch')) return 'dispatch';
    if (pathname.endsWith('/finance')) return 'finance';
    if (pathname.endsWith('/platform-fee')) return 'platform-fee';
    if (pathname.endsWith('/banners')) return 'banners';
    if (pathname.endsWith('/layout')) return 'layout';
    return 'details';
  }, [id, pathname]);

  useEffect(() => {
    if (activeTab === 'orders') {
      console.log('NMD-TARGET-ACQUIRED: This is the Tenant Orders Page!');
    }
  }, [activeTab]);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTenantIds, setSelectedTenantIds] = useState<Set<string>>(new Set());
  const [resetPasswordTarget, setResetPasswordTarget] = useState<{ tenantId: string; tenantName: string; admin: { id: string; email: string } } | null>(null);
  const [createAccountTarget, setCreateAccountTarget] = useState<{ tenantId: string; tenantName: string } | null>(null);
  const [orderDeleteTarget, setOrderDeleteTarget] = useState<{ id?: string; tenantId?: string } | null>(null);
  const [orderDetailsId, setOrderDetailsId] = useState<string | null>(null);
  const [orderOpsId, setOrderOpsId] = useState<string | null>(null);
  const [orderHardDeleting, setOrderHardDeleting] = useState(false);
  const [orderSourceFilter, setOrderSourceFilter] = useState<OrderSourceFilter>(DEFAULT_ORDER_SOURCE_FILTER);
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatusFilterKey>(DEFAULT_ORDER_STATUS_FILTER);
  const [createForm, setCreateForm] = useState({
    name: '',
    slug: '',
    type: 'GENERAL' as 'CLOTHING' | 'FOOD' | 'GENERAL',
    primaryColor: '#0f766e',
    enabled: true,
    adminEmail: '',
    adminPassword: '',
  });

  const { data: market, isLoading: marketLoading, isError: marketError } = useQuery({
    queryKey: ['market', id],
    queryFn: () => fetch(`${MOCK_API_URL}/markets/${id}`, { headers: apiHeaders() }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status === 403 ? 'Forbidden' : 'Not found')))),
    enabled: !!id && !!MOCK_API_URL,
  });

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.getMe(),
    enabled: !!MOCK_API_URL,
  });
  const isRootAdmin = me?.role === 'ROOT_ADMIN';
  const isSuperAdmin = me?.role === 'SUPER_ADMIN';

  const { data: allTenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.listTenants(),
  });

  const { data: categoriesRaw = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => listCategories(),
    enabled: !!MOCK_API_URL,
  });
  const categoryOptions: CategoryOption[] = Array.isArray(categoriesRaw) ? normalizeCategories(categoriesRaw) : [];

  const marketTenants = (allTenants as (RegistryTenant & { marketId?: string })[]).filter(
    (t) => t.marketId === id
  );

  const tenantsNotInMarket = (allTenants as (RegistryTenant & { marketId?: string })[]).filter(
    (t) => !t.marketId || t.marketId !== id
  );

  const canManageTenants = isRootAdmin || isSuperAdmin || me?.marketId === id;
  const canPlatformOrderOps = canUsePlatformOrderOps(me?.role);

  const { data: marketOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['market-orders', id],
    queryFn: () => api.getMarketOrders(id!) as Promise<OrderRow[]>,
    enabled: !!MOCK_API_URL && !!id,
  });

  const filteredMarketOrders = useMemo(
    () => filterOrdersForList(marketOrders as OrderRow[], orderSourceFilter, orderStatusFilter),
    [marketOrders, orderSourceFilter, orderStatusFilter]
  );

  const { data: allMarkets = [] } = useQuery({
    queryKey: ['markets'],
    queryFn: () => fetch(`${MOCK_API_URL}/markets?all=true`, { headers: apiHeaders() }).then((r) => r.json()),
    enabled: !!MOCK_API_URL && isRootAdmin,
  });
  const markets = Array.isArray(allMarkets) ? allMarkets : [];

  const { data: tenantAdmins = [] } = useQuery({
    queryKey: ['tenant-admins', id],
    queryFn: () => api.listTenantAdminsForMarket(id!),
    enabled: !!MOCK_API_URL && !!id && canManageTenants,
  });
  const tenantAdminMap = useMemo(() => {
    const m = new Map<string, { id: string; email: string; role: string; tenantId?: string }>();
    tenantAdmins.forEach((a) => {
      if (a.tenantId) m.set(a.tenantId, a);
    });
    return m;
  }, [tenantAdmins]);

  const createMutation = useMutation({
    mutationFn: async (input: { name: string; slug: string; type: string; primaryColor: string; enabled: boolean; adminEmail?: string; adminPassword?: string }) => {
      const slug = (input.slug || input.name).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || `store-${Date.now()}`;
      return api.createTenantForMarket(id!, {
        name: input.name.trim(),
        slug,
        logoUrl: '',
        primaryColor: input.primaryColor,
        secondaryColor: '#d4a574',
        fontFamily: '"Cairo", system-ui, sans-serif',
        radiusScale: 1,
        layoutStyle: 'default',
        enabled: input.enabled,
        type: input.type as 'CLOTHING' | 'FOOD' | 'GENERAL',
        adminEmail: input.adminEmail?.trim() || undefined,
        adminPassword: input.adminPassword || undefined,
      });
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      addToast('تم إنشاء المحل بنجاح', 'success');
      setCreateModalOpen(false);
      setCreateForm({ name: '', slug: '', type: 'GENERAL', primaryColor: '#0f766e', enabled: true, adminEmail: '', adminPassword: '' });
      navigate(`/markets/${id}/tenants/${created.id}`);
    },
    onError: (err: Error) => {
      addToast(err?.message ?? 'فشل الإنشاء', 'error');
    },
  });

  const handleHardDeleteOrder = async () => {
    if (!orderDeleteTarget?.id) return;
    setOrderHardDeleting(true);
    try {
      const base = (import.meta.env.VITE_MOCK_API_URL ?? '/api').replace(/\/$/, '');
      const token = typeof localStorage !== 'undefined' ? localStorage.getItem('nmd-access-token') : null;
      const res = await fetch(`${base}/orders/${encodeURIComponent(orderDeleteTarget.id)}/hard-delete`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(errText || String(res.status));
      }
      queryClient.invalidateQueries({ queryKey: ['market-orders', id] });
      setOrderDeleteTarget(null);
      addToast('تم حذف الطلب نهائياً', 'success');
    } catch {
      addToast('فشل حذف الطلب', 'error');
    } finally {
      setOrderHardDeleting(false);
    }
  };

  const addMutation = useMutation({
    mutationFn: async (tenantIds: string[]) => {
      for (const tid of tenantIds) {
        const result = await api.updateTenant(tid, {
          marketId: id!,
          isListedInMarket: true,
        });
        if (result === null) throw new Error('فشل التحديث');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      addToast('تم التحديث', 'success');
      setAddModalOpen(false);
      setSelectedTenantIds(new Set());
    },
    onError: (err: Error) => {
      addToast(err?.message ?? 'فشل التحديث', 'error');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ tenantId, updates }: { tenantId: string; updates: Partial<RegistryTenant & { adminEmail?: string }> }) => {
      if (updates.adminEmail !== undefined) {
        if (!updates.adminEmail || String(updates.adminEmail).trim() === '') {
          const err = new Error('البريد الإداري لا يمكن أن يكون فارغاً');
          addToast(err.message, 'error');
          throw err;
        }
      }
      const result = await api.updateTenant(tenantId, updates);
      if (result === null) throw new Error('فشل التحديث (تحقق من الاتصال أو صلاحيات الخادم)');
      return result as unknown as Record<string, unknown> & { updatedAdmin?: { tenantId: string; email: string } };
    },
    onSuccess: async (data, variables) => {
      const newEmail = variables.updates?.adminEmail;
      const updatedAdmin = data?.updatedAdmin as { tenantId: string; email: string } | undefined;
      if ((newEmail !== undefined || updatedAdmin) && variables.tenantId) {
        const emailToSet = updatedAdmin?.email ?? newEmail;
        queryClient.setQueryData(
          ['tenant-admins', id],
          (old: Array<{ id: string; email: string; role: string; tenantId?: string }> | undefined) => {
            if (!old) return old;
            return old.map((a) =>
              a.tenantId === variables.tenantId ? { ...a, email: emailToSet ?? a.email } : a
            );
          }
        );
      }
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      queryClient.invalidateQueries({ queryKey: ['tenant-admins', id] });
      await queryClient.refetchQueries({ queryKey: ['tenant-admins', id] });
      const expectedEmail = (data?.updatedAdmin as { email?: string } | undefined)?.email ?? variables.updates?.adminEmail;
      if (expectedEmail !== undefined && variables.tenantId) {
        const list = queryClient.getQueryData<Array<{ tenantId?: string; email: string }>>(['tenant-admins', id]);
        const after = list?.find((a) => a.tenantId === variables.tenantId);
        if (after && after.email !== expectedEmail) {
          addToast('لم يتم حفظ البريد الإداري — تحقق من صلاحيات الملف على الخادم أو سجّل الدخول مرة أخرى.', 'error');
          return;
        }
      }
      addToast(
        variables.updates?.adminEmail !== undefined ? 'تم تحديث إيميل التاجر بنجاح' : 'تم التحديث',
        'success'
      );
    },
    onError: (err: Error) => {
      addToast(err?.message ?? 'فشل التحديث. تحقق من الاستجابة من الخادم (غير 200).', 'error');
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      if (!newPassword || newPassword.length < 6) {
        throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      }
      const res = await api.resetUserPassword(userId, newPassword);
      if (!res?.ok) throw new Error('لم يقبل الخادم تحديث كلمة المرور');
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-admins', id] });
      addToast('تم تغيير كلمة المرور بنجاح', 'success');
      setResetPasswordTarget(null);
    },
    onError: (err: Error) => addToast(err?.message ?? 'فشل تحديث كلمة المرور. تحقق من الاستجابة من الخادم.', 'error'),
  });

  const createAccountMutation = useMutation({
    mutationFn: async ({ tenantId, email, password }: { tenantId: string; email: string; password: string }) =>
      api.createTenantAdminForTenant(tenantId, { email, password }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-admins', id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      addToast('تم إنشاء الحساب بنجاح', 'success');
      setCreateAccountTarget(null);
    },
    onError: (err: Error) => addToast(err?.message ?? 'تفاصيل تفاصيل?? تفاصيلتفاصيل', 'error'),
  });

  if (!id) return null;
  if (MOCK_API_URL && me?.role === 'MARKET_ADMIN' && me.marketId && id !== me.marketId) {
    navigate(`/markets/${me.marketId}`, { replace: true });
    return null;
  }
  if (!MOCK_API_URL) {
    return (
      <div className="py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate('/markets')} className="mb-4">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
          يرجى ضبط متغير البيئة VITE_MOCK_API_URL (مثال: http://localhost:5190)
        </div>
      </div>
    );
  }
  if (marketLoading || (!market && !marketError)) {
    return <div className="text-gray-500 py-8">جاري التحميل...</div>;
  }
  if (marketError || !market) {
    if (MOCK_API_URL && me?.role === 'MARKET_ADMIN' && me.marketId) {
      navigate(`/markets/${me.marketId}`, { replace: true });
      return null;
    }
    return (
      <div className="py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate('/markets')} className="mb-4">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="text-red-600">السوق غير موجود</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate('/markets')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{market.name}</h1>
          <p className="text-sm text-gray-500">/{market.slug}</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-w-0">
        <NavLink
          to={`/markets/${id}`}
          end
          className={({ isActive }) =>
            `shrink-0 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              isActive ? 'bg-white border border-b-0 border-gray-200 text-gray-900 -mb-px' : 'text-gray-500 hover:text-gray-700'
            }`
          }
        >
          الإعدادات
        </NavLink>
        <NavLink
          to={`/markets/${id}/tenants`}
          className={({ isActive }) =>
            `shrink-0 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              isActive ? 'bg-white border border-b-0 border-gray-200 text-gray-900 -mb-px' : 'text-gray-500 hover:text-gray-700'
            }`
          }
        >
          المحلات ({marketTenants.length})
        </NavLink>
        <NavLink
          to={`/markets/${id}/orders`}
          className={({ isActive }) =>
            `shrink-0 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              isActive ? 'bg-white border border-b-0 border-gray-200 text-gray-900 -mb-px' : 'text-gray-500 hover:text-gray-700'
            }`
          }
        >
          الطلبات ({marketOrders.length})
        </NavLink>
        {me?.role !== 'TENANT_ADMIN' && (
          <>
            <NavLink
              to={`/markets/${id}/dispatch`}
              className={({ isActive }) =>
                `shrink-0 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  isActive ? 'bg-white border border-b-0 border-gray-200 text-gray-900 -mb-px' : 'text-gray-500 hover:text-gray-700'
                }`
              }
            >
              التوصيل
            </NavLink>
            <NavLink
              to={`/markets/${id}/finance`}
              className={({ isActive }) =>
                `shrink-0 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  isActive ? 'bg-white border border-b-0 border-gray-200 text-gray-900 -mb-px' : 'text-gray-500 hover:text-gray-700'
                }`
              }
            >
              المالية
            </NavLink>
            {(isRootAdmin || isSuperAdmin) && (
              <NavLink
                to={`/markets/${id}/platform-fee`}
                className={({ isActive }) =>
                  `shrink-0 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    isActive ? 'bg-white border border-b-0 border-gray-200 text-gray-900 -mb-px' : 'text-gray-500 hover:text-gray-700'
                  }`
                }
              >
                رسوم المنصة
              </NavLink>
            )}
            <NavLink
              to={`/markets/${id}/reports`}
              className={({ isActive }) =>
                `shrink-0 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  isActive ? 'bg-white border border-b-0 border-gray-200 text-gray-900 -mb-px' : 'text-gray-500 hover:text-gray-700'
                }`
              }
            >
              التقارير
            </NavLink>
          </>
        )}
        <NavLink
          to={`/markets/${id}/banners`}
          className={({ isActive }) =>
            `shrink-0 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              isActive ? 'bg-white border border-b-0 border-gray-200 text-gray-900 -mb-px' : 'text-gray-500 hover:text-gray-700'
            }`
          }
        >
          بانرات السوق
        </NavLink>
        <NavLink
          to={`/markets/${id}/layout`}
          className={({ isActive }) =>
            `shrink-0 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              isActive ? 'bg-white border border-b-0 border-gray-200 text-gray-900 -mb-px' : 'text-gray-500 hover:text-gray-700'
            }`
          }
        >
          تخطيط السوق
        </NavLink>
      </div>

      {activeTab === 'details' && (
          <MarketDetailsTab market={market} />
      )}

      {activeTab === 'tenants' && (
          <Card>
            <div className="p-4 flex justify-between items-center border-b border-gray-100">
              <span className="text-sm text-gray-700">المحلات في هذا السوق</span>
              {canManageTenants && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setCreateModalOpen(true)} disabled={!MOCK_API_URL}>
                    إنشاء محل جديد
                  </Button>
                  {isRootAdmin && (
                    <Button size="sm" variant="outline" onClick={() => setAddModalOpen(true)} disabled={!MOCK_API_URL}>
                      إضافة محلات من منصة
                    </Button>
                  )}
                </div>
              )}
            </div>
            {tenantsLoading ? (
              <div className="p-12 text-center text-gray-500">جاري التحميل...</div>
            ) : marketTenants.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                لا توجد محلات بعد. استخدم &quot;إنشاء محل جديد&quot; أو &quot;إضافة محلات&quot; لإضافة محلات لهذا السوق.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-start font-medium text-gray-700">المحل</th>
                      <th className="px-4 py-3 text-start font-medium text-gray-700">البريد الإداري</th>
                      {isRootAdmin && <th className="px-4 py-3 text-start font-medium text-gray-700">السوق التابع له</th>}
                      <th className="px-4 py-3 text-start font-medium text-gray-700">التصنيف</th>
                      <th className="px-4 py-3 text-start font-medium text-gray-700">ظاهر في السوق</th>
                      <th className="px-4 py-3 text-start font-medium text-gray-700">الترتيب</th>
                      <th className="px-4 py-3 text-start font-medium text-gray-700" title="عرض حقول وحدة البيع وقفزة الكمية في نموذج المنتجات">دعم البيع بالأوزان والكسور</th>
                      <th className="px-4 py-3 text-start font-medium text-gray-700" title="تحكم الإدارة: فتح/إغلاق المتجر عن بعد">تحكم عن بعد</th>
                      <th className="px-4 py-3 text-start font-medium text-gray-700">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {marketTenants.map((t) => (
                      <MarketTenantRow
                        key={t.id}
                        tenant={t}
                        marketId={id!}
                        markets={markets}
                        isRootAdmin={!!isRootAdmin}
                        tenantAdmin={tenantAdminMap.get(t.id)}
                        categoryOptions={categoryOptions}
                        onSave={(updates) => updateMutation.mutate({ tenantId: t.id, updates })}
                        isSaving={updateMutation.isPending && updateMutation.variables?.tenantId === t.id}
                        canManageAccounts={canManageTenants}
                        onResetPassword={() => {
                          const admin = tenantAdminMap.get(t.id);
                          if (admin) setResetPasswordTarget({ tenantId: t.id, tenantName: t.name, admin });
                        }}
                        onCreateAccount={() => setCreateAccountTarget({ tenantId: t.id, tenantName: t.name })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
      )}

      {activeTab === 'orders' && (
          <>
          <Card>
            <div className="p-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-gray-600">طلبات العملاء الحقيقية فقط</span>
              <Link to="/delivery-leads" className="text-sm text-primary hover:underline">
                عرض طلبات واتساب / اتصال
              </Link>
            </div>
            <OrderListFilters
              sourceFilter={orderSourceFilter}
              statusFilter={orderStatusFilter}
              onSourceChange={setOrderSourceFilter}
              onStatusChange={setOrderStatusFilter}
              className="px-4 pt-4"
            />
            {ordersLoading ? (
              <div className="p-12 text-center text-gray-500">جاري التحميل...</div>
            ) : filteredMarketOrders.length === 0 ? (
              <div className="p-12 text-center text-gray-500">لا توجد طلبات تطابق التصفية</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-start font-medium text-gray-700">المعرّف</th>
                      <th className="px-4 py-3 text-start font-medium text-gray-700">المصدر</th>
                      <th className="px-4 py-3 text-start font-medium text-gray-700">المحل</th>
                      <th className="px-4 py-3 text-start font-medium text-gray-700">المبلغ</th>
                      <th className="px-4 py-3 text-start font-medium text-gray-700">الحالة</th>
                      <th className="px-4 py-3 text-start font-medium text-gray-700">التاريخ</th>
                      <th className="px-4 py-3 text-start font-medium text-gray-700 w-24">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMarketOrders.map((o) => {
                      const storeName = marketTenants.find((t) => t.id === o.tenantId)?.name ?? o.tenantId;
                      return (
                        <tr key={o.id ?? o.tenantId} className="border-t border-gray-100">
                          <td className="px-4 py-3 font-mono text-xs">{o.id?.slice(0, 8) ?? '-'}</td>
                          <td className="px-4 py-3">
                            <OrderSourceBadge isExternal={o.isExternal} />
                          </td>
                          <td className="px-4 py-3">
                            {storeName}
                          </td>
                          <td className="px-4 py-3">{`${o.total ?? 0} ر.س`}</td>
                          <td className="px-4 py-3">
                            <span>{formatOrderStatusLabel(o.status)}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">{o.createdAt ? formatDateGregorian(o.createdAt) : '-'}</td>
                          <td className="px-4 py-3">
                            {o.id && (
                              <div className="flex items-center gap-1">
                                {canPlatformOrderOps && (
                                  <button
                                    type="button"
                                    className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
                                    onClick={() => setOrderOpsId(o.id!)}
                                    aria-label="تشغيل الطلب"
                                    title="تشغيل الطلب"
                                  >
                                    <Settings2 className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                                  onClick={() => setOrderDetailsId(o.id!)}
                                  aria-label="التفاصيل"
                                  title="التفاصيل"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                                  onClick={() => setOrderDeleteTarget(o)}
                                  aria-label="حذف الطلب نهائياً"
                                  title="حذف نهائياً"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                          </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <ConfirmDialog
            open={!!orderDeleteTarget}
            onClose={() => setOrderDeleteTarget(null)}
            onConfirm={handleHardDeleteOrder}
            title="حذف الطلب نهائياً"
            message={orderDeleteTarget ? 'هل أنت متأكد من حذف هذا الطلب؟' : ''}
            confirmLabel="حذف نهائياً"
            variant="danger"
            loading={orderHardDeleting}
            closeOnConfirm={false}
          />
          <OrderDetailsDrawer
            orderId={orderDetailsId}
            onClose={() => setOrderDetailsId(null)}
            marketTenants={marketTenants}
            userRole={me?.role}
            marketId={id}
          />
          <OrderPlatformOpsDrawer
            orderId={orderOpsId}
            onClose={() => setOrderOpsId(null)}
            userRole={me?.role}
            storeName={orderOpsId ? marketTenants.find((t) => marketOrders.find((o) => o.id === orderOpsId)?.tenantId === t.id)?.name : undefined}
            invalidateKeys={id ? [['market-orders', id]] : []}
          />
          </>
      )}

      {activeTab === 'banners' && market?.slug && (
        <MarketBannersTab
          marketSlug={market.slug}
          marketId={id!}
          tenants={marketTenants.map((t) => ({ id: t.id, slug: t.slug, name: t.name }))}
        />
      )}

      {activeTab === 'layout' && market?.slug && (
        <MarketLayoutTab
          marketSlug={market.slug}
          marketId={id!}
          tenants={marketTenants.map((t) => ({ id: t.id, slug: t.slug, name: t.name }))}
        />
      )}

      <Modal
        open={addModalOpen}
        onClose={() => {
          setAddModalOpen(false);
          setSelectedTenantIds(new Set());
        }}
        title="إضافة محلات إلى السوق"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">اختر المحلات التي تريد إضافتها إلى هذا السوق:</p>
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
            {tenantsNotInMarket.length === 0 ? (
              <div className="p-6 text-center text-gray-500">لا توجد محلات خارج السوق أو تم إضافتها كلها</div>
            ) : (
              tenantsNotInMarket.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedTenantIds.has(t.id)}
                    onChange={(e) => {
                      setSelectedTenantIds((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(t.id);
                        else next.delete(t.id);
                        return next;
                      });
                    }}
                  />
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
                    style={{ backgroundColor: t.primaryColor }}
                  >
                    {t.name.charAt(0)}
                  </div>
                  <span className="font-medium">{t.name}</span>
                  {t.marketId && (
                    <span className="text-xs text-gray-500">(في سوق آخر)</span>
                  )}
                </label>
              ))
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setAddModalOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={() => {
                if (selectedTenantIds.size > 0) {
                  addMutation.mutate(Array.from(selectedTenantIds));
                }
              }}
              disabled={selectedTenantIds.size === 0 || addMutation.isPending}
            >
              {addMutation.isPending ? 'جاري...' : `إضافة (${selectedTenantIds.size})`}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          setCreateForm({ name: '', slug: '', type: 'GENERAL', primaryColor: '#0f766e', enabled: true, adminEmail: '', adminPassword: '' });
        }}
        title="إنشاء محل جديد"
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="الاسم"
            value={createForm.name}
            onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="اسم المحل"
          />
          <Input
            label="Slug"
            value={createForm.slug}
            onChange={(e) => setCreateForm((f) => ({ ...f, slug: e.target.value }))}
            placeholder="store-slug"
          />
          <Select
            label="نوع المحل"
            options={[
              { value: 'GENERAL', label: 'عام' },
              { value: 'FOOD', label: 'طعام' },
              { value: 'CLOTHING', label: 'ملابس' },
            ]}
            value={createForm.type}
            onChange={(e) => setCreateForm((f) => ({ ...f, type: e.target.value as 'CLOTHING' | 'FOOD' | 'GENERAL' }))}
          />
          <Input
            label="اللون الأساسي"
            type="color"
            value={createForm.primaryColor}
            onChange={(e) => setCreateForm((f) => ({ ...f, primaryColor: e.target.value }))}
          />
          <Input
            label="البريد الإداري (اختياري)"
            type="email"
            value={createForm.adminEmail}
            onChange={(e) => setCreateForm((f) => ({ ...f, adminEmail: e.target.value }))}
            placeholder="admin@store.com"
          />
          <Input
            label="كلمة المرور"
            type="password"
            value={createForm.adminPassword}
            onChange={(e) => setCreateForm((f) => ({ ...f, adminPassword: e.target.value }))}
            placeholder="6+ أحرف"
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={createForm.enabled}
              onChange={(e) => setCreateForm((f) => ({ ...f, enabled: e.target.checked }))}
            />
            تفاصيل??
          </label>
          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={() => {
                if (createForm.name.trim()) {
                  createMutation.mutate(createForm);
                }
              }}
              disabled={!createForm.name.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? 'جاري...' : 'إنشاء'}
            </Button>
          </div>
        </div>
      </Modal>

      <ResetPasswordModal
        target={resetPasswordTarget}
        onClose={() => setResetPasswordTarget(null)}
        onSubmit={(newPassword) => {
          if (resetPasswordTarget) {
            resetPasswordMutation.mutate({ userId: resetPasswordTarget.admin.id, newPassword });
          }
        }}
        isPending={resetPasswordMutation.isPending}
      />

      <CreateAccountModal
        target={createAccountTarget}
        onClose={() => setCreateAccountTarget(null)}
        onSubmit={(email, password) => {
          if (createAccountTarget) {
            createAccountMutation.mutate({ tenantId: createAccountTarget.tenantId, email, password });
          }
        }}
        isPending={createAccountMutation.isPending}
      />
    </div>
  );
}

function ResetPasswordModal({
  target,
  onClose,
  onSubmit,
  isPending,
}: {
  target: { tenantId: string; tenantName: string; admin: { id: string; email: string } } | null;
  onClose: () => void;
  onSubmit: (newPassword: string) => void;
  isPending: boolean;
}) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (target) {
      setNewPassword('');
      setConfirmPassword('');
      setError('');
    }
  }, [target]);
  const handleSubmit = () => {
    setError('');
    if (!newPassword || newPassword.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('كلمة المرور والتأكيد غير متطابقتين');
      return;
    }
    onSubmit(newPassword);
  };
  if (!target) return null;
  return (
    <Modal open={!!target} onClose={onClose} title="تغيير كلمة المرور" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          الحساب: <span className="font-medium text-gray-900">{target.admin.email}</span>
        </p>
        <p className="text-sm text-gray-500">الحساب: {target.tenantName}</p>
        <Input
          label="كلمة المرور الجديدة"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="6+ أحرف"
        />
        <Input
          label="تأكيد كلمة المرور الجديدة"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="أعد إدخال كلمة المرور الجديدة"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'جاري...' : 'حفظ'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CreateAccountModal({
  target,
  onClose,
  onSubmit,
  isPending,
}: {
  target: { tenantId: string; tenantName: string } | null;
  onClose: () => void;
  onSubmit: (email: string, password: string) => void;
  isPending: boolean;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (target) {
      setEmail('');
      setPassword('');
      setError('');
    }
  }, [target]);
  const handleSubmit = () => {
    setError('');
    if (!email.trim()) {
      setError('البريد الإداري مطلوب');
      return;
    }
    if (!password || password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    onSubmit(email.trim(), password);
  };
  if (!target) return null;
  return (
    <Modal open={!!target} onClose={onClose} title="إنشاء حساب مدير" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">الحساب: {target.tenantName}</p>
        <Input
          label="البريد الإداري"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@store.com"
        />
        <Input
          label="كلمة المرور"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="6+ أحرف"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'جاري...' : 'حفظ'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

interface OrderDetailsDrawerProps {
  orderId: string | null;
  onClose: () => void;
  marketTenants: (RegistryTenant & { marketId?: string })[];
  userRole?: string;
  marketId?: string;
}

function OrderDetailsDrawer({ orderId, onClose, marketTenants, userRole, marketId }: OrderDetailsDrawerProps) {
  const { data: order, isLoading, isError } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => api.getOrder(orderId!),
    enabled: !!orderId && !!MOCK_API_URL,
  });

  const storeName = order?.tenantId
    ? marketTenants.find((t) => t.id === order.tenantId)?.name ?? order.tenantId
    : '—';
  const deliveryFee = order?.delivery?.fee ?? (order ? Math.max(0, (order.total ?? 0) - (order.subtotal ?? 0)) : 0);
  const currency = order?.currency ?? 'ر.س';

  return (
    <Drawer open={!!orderId} onClose={onClose} title="تفاصيل الطلب" contentClassName="md:max-w-lg">
      {!orderId ? null : isLoading ? (
        <div className="py-8 text-center text-gray-500">جاري التحميل...</div>
      ) : isError || !order ? (
        <div className="py-8 text-center text-red-600">تعذر تحميل الطلب</div>
      ) : (
        <div className="space-y-6">
          {/* Order Summary */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">ملخص الطلب</h3>
            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">المعرّف</span>
                <span className="font-mono">{order.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">الحالة</span>
                <span>{formatOrderStatusLabel(order.status)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">التاريخ</span>
                <span>{order.createdAt ? formatDateGregorian(order.createdAt) : '—'}</span>
              </div>
            </div>
          </section>

          {/* Customer Info */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">العميل</h3>
            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">الاسم</span>
                <span>{order.customerName ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">الهاتف</span>
                <span dir="ltr">{order.customerPhone ?? '—'}</span>
              </div>
            </div>
          </section>

          {/* Order Items */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">المشتريات</h3>
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-start font-medium text-gray-700">المنتج</th>
                    <th className="px-3 py-2 text-end font-medium text-gray-700">الكمية</th>
                    <th className="px-3 py-2 text-end font-medium text-gray-700">السعر</th>
                    <th className="px-3 py-2 text-end font-medium text-gray-700">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.items ?? []).map(
                    (
                      item: {
                        id?: string;
                        productName?: string;
                        quantity?: number;
                        basePrice?: number;
                        totalPrice?: number;
                        selectedOptions?: {
                          optionGroupId?: string;
                          optionItemIds?: string[];
                          optionPlacements?: Record<string, string>;
                        }[];
                        optionGroups?: { id?: string; items?: { id?: string; name?: string }[] }[];
                      }
                    ) => (
                      <tr key={item.id ?? item.productName} className="border-t border-gray-100">
                        <td className="px-3 py-2 align-top">
                          <div className="font-medium">{item.productName ?? '—'}</div>
                          {(item.selectedOptions?.length ?? 0) > 0 && (
                            <ul className="mt-1.5 space-y-1 text-xs text-gray-600">
                              {(item.selectedOptions ?? []).map((s, gIdx) => {
                                const g = item.optionGroups?.find((x) => x.id === s.optionGroupId);
                                const ids = s.optionItemIds ?? [];
                                const placements = s.optionPlacements ?? {};
                                return (
                                  <li key={`${s.optionGroupId ?? gIdx}`} className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 justify-end text-end">
                                    {ids.map((id, idx) => {
                                      const name = g?.items?.find((opt) => opt.id === id)?.name ?? id;
                                      const placement = (placements[id] ?? 'WHOLE') as 'WHOLE' | 'LEFT' | 'RIGHT';
                                      return (
                                        <span key={id} className="inline-flex items-center gap-1">
                                          {idx > 0 && <span className="text-gray-400">/</span>}
                                          <span>{formatAddonNameWithPlacement(name, placement)}</span>
                                          <PizzaSideIndicator placement={placement} />
                                        </span>
                                      );
                                    })}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </td>
                        <td className="px-3 py-2 text-end align-top">{item.quantity ?? 0}</td>
                        <td className="px-3 py-2 text-end align-top">
                          {item.basePrice ?? 0} {currency}
                        </td>
                        <td className="px-3 py-2 text-end font-medium align-top">
                          {item.totalPrice ?? 0} {currency}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
              {(order.items ?? []).length === 0 && (
                <div className="px-3 py-4 text-center text-gray-500">لا توجد أصناف</div>
              )}
            </div>
          </section>

          {/* Totals */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">المبالغ</h3>
            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">المجموع الفرعي</span>
                <span>{order.subtotal ?? 0} {currency}</span>
              </div>
              {deliveryFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600">رسوم التوصيل</span>
                  <span>{deliveryFee} {currency}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold pt-1.5 border-t border-gray-200">
                <span>الإجمالي</span>
                <span>{order.total ?? 0} {currency}</span>
              </div>
            </div>
          </section>

          {/* Store Info */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">المحل</h3>
            <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 text-sm">
              <span>{storeName}</span>
            </div>
          </section>

          {canUsePlatformOrderOps(userRole) && order.id && order.tenantId && (
            <PlatformOrderOpsPanel
              order={order}
              userRole={userRole}
              invalidateKeys={[
                ...(marketId ? [['market-orders', marketId] as string[]] : []),
                ['order', orderId!],
              ]}
            />
          )}
        </div>
      )}
    </Drawer>
  );
}

function MarketDetailsTab({ market }: { market: Market }) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: market.name,
    slug: market.slug,
    imageUrl: market.imageUrl ?? '',
    primaryColor: (market.branding as { primaryColor?: string })?.primaryColor ?? '#D97706',
    isActive: market.isActive,
  });
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      name: market.name,
      slug: market.slug,
      imageUrl: market.imageUrl ?? '',
      primaryColor: (market.branding as { primaryColor?: string })?.primaryColor ?? '#D97706',
      isActive: market.isActive,
    });
  }, [market]);

  const saveMarket = async () => {
    if (!MOCK_API_URL) {
      addToast('VITE_MOCK_API_URL غير معرّف — لا يمكن الحفظ', 'error');
      console.error('[MarketDetailsTab] Save skipped: MOCK_API_URL is empty');
      return;
    }
    let imageUrl = form.imageUrl?.trim() || undefined;
    if (pendingFile) {
      try {
        const { urls } = await apiUpload([pendingFile]);
        if (urls[0]) imageUrl = urls[0];
        setPendingFile(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'فشل رفع الصورة';
        console.error('[MarketDetailsTab] Upload failed:', msg);
        addToast(msg, 'error');
        return;
      }
    }
    setSaving(true);
    try {
      await apiFetch(`/markets/${market.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          imageUrl,
          branding: { primaryColor: form.primaryColor },
          isActive: Boolean(form.isActive),
        }),
      });
      queryClient.invalidateQueries({ queryKey: ['market', market.id] });
      queryClient.invalidateQueries({ queryKey: ['markets'] });
      addToast('تم حفظ السوق', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'فشل الحفظ';
      console.error('[MarketDetailsTab] Save failed:', msg, { marketId: market.id, endpoint: `/markets/${market.id}` });
      addToast(`فشل حفظ إعدادات السوق: ${msg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6 max-w-md">
      <h2 className="text-lg font-semibold mb-4">إعدادات السوق</h2>
      <div className="grid gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">صورة السوق (رفع صورة السوق)</label>
          <div className="flex gap-2 items-start">
            <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 shrink-0">
              {form.imageUrl ? (
                <img src={form.imageUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              ) : pendingFile ? (
                <span className="w-full h-full flex items-center justify-center text-xs text-gray-500">رفع</span>
              ) : (
                <span className="w-full h-full flex items-center justify-center text-xs text-gray-500">?</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 mb-1">
                <Upload className="w-4 h-4" /> رفع صورة
              </Button>
              <input
                type="url"
                value={form.imageUrl}
                onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                placeholder="أو رابط الصورة"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">اسم السوق</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
          <input
            type="text"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">اللون الأساسي</label>
          <input
            type="color"
            value={form.primaryColor}
            onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
            className="w-12 h-10 rounded border border-gray-200 cursor-pointer"
          />
          <span className="ms-2 text-sm text-gray-500">{form.primaryColor}</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isActive"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
          <label htmlFor="isActive" className="text-sm font-medium text-gray-700">نشط</label>
        </div>
        <Button onClick={saveMarket} disabled={!MOCK_API_URL || saving}>{saving ? 'جاري...' : 'حفظ'}</Button>
      </div>
    </Card>
  );
}

interface MarketTenantRowProps {
  tenant: RegistryTenant & { marketId?: string };
  marketId: string;
  markets?: { id: string; name: string; slug?: string }[];
  isRootAdmin?: boolean;
  tenantAdmin?: { id: string; email: string; role: string; tenantId?: string } | null;
  categoryOptions: CategoryOption[];
  onSave: (updates: Partial<RegistryTenant & { marketId?: string; adminEmail?: string; supportsWeightSelling?: boolean }>) => void;
  isSaving: boolean;
  canManageAccounts?: boolean;
  onResetPassword?: () => void;
  onCreateAccount?: () => void;
}

function MarketTenantRow({ tenant, marketId, markets = [], isRootAdmin: isRoot, tenantAdmin, categoryOptions, onSave, isSaving, canManageAccounts, onResetPassword, onCreateAccount }: MarketTenantRowProps) {
  const resolvedCategoryId = resolveCategoryId(tenant.marketCategory, categoryOptions);
  const [marketCategoryId, setMarketCategoryId] = useState(resolvedCategoryId);
  const [isListedInMarket, setIsListedInMarket] = useState(tenant.isListedInMarket !== false);
  const [marketSortOrder, setMarketSortOrder] = useState(String(tenant.marketSortOrder ?? 0));
  const [parentMarketId, setParentMarketId] = useState(tenant.marketId ?? '');
  const [adminEmailEdit, setAdminEmailEdit] = useState(tenantAdmin?.email ?? '');
  const [supportsWeightSelling, setSupportsWeightSelling] = useState((tenant as { supportsWeightSelling?: boolean }).supportsWeightSelling ?? false);
  const [overrideStatus, setOverrideStatus] = useState<'AUTO' | 'FORCE_OPEN' | 'FORCE_CLOSED'>((tenant as { overrideStatus?: string }).overrideStatus as 'AUTO' | 'FORCE_OPEN' | 'FORCE_CLOSED' ?? 'AUTO');

  useEffect(() => {
    setMarketCategoryId(resolveCategoryId(tenant.marketCategory, categoryOptions));
    setIsListedInMarket(tenant.isListedInMarket !== false);
    setMarketSortOrder(String(tenant.marketSortOrder ?? 0));
    setParentMarketId(tenant.marketId ?? '');
    setAdminEmailEdit(tenantAdmin?.email ?? '');
    setSupportsWeightSelling((tenant as { supportsWeightSelling?: boolean }).supportsWeightSelling ?? false);
    setOverrideStatus((tenant as { overrideStatus?: string }).overrideStatus as 'AUTO' | 'FORCE_OPEN' | 'FORCE_CLOSED' ?? 'AUTO');
  }, [tenant.marketCategory, tenant.isListedInMarket, tenant.marketSortOrder, tenant.marketId, (tenant as { supportsWeightSelling?: boolean }).supportsWeightSelling, (tenant as { overrideStatus?: string }).overrideStatus, categoryOptions, tenantAdmin?.email]);

  const handleSave = () => {
    const order = parseInt(marketSortOrder, 10);
    const updates: Partial<RegistryTenant & { marketId?: string; adminEmail?: string; supportsWeightSelling?: boolean }> = {
      marketCategory: marketCategoryId as RegistryTenant['marketCategory'],
      isListedInMarket,
      marketSortOrder: isNaN(order) ? 0 : order,
    };
    if (isRoot && parentMarketId !== (tenant.marketId ?? '')) {
      updates.marketId = parentMarketId || undefined;
    }
    const emailTrimmed = adminEmailEdit.trim();
    if (canManageAccounts && emailTrimmed && emailTrimmed !== (tenantAdmin?.email ?? '')) {
      updates.adminEmail = emailTrimmed;
    }
    updates.supportsWeightSelling = supportsWeightSelling;
    (updates as Record<string, unknown>).overrideStatus = overrideStatus === 'AUTO' ? undefined : overrideStatus;
    onSave(updates);
  };

  const emailChanged = canManageAccounts && adminEmailEdit.trim() !== (tenantAdmin?.email ?? '');
  const tenantWeightSupport = (tenant as { supportsWeightSelling?: boolean }).supportsWeightSelling ?? false;
  const tenantOverride = (tenant as { overrideStatus?: string }).overrideStatus ?? 'AUTO';
  const hasChanges =
    resolvedCategoryId !== marketCategoryId ||
    (tenant.isListedInMarket !== false) !== isListedInMarket ||
    String(tenant.marketSortOrder ?? 0) !== marketSortOrder ||
    (isRoot && (tenant.marketId ?? '') !== parentMarketId) ||
    emailChanged ||
    tenantWeightSupport !== supportsWeightSelling ||
    tenantOverride !== overrideStatus;

  return (
    <tr className="border-t border-gray-100">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold shrink-0"
            style={{ backgroundColor: tenant.primaryColor }}
          >
            {tenant.name.charAt(0)}
          </div>
          <span className="font-medium">{tenant.name}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        {canManageAccounts ? (
          <input
            type="email"
            value={adminEmailEdit}
            onChange={(e) => setAdminEmailEdit(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="البريد الإداري"
            title="تعديل البريد الإداري"
            className="w-full min-w-[160px] max-w-[220px] h-9 px-2 rounded border border-gray-300 text-sm text-gray-700"
            dir="ltr"
          />
        ) : tenantAdmin ? (
          <span className="text-gray-700">{tenantAdmin.email}</span>
        ) : (
          <span className="text-gray-400">?</span>
        )}
      </td>
      {isRoot && (
        <td className="px-4 py-3">
          <select
            value={parentMarketId}
            onChange={(e) => setParentMarketId(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="h-9 px-2 rounded border border-gray-300 bg-white text-sm min-w-[140px]"
          >
            <option value="">?</option>
            {markets.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </td>
      )}
      <td className="px-4 py-3">
        <select
          value={marketCategoryId}
          onChange={(e) => setMarketCategoryId(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="h-9 px-2 rounded border border-gray-300 bg-white text-sm min-w-[120px]"
        >
          {categoryOptions.length === 0 ? (
            <option value={marketCategoryId}>?</option>
          ) : (
            categoryOptions.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.title}
              </option>
            ))
          )}
        </select>
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsListedInMarket((v) => !v);
          }}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            isListedInMarket ? 'bg-primary' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              isListedInMarket ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </td>
      <td className="px-4 py-3">
        <input
          type="number"
          value={marketSortOrder}
          onChange={(e) => setMarketSortOrder(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="w-20 h-9 px-2 rounded border border-gray-300 text-sm"
        />
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          title="دعم البيع بالأوزان والكسور"
          onClick={(e) => {
            e.stopPropagation();
            setSupportsWeightSelling((v) => !v);
          }}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            supportsWeightSelling ? 'bg-primary' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
              supportsWeightSelling ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </td>
      <td className="px-4 py-3">
        <select
          value={overrideStatus}
          onChange={(e) => { e.stopPropagation(); setOverrideStatus(e.target.value as 'AUTO' | 'FORCE_OPEN' | 'FORCE_CLOSED'); }}
          onClick={(e) => e.stopPropagation()}
          className={`w-28 h-9 px-2 rounded border text-xs font-medium ${
            overrideStatus === 'FORCE_CLOSED' ? 'border-red-300 bg-red-50 text-red-700' :
            overrideStatus === 'FORCE_OPEN' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' :
            'border-gray-300 bg-white text-gray-700'
          }`}
        >
          <option value="AUTO">تلقائي</option>
          <option value="FORCE_OPEN">فتح إجباري</option>
          <option value="FORCE_CLOSED">إغلاق إجباري</option>
        </select>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to={`/markets/${marketId}/tenants/${tenant.id}`}
            className="text-sm text-primary hover:underline"
          >
            تفاصيل
          </Link>
          {canManageAccounts && tenantAdmin && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onResetPassword?.();
              }}
              className="inline-flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700 hover:underline"
              title="تغيير كلمة المرور"
            >
              <KeyRound className="w-4 h-4" />
            </button>
          )}
          {canManageAccounts && !tenantAdmin && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onCreateAccount?.();
              }}
              className="text-sm text-primary hover:underline"
            >
              إنشاء حساب مدير
            </button>
          )}
          <Button size="sm" onClick={handleSave} disabled={!hasChanges || isSaving}>
            {isSaving ? '...' : 'حفظ'}
          </Button>
        </div>
      </td>
    </tr>
  );
}
