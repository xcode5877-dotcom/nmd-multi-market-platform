import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { Card, Tabs, TabsList, TabsTrigger, TabsContent, Button, Badge, useToast, Modal, Input, ConfirmDialog } from '@nmd/ui';
import { getTenantById, getCatalog, listOrdersByTenant } from '@nmd/mock';
import { MockApiClient } from '@nmd/mock';
import { useState, useEffect } from 'react';
import { formatPrice, formatDateGregorian } from '@nmd/core';
import { Sparkles, ArrowLeft, Settings, KeyRound, ShoppingBag, UserRound, Trash2, MapPin, Truck, DollarSign } from 'lucide-react';
import { apiFetch } from '../api';

const api = new MockApiClient();
const USE_API = !!import.meta.env.VITE_MOCK_API_URL;
const MIN_PASSWORD_LENGTH = 6;
const ADMIN_PORT = 5176;
const STOREFRONT_PORT = 5173;

function isSuperAdmin(role: string | undefined): boolean {
  return role === 'SUPER_ADMIN';
}

/** Only SUPER_ADMIN and MARKET_ADMIN can delete a store. TENANT_ADMIN (merchant) must never see or use delete. */
function canDeleteStore(role: string | undefined): boolean {
  if (role === 'TENANT_ADMIN') return false;
  return role === 'SUPER_ADMIN' || role === 'MARKET_ADMIN';
}

export default function TenantDetailPage() {
  const params = useParams<{ id?: string; tenantId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user } = useAuth();
  const id = params.tenantId ?? params.id;
  const superAdmin = isSuperAdmin(user?.role);
  const showDeleteStore = canDeleteStore(user?.role);
  const [orderDeleteTarget, setOrderDeleteTarget] = useState<{ id?: string } | null>(null);
  const [orderHardDeleting, setOrderHardDeleting] = useState(false);
  const openResetFromState = (location.state as { openResetPassword?: boolean })?.openResetPassword ?? false;
  const queryClient = useQueryClient();
  const { data: tenantFromApi, isLoading } = useQuery({
    queryKey: ['tenant-registry', id],
    queryFn: () => api.getTenantById(id!),
    enabled: !!id && USE_API,
  });
  const { data: catalogFromApi } = useQuery({
    queryKey: ['catalog', id],
    queryFn: () => api.getCatalogApi(id!),
    enabled: !!id && USE_API,
  });
  const { data: ordersFromApi = [] } = useQuery({
    queryKey: ['orders', id],
    queryFn: () => api.listOrdersByTenant(id!),
    enabled: !!id && USE_API,
  });
  const marketId = params.tenantId ? params.id : undefined;
  const { data: usersFromList = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.listUsers(),
    enabled: USE_API && !marketId,
  });
  const { data: categoryPolicies = [] } = useQuery({
    queryKey: ['category-policies'],
    queryFn: () => api.getCategoryPolicies(),
    enabled: USE_API,
  });
  const { data: tenantAdminFromApi } = useQuery({
    queryKey: ['tenant-admin', id],
    queryFn: () => api.getTenantAdmin(id!),
    enabled: USE_API && !!marketId && !!id,
  });
  const { data: tenantAdminsForMarket = [] } = useQuery({
    queryKey: ['tenant-admins', marketId],
    queryFn: () => api.listTenantAdminsForMarket(marketId!),
    enabled: USE_API && !!marketId,
  });
  const tenantAdmin =
    marketId && tenantAdminFromApi
      ? tenantAdminFromApi
      : (marketId ? tenantAdminsForMarket : usersFromList).find((u) => u.role === 'TENANT_ADMIN' && u.tenantId === id);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetError, setResetError] = useState('');
  useEffect(() => {
    if (openResetFromState && tenantAdmin) {
      setResetPasswordOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [openResetFromState, tenantAdmin, location.pathname, navigate]);
  const markReadyMutation = useMutation({
    mutationFn: (orderId: string) => api.markOrderReady(id!, orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
      addToast('تم تعليم الطلب جاهزاً', 'success');
    },
    onError: (err) => addToast(err instanceof Error ? err.message : 'فشل', 'error'),
  });

  const handleHardDeleteOrder = async () => {
    if (!orderDeleteTarget?.id || !USE_API) return;
    setOrderHardDeleting(true);
    try {
      await api.hardDeleteOrder(orderDeleteTarget.id);
      queryClient.invalidateQueries({ queryKey: ['orders', id] });
      setOrderDeleteTarget(null);
      addToast('تم حذف الطلب نهائياً', 'success');
    } catch {
      addToast('فشل حذف الطلب', 'error');
    } finally {
      setOrderHardDeleting(false);
    }
  };
  const applyTemplateMutation = useMutation({
    mutationFn: () => api.applyTemplateApi(id!, 'clothing'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-registry', id] });
      queryClient.invalidateQueries({ queryKey: ['catalog', id] });
      addToast('تم تطبيق القالب بنجاح', 'success');
    },
    onError: (err) => addToast(err instanceof Error ? err.message : 'فشل تطبيق القالب', 'error'),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, newPassword }: { userId: string; newPassword: string }) =>
      api.resetUserPassword(userId, newPassword),
    onSuccess: () => {
      addToast('تم تعيين كلمة المرور الجديدة بنجاح', 'success');
      setResetPasswordOpen(false);
      setResetNewPassword('');
      setResetConfirmPassword('');
      setResetError('');
    },
    onError: (err) => addToast(err instanceof Error ? err.message : 'فشل تعيين كلمة المرور', 'error'),
  });

  const handleResetPassword = () => {
    setResetError('');
    if (!tenantAdmin) {
      setResetError('لا يوجد مدير لهذا المحل');
      return;
    }
    if (resetNewPassword.length < MIN_PASSWORD_LENGTH) {
      setResetError(`كلمة المرور يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل`);
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setResetError('كلمة المرور وتأكيدها غير متطابقتين');
      return;
    }
    resetPasswordMutation.mutate({ userId: tenantAdmin.id, newPassword: resetNewPassword });
  };

  const tenant = id ? (USE_API ? tenantFromApi : getTenantById(id)) : null;
  const [tab, setTab] = useState('basic');
  const currentName = tenant?.name ?? '';
  const currentAbout = (tenant as { about?: string })?.about ?? '';
  const currentStoreType = (tenant as { storeType?: 'RESTAURANT' | 'PROFESSIONAL' })?.storeType ?? 'RESTAURANT';
  const currentOpenTime = (tenant as { openTime?: string })?.openTime ?? '08:00';
  const currentCloseTime = (tenant as { closeTime?: string })?.closeTime ?? '17:00';
  const currentForceClosed = (tenant as { forceClosed?: boolean })?.forceClosed ?? false;
  const currentCategoryId = (tenant as { categoryId?: string })?.categoryId ?? '';
  const currentEnabled = (tenant as { enabled?: boolean })?.enabled ?? true;
  const currentLocation = (tenant as { location?: { lat: number; lng: number } })?.location;
  const currentDeliveryRadiusKm = (tenant as { deliveryRadiusKm?: number })?.deliveryRadiusKm;
  const currentFinancialConfig = (tenant as { financialConfig?: { commissionType: string; commissionValue: number; deliveryFeeModel: string } })?.financialConfig;
  const [nameLocal, setNameLocal] = useState(currentName);
  const [aboutLocal, setAboutLocal] = useState(currentAbout);
  const [storeTypeLocal, setStoreTypeLocal] = useState<'RESTAURANT' | 'PROFESSIONAL'>(currentStoreType);
  const [openTimeLocal, setOpenTimeLocal] = useState(currentOpenTime);
  const [closeTimeLocal, setCloseTimeLocal] = useState(currentCloseTime);
  const [forceClosedLocal, setForceClosedLocal] = useState(currentForceClosed);
  const [categoryIdLocal, setCategoryIdLocal] = useState(currentCategoryId);
  const [enabledLocal, setEnabledLocal] = useState(currentEnabled);
  const [latLocal, setLatLocal] = useState(currentLocation?.lat ?? '');
  const [lngLocal, setLngLocal] = useState(currentLocation?.lng ?? '');
  const [deliveryRadiusKmLocal, setDeliveryRadiusKmLocal] = useState(currentDeliveryRadiusKm ?? '');
  const [commissionTypeLocal, setCommissionTypeLocal] = useState(currentFinancialConfig?.commissionType ?? 'PERCENTAGE');
  const [commissionValueLocal, setCommissionValueLocal] = useState(currentFinancialConfig?.commissionValue ?? 10);
  const [deliveryFeeModelLocal, setDeliveryFeeModelLocal] = useState(currentFinancialConfig?.deliveryFeeModel ?? 'TENANT');
  useEffect(() => { setNameLocal(currentName); }, [currentName]);
  useEffect(() => { setAboutLocal(currentAbout); }, [currentAbout]);
  useEffect(() => { setStoreTypeLocal(currentStoreType); }, [currentStoreType]);
  useEffect(() => { setOpenTimeLocal(currentOpenTime); }, [currentOpenTime]);
  useEffect(() => { setCloseTimeLocal(currentCloseTime); }, [currentCloseTime]);
  useEffect(() => { setForceClosedLocal(currentForceClosed); }, [currentForceClosed]);
  useEffect(() => { setCategoryIdLocal(currentCategoryId); }, [currentCategoryId]);
  useEffect(() => { setEnabledLocal(currentEnabled); }, [currentEnabled]);
  useEffect(() => {
    setLatLocal(currentLocation?.lat != null ? String(currentLocation.lat) : '');
    setLngLocal(currentLocation?.lng != null ? String(currentLocation.lng) : '');
  }, [currentLocation?.lat, currentLocation?.lng]);
  useEffect(() => { setDeliveryRadiusKmLocal(currentDeliveryRadiusKm != null ? String(currentDeliveryRadiusKm) : ''); }, [currentDeliveryRadiusKm]);
  useEffect(() => {
    setCommissionTypeLocal(currentFinancialConfig?.commissionType ?? 'PERCENTAGE');
    setCommissionValueLocal(currentFinancialConfig?.commissionValue ?? 10);
    setDeliveryFeeModelLocal(currentFinancialConfig?.deliveryFeeModel ?? 'TENANT');
  }, [currentFinancialConfig?.commissionType, currentFinancialConfig?.commissionValue, currentFinancialConfig?.deliveryFeeModel]);

  const saveStorefrontMutation = useMutation({
    mutationFn: (payload: { name: string; about: string }) =>
      apiFetch(`/tenants/${id}/operational-settings`, { method: 'PUT', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-registry', id] });
      addToast('تم حفظ محتوى الواجهة', 'success');
    },
    onError: (err) => addToast(err instanceof Error ? err.message : 'فشل الحفظ', 'error'),
  });
  const saveGeneralMutation = useMutation({
    mutationFn: (payload: { storeType: 'RESTAURANT' | 'PROFESSIONAL'; openTime: string; closeTime: string; forceClosed: boolean }) =>
      apiFetch(`/tenants/${id}/operational-settings`, { method: 'PUT', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-registry', id] });
      addToast('تم الحفظ', 'success');
    },
    onError: (err) => addToast(err instanceof Error ? err.message : 'فشل الحفظ', 'error'),
  });
  const saveCategoryMutation = useMutation({
    mutationFn: (payload: { categoryId: string }) =>
      apiFetch(`/tenants/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-registry', id] });
      addToast('تم تحديث تصنيف SLA', 'success');
    },
    onError: (err) => addToast(err instanceof Error ? err.message : 'فشل الحفظ', 'error'),
  });

  const storeManagementPayload = () => {
    const lat = latLocal === '' ? undefined : Number(latLocal);
    const lng = lngLocal === '' ? undefined : Number(lngLocal);
    const location =
      typeof lat === 'number' && !Number.isNaN(lat) && typeof lng === 'number' && !Number.isNaN(lng)
        ? { lat, lng }
        : latLocal === '' && lngLocal === ''
          ? null
          : undefined;
    const deliveryRadiusKm = deliveryRadiusKmLocal === '' ? undefined : Number(deliveryRadiusKmLocal);
    const payload: Record<string, unknown> = {
      enabled: enabledLocal,
      deliveryRadiusKm: typeof deliveryRadiusKm === 'number' && !Number.isNaN(deliveryRadiusKm) ? deliveryRadiusKm : undefined,
      financialConfig: {
        commissionType: commissionTypeLocal as 'PERCENTAGE' | 'FIXED',
        commissionValue: Number(commissionValueLocal) || 0,
        deliveryFeeModel: deliveryFeeModelLocal as 'MARKET' | 'TENANT',
      },
    };
    if (location !== undefined) payload.location = location;
    return payload;
  };
  const saveStoreManagementMutation = useMutation({
    mutationFn: () => apiFetch(`/tenants/${id}`, { method: 'PATCH', body: JSON.stringify(storeManagementPayload()) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-registry', id] });
      addToast('تم حفظ إعدادات المتجر', 'success');
    },
    onError: (err) => addToast(err instanceof Error ? err.message : 'فشل الحفظ', 'error'),
  });
  const storeManagementHasChanges =
    enabledLocal !== currentEnabled ||
    (currentLocation?.lat != null ? String(currentLocation.lat) : '') !== latLocal ||
    (currentLocation?.lng != null ? String(currentLocation.lng) : '') !== lngLocal ||
    (currentDeliveryRadiusKm != null ? String(currentDeliveryRadiusKm) : '') !== deliveryRadiusKmLocal ||
    (currentFinancialConfig?.commissionType ?? 'PERCENTAGE') !== commissionTypeLocal ||
    (currentFinancialConfig?.commissionValue ?? 10) !== commissionValueLocal ||
    (currentFinancialConfig?.deliveryFeeModel ?? 'TENANT') !== deliveryFeeModelLocal;

  const storefrontHasChanges = nameLocal !== currentName || aboutLocal !== currentAbout;
  const generalHasChanges =
    storeTypeLocal !== currentStoreType ||
    openTimeLocal !== currentOpenTime ||
    closeTimeLocal !== currentCloseTime ||
    forceClosedLocal !== currentForceClosed;
  const handleSaveStorefront = () => saveStorefrontMutation.mutate({ name: nameLocal, about: aboutLocal });
  const handleSaveGeneral = () =>
    saveGeneralMutation.mutate({ storeType: storeTypeLocal, openTime: openTimeLocal, closeTime: closeTimeLocal, forceClosed: forceClosedLocal });

  const [deleteStoreModalOpen, setDeleteStoreModalOpen] = useState(false);
  const deleteStoreMutation = useMutation({
    mutationFn: () => api.deleteTenant(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-registry'] });
      queryClient.invalidateQueries({ queryKey: ['markets'] });
      addToast('تم حذف المتجر وجميع بياناته', 'success');
      setDeleteStoreModalOpen(false);
      navigate(marketId ? `/markets/${marketId}/tenants` : '/tenants', { replace: true });
    },
    onError: (err) => addToast(err instanceof Error ? err.message : 'فشل حذف المتجر', 'error'),
  });

  if (USE_API && isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  if (!tenant) {
    return (
      <div className="p-8 text-center text-gray-500">
        المستأجر غير موجود
      </div>
    );
  }

  const catalog = USE_API ? (catalogFromApi ?? { categories: [], products: [], optionGroups: [] }) : getCatalog(tenant.id);
  const tenantType = (tenant as { tenantType?: string }).tenantType ?? (tenant.type === 'FOOD' ? 'RESTAURANT' : 'SHOP');
  const isRestaurant = tenantType === 'RESTAURANT';
  const orders = (USE_API ? ordersFromApi : listOrdersByTenant(tenant.id)).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 20);

  const adminUrl = `http://localhost:${ADMIN_PORT}/?tenant=${tenant.slug}`;
  const storefrontUrl = `http://localhost:${STOREFRONT_PORT}/?tenant=${tenant.slug}`;

  return (
    <div>
      {marketId && (
        <Link
          to={`/markets/${marketId}/tenants`}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          رجوع للمستأجرين
        </Link>
      )}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center text-white font-bold text-2xl"
            style={{ backgroundColor: tenant.primaryColor }}
          >
            {tenant.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
              {(tenant as { businessType?: string })?.businessType && <Badge className="text-xs">{(tenant as { businessType?: string }).businessType}</Badge>}
            </div>
            <p className="text-gray-500">/{tenant.slug}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => applyTemplateMutation.mutate()}
            disabled={applyTemplateMutation.isPending}
            className="gap-1.5"
          >
            <Sparkles className="w-4 h-4" />
            {applyTemplateMutation.isPending ? 'جاري التطبيق...' : 'تطبيق قالب جاهز'}
          </Button>
          {USE_API && tenantAdmin && (
            <Button size="sm" variant="outline" onClick={() => setResetPasswordOpen(true)} className="gap-1.5">
              <KeyRound className="w-4 h-4" />
              إعادة تعيين كلمة المرور
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => window.open(adminUrl, '_blank')}>
            فتح لوحة المستأجر
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.open(storefrontUrl, '_blank')}>
            فتح المتجر
          </Button>
          <Link to={marketId ? `/markets/${marketId}/tenants/${id}/settings/delivery` : `/tenants/${id}/settings/delivery`}>
            <Button size="sm" variant="outline" className="gap-1.5">
              <Settings className="w-4 h-4" />
              إعدادات التوصيل
            </Button>
          </Link>
        </div>
      </div>
      <Tabs value={tab} onChange={setTab}>
        <TabsList>
          <TabsTrigger value="basic">المعلومات الأساسية</TabsTrigger>
          <TabsTrigger value="store">إدارة المتجر</TabsTrigger>
          <TabsTrigger value="products">المنتجات</TabsTrigger>
          <TabsTrigger value="orders">الطلبات</TabsTrigger>
          <TabsTrigger value="settings">الإعدادات</TabsTrigger>
        </TabsList>

        {/* Basic Info: name, about, branding */}
        <TabsContent value="basic">
          <div className="space-y-6">
            <Card className="p-6 bg-white">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">الاسم والنبذة</h2>
              <p className="text-sm text-gray-500 mb-4">
                المحتوى التسويقي المعروض للعملاء: الاسم، النبذة، الهيرو والإعلانات (الهيرو من العلامة التجارية).
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 ms-1">اسم المحل</label>
                  <input
                    type="text"
                    value={nameLocal}
                    onChange={(e) => setNameLocal(e.target.value)}
                    placeholder="اسم المحل أو العلامة"
                    maxLength={50}
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    dir="rtl"
                  />
                  <p className="text-xs text-gray-400 mt-1 ms-1">حد أقصى 50 حرفاً</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 ms-1">نبذة عن المكتب/العمل (About Business)</label>
                  <textarea
                    value={aboutLocal}
                    onChange={(e) => setAboutLocal(e.target.value)}
                    placeholder="أدخل وصفاً مختصراً عن المكتب أو الخدمات... تظهر في وضع الخدمات/احترافي."
                    rows={5}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y min-h-[100px]"
                    dir="rtl"
                  />
                </div>
              </div>
            </Card>
            <Card className="p-6 bg-white">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">العلامة التجارية (Logo / Colors)</h2>
              <div className="space-y-2 text-sm">
                <p><span className="text-gray-500">اللون الأساسي:</span> <span className="font-mono" style={{ color: tenant.primaryColor }}>{tenant.primaryColor}</span></p>
                <p><span className="text-gray-500">اللون الثانوي:</span> <span className="font-mono" style={{ color: tenant.secondaryColor }}>{tenant.secondaryColor}</span></p>
                <p><span className="text-gray-500">الخط:</span> {tenant.fontFamily}</p>
              </div>
            </Card>
            {USE_API && (
              <Button
                onClick={handleSaveStorefront}
                disabled={saveStorefrontMutation.isPending || !storefrontHasChanges}
              >
                {saveStorefrontMutation.isPending ? 'جاري الحفظ...' : 'حفظ محتوى الواجهة'}
              </Button>
            )}
            {!USE_API && (
              <p className="text-sm text-gray-500">تفعيل الواجهة البرمجية (VITE_MOCK_API_URL) لحفظ التغييرات.</p>
            )}
          </div>
        </TabsContent>

        {/* Store Management: delivery radius, location, status, commission */}
        <TabsContent value="store">
          <div className="space-y-6">
            <Card className="p-6 bg-white">
              <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Truck className="w-5 h-5" />
                نصف قطر التوصيل (كم)
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                أقصى مسافة توصيل من موقع المتجر. يساعد في حل مشكلة «خارج النطاق» عند عدم وجود مناطق توصيل أو عند استخدام موقع المتجر كاحتياطي.
              </p>
              <div className="max-w-xs">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={deliveryRadiusKmLocal}
                  onChange={(e) => setDeliveryRadiusKmLocal(e.target.value)}
                  placeholder="مثال: 5"
                  className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">اتركه فارغاً لعدم استخدام نطاق افتراضي من موقع المتجر</p>
              </div>
            </Card>
            <Card className="p-6 bg-white">
              <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                موقع المتجر (إحداثيات)
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                خط العرض وخط الطول لموقع المتجر. يُستخدم لحساب المسافة وتحديد «خارج النطاق» عند وجود نصف قطر التوصيل.
              </p>
              <div className="flex flex-wrap gap-4">
                <div className="min-w-[140px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">خط العرض (Latitude)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={latLocal}
                    onChange={(e) => setLatLocal(e.target.value)}
                    placeholder="32.5"
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div className="min-w-[140px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">خط الطول (Longitude)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={lngLocal}
                    onChange={(e) => setLngLocal(e.target.value)}
                    placeholder="35.2"
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
              {typeof navigator !== 'undefined' && navigator.geolocation && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-2"
                  onClick={() => {
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        setLatLocal(String(pos.coords.latitude));
                        setLngLocal(String(pos.coords.longitude));
                        addToast('تم تعيين موقعك الحالي', 'success');
                      },
                      () => addToast('لم يتم الحصول على الموقع', 'error')
                    );
                  }}
                >
                  <MapPin className="w-4 h-4" />
                  استخدام موقعي الحالي
                </Button>
              )}
              <p className="text-xs text-gray-400 mt-2">يمكنك الحصول على الإحداثيات من خرائط جوجل (انقر بزر الماوس الأيمن على الموقع → الإحداثيات)</p>
            </Card>
            <Card className="p-6 bg-white">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">حالة المتجر</h2>
              <p className="text-sm text-gray-500 mb-4">
                تفعيل أو إيقاف المتجر. عند الإيقاف لا يظهر المتجر في الواجهة ولا يقبل طلبات.
              </p>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabledLocal}
                  onChange={(e) => setEnabledLocal(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="font-medium text-gray-900">المتجر مفعّل (يظهر ويقبل الطلبات)</span>
              </label>
            </Card>
            <Card className="p-6 bg-white">
              <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                العمولة / الرسوم
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                إعدادات مالية خاصة بالمتجر (إن وُجدت). لا تؤثر على واجهة العميل مباشرة.
              </p>
              <div className="grid gap-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">نوع العمولة</label>
                  <select
                    value={commissionTypeLocal}
                    onChange={(e) => setCommissionTypeLocal(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="PERCENTAGE">نسبة مئوية</option>
                    <option value="FIXED">مبلغ ثابت</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">قيمة العمولة</label>
                  <input
                    type="number"
                    min={0}
                    step={commissionTypeLocal === 'PERCENTAGE' ? 1 : 0.01}
                    value={commissionValueLocal}
                    onChange={(e) => setCommissionValueLocal(Number(e.target.value) || 0)}
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">نموذج رسوم التوصيل</label>
                  <select
                    value={deliveryFeeModelLocal}
                    onChange={(e) => setDeliveryFeeModelLocal(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="TENANT">المستأجر</option>
                    <option value="MARKET">السوق</option>
                  </select>
                </div>
              </div>
            </Card>
            {USE_API && (
              <Button
                onClick={() => saveStoreManagementMutation.mutate()}
                disabled={saveStoreManagementMutation.isPending || !storeManagementHasChanges}
              >
                {saveStoreManagementMutation.isPending ? 'جاري الحفظ...' : 'حفظ إعدادات المتجر'}
              </Button>
            )}
            {!USE_API && (
              <p className="text-sm text-gray-500">تفعيل الواجهة البرمجية (VITE_MOCK_API_URL) لحفظ التغييرات.</p>
            )}
          </div>
        </TabsContent>

        {/* Products: catalog summary */}
        <TabsContent value="products">
          <div className="space-y-6">
            <Card className="p-6 bg-white">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">الكتالوج</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-gray-50">
                  <p className="text-2xl font-bold text-primary">{catalog.categories?.length ?? 0}</p>
                  <p className="text-sm text-gray-500">تصنيفات</p>
                </div>
                <div className="p-4 rounded-lg bg-gray-50">
                  <p className="text-2xl font-bold text-primary">{catalog.products?.length ?? 0}</p>
                  <p className="text-sm text-gray-500">منتجات</p>
                </div>
                <div className="p-4 rounded-lg bg-gray-50">
                  <p className="text-2xl font-bold text-primary">{catalog.optionGroups?.length ?? 0}</p>
                  <p className="text-sm text-gray-500">مجموعات خيارات</p>
                </div>
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* Orders */}
        <TabsContent value="orders">
          <div className="space-y-6">
            <Card className="p-6 bg-white">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">الطلبات</h2>
              <p className="text-sm text-gray-500 mb-4">آخر 20 طلب</p>
              {orders.length === 0 ? (
                <p className="text-gray-500">لا توجد طلبات</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-start py-2">#</th>
                        <th className="text-start py-2">التاريخ</th>
                        <th className="text-start py-2">الإجمالي</th>
                        <th className="text-start py-2">الحالة</th>
                        {isRestaurant && <th className="text-start py-2">جاهز في</th>}
                        {USE_API && isRestaurant && <th className="text-start py-2">إجراء</th>}
                        {superAdmin && USE_API && <th className="text-start py-2 w-10" aria-label="حذف نهائي" />}
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o, i) => {
                        const oExt = o as { id?: unknown; status?: string; readyAt?: string; fallbackTriggeredAt?: string };
                        const idStr = String(oExt.id ?? '');
                        const hasValidId = idStr.length > 0;
                        if (!hasValidId && i < 3) console.warn('[TenantDetailPage] Order with missing/non-string id:', o);
                        const readyAt = oExt.readyAt ? new Date(oExt.readyAt) : null;
                        const now = new Date();
                        const minsLeft = readyAt ? Math.max(0, Math.round((readyAt.getTime() - now.getTime()) / 60000)) : null;
                        const canMarkReady = USE_API && isRestaurant && hasValidId && oExt.status !== 'READY' && oExt.status !== 'OUT_FOR_DELIVERY' && oExt.status !== 'DELIVERED' && oExt.status !== 'CANCELED';
                        return (
                          <tr key={hasValidId ? idStr : `order-${i}`} className="border-b">
                            <td className="py-2 font-mono">{hasValidId ? idStr.slice(0, 8) : '—'}</td>
                            <td className="py-2">{formatDateGregorian(o.createdAt)}</td>
                            <td className="py-2">{formatPrice(o.total)}</td>
                            <td className="py-2">
                              <span className={oExt.status === 'READY' ? 'text-green-600 font-medium' : ''}>{oExt.status ?? o.status}</span>
                              {oExt.fallbackTriggeredAt && <span className="ms-1 text-xs text-amber-600" title="انتقل لتوصيل السوق">↗</span>}
                            </td>
                            {isRestaurant && (
                              <td className="py-2">
                                {oExt.status === 'READY' ? <span className="text-green-600">جاهز</span> : minsLeft !== null ? <span>{minsLeft} د</span> : '-'}
                              </td>
                            )}
                            {USE_API && isRestaurant && (
                              <td className="py-2">
                                {canMarkReady && (
                                  <Button size="sm" onClick={() => markReadyMutation.mutate(idStr)} disabled={markReadyMutation.isPending}>
                                    جاهز للاستلام
                                  </Button>
                                )}
                              </td>
                            )}
                            {superAdmin && USE_API && (
                              <td className="py-2">
                                <button
                                  type="button"
                                  className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                                  onClick={() => setOrderDeleteTarget({ id: idStr })}
                                  aria-label="حذف الطلب نهائياً"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            )}
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
              message={orderDeleteTarget ? 'هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء.' : ''}
              confirmLabel="حذف نهائياً"
              variant="danger"
              loading={orderHardDeleting}
              closeOnConfirm={false}
            />
          </div>
        </TabsContent>

        {/* Settings: store mode, business hours, delivery link, delete store */}
        <TabsContent value="settings">
          <div className="space-y-6">
            <Card className="p-6 bg-white">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">وضع المتجر (Store Mode)</h2>
              <p className="text-sm text-gray-500 mb-4">
                يحدد طريقة عرض المتجر للزبائن: سلة شراء ومنتجات، أو وضع خدمات مع تواصل واتساب/اتصال.
              </p>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors hover:bg-gray-50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input
                    type="radio"
                    name="storeType"
                    value="RESTAURANT"
                    checked={storeTypeLocal === 'RESTAURANT'}
                    onChange={() => setStoreTypeLocal('RESTAURANT')}
                    className="w-4 h-4 text-primary"
                  />
                  <ShoppingBag className="w-5 h-5 text-gray-600" />
                  <div>
                    <span className="font-medium text-gray-900">وضع التسوق (تجزئة / طعام)</span>
                    <p className="text-sm text-gray-500 mt-0.5">سلة شراء، إضافة للسلة، طلبات وتوصيل</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors hover:bg-gray-50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input
                    type="radio"
                    name="storeType"
                    value="PROFESSIONAL"
                    checked={storeTypeLocal === 'PROFESSIONAL'}
                    onChange={() => setStoreTypeLocal('PROFESSIONAL')}
                    className="w-4 h-4 text-primary"
                  />
                  <UserRound className="w-5 h-5 text-gray-600" />
                  <div>
                    <span className="font-medium text-gray-900">وضع الخدمات (احترافي)</span>
                    <p className="text-sm text-gray-500 mt-0.5">قائمة خدمات، تواصل واتساب / اتصال، بدون سلة</p>
                  </div>
                </label>
              </div>
            </Card>
            <Card className="p-6 bg-white">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">ساعات العمل (Business Hours)</h2>
              <p className="text-sm text-gray-500 mb-3">
                وقت الفتح والإغلاق اليومي. يظهر للعملاء ويحدد شارة مفتوح/مغلق تلقائياً.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 ms-1">وقت الفتح</label>
                  <input
                    type="time"
                    value={openTimeLocal}
                    onChange={(e) => setOpenTimeLocal(e.target.value)}
                    className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 ms-1">وقت الإغلاق</label>
                  <input
                    type="time"
                    value={closeTimeLocal}
                    onChange={(e) => setCloseTimeLocal(e.target.value)}
                    className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <input
                  type="checkbox"
                  id="forceClosed"
                  checked={forceClosedLocal}
                  onChange={(e) => setForceClosedLocal(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="forceClosed" className="text-sm font-medium text-gray-900 cursor-pointer">
                  إغلاق يدوي طارئ (Force Closed) — يعرض المحل مغلقاً بغض النظر عن الساعات
                </label>
              </div>
            </Card>
            {USE_API && (
              <Button
                onClick={handleSaveGeneral}
                disabled={saveGeneralMutation.isPending || !generalHasChanges}
              >
                {saveGeneralMutation.isPending ? 'جاري الحفظ...' : 'حفظ الإعدادات العامة'}
              </Button>
            )}
            {!USE_API && (
              <p className="text-sm text-gray-500">تفعيل الواجهة البرمجية (VITE_MOCK_API_URL) لحفظ التغييرات.</p>
            )}
            {USE_API && categoryPolicies.length > 0 && (
              <Card className="p-6 bg-white">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">تصنيف SLA (لوحة الطلبات وتطبيق السائق)</h2>
                <p className="text-sm text-gray-500 mb-3">
                  يحدد عتبات الأخضر / البرتقالي / الأحمر لانتظار الطلب (حسب السياسة المعرّفة في إعدادات النظام).
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={categoryIdLocal}
                    onChange={(e) => setCategoryIdLocal(e.target.value)}
                    className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary min-w-[200px]"
                  >
                    <option value="">— اختر التصنيف —</option>
                    {categoryPolicies.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={saveCategoryMutation.isPending || categoryIdLocal === currentCategoryId}
                    onClick={() => saveCategoryMutation.mutate({ categoryId: categoryIdLocal })}
                  >
                    {saveCategoryMutation.isPending ? 'جاري...' : 'حفظ التصنيف'}
                  </Button>
                </div>
              </Card>
            )}
            <Card className="p-6 bg-white">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">إعدادات إضافية</h2>
              <div className="flex flex-wrap gap-3">
                <Link to={marketId ? `/markets/${marketId}/tenants/${id}/settings/delivery` : `/tenants/${id}/settings/delivery`}>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Settings className="w-4 h-4" />
                    إعدادات التوصيل
                  </Button>
                </Link>
              </div>
            </Card>
            {showDeleteStore && (
              <Card className="p-6 bg-white border-red-200">
                <h2 className="text-lg font-semibold text-red-700 mb-2">منطقة الخطر</h2>
                <p className="text-sm text-gray-600 mb-4">
                  حذف المتجر نهائياً مع كل بياناته (الطلبات، المنتجات، الإعدادات). لا يمكن التراجع عن هذا الإجراء.
                </p>
                {USE_API ? (
                  <Button
                    variant="outline"
                    className="border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700 gap-2"
                    onClick={() => setDeleteStoreModalOpen(true)}
                    disabled={deleteStoreMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                    {deleteStoreMutation.isPending ? 'جاري الحذف...' : 'حذف المتجر'}
                  </Button>
                ) : (
                  <p className="text-sm text-gray-500">تفعيل الواجهة البرمجية (VITE_MOCK_API_URL) لتفعيل حذف المتجر.</p>
                )}
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {showDeleteStore && (
        <Modal open={deleteStoreModalOpen} onClose={() => !deleteStoreMutation.isPending && setDeleteStoreModalOpen(false)} title="حذف المتجر" size="sm">
          <p className="text-sm text-gray-700 mb-6">
            سيتم حذف المتجر وجميع بياناته نهائياً (الطلبات، المنتجات، الإعدادات). لا يمكن التراجع عن هذا الإجراء.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setDeleteStoreModalOpen(false)} disabled={deleteStoreMutation.isPending}>
              إلغاء
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteStoreMutation.mutate()}
              disabled={deleteStoreMutation.isPending}
            >
              {deleteStoreMutation.isPending ? 'جاري الحذف...' : 'حذف نهائياً'}
            </Button>
          </div>
        </Modal>
      )}

      <Modal open={resetPasswordOpen} onClose={() => setResetPasswordOpen(false)} title="إعادة تعيين كلمة المرور" size="sm">
        <p className="text-sm text-gray-500 mb-4">
          تعيين كلمة مرور جديدة لـ {tenantAdmin?.email ?? 'مدير المحل'}. سيُطلب منه تغييرها عند أول تسجيل دخول.
        </p>
        <div className="space-y-4">
          <Input
            type="password"
            label="كلمة المرور الجديدة"
            value={resetNewPassword}
            onChange={(e) => setResetNewPassword(e.target.value)}
            placeholder={`${MIN_PASSWORD_LENGTH} أحرف على الأقل`}
            autoComplete="new-password"
          />
          <Input
            type="password"
            label="تأكيد كلمة المرور"
            value={resetConfirmPassword}
            onChange={(e) => setResetConfirmPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
          />
          {resetError && <p className="text-sm text-red-600">{resetError}</p>}
          <Button
            onClick={handleResetPassword}
            disabled={resetPasswordMutation.isPending}
          >
            {resetPasswordMutation.isPending ? 'جاري الحفظ...' : 'تعيين كلمة المرور'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
