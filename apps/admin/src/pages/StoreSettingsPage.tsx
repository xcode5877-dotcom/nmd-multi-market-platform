import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { DayKey, BusinessHours, DayHours } from '@nmd/core';
import { Card, Button, Input, useToast } from '@nmd/ui';
import { useAdminContext } from '../context/AdminContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import { Store, Palette, Clock, Activity, Link2, Trash2, Truck, CheckCircle, AlertCircle, XCircle, Shield } from 'lucide-react';
import { broadcastTenantUpdate } from '../lib/tenant-broadcast';

const api = new MockApiClient();
const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';
const MIN_PASSWORD_LENGTH = 6;

const DAY_LABELS: Record<DayKey, string> = {
  sun: 'الأحد',
  mon: 'الإثنين',
  tue: 'الثلاثاء',
  wed: 'الأربعاء',
  thu: 'الخميس',
  fri: 'الجمعة',
  sat: 'السبت',
};

const DAY_ORDER: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const DEFAULT_DAY: DayHours = { open: '09:00', close: '21:00', isClosedDay: false };

function defaultBusinessHours(): BusinessHours {
  const h: BusinessHours = {};
  for (const d of DAY_ORDER) {
    h[d] = { ...DEFAULT_DAY };
  }
  return h;
}

export default function StoreSettingsPage() {
  const { tenantId } = useAdminContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addToast = useToast().addToast;

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant-by-id', tenantId],
    queryFn: () => api.getTenant(tenantId) as Promise<{ name?: string; operationalStatus?: string; orderPolicy?: string; businessHours?: BusinessHours; busyBannerEnabled?: boolean; busyBannerText?: string; storeType?: 'RESTAURANT' | 'PROFESSIONAL'; bookingEnabled?: boolean; about?: string; officeHours?: string; phone?: string; whatsappPhone?: string } | null>,
    enabled: !!tenantId,
  });

  const [storeName, setStoreName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [busyBannerText, setBusyBannerText] = useState('المحل مشغول حالياً، قد يستغرق الطلب وقتاً أطول');
  const [about, setAbout] = useState('');
  const [officeHours, setOfficeHours] = useState('');
  const [hours, setHours] = useState<BusinessHours>(() => defaultBusinessHours());
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (tenant) {
      setStoreName(tenant.name ?? '');
      const phone = (tenant as { phone?: string }).phone ?? (tenant as { whatsappPhone?: string }).whatsappPhone ?? '';
      setContactPhone(phone);
      setBusyBannerText(tenant.busyBannerText ?? 'المحل مشغول حالياً، قد يستغرق الطلب وقتاً أطول');
      setAbout((tenant as { about?: string }).about ?? '');
      setOfficeHours((tenant as { officeHours?: string }).officeHours ?? '');
      const bh = tenant.businessHours;
      setHours(bh && Object.keys(bh).length > 0 ? { ...defaultBusinessHours(), ...bh } : defaultBusinessHours());
    }
  }, [tenant]);

  const operationalStatus = (tenant?.operationalStatus as 'open' | 'closed' | 'busy') ?? 'open';
  const orderPolicy = (tenant?.orderPolicy as 'accept_always' | 'accept_only_when_open') ?? 'accept_only_when_open';
  const busyBannerEnabled = tenant?.busyBannerEnabled ?? false;
  const bookingEnabled = tenant?.bookingEnabled ?? false;
  const isProfessional = tenant?.storeType === 'PROFESSIONAL';

  const handleStatusOverride = async (status: 'open' | 'closed' | 'busy') => {
    try {
      await api.updateOperationalSettingsApi(tenantId, { operationalStatus: status });
      queryClient.invalidateQueries({ queryKey: ['tenant-by-id', tenantId] });
      broadcastTenantUpdate(tenantId);
      addToast(`تم تعيين الحالة: ${status === 'open' ? 'مفتوح' : status === 'busy' ? 'مشغول' : 'مغلق'}`, 'success');
    } catch {
      addToast('حدث خطأ', 'error');
    }
  };

  const handleOrderPolicyChange = async (policy: 'accept_always' | 'accept_only_when_open') => {
    try {
      await api.updateOperationalSettingsApi(tenantId, { orderPolicy: policy });
      queryClient.invalidateQueries({ queryKey: ['tenant-by-id', tenantId] });
      broadcastTenantUpdate(tenantId);
      addToast('تم تحديث سياسة الطلبات', 'success');
    } catch {
      addToast('حدث خطأ', 'error');
    }
  };

  const handleBusyBannerToggle = async (enabled: boolean) => {
    try {
      await api.updateOperationalSettingsApi(tenantId, { busyBannerEnabled: enabled });
      queryClient.invalidateQueries({ queryKey: ['tenant-by-id', tenantId] });
      broadcastTenantUpdate(tenantId);
      addToast(enabled ? 'تم تفعيل بانر المشغولية' : 'تم إيقاف بانر المشغولية', 'success');
    } catch {
      addToast('حدث خطأ', 'error');
    }
  };

  const handleBusyBannerTextSave = async () => {
    try {
      await api.updateOperationalSettingsApi(tenantId, { busyBannerText });
      queryClient.invalidateQueries({ queryKey: ['tenant-by-id', tenantId] });
      broadcastTenantUpdate(tenantId);
      addToast('تم حفظ نص البانر', 'success');
    } catch {
      addToast('حدث خطأ', 'error');
    }
  };

  const handleHoursChange = (day: DayKey, field: keyof DayHours, value: string | boolean) => {
    setHours((prev) => {
      const dayData = prev[day] ?? { ...DEFAULT_DAY };
      return { ...prev, [day]: { ...dayData, [field]: value } };
    });
  };

  const handleSaveHours = async () => {
    try {
      await api.updateOperationalSettingsApi(tenantId, { businessHours: hours });
      queryClient.invalidateQueries({ queryKey: ['tenant-by-id', tenantId] });
      broadcastTenantUpdate(tenantId);
      addToast('تم حفظ أوقات العمل', 'success');
    } catch {
      addToast('حدث خطأ', 'error');
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    if (!currentPassword.trim()) {
      setPasswordError('أدخل كلمة المرور الحالية');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`كلمة المرور الجديدة يجب أن تكون ${MIN_PASSWORD_LENGTH} أحرف على الأقل`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('كلمة المرور الجديدة وتأكيدها غير متطابقتين');
      return;
    }
    try {
      await api.changePassword(currentPassword, newPassword);
      addToast('تم تغيير كلمة المرور بنجاح', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      addToast('فشل تغيير كلمة المرور — تحقق من كلمة المرور الحالية', 'error');
    }
  };

  if (isLoading || !tenant) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const handleSaveStoreName = async () => {
    const trimmed = storeName.trim();
    if (trimmed.length === 0) {
      addToast('اسم المتجر لا يمكن أن يكون فارغاً', 'error');
      return;
    }
    if (trimmed.length > 50) {
      addToast('اسم المتجر يجب أن يكون 50 حرفاً أو أقل', 'error');
      return;
    }
    try {
      await api.updateOperationalSettingsApi(tenantId, { name: trimmed });
      queryClient.invalidateQueries({ queryKey: ['tenant-by-id', tenantId] });
      broadcastTenantUpdate(tenantId);
      addToast('تم حفظ اسم المتجر', 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'حدث خطأ', 'error');
    }
  };

  const [deleteStoreModalOpen, setDeleteStoreModalOpen] = useState(false);
  const handleDeleteStore = async () => {
    if (!tenantId) return;
    try {
      await api.deleteTenant(tenantId);
      queryClient.invalidateQueries({ queryKey: ['tenant-by-id'] });
      addToast('تم حذف المتجر وجميع بياناته', 'success');
      setDeleteStoreModalOpen(false);
      navigate('/login', { replace: true });
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'فشل حذف المتجر', 'error');
    }
  };

  const tenantBranding = tenant && typeof (tenant as { branding?: { primaryColor?: string; secondaryColor?: string } }).branding === 'object'
    ? (tenant as { branding?: { primaryColor?: string; secondaryColor?: string; logoUrl?: string } }).branding
    : null;

  return (
    <div className="space-y-8 pb-10">
      <h1 className="text-2xl font-bold text-gray-900">إعدادات المحل</h1>

      {/* Row 1: حالة التشغيل (Operation Status) — full width at top */}
      <Card className="p-6 bg-white">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-gray-600" />
          <h2 className="font-semibold text-gray-900">حالة التشغيل</h2>
        </div>
        <div className="space-y-6">
          <div>
            <p className="text-sm text-gray-600 mb-3">الحالة الحالية (تجاوز يدوي)</p>
            <div className="flex flex-wrap gap-4">
              <button
                type="button"
                onClick={() => handleStatusOverride('open')}
                className={`flex-1 min-w-[140px] min-h-[88px] flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 transition-all cursor-pointer touch-manipulation select-none shadow-sm hover:shadow ${
                  operationalStatus === 'open'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-200 shadow-emerald-100'
                    : 'bg-white border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                }`}
              >
                <CheckCircle className="w-12 h-12 shrink-0" />
                <span className="font-bold text-base">مفتوح</span>
              </button>
              <button
                type="button"
                onClick={() => handleStatusOverride('busy')}
                className={`flex-1 min-w-[140px] min-h-[88px] flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 transition-all cursor-pointer touch-manipulation select-none shadow-sm hover:shadow ${
                  operationalStatus === 'busy'
                    ? 'bg-amber-50 border-amber-500 text-amber-700 ring-2 ring-amber-200 shadow-amber-100'
                    : 'bg-white border-gray-200 hover:border-amber-300 hover:bg-amber-50/50'
                }`}
              >
                <AlertCircle className="w-12 h-12 shrink-0" />
                <span className="font-bold text-base">مشغول</span>
              </button>
              <button
                type="button"
                onClick={() => handleStatusOverride('closed')}
                className={`flex-1 min-w-[140px] min-h-[88px] flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 transition-all cursor-pointer touch-manipulation select-none shadow-sm hover:shadow ${
                  operationalStatus === 'closed'
                    ? 'bg-red-50 border-red-500 text-red-700 ring-2 ring-red-200 shadow-red-100'
                    : 'bg-white border-gray-200 hover:border-red-300 hover:bg-red-50/50'
                }`}
              >
                <XCircle className="w-12 h-12 shrink-0" />
                <span className="font-bold text-base">مغلق</span>
              </button>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">سياسة استقبال الطلبات</p>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="orderPolicy"
                  checked={orderPolicy === 'accept_only_when_open'}
                  onChange={() => handleOrderPolicyChange('accept_only_when_open')}
                />
                <span>قبول الطلبات فقط عند الفتح</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="orderPolicy"
                  checked={orderPolicy === 'accept_always'}
                  onChange={() => handleOrderPolicyChange('accept_always')}
                />
                <span>قبول الطلبات دائماً</span>
              </label>
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input
                type="checkbox"
                checked={busyBannerEnabled}
                onChange={(e) => handleBusyBannerToggle(e.target.checked)}
              />
              <span>عرض بانر مخصص للعملاء عند حالة "مشغول"</span>
            </label>
            {busyBannerEnabled && (
              <div className="flex gap-2 mt-2">
                <Input
                  value={busyBannerText}
                  onChange={(e) => setBusyBannerText(e.target.value)}
                  placeholder="المحل مشغول حالياً، قد يستغرق الطلب وقتاً أطول"
                  className="flex-1"
                />
                <Button onClick={handleBusyBannerTextSave}>حفظ النص</Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Row 2: 2-column grid — هوية المتجر + الهوية البصرية */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Card A: هوية المتجر (Store Identity) */}
      <Card className="p-6 bg-white">
        <div className="flex items-center gap-2 mb-4">
          <Store className="w-5 h-5 text-gray-600" />
          <h2 className="font-semibold text-gray-900">هوية المتجر</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">اسم المتجر / المكتب</label>
            <div className="flex gap-2 max-w-md">
              <Input
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="مثال: مكتب المحامي فلان"
                maxLength={51}
                className="flex-1"
              />
              <Button onClick={handleSaveStoreName}>حفظ</Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">الحد الأقصى 50 حرفاً. سيظهر في الهيدر وصفحة السوق.</p>
          </div>
          {isProfessional && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نبذة عن المكتب (الوصف)</label>
                <textarea
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  placeholder="اكتب وصفاً لمكتبك وخدماتك..."
                  rows={5}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  dir="rtl"
                />
                <p className="text-xs text-gray-500 mt-1">يدعم HTML (مثال: &lt;p&gt;نص&lt;/p&gt;)</p>
                <Button className="mt-3" onClick={async () => {
                  try {
                    await api.updateOperationalSettingsApi(tenantId, { about });
                    queryClient.invalidateQueries({ queryKey: ['tenant-by-id', tenantId] });
                    broadcastTenantUpdate(tenantId);
                    addToast('تم حفظ النبذة', 'success');
                  } catch { addToast('حدث خطأ', 'error'); }
                }}>
                  حفظ النبذة
                </Button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهاتف / واتساب</label>
                <p className="text-sm text-gray-500 mb-2">يُستخدم للزرين: اتصال هاتفي وتواصل واتساب</p>
                <div className="flex gap-2 max-w-md">
                  <Input
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="972501234567"
                    dir="ltr"
                  />
                  <Button
                    onClick={async () => {
                      try {
                        await api.updateOperationalSettingsApi(tenantId, { whatsappPhone: contactPhone.replace(/\D/g, ''), phone: contactPhone.replace(/\D/g, '') });
                        queryClient.invalidateQueries({ queryKey: ['tenant-by-id', tenantId] });
                        broadcastTenantUpdate(tenantId);
                        addToast('تم حفظ رقم الهاتف', 'success');
                      } catch { addToast('حدث خطأ', 'error'); }
                    }}
                  >
                    حفظ
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Card B: الهوية البصرية (Branding) */}
      <Card className="p-6 bg-white">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="w-5 h-5 text-gray-600" />
          <h2 className="font-semibold text-gray-900">الهوية البصرية</h2>
        </div>
        {tenantBranding && (tenantBranding.primaryColor || tenantBranding.secondaryColor || tenantBranding.logoUrl) ? (
          <div className="space-y-2 text-sm">
            {tenantBranding.primaryColor && (
              <p><span className="text-gray-500">اللون الأساسي:</span> <span className="font-mono" style={{ color: tenantBranding.primaryColor }}>{tenantBranding.primaryColor}</span></p>
            )}
            {tenantBranding.secondaryColor && (
              <p><span className="text-gray-500">اللون الثانوي:</span> <span className="font-mono" style={{ color: tenantBranding.secondaryColor }}>{tenantBranding.secondaryColor}</span></p>
            )}
            {tenantBranding.logoUrl && <p><span className="text-gray-500">الشعار:</span> <a href={tenantBranding.logoUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">عرض</a></p>}
            <p className="text-gray-500 mt-2">إدارة الشعار والألوان تتم من لوحة الإدارة الرئيسية إن لزم.</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">إدارة الشعار والألوان تتم من لوحة الإدارة الرئيسية.</p>
        )}
      </Card>
      </div>

      {/* Row 3: ساعات العمل (Business Hours) — full width */}
      <Card className="p-6 bg-white">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-gray-600" />
          <h2 className="font-semibold text-gray-900">ساعات العمل</h2>
        </div>
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <div className="inline-block min-w-[420px]">
              {/* Grid header */}
              <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-center pb-2 mb-2 border-b border-gray-200">
                <span className="font-semibold text-gray-700">اليوم</span>
                <span className="font-semibold text-gray-700">وقت الفتح</span>
                <span className="font-semibold text-gray-700">وقت الإغلاق</span>
                <span className="font-semibold text-gray-700 text-sm">يوم إجازة</span>
              </div>
              {DAY_ORDER.map((day) => {
                const d = hours[day] ?? DEFAULT_DAY;
                return (
                  <div
                    key={day}
                    className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 items-center py-2 border-b border-gray-100 last:border-0"
                  >
                    <span className="font-medium text-gray-700">{DAY_LABELS[day]}</span>
                    {d.isClosedDay ? (
                      <span className="text-gray-400 text-sm">—</span>
                    ) : (
                      <Input
                        type="time"
                        value={d.open}
                        onChange={(e) => handleHoursChange(day, 'open', e.target.value)}
                        className="w-full min-w-[120px] px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    )}
                    {d.isClosedDay ? (
                      <span className="text-gray-400 text-sm">—</span>
                    ) : (
                      <Input
                        type="time"
                        value={d.close}
                        onChange={(e) => handleHoursChange(day, 'close', e.target.value)}
                        className="w-full min-w-[120px] px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                      />
                    )}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={d.isClosedDay}
                        onChange={(e) => handleHoursChange(day, 'isClosedDay', e.target.checked)}
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-gray-600">إجازة</span>
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
          <Button onClick={handleSaveHours} className="mt-4 min-h-[44px] px-6 font-semibold">
            حفظ أوقات العمل
          </Button>
          {isProfessional && (
            <div className="pt-4 border-t border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-2">ساعات العمل (نص حر — للعرض)</label>
              <Input
                value={officeHours}
                onChange={(e) => setOfficeHours(e.target.value)}
                placeholder="مثال: الأحد–الخميس: 09:00–17:00 | الجمعة–السبت: مغلق"
                className="w-full"
              />
              <Button className="mt-3" onClick={async () => {
                try {
                  await api.updateOperationalSettingsApi(tenantId, { officeHours });
                  queryClient.invalidateQueries({ queryKey: ['tenant-by-id', tenantId] });
                  broadcastTenantUpdate(tenantId);
                  addToast('تم حفظ ساعات العمل', 'success');
                } catch { addToast('حدث خطأ', 'error'); }
              }}>
                حفظ ساعات العمل
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Row 4: إعدادات إضافية then Danger Zone */}
      {/* Card E: إعدادات إضافية (Links & Logistics) */}
      <Card className="p-6 bg-white">
        <div className="flex items-center gap-2 mb-4">
          <Link2 className="w-5 h-5 text-gray-600" />
          <h2 className="font-semibold text-gray-900">إعدادات إضافية</h2>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-500 mb-2">مناطق التوصيل والإعدادات اللوجستية</p>
            <Link to="/settings/delivery" className="inline-flex items-center gap-2 text-primary font-medium hover:underline">
              <Truck className="w-4 h-4" />
              إعدادات التوصيل
            </Link>
          </div>
          {isProfessional && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">الحجز أونلاين (قريباً)</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bookingEnabled}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    api.updateOperationalSettingsApi(tenantId, { bookingEnabled: checked }).then(() => {
                      queryClient.invalidateQueries({ queryKey: ['tenant-by-id', tenantId] });
                      broadcastTenantUpdate(tenantId);
                      addToast(checked ? 'تم تفعيل الحجز أونلاين (قريباً)' : 'تم إيقاف الحجز أونلاين', 'success');
                    }).catch(() => addToast('حدث خطأ', 'error'));
                  }}
                />
                <span>تفعيل الحجز أونلاين (قريباً)</span>
              </label>
              <p className="text-sm text-gray-500 mt-2">هذه الميزة قيد التطوير وسيتم تفعيلها قريباً.</p>
            </div>
          )}
          {MOCK_API_URL && (
            <div className="pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-gray-600" />
                <span className="font-medium text-gray-900">الأمان</span>
              </div>
              <p className="text-sm text-gray-500 mb-4">غيّر كلمة المرور الخاصة بك. لا يوجد استعادة عبر البريد — إدارة كلمة المرور تتم داخلياً.</p>
              <div className="space-y-4 max-w-md">
                <Input
                  type="password"
                  label="كلمة المرور الحالية"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <Input
                  type="password"
                  label="كلمة المرور الجديدة"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={`${MIN_PASSWORD_LENGTH} أحرف على الأقل`}
                  autoComplete="new-password"
                />
                <Input
                  type="password"
                  label="تأكيد كلمة المرور الجديدة"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
                <Button onClick={handleChangePassword}>حفظ كلمة المرور الجديدة</Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Danger Zone (Row 4) */}
      <Card className="p-6 bg-white border-red-200">
        <div className="flex items-center gap-2 mb-2">
          <Trash2 className="w-5 h-5 text-red-600" />
          <h2 className="font-semibold text-red-700">منطقة الخطر</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          حذف المتجر نهائياً مع كل بياناته (الطلبات، المنتجات، الإعدادات). لا يمكن التراجع عن هذا الإجراء.
        </p>
        <Button
          variant="outline"
          className="border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700 gap-2"
          onClick={() => setDeleteStoreModalOpen(true)}
        >
          <Trash2 className="w-4 h-4" />
          حذف المتجر
        </Button>
      </Card>

      {/* Delete Store Confirmation Modal */}
      {deleteStoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">حذف المتجر</h3>
            <p className="text-sm text-gray-700 mb-6">
              سيتم حذف المتجر وجميع بياناته نهائياً (الطلبات، المنتجات، الإعدادات). لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setDeleteStoreModalOpen(false)}>إلغاء</Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDeleteStore}>
                حذف نهائياً
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
