import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Button, Input, useToast } from '@nmd/ui';
import { CreditCard, Clock, LayoutGrid, Send, Percent } from 'lucide-react';
import { apiFetch, apiHeaders } from '../api';
import PlatformFeeDisabledBanner from '../components/platform-fee/PlatformFeeDisabledBanner';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

export default function SystemSettingsPage() {
  const { addToast } = useToast();
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [globalCardEnabled, setGlobalCardEnabled] = useState(true);
  const [globalInstallmentsEnabled, setGlobalInstallmentsEnabled] = useState(true);
  const [globalPaymentLoading, setGlobalPaymentLoading] = useState(true);
  const [globalPaymentSaving, setGlobalPaymentSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch<{ paymentMethods?: { card?: boolean; installments?: boolean } }>('/config/payment-methods');
        setGlobalCardEnabled(res.paymentMethods?.card !== false);
        setGlobalInstallmentsEnabled(res.paymentMethods?.installments !== false);
      } catch {
        addToast('تعذّر تحميل إعدادات الدفع العامة', 'error');
      } finally {
        setGlobalPaymentLoading(false);
      }
    };
    void load();
  }, [addToast]);

  const saveGlobalPayments = async () => {
    setGlobalPaymentSaving(true);
    try {
      await apiFetch('/config/payment-methods', {
        method: 'PUT',
        body: JSON.stringify({
          paymentMethods: {
            card: globalCardEnabled,
            installments: globalInstallmentsEnabled,
          },
        }),
      });
      addToast('تم حفظ إعدادات الدفع العامة', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'فشل حفظ إعدادات الدفع', 'error');
    } finally {
      setGlobalPaymentSaving(false);
    }
  };

  const sendBroadcast = async () => {
    const title = broadcastTitle.trim();
    const body = broadcastBody.trim();
    if (!title && !body) {
      addToast('أدخل العنوان أو النص', 'error');
      return;
    }
    if (!MOCK_API_URL) {
      addToast('API غير متاح', 'error');
      return;
    }
    setBroadcastSending(true);
    try {
      const res = await fetch(`${MOCK_API_URL}/admin/broadcast`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ title: title || 'إشعار', body: body || '' }),
      });
      const data = (await res.json().catch(() => ({}))) as { sent?: number; message?: string };
      if (!res.ok) {
        addToast((data as { error?: string }).error ?? `خطأ: ${res.status}`, 'error');
        return;
      }
      addToast(`تم الإرسال إلى ${data.sent ?? 0} عميل`, 'success');
      setBroadcastTitle('');
      setBroadcastBody('');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'فشل الإرسال', 'error');
    } finally {
      setBroadcastSending(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">إعدادات النظام</h1>
      <div className="space-y-3">
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Send className="w-5 h-5 text-gray-600" />
            <h2 className="font-semibold text-gray-900">إشعار للجميع (FCM)</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">إرسال إشعار push لجميع العملاء الذين لديهم تطبيق العميل (رمز FCM مسجّل).</p>
          <div className="flex flex-col gap-3 max-w-md">
            <Input label="العنوان" value={broadcastTitle} onChange={(e) => setBroadcastTitle(e.target.value)} placeholder="عنوان الإشعار" />
            <Input label="النص" value={broadcastBody} onChange={(e) => setBroadcastBody(e.target.value)} placeholder="نص الإشعار" />
            <Button onClick={sendBroadcast} disabled={broadcastSending} leftIcon={<Send className="w-4 h-4" />}>
              {broadcastSending ? 'جاري الإرسال...' : 'إرسال إشعار للجميع'}
            </Button>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <div className="font-medium text-gray-900">تحكم عام بالدفع</div>
              <div className="text-sm text-gray-500">Kill-Switch شامل لكل المنصة (بطاقة / أقساط)</div>
            </div>
            <Button size="sm" onClick={saveGlobalPayments} disabled={globalPaymentLoading || globalPaymentSaving}>
              {globalPaymentSaving ? 'جاري الحفظ...' : 'حفظ'}
            </Button>
          </div>
          <div className="grid gap-3 mb-4">
            <label className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm font-medium text-gray-900">تفعيل الدفع بالبطاقة عالميًا</span>
              <input type="checkbox" checked={globalCardEnabled} onChange={(e) => setGlobalCardEnabled(e.target.checked)} disabled={globalPaymentLoading} className="h-4 w-4" />
            </label>
            <label className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm font-medium text-gray-900">تفعيل الأقساط عالميًا</span>
              <input type="checkbox" checked={globalInstallmentsEnabled} onChange={(e) => setGlobalInstallmentsEnabled(e.target.checked)} disabled={globalPaymentLoading} className="h-4 w-4" />
            </label>
          </div>
          <Link
            to="/settings/payments"
            className="flex items-center gap-3 p-4 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <CreditCard className="w-5 h-5 text-gray-600" />
            <div>
              <div className="font-medium text-gray-900">المدفوعات</div>
              <div className="text-sm text-gray-500">طرق الدفع والبوابات</div>
            </div>
          </Link>
        </Card>
        <Card className="p-6">
          <PlatformFeeDisabledBanner />
          <div className="flex items-start gap-3">
            <Percent className="w-5 h-5 text-teal-600 mt-0.5" />
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900 mb-1">رسوم منصة Now Market</h2>
              <p className="text-sm text-gray-500 mb-3">
                الإعداد الافتراضي يُحدَّد لكل سوق على حدة. يمكن تجاوزه لمتجر معيّن من صفحة تفاصيل المتجر.
              </p>
              <Link
                to="/markets"
                className="inline-flex items-center text-sm font-medium text-primary hover:underline"
              >
                اذهب إلى الأسواق ← رسوم المنصة
              </Link>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <Link
            to="/settings/category-policies"
            className="flex items-center gap-3 p-4 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Clock className="w-5 h-5 text-gray-600" />
            <div>
              <div className="font-medium text-gray-900">سياسات SLA (التصنيفات)</div>
              <div className="text-sm text-gray-500">أخضر / برتقالي / أحمر (دقائق) لكل تصنيف — لوحة الطلبات وتطبيق السائق</div>
            </div>
          </Link>
        </Card>
        <Card className="p-6">
          <Link
            to="/settings/home-layout"
            className="flex items-center gap-3 p-4 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <LayoutGrid className="w-5 h-5 text-gray-600" />
            <div>
              <div className="font-medium text-gray-900">ترتيب الصفحة الرئيسية</div>
              <div className="text-sm text-gray-500">اسحب المتاجر لترتيب ظهورها في تطبيق العميل</div>
            </div>
          </Link>
        </Card>
      </div>
    </div>
  );
}
