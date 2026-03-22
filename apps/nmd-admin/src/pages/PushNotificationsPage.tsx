import { useState } from 'react';
import { Card, Button, Input, useToast, ConfirmDialog } from '@nmd/ui';
import { apiFetch } from '../api';
import { Send, User } from 'lucide-react';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

type TargetAudience = 'all' | 'specific';

export default function PushNotificationsPage() {
  const { addToast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState<TargetAudience>('all');
  const [customerId, setCustomerId] = useState('');
  const [broadcastConfirmOpen, setBroadcastConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const doSendBroadcast = async () => {
    setSending(true);
    try {
      const data = await apiFetch<{ sent?: number; failed?: number; totalTokens?: number }>('/admin/notifications/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim() || 'إشعار',
          body: body.trim() || '',
        }),
      });
      const sent = data?.sent ?? 0;
      const failed = data?.failed ?? 0;
      addToast(`تم الإرسال إلى ${sent} جهاز${failed > 0 ? ` (فشل: ${failed})` : ''}`, 'success');
      setBroadcastConfirmOpen(false);
      setTitle('');
      setBody('');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'فشل الإرسال', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleSendToIndividual = async () => {
    const id = customerId.trim();
    if (!id) {
      addToast('أدخل معرف العميل', 'error');
      return;
    }
    setSending(true);
    try {
      await apiFetch('/admin/notifications/send-to-customer', {
        method: 'POST',
        body: JSON.stringify({
          customerId: id,
          title: title.trim() || 'إشعار',
          body: body.trim() || '',
        }),
      });
      addToast('تم إرسال الإشعار للعميل', 'success');
      setCustomerId('');
      setTitle('');
      setBody('');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'فشل الإرسال', 'error');
    } finally {
      setSending(false);
    }
  };

  if (!MOCK_API_URL) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">إشعارات Push</h1>
        <Card className="p-6">
          <p className="text-sm text-amber-600">يتطلب mock-api (VITE_MOCK_API_URL)</p>
        </Card>
      </div>
    );
  }

  const showIndividualButton = target === 'specific' && customerId.trim().length > 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">إشعارات Push</h1>
      <Card className="p-6 max-w-2xl">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">عنوان الإشعار (EN/AR)</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Notification Title / عنوان الإشعار"
              className="w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">نص الإشعار (EN/AR)</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Notification body / نص الإشعار"
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الفئة المستهدفة</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value as TargetAudience)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="all">جميع العملاء (All Customers)</option>
              <option value="specific">عميل محدد (Specific Customer ID)</option>
            </select>
          </div>
          {target === 'specific' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">معرف العميل (Customer ID)</label>
              <Input
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder="e.g. customer-xxx"
                className="w-full"
              />
            </div>
          )}
          <div className="flex flex-wrap gap-3 pt-2">
            <Button
              onClick={() => setBroadcastConfirmOpen(true)}
              disabled={sending}
              className="gap-2"
            >
              <Send className="w-4 h-4" />
              إرسال للجميع (Send Broadcast)
            </Button>
            {showIndividualButton && (
              <Button
                variant="outline"
                onClick={handleSendToIndividual}
                disabled={sending}
                className="gap-2"
              >
                <User className="w-4 h-4" />
                إرسال للعميل (Send to Individual)
              </Button>
            )}
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={broadcastConfirmOpen}
        onClose={() => setBroadcastConfirmOpen(false)}
        onConfirm={doSendBroadcast}
        title="تأكيد الإرسال للجميع"
        message="سيتم إرسال هذا الإشعار لجميع العملاء المسجلين على التطبيق. هل أنت متأكد؟"
        confirmLabel="نعم، إرسال"
        cancelLabel="إلغاء"
        variant="warning"
        loading={sending}
        closeOnConfirm={false}
      />
    </div>
  );
}
