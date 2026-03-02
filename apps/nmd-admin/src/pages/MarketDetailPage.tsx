import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useLocation, NavLink, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Modal, useToast, Input, Select } from '@nmd/ui';
import { MockApiClient, type RegistryTenant } from '@nmd/mock';
import type { MarketCategory } from '@nmd/core';
import { ArrowLeft, KeyRound } from 'lucide-react';
import { apiHeaders } from '../api';
import MarketBannersTab from './MarketBannersTab';
import MarketLayoutTab from './MarketLayoutTab';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

interface Market {
  id: string;
  name: string;
  slug: string;
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
}

interface LeadRow {
  id: string;
  tenantId: string;
  type: string;
  status?: string;
  contactType?: string;
  timestamp: string;
}

const MARKET_CATEGORIES: { value: MarketCategory; label: string }[] = [
  { value: 'FOOD', label: 'طعام' },
  { value: 'CLOTHING', label: 'ملابس' },
  { value: 'GROCERIES', label: 'بقالة' },
  { value: 'BUTCHER', label: 'لحوم' },
  { value: 'OFFERS', label: 'عروض' },
  { value: 'ELECTRONICS', label: 'إلكترونيات' },
  { value: 'HOME', label: 'منزل' },
  { value: 'GENERAL', label: 'عام' },
];

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
    if (pathname.endsWith('/banners')) return 'banners';
    if (pathname.endsWith('/layout')) return 'layout';
    return 'details';
  }, [id, pathname]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTenantIds, setSelectedTenantIds] = useState<Set<string>>(new Set());
  const [resetPasswordTarget, setResetPasswordTarget] = useState<{ tenantId: string; tenantName: string; admin: { id: string; email: string } } | null>(null);
  const [createAccountTarget, setCreateAccountTarget] = useState<{ tenantId: string; tenantName: string } | null>(null);
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

  const { data: allTenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.listTenants(),
  });

  const marketTenants = (allTenants as (RegistryTenant & { marketId?: string })[]).filter(
    (t) => t.marketId === id
  );

  const tenantsNotInMarket = (allTenants as (RegistryTenant & { marketId?: string })[]).filter(
    (t) => !t.marketId || t.marketId !== id
  );

  const canManageTenants = isRootAdmin || me?.marketId === id;

  const { data: marketOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['market-orders', id],
    queryFn: () => api.getMarketOrders(id!) as Promise<OrderRow[]>,
    enabled: !!MOCK_API_URL && !!id,
  });

  const { data: allLeads = [] } = useQuery({
    queryKey: ['leads'],
    queryFn: () => api.listLeads(),
    enabled: !!MOCK_API_URL && !!id && canManageTenants,
  });

  const marketLeads = useMemo(() => {
    const tenantIds = new Set(marketTenants.map((t) => t.id));
    return (allLeads as LeadRow[]).filter(
      (l) => l.type === 'PROFESSIONAL_CONTACT' && tenantIds.has(l.tenantId)
    );
  }, [allLeads, marketTenants]);

  const ordersAndLeads = useMemo(() => {
    const orderRows: { id?: string; tenantId?: string; total?: number; status?: string; createdAt?: string; isLead?: boolean; contactType?: string }[] = marketOrders.map((o) => ({
      ...o,
      isLead: false,
    }));
    const leadRows = marketLeads.map((l) => ({
      id: l.id,
      tenantId: l.tenantId,
      total: undefined,
      status: 'PROFESSIONAL_CONTACT',
      createdAt: l.timestamp,
      isLead: true,
      contactType: l.contactType,
    }));
    return [...orderRows, ...leadRows].sort(
      (a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
    );
  }, [marketOrders, marketLeads]);

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
      addToast('تم إنشاء المستأجر', 'success');
      setCreateModalOpen(false);
      setCreateForm({ name: '', slug: '', type: 'GENERAL', primaryColor: '#0f766e', enabled: true, adminEmail: '', adminPassword: '' });
      navigate(`/markets/${id}/tenants/${created.id}`);
    },
    onError: (err: Error) => {
      addToast(err?.message ?? 'فشل الإنشاء', 'error');
    },
  });

  const addMutation = useMutation({
    mutationFn: async (tenantIds: string[]) => {
      for (const tid of tenantIds) {
        const result = await api.updateTenant(tid, {
          marketId: id!,
          isListedInMarket: true,
        });
        if (result === null) throw new Error('فشل الحفظ');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      addToast('تم الحفظ', 'success');
      setAddModalOpen(false);
      setSelectedTenantIds(new Set());
    },
    onError: (err: Error) => {
      addToast(err?.message ?? 'فشل الحفظ', 'error');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ tenantId, updates }: { tenantId: string; updates: Partial<RegistryTenant> }) => {
      const result = await api.updateTenant(tenantId, updates);
      if (result === null) throw new Error('فشل الحفظ');
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
      addToast('تم الحفظ', 'success');
    },
    onError: (err: Error) => {
      addToast(err?.message ?? 'فشل الحفظ', 'error');
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) =>
      api.resetUserPassword(userId, newPassword),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-admins', id] });
      addToast('تم تعيين كلمة المرور بنجاح', 'success');
      setResetPasswordTarget(null);
    },
    onError: (err: Error) => addToast(err?.message ?? 'فشل تعيين كلمة المرور', 'error'),
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
    onError: (err: Error) => addToast(err?.message ?? 'فشل إنشاء الحساب', 'error'),
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
          لتشغيل هذه الصفحة، ضبط VITE_MOCK_API_URL (مثال: http://localhost:5190)
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
          التفاصيل
        </NavLink>
        <NavLink
          to={`/markets/${id}/tenants`}
          className={({ isActive }) =>
            `shrink-0 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              isActive ? 'bg-white border border-b-0 border-gray-200 text-gray-900 -mb-px' : 'text-gray-500 hover:text-gray-700'
            }`
          }
        >
          المستأجرون ({marketTenants.length})
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
          إدارة الإعلانات
        </NavLink>
        <NavLink
          to={`/markets/${id}/layout`}
          className={({ isActive }) =>
            `shrink-0 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              isActive ? 'bg-white border border-b-0 border-gray-200 text-gray-900 -mb-px' : 'text-gray-500 hover:text-gray-700'
            }`
          }
        >
          ترتيب الصفحة
        </NavLink>
      </div>

      {activeTab === 'details' && (
          <MarketDetailsTab market={market} />
      )}

      {activeTab === 'tenants' && (
          <Card>
            <div className="p-4 flex justify-between items-center border-b border-gray-100">
              <span className="text-sm text-gray-600">مستأجرون في هذا السوق</span>
              {canManageTenants && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setCreateModalOpen(true)} disabled={!MOCK_API_URL}>
                    إنشاء مستأجر جديد
                  </Button>
                  {isRootAdmin && (
                    <Button size="sm" variant="outline" onClick={() => setAddModalOpen(true)} disabled={!MOCK_API_URL}>
                      إضافة مستأجر موجود
                    </Button>
                  )}
                </div>
              )}
            </div>
            {tenantsLoading ? (
              <div className="p-12 text-center text-gray-500">جاري التحميل...</div>
            ) : marketTenants.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                لا يوجد مستأجرون. اضغط &quot;إضافة مستأجر&quot; لإضافة مستأجرين من قائمة المستأجرين.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-start font-medium text-gray-700">المستأجر</th>
                      <th className="px-4 py-3 text-start font-medium text-gray-700">الحساب</th>
                      {isRootAdmin && <th className="px-4 py-3 text-start font-medium text-gray-700">السوق التابع له</th>}
                      <th className="px-4 py-3 text-start font-medium text-gray-700">التصنيف</th>
                      <th className="px-4 py-3 text-start font-medium text-gray-700">ظاهر في السوق</th>
                      <th className="px-4 py-3 text-start font-medium text-gray-700">ترتيب</th>
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
                        marketCategories={MARKET_CATEGORIES}
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
          <Card>
            <div className="p-4 border-b border-gray-100">
              <span className="text-sm text-gray-600">طلبات هذا السوق</span>
            </div>
            {ordersLoading ? (
              <div className="p-12 text-center text-gray-500">جاري التحميل...</div>
            ) : ordersAndLeads.length === 0 ? (
              <div className="p-12 text-center text-gray-500">لا توجد طلبات أو اتصالات</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-start font-medium text-gray-700">الطلب</th>
                      <th className="px-4 py-3 text-start font-medium text-gray-700">المستأجر</th>
                      <th className="px-4 py-3 text-start font-medium text-gray-700">المبلغ</th>
                      <th className="px-4 py-3 text-start font-medium text-gray-700">الحالة</th>
                      <th className="px-4 py-3 text-start font-medium text-gray-700">التاريخ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordersAndLeads.map((o) => {
                      const isLead = (o as { isLead?: boolean }).isLead;
                      const contactType = (o as { contactType?: string }).contactType;
                      const statusLabel = isLead
                        ? (contactType === 'call' ? 'اتصال مهني (هاتف)' : 'اتصال مهني (واتساب)')
                        : (o.status ?? '-');
                      const storeName = marketTenants.find((t) => t.id === o.tenantId)?.name ?? o.tenantId;
                      return (
                        <tr key={o.id ?? o.tenantId} className={`border-t border-gray-100 ${isLead ? 'bg-emerald-50/50' : ''}`}>
                          <td className="px-4 py-3 font-mono text-xs">{o.id?.slice(0, 8) ?? '-'}</td>
                          <td className="px-4 py-3">
                            {storeName}
                            {isLead && (
                              <span className="mr-1 text-xs text-emerald-600" title="من صفحة مهنية">
                                (مهني)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">{isLead ? '—' : `${o.total ?? 0} ر.س`}</td>
                          <td className="px-4 py-3">
                            <span className={isLead ? 'text-emerald-700 font-medium' : ''}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">{o.createdAt ? new Date(o.createdAt).toLocaleDateString('ar-SA') : '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
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
        title="إضافة مستأجر إلى السوق"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">اختر المستأجرين الذين تريد إضافتهم إلى هذا السوق:</p>
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
            {tenantsNotInMarket.length === 0 ? (
              <div className="p-6 text-center text-gray-500">جميع المستأجرين في هذا السوق أو لا يوجد مستأجرون</div>
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
                    <span className="text-xs text-gray-500">(من سوق آخر)</span>
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
        title="إنشاء مستأجر جديد"
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
            label="نوع المتجر"
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
            label="البريد الإلكتروني (مدير المتجر)"
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
            مفعّل
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
      setError('كلمة المرور وتأكيدها غير متطابقتين');
      return;
    }
    onSubmit(newPassword);
  };
  if (!target) return null;
  return (
    <Modal open={!!target} onClose={onClose} title="إعادة تعيين كلمة المرور" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          الحساب: <span className="font-medium text-gray-900">{target.admin.email}</span>
        </p>
        <p className="text-sm text-gray-500">المتجر: {target.tenantName}</p>
        <Input
          label="كلمة المرور الجديدة"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="6+ أحرف"
        />
        <Input
          label="تأكيد كلمة المرور"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="أعد إدخال كلمة المرور"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? 'جاري...' : 'تعيين'}
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
      setError('البريد الإلكتروني مطلوب');
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
    <Modal open={!!target} onClose={onClose} title="إنشاء حساب للمتجر" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">المتجر: {target.tenantName}</p>
        <Input
          label="البريد الإلكتروني"
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
            {isPending ? 'جاري...' : 'إنشاء'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function MarketDetailsTab({ market }: { market: Market }) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [form, setForm] = useState({
    name: market.name,
    slug: market.slug,
    primaryColor: (market.branding as { primaryColor?: string })?.primaryColor ?? '#D97706',
    isActive: market.isActive,
  });

  useEffect(() => {
    setForm({
      name: market.name,
      slug: market.slug,
      primaryColor: (market.branding as { primaryColor?: string })?.primaryColor ?? '#D97706',
      isActive: market.isActive,
    });
  }, [market]);

  const saveMarket = async () => {
    if (!MOCK_API_URL) return;
    const res = await fetch(`${MOCK_API_URL}/markets/${market.id}`, {
      method: 'PUT',
      headers: apiHeaders(),
      body: JSON.stringify({
        name: form.name,
        slug: form.slug,
        branding: { primaryColor: form.primaryColor },
        isActive: form.isActive,
      }),
    });
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ['market', market.id] });
      queryClient.invalidateQueries({ queryKey: ['markets'] });
      addToast('تم الحفظ', 'success');
    }
  };

  return (
    <Card className="p-6 max-w-md">
      <h2 className="text-lg font-semibold mb-4">التفاصيل</h2>
      <div className="grid gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">الاسم</label>
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
        <Button onClick={saveMarket} disabled={!MOCK_API_URL}>حفظ</Button>
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
  marketCategories: { value: MarketCategory; label: string }[];
  onSave: (updates: Partial<RegistryTenant & { marketId?: string }>) => void;
  isSaving: boolean;
  canManageAccounts?: boolean;
  onResetPassword?: () => void;
  onCreateAccount?: () => void;
}

function MarketTenantRow({ tenant, marketId, markets = [], isRootAdmin: isRoot, tenantAdmin, marketCategories, onSave, isSaving, canManageAccounts, onResetPassword, onCreateAccount }: MarketTenantRowProps) {
  const [marketCategory, setMarketCategory] = useState<MarketCategory>(tenant.marketCategory ?? 'GENERAL');
  const [isListedInMarket, setIsListedInMarket] = useState(tenant.isListedInMarket !== false);
  const [marketSortOrder, setMarketSortOrder] = useState(String(tenant.marketSortOrder ?? 0));
  const [parentMarketId, setParentMarketId] = useState(tenant.marketId ?? '');

  useEffect(() => {
    setMarketCategory(tenant.marketCategory ?? 'GENERAL');
    setIsListedInMarket(tenant.isListedInMarket !== false);
    setMarketSortOrder(String(tenant.marketSortOrder ?? 0));
    setParentMarketId(tenant.marketId ?? '');
  }, [tenant.marketCategory, tenant.isListedInMarket, tenant.marketSortOrder, tenant.marketId]);

  const handleSave = () => {
    const order = parseInt(marketSortOrder, 10);
    const updates: Partial<RegistryTenant & { marketId?: string }> = {
      marketCategory,
      isListedInMarket,
      marketSortOrder: isNaN(order) ? 0 : order,
    };
    if (isRoot && parentMarketId !== (tenant.marketId ?? '')) {
      updates.marketId = parentMarketId || undefined;
    }
    onSave(updates);
  };

  const hasChanges =
    (tenant.marketCategory ?? 'GENERAL') !== marketCategory ||
    (tenant.isListedInMarket !== false) !== isListedInMarket ||
    String(tenant.marketSortOrder ?? 0) !== marketSortOrder ||
    (isRoot && (tenant.marketId ?? '') !== parentMarketId);

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
        {tenantAdmin ? (
          <span className="text-gray-700">{tenantAdmin.email}</span>
        ) : (
          <span className="text-gray-400">—</span>
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
            <option value="">—</option>
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
          value={marketCategory}
          onChange={(e) => setMarketCategory(e.target.value as MarketCategory)}
          onClick={(e) => e.stopPropagation()}
          className="h-9 px-2 rounded border border-gray-300 bg-white text-sm min-w-[120px]"
        >
          {marketCategories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
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
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to={`/markets/${marketId}/tenants/${tenant.id}`}
            className="text-sm text-primary hover:underline"
          >
            فتح
          </Link>
          {canManageAccounts && tenantAdmin && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onResetPassword?.();
              }}
              className="inline-flex items-center gap-1 text-sm text-amber-600 hover:text-amber-700 hover:underline"
              title="إعادة تعيين كلمة المرور"
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
              إنشاء حساب
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
