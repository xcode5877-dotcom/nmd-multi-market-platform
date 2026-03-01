import { useState, useEffect } from 'react';
import type { DayKey, BusinessHours, DayHours } from '@nmd/core';
import { Card, Button, Input, useToast } from '@nmd/ui';
import { useAdminContext } from '../context/AdminContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import { Clock, CheckCircle, AlertCircle, XCircle, Shield } from 'lucide-react';

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
  const queryClient = useQueryClient();
  const addToast = useToast().addToast;

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant-by-id', tenantId],
    queryFn: () => api.getTenant(tenantId) as Promise<{ operationalStatus?: string; orderPolicy?: string; businessHours?: BusinessHours; busyBannerEnabled?: boolean; busyBannerText?: string } | null>,
    enabled: !!tenantId,
  });

  const [busyBannerText, setBusyBannerText] = useState('المحل مشغول حالياً، قد يستغرق الطلب وقتاً أطول');
  const [hours, setHours] = useState<BusinessHours>(() => defaultBusinessHours());
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    if (tenant) {
      setBusyBannerText(tenant.busyBannerText ?? 'المحل مشغول حالياً، قد يستغرق الطلب وقتاً أطول');
      const bh = tenant.businessHours;
      setHours(bh && Object.keys(bh).length > 0 ? { ...defaultBusinessHours(), ...bh } : defaultBusinessHours());
    }
  }, [tenant]);

  const operationalStatus = (tenant?.operationalStatus as 'open' | 'closed' | 'busy') ?? 'open';
  const orderPolicy = (tenant?.orderPolicy as 'accept_always' | 'accept_only_when_open') ?? 'accept_only_when_open';
  const busyBannerEnabled = tenant?.busyBannerEnabled ?? false;

  const handleStatusOverride = async (status: 'open' | 'closed' | 'busy') => {
    try {
      await api.updateOperationalSettingsApi(tenantId, { operationalStatus: status });
      queryClient.invalidateQueries({ queryKey: ['tenant-by-id', tenantId] });
      addToast(`تم تعيين الحالة: ${status === 'open' ? 'مفتوح' : status === 'busy' ? 'مشغول' : 'مغلق'}`, 'success');
    } catch {
      addToast('حدث خطأ', 'error');
    }
  };

  const handleOrderPolicyChange = async (policy: 'accept_always' | 'accept_only_when_open') => {
    try {
      await api.updateOperationalSettingsApi(tenantId, { orderPolicy: policy });
      queryClient.invalidateQueries({ queryKey: ['tenant-by-id', tenantId] });
      addToast('تم تحديث سياسة الطلبات', 'success');
    } catch {
      addToast('حدث خطأ', 'error');
    }
  };

  const handleBusyBannerToggle = async (enabled: boolean) => {
    try {
      await api.updateOperationalSettingsApi(tenantId, { busyBannerEnabled: enabled });
      queryClient.invalidateQueries({ queryKey: ['tenant-by-id', tenantId] });
      addToast(enabled ? 'تم تفعيل بانر المشغولية' : 'تم إيقاف بانر المشغولية', 'success');
    } catch {
      addToast('حدث خطأ', 'error');
    }
  };

  const handleBusyBannerTextSave = async () => {
    try {
      await api.updateOperationalSettingsApi(tenantId, { busyBannerText });
      queryClient.invalidateQueries({ queryKey: ['tenant-by-id', tenantId] });
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

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">إعدادات المحل</h1>

      {/* Manual Override - 3 Big Buttons */}
      <Card className="p-6">
        <h2 className="font-semibold text-gray-900 mb-4">الحالة الحالية (تجاوز يدوي)</h2>
        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            onClick={() => handleStatusOverride('open')}
            className={`flex-1 min-w-[120px] flex flex-col items-center gap-2 p-6 rounded-xl border-2 transition-all ${
              operationalStatus === 'open'
                ? 'bg-emerald-50 border-emerald-500 text-emerald-700 ring-2 ring-emerald-200'
                : 'bg-white border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50'
            }`}
          >
            <CheckCircle className="w-10 h-10" />
            <span className="font-bold">مفتوح</span>
          </button>
          <button
            type="button"
            onClick={() => handleStatusOverride('busy')}
            className={`flex-1 min-w-[120px] flex flex-col items-center gap-2 p-6 rounded-xl border-2 transition-all ${
              operationalStatus === 'busy'
                ? 'bg-amber-50 border-amber-500 text-amber-700 ring-2 ring-amber-200'
                : 'bg-white border-gray-200 hover:border-amber-300 hover:bg-amber-50/50'
            }`}
          >
            <AlertCircle className="w-10 h-10" />
            <span className="font-bold">مشغول</span>
          </button>
          <button
            type="button"
            onClick={() => handleStatusOverride('closed')}
            className={`flex-1 min-w-[120px] flex flex-col items-center gap-2 p-6 rounded-xl border-2 transition-all ${
              operationalStatus === 'closed'
                ? 'bg-red-50 border-red-500 text-red-700 ring-2 ring-red-200'
                : 'bg-white border-gray-200 hover:border-red-300 hover:bg-red-50/50'
            }`}
          >
            <XCircle className="w-10 h-10" />
            <span className="font-bold">مغلق</span>
          </button>
        </div>
      </Card>

      {/* Business Hours */}
      <Card className="p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          أوقات العمل
        </h2>
        <div className="space-y-3 max-w-xl">
          {DAY_ORDER.map((day) => {
            const d = hours[day] ?? DEFAULT_DAY;
            return (
              <div key={day} className="flex items-center gap-4 flex-wrap">
                <span className="w-24 font-medium text-gray-700">{DAY_LABELS[day]}</span>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={d.isClosedDay}
                    onChange={(e) => handleHoursChange(day, 'isClosedDay', e.target.checked)}
                  />
                  <span className="text-sm text-gray-600">يوم إجازة</span>
                </label>
                {!d.isClosedDay && (
                  <>
                    <Input
                      type="time"
                      value={d.open}
                      onChange={(e) => handleHoursChange(day, 'open', e.target.value)}
                      className="w-28"
                    />
                    <span className="text-gray-500">–</span>
                    <Input
                      type="time"
                      value={d.close}
                      onChange={(e) => handleHoursChange(day, 'close', e.target.value)}
                      className="w-28"
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
        <Button className="mt-4" onClick={handleSaveHours}>
          حفظ أوقات العمل
        </Button>
      </Card>

      {/* Order Policy */}
      <Card className="p-6">
        <h2 className="font-semibold text-gray-900 mb-4">سياسة استقبال الطلبات</h2>
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
      </Card>

      {/* Security - Change Password */}
      {MOCK_API_URL && (
        <Card className="p-6">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            الأمان
          </h2>
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
        </Card>
      )}

      {/* Busy Banner Toggle */}
      <Card className="p-6">
        <h2 className="font-semibold text-gray-900 mb-4">بانر المشغولية للعملاء</h2>
        <label className="flex items-center gap-2 cursor-pointer mb-4">
          <input
            type="checkbox"
            checked={busyBannerEnabled}
            onChange={(e) => handleBusyBannerToggle(e.target.checked)}
          />
          <span>عرض بانر مخصص للعملاء عند حالة "مشغول"</span>
        </label>
        {busyBannerEnabled && (
          <div className="flex gap-2">
            <Input
              value={busyBannerText}
              onChange={(e) => setBusyBannerText(e.target.value)}
              placeholder="المحل مشغول حالياً، قد يستغرق الطلب وقتاً أطول"
              className="flex-1"
            />
            <Button onClick={handleBusyBannerTextSave}>حفظ النص</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
