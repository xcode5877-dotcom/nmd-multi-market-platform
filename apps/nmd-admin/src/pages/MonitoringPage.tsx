import { useQuery } from '@tanstack/react-query';
import { Card } from '@nmd/ui';
import { formatPrice } from '@nmd/core';
import { apiFetch } from '../api';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

interface MarketStat {
  marketId: string;
  marketName: string;
  tenantCount: number;
  orderCount: number;
  revenue: number;
}

interface OtpDiagnostics {
  currentProvider?: string;
  whatsAppState?: Record<string, unknown> | null;
  queueSize?: number;
  lastSend?: string | null;
  lastFailure?: string | null;
  lastFailureError?: string | null;
  lastRestart?: string | null;
  restartCount?: number;
  alert?: { unhealthyForMs?: number; warningRaised?: boolean };
  providers?: Array<{ name: string; configured: boolean; healthy: boolean }>;
}

export default function MonitoringPage() {
  const { data: stats = [], isLoading } = useQuery({
    queryKey: ['monitoring-stats'],
    queryFn: () => apiFetch<MarketStat[]>('/monitoring/stats'),
    enabled: !!MOCK_API_URL,
  });

  const { data: otpDiag } = useQuery({
    queryKey: ['otp-diagnostics'],
    queryFn: () => apiFetch<OtpDiagnostics>('/admin/otp/diagnostics'),
    enabled: !!MOCK_API_URL,
    refetchInterval: 30_000,
  });

  if (!MOCK_API_URL) {
    return <div className="p-4 text-amber-600">يتطلب mock-api</div>;
  }

  if (isLoading) return <div className="text-gray-500">جاري التحميل...</div>;

  const totalTenants = stats.reduce((s, m) => s + m.tenantCount, 0);
  const totalOrders = stats.reduce((s, m) => s + m.orderCount, 0);
  const totalRevenue = stats.reduce((s, m) => s + m.revenue, 0);
  const waState = otpDiag?.whatsAppState as
    | { connectionState?: string; ready?: boolean; lastSendOkAt?: string | null }
    | null
    | undefined;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">مراقبة المنصة</h1>
      <Card className="p-4 mb-6 border-s-4 border-s-amber-500">
        <h2 className="font-semibold text-gray-900 mb-3">تشخيص OTP / واتساب</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <span className="text-gray-500">المزوّد:</span>{' '}
            <span className="font-medium">{otpDiag?.currentProvider ?? '—'}</span>
          </div>
          <div>
            <span className="text-gray-500">حالة واتساب:</span>{' '}
            <span className="font-medium">
              {waState?.connectionState ?? (waState?.ready ? 'READY' : '—')}
            </span>
          </div>
          <div>
            <span className="text-gray-500">حجم الطابور:</span>{' '}
            <span className="font-medium">{otpDiag?.queueSize ?? 0}</span>
          </div>
          <div>
            <span className="text-gray-500">آخر إرسال:</span>{' '}
            <span className="font-medium text-xs">{otpDiag?.lastSend ?? waState?.lastSendOkAt ?? '—'}</span>
          </div>
          <div>
            <span className="text-gray-500">آخر فشل:</span>{' '}
            <span className="font-medium text-xs">{otpDiag?.lastFailure ?? '—'}</span>
          </div>
          <div className="md:col-span-2">
            <span className="text-gray-500">سبب الفشل:</span>{' '}
            <span className="font-medium text-xs break-all">{otpDiag?.lastFailureError ?? '—'}</span>
          </div>
          <div>
            <span className="text-gray-500">آخر إعادة تشغيل:</span>{' '}
            <span className="font-medium text-xs">{otpDiag?.lastRestart ?? '—'}</span>
          </div>
          <div>
            <span className="text-gray-500">عدد إعادة التشغيل:</span>{' '}
            <span className="font-medium">{otpDiag?.restartCount ?? 0}</span>
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border-s-4 border-s-[#7C3AED]">
          <div className="p-4">
            <p className="text-sm text-gray-500">إجمالي المستأجرين</p>
            <p className="text-2xl font-bold text-[#7C3AED]">{totalTenants}</p>
          </div>
        </Card>
        <Card className="border-s-4 border-s-[#14B8A6]">
          <div className="p-4">
            <p className="text-sm text-gray-500">إجمالي الطلبات</p>
            <p className="text-2xl font-bold text-[#14B8A6]">{totalOrders}</p>
          </div>
        </Card>
        <Card className="border-s-4 border-s-[#059669]">
          <div className="p-4">
            <p className="text-sm text-gray-500">إجمالي الإيرادات</p>
            <p className="text-2xl font-bold text-[#059669]">{formatPrice(totalRevenue)}</p>
          </div>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {stats.map((m) => (
          <Card key={m.marketId} className="p-4">
            <h3 className="font-semibold text-gray-900 mb-3">{m.marketName}</h3>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <span className="text-gray-500">المستأجرون:</span>
                <span className="font-medium ms-1">{m.tenantCount}</span>
              </div>
              <div>
                <span className="text-gray-500">الطلبات:</span>
                <span className="font-medium ms-1">{m.orderCount}</span>
              </div>
              <div>
                <span className="text-gray-500">الإيرادات:</span>
                <span className="font-medium ms-1">{formatPrice(m.revenue)}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
