import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button, Input, useToast, Card, ConfirmDialog } from '@nmd/ui';
import { ArrowLeft, User, Bell, Wifi, WifiOff, Coins } from 'lucide-react';
import { useCustomerAuth } from '../contexts/CustomerAuthContext';
import { useCoins } from '../hooks/useCoins';
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
  const { customer, isLoading: authLoading, updateProfile, logout, deleteAccount } = useCustomerAuth();
  const { nowCoins } = useCoins();
  const { openAuthModal } = useGlobalAuthModal();
  const { addToast } = useToast();
  const notification = useCustomerNotification();
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
        <h1 className="text-xl font-semibold" style={{ color: '#0f766e' }}>حسابي</h1>
        <Link
          to={backHref}
          className="flex items-center gap-1 text-sm hover:underline"
          style={{ color: '#14b8a6' }}
        >
          <ArrowLeft className="w-4 h-4" />
          العودة
        </Link>
      </div>

      {/* Gamification: Now Coins — heart of community rewards */}
      <section
        className="rounded-2xl border-2 mb-6 overflow-hidden shadow-sm"
        style={{ borderColor: '#0f766e', backgroundColor: '#ffffff' }}
        aria-label="رصيد العملات"
      >
        <div
          className="px-4 py-4 flex items-center justify-between gap-3"
          style={{ background: 'linear-gradient(135deg, rgba(15,118,110,0.08) 0%, #ffffff 100%)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: '#0f766e', color: '#ffffff' }}
            >
              <Coins className="w-6 h-6" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#14b8a6' }}>
                عملاتك الآن
              </p>
              <p className="text-2xl font-bold tabular-nums" style={{ color: '#0f766e' }}>
                {nowCoins.toLocaleString('ar-SA')}
                <span className="text-base font-semibold ms-1">عملة</span>
              </p>
            </div>
          </div>
        </div>
        <p className="px-4 pb-3 text-xs leading-relaxed" style={{ color: '#0a0a0a' }}>
          اجمع العملات من الطلبات والفعاليات المجتمعية واستخدمها في العروض والمكافآت.
        </p>
      </section>

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

      <div className="mt-6 pt-4 border-t border-gray-200 space-y-3">
        <Button
          variant="outline"
          className="w-full text-gray-600 hover:bg-white hover:border-neutral-300"
          onClick={() => logout()}
        >
          تسجيل الخروج
        </Button>
        <Button
          variant="outline"
          className="w-full border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300"
          onClick={() => setDeleteDialogOpen(true)}
        >
          حذف الحساب
        </Button>
        <p className="text-xs text-gray-500 text-center leading-relaxed">
          حذف الحساب يزيل بياناتك من التطبيق بشكل دائم وفق متطلبات Apple.
        </p>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => !deleteLoading && setDeleteDialogOpen(false)}
        title="حذف الحساب نهائياً؟"
        message="سيتم حذف حسابك وبيانات الملف الشخصي من الخادم. لا يمكن التراجع عن هذا الإجراء."
        confirmLabel="حذف نهائي"
        cancelLabel="إلغاء"
        variant="danger"
        loading={deleteLoading}
        closeOnConfirm={false}
        onConfirm={async () => {
          setDeleteLoading(true);
          const result = await deleteAccount();
          setDeleteLoading(false);
          if (result.ok) {
            setDeleteDialogOpen(false);
            addToast('تم حذف حسابك', 'success');
          } else {
            addToast(result.error ?? 'تعذّر حذف الحساب', 'error');
          }
        }}
      />
    </div>
  );
}
