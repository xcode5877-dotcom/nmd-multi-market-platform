import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Button, Input, useToast } from '@nmd/ui';
import { CreditCard, Clock, LayoutGrid, Send } from 'lucide-react';
import { apiHeaders } from '../api';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

export default function SystemSettingsPage() {
  const { addToast } = useToast();
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastSending, setBroadcastSending] = useState(false);

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
