import { useEffect, useState } from 'react';
import { Card, Button, Input, useToast, ConfirmDialog } from '@nmd/ui';
import { apiFetch } from '../api';
import { AlertTriangle, Send, User, FlaskConical } from 'lucide-react';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

type TargetAudience = 'all' | 'market' | 'specific';

type NotificationStatus = {
  fcmConfigured: boolean;
  registeredCustomerTokens: number;
  pushReady: boolean;
  message?: string;
};

type SendResult = {
  sent?: number;
  failed?: number;
  totalTokens?: number;
  message?: string;
  error?: string;
  fcmConfigured?: boolean;
  ok?: boolean;
  customerId?: string;
  warning?: string;
};

function looksLikePhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 9 && !value.startsWith('cust-') && !value.startsWith('customer-');
}

export default function PushNotificationsPage() {
  const { addToast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [route, setRoute] = useState('');
  const [target, setTarget] = useState<TargetAudience>('all');
  const [marketSlug, setMarketSlug] = useState('dabburiyya');
  const [customerIdentifier, setCustomerIdentifier] = useState('');
  const [testCustomerIdentifier, setTestCustomerIdentifier] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [broadcastConfirmOpen, setBroadcastConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<SendResult | null>(null);
  const [status, setStatus] = useState<NotificationStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [markets, setMarkets] = useState<Array<{ slug: string; nameAr?: string; name?: string }>>([]);

  const loadStatus = async () => {
    try {
      const data = await apiFetch<NotificationStatus>('/admin/notifications/status');
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    if (!MOCK_API_URL) {
      setStatusLoading(false);
      return;
    }
    void loadStatus();
    void apiFetch<Array<{ slug: string; nameAr?: string; name?: string }>>('/markets')
      .then(setMarkets)
      .catch(() => setMarkets([]));
  }, []);

  const buildPayload = () => ({
    title: title.trim() || 'إشعار',
    body: body.trim() || '',
    ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}),
    ...(route.trim() ? { route: route.trim() } : {}),
    ...(scheduledAt.trim() ? { scheduledAt: scheduledAt.trim() } : {}),
  });

  const handleSendResult = (data: SendResult, successFallback: string) => {
    setLastResult(data);
    const sent = data?.sent ?? (data?.ok ? 1 : 0);
    const failed = data?.failed ?? 0;
    if (sent <= 0) {
      addToast(data?.message ?? data?.error ?? 'لم يُرسل أي إشعار', 'error');
      return;
    }
    const detail =
      failed > 0
        ? ` (${sent} ناجح، فشل ${failed}${data.totalTokens != null ? ` من ${data.totalTokens}` : ''})`
        : data.totalTokens != null && data.totalTokens > 1
          ? ` (${sent} من ${data.totalTokens} أجهزة)`
          : '';
    addToast(`${data?.message ?? successFallback}${detail}`, 'success');
    if (data.warning) addToast(data.warning, 'error');
    void loadStatus();
  };

  const doSendBroadcast = async () => {
    setSending(true);
    try {
      const data = await apiFetch<SendResult>('/admin/notifications/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          ...buildPayload(),
          ...(target === 'market' && marketSlug.trim() ? { marketSlug: marketSlug.trim() } : {}),
        }),
      });
      handleSendResult(data, 'تم الإرسال');
      setBroadcastConfirmOpen(false);
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'فشل الإرسال', 'error');
    } finally {
      setSending(false);
    }
  };

  const sendToCustomer = async (identifier: string) => {
    const trimmed = identifier.trim();
    if (!trimmed) {
      addToast('أدخل رقم الهاتف أو معرف العميل', 'error');
      return;
    }
    setSending(true);
    try {
      const payload = looksLikePhone(trimmed)
        ? { phone: trimmed, ...buildPayload() }
        : { customerId: trimmed, ...buildPayload() };
      const data = await apiFetch<SendResult>('/admin/notifications/send-to-customer', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      handleSendResult(data, 'تم إرسال الإشعار للعميل');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'فشل الإرسال';
      addToast(msg, 'error');
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

  const pushDisabled = !status?.fcmConfigured;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">إشعارات Push للعملاء</h1>

      {!statusLoading && status && (
        <Card className="p-4 mb-4 border-gray-200 bg-gray-50 text-sm">
          <p>
            FCM:{' '}
            <span className={status.fcmConfigured ? 'text-green-700 font-semibold' : 'text-red-600'}>
              {status.fcmConfigured ? 'مُهيّأ' : 'غير مُهيّأ'}
            </span>
            {' · '}
            أجهزة مسجّلة: <strong>{status.registeredCustomerTokens}</strong>
          </p>
          {!status.pushReady && (
            <p className="mt-2 text-amber-800 flex gap-2 items-start">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {status.message}
            </p>
          )}
          {lastResult && (lastResult.sent != null || lastResult.failed != null) && (
            <p className="mt-2 text-gray-700">
              آخر إرسال: ناجح {lastResult.sent ?? 0} · فشل {lastResult.failed ?? 0}
              {lastResult.totalTokens != null ? ` · من أصل ${lastResult.totalTokens}` : ''}
              {lastResult.customerId ? ` · عميل ${lastResult.customerId}` : ''}
            </p>
          )}
        </Card>
      )}

      <Card className="p-6 max-w-2xl">
        <div className="space-y-4">
          <Input
            label="عنوان الإشعار"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="عنوان يظهر في شريط الإشعارات"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">نص الإشعار</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="نص الرسالة"
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
            />
          </div>
          <Input
            label="رابط صورة (اختياري)"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
          />
          <Input
            label="مسار عند النقر (اختياري)"
            value={route}
            onChange={(e) => setRoute(e.target.value)}
            placeholder="/market/dabburiyya/orders"
          />
          <Input
            label="جدولة (اختياري — ISO)"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الفئة المستهدفة</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value as TargetAudience)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="all">جميع العملاء المسجّلين</option>
              <option value="market">عملاء سوق محدد (طلبات سابقة)</option>
              <option value="specific">عميل محدد (هاتف أو معرف)</option>
            </select>
          </div>
          {target === 'market' && (
            <SelectMarket markets={markets} value={marketSlug} onChange={setMarketSlug} />
          )}
          {target === 'specific' && (
            <Input
              label="رقم الهاتف أو معرف العميل"
              value={customerIdentifier}
              onChange={(e) => setCustomerIdentifier(e.target.value)}
              placeholder="0546111668 أو +972546111668 أو customer-xxx"
            />
          )}
          <div className="border-t pt-4">
            <Input
              label="إرسال تجريبي (هاتف أو معرف العميل)"
              value={testCustomerIdentifier}
              onChange={(e) => setTestCustomerIdentifier(e.target.value)}
              placeholder="0546111668 أو customer-xxx"
            />
            <Button
              variant="outline"
              size="sm"
              className="mt-2 gap-2"
              disabled={sending || pushDisabled || !testCustomerIdentifier.trim()}
              onClick={() => void sendToCustomer(testCustomerIdentifier)}
            >
              <FlaskConical className="w-4 h-4" />
              إرسال تجريبي
            </Button>
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            {target !== 'specific' && (
              <Button
                onClick={() => setBroadcastConfirmOpen(true)}
                disabled={sending || pushDisabled}
                className="gap-2"
              >
                <Send className="w-4 h-4" />
                إرسال للجميع
              </Button>
            )}
            {target === 'specific' && customerIdentifier.trim() && (
              <Button
                variant="outline"
                onClick={() => void sendToCustomer(customerIdentifier)}
                disabled={sending || pushDisabled}
                className="gap-2"
              >
                <User className="w-4 h-4" />
                إرسال للعميل
              </Button>
            )}
          </div>
        </div>
      </Card>

      <ConfirmDialog
        open={broadcastConfirmOpen}
        onClose={() => setBroadcastConfirmOpen(false)}
        onConfirm={doSendBroadcast}
        title="تأكيد الإرسال"
        message={
          target === 'market'
            ? `إرسال لعملاء سوق ${marketSlug} الذين لديهم أجهزة مسجّلة؟`
            : 'إرسال لجميع العملاء المسجّلين؟'
        }
        confirmLabel="نعم، إرسال"
        cancelLabel="إلغاء"
        variant="warning"
        loading={sending}
        closeOnConfirm={false}
      />
    </div>
  );
}

function SelectMarket({
  markets,
  value,
  onChange,
}: {
  markets: Array<{ slug: string; nameAr?: string; name?: string }>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">السوق</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2"
      >
        {markets.map((m) => (
          <option key={m.slug} value={m.slug}>
            {m.nameAr || m.name || m.slug}
          </option>
        ))}
      </select>
    </div>
  );
}
