import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button, Input, useToast, Card } from '@nmd/ui';
import { ArrowLeft, User, Bell, Wifi, WifiOff } from 'lucide-react';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import { useGlobalAuthModal } from '../contexts/GlobalAuthModalContext';
import { useCustomerNotification } from '../contexts/CustomerNotificationContext';
import { isNativeAppUA, getBridgeDebugMessage } from '../lib/fcm-bridge';

function formatFCMLastSync(d: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return 'الآن';
  if (diff < 3600) return `منذ ${Math.floor(diff / 60)} د`;
  if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} س`;
  return d.toLocaleDateString('ar-SA');
}

export default function MyAccountPage() {
  const { pathname } = useLocation();
  const { customer, isLoading: authLoading, updateProfile, logout } = useCustomerAuth();
  const { openAuthModal } = useGlobalAuthModal();
  const { addToast } = useToast();
  const notification = useCustomerNotification();
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (customer) {
      setFullName(customer.name ?? '');
    }
  }, [customer]);

  const handleSave = async () => {
    if (!customer) return;
    setSaving(true);
    const result = await updateProfile(fullName.trim());
    setSaving(false);
    if (result.ok) {
      addToast('تم تحديث البيانات بنجاح', 'success');
    } else {
      addToast(result.error ?? 'فشل الحفظ', 'error');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center" dir="rtl">
        <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center" dir="rtl">
        <h1 className="text-xl font-semibold text-gray-900 mb-4">حسابي</h1>
        <p className="text-gray-600 mb-6">سجّل الدخول لتعديل بياناتك</p>
        <Button onClick={() => openAuthModal()}>تسجيل الدخول</Button>
      </div>
    );
  }

  const isMarketLevel = pathname === '/my-account';
  const backHref = isMarketLevel ? '/' : pathname.replace(/\/my-account\/?$/, '') || '/';

  return (
    <div className="max-w-xl mx-auto p-4 pt-6 bg-white min-h-full" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">حسابي</h1>
        <Link
          to={backHref}
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          العودة
        </Link>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white overflow-hidden mb-6">
        <div className="px-4 py-3 bg-white border-b border-gray-200 flex items-center gap-2">
          <User className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-gray-900">الملف الشخصي</h2>
        </div>
        <div className="p-4 space-y-4">
          <Input
            label="الاسم الكامل"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="أدخل اسمك الكامل"
            className="w-full"
          />
          <Input
            label="رقم الهاتف"
            value={customer.phone}
            disabled
            readOnly
            className="w-full bg-white"
          />
          <p className="text-xs text-gray-500">رقم الهاتف هو مفتاح الدخول ولا يمكن تغييره من هنا.</p>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </Button>
        </div>
      </section>

      {notification && (
        <Card className="p-4 mb-6 bg-white" dir="rtl">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-5 h-5 text-gray-600" />
            <h2 className="font-semibold text-gray-900">إشعارات الطلبات — تشخيص</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-white border border-gray-200">
              <span className="text-gray-700">حالة الجسر (Native Bridge)</span>
              {notification.fcmBridgeStatus === 'present' ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-700 font-medium">
                  <Wifi className="w-4 h-4" /> متصل
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium">
                  <WifiOff className="w-4 h-4" /> غير متاح
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-white border border-gray-200">
              <span className="text-gray-700">رمز FCM</span>
              <span className="font-medium">
                {notification.fcmTokenStatus === 'found' ? 'تم الاستلام' : notification.fcmTokenStatus === 'not-found' ? 'لم يُستلم' : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-white border border-gray-200">
              <span className="text-gray-700">آخر مزامنة</span>
              <span className="font-medium">{notification.fcmLastSyncTime ? formatFCMLastSync(notification.fcmLastSyncTime) : '—'}</span>
            </div>
            {(() => {
              const bridgeDebug = getBridgeDebugMessage();
              const reason =
                bridgeDebug
                  ? `${bridgeDebug} (التطبيق الأصلي يعمل لكن حقن الجسر فشل)`
                  : notification.fcmBridgeStatus === 'missing'
                    ? isNativeAppUA()
                      ? 'التطبيق الأصلي يعمل لكن الجسر غير جاهز بعد — جرّب "إعادة فحص الجسر" أو "إعادة ربط الجهاز".'
                      : 'التطبيق الأصلي غير متاح (افتح التطبيق من الهاتف وليس المتصفح).'
                    : notification.fcmLastError
                    ? notification.fcmLastError.includes('401')
                      ? 'تم رفض الدخول (سجّل الدخول من جديد).'
                      : notification.fcmLastError.includes('timeout')
                        ? 'انتهت المهلة — جرّب إعادة الربط.'
                        : `خطأ الخادم أو Firebase: ${notification.fcmLastError}`
                    : notification.fcmTokenStatus === 'not-found'
                      ? 'لم يُستلم رمز FCM — تحقق من إذن الإشعارات أو خدمة Firebase.'
                      : null;
              return reason ? (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  <span className="font-medium">سبب التعطيل: </span>
                  <span>{reason}</span>
                </div>
              ) : null;
            })()}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={notification.refreshBridgeStatus}>
                إعادة فحص الجسر
              </Button>
              <Button variant="outline" size="sm" onClick={notification.registerFCMTokenManual}>
                إعادة ربط الجهاز بالإشعارات
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Link
        to="/my-activity"
        className="block text-center py-3 text-primary hover:underline font-medium"
      >
        عرض نشاطي (طلباتي وتواصلي)
      </Link>

      <div className="mt-6 pt-4 border-t border-gray-200">
        <Button
          variant="outline"
          className="w-full text-gray-600 hover:bg-white hover:border-neutral-300"
          onClick={() => logout()}
        >
          تسجيل الخروج
        </Button>
      </div>
    </div>
  );
}
