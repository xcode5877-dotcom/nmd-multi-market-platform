import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Card } from '@nmd/ui';
import { MockApiClient } from '@nmd/mock';
import { useAuth } from '../contexts/AuthContext';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';
const api = new MockApiClient();

interface Tenant {
  id: string;
  name: string;
  slug: string;
  marketId?: string;
}

function getTodayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function getActionLabel(type: string, contactType?: string): string {
  if (type === 'PROFESSIONAL_CONTACT') {
    return contactType === 'call' ? 'اتصال مهني (هاتف)' : 'اتصال مهني (واتساب)';
  }
  if (type === 'whatsapp') return 'واتساب';
  if (type === 'call') return 'اتصال';
  return 'CTA';
}

function getDeviceLabel(metadata?: Record<string, unknown>): string {
  const ua = (metadata?.userAgent as string) ?? '';
  if (ua.includes('iPhone')) return 'iPhone';
  if (ua.includes('iPad')) return 'iPad';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac')) return 'Mac';
  return ua ? ua.slice(0, 30) + (ua.length > 30 ? '…' : '') : '—';
}

export default function LeadsPage() {
  const { user: me } = useAuth();
  const [searchParams] = useSearchParams();
  const urlTenant = searchParams.get('tenant')?.trim() || undefined;
  const authTenantSlug = (me as { tenantSlug?: string })?.tenantSlug;
  const effectiveTenantSlug = urlTenant ?? (me?.role === 'TENANT_ADMIN' ? authTenantSlug : undefined);
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', effectiveTenantSlug ?? ''],
    queryFn: () => api.listLeads(effectiveTenantSlug),
    enabled: !!MOCK_API_URL,
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.listTenants(),
    enabled: !!MOCK_API_URL,
  });

  const tenantMap = new Map<string, Tenant>();
  (tenants as { id: string; name: string; slug: string; marketId?: string }[]).forEach((t) => tenantMap.set(t.id, t));

  const todayStart = getTodayStart().getTime();
  const leadsToday = leads.filter((l) => new Date(l.timestamp).getTime() >= todayStart);
  const sortedLeads = [...leads].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (!MOCK_API_URL) {
    return (
      <div className="p-4 text-amber-600">
        يتطلب mock-api (VITE_MOCK_API_URL)
      </div>
    );
  }
  if (isLoading) {
    return <div className="text-gray-500">جاري التحميل...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">سجل الطلبات</h1>
      {effectiveTenantSlug && (
        <p className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
          عرض بيانات متجر واحد فقط: <strong>{effectiveTenantSlug}</strong>
        </p>
      )}

      <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/20">
        <p className="text-sm text-gray-600">إجمالي الطلبات اليوم</p>
        <p className="text-3xl font-bold text-primary">{leadsToday.length}</p>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-start font-medium text-gray-700">المتجر</th>
                  <th className="px-4 py-3 text-start font-medium text-gray-700">نوع الإجراء</th>
                  <th className="px-4 py-3 text-start font-medium text-gray-700">الهاتف / الجهاز</th>
                  <th className="px-4 py-3 text-start font-medium text-gray-700">التاريخ والوقت</th>
                  <th className="px-4 py-3 text-start font-medium text-gray-700">رابط</th>
                </tr>
              </thead>
            <tbody>
              {sortedLeads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    لا توجد طلبات
                  </td>
                </tr>
              ) : (
                sortedLeads.map((l) => {
                  const tenant = tenantMap.get(l.tenantId) as { id: string; name: string; slug: string; marketId?: string } | undefined;
                  const storeName = tenant?.name ?? l.tenantId;
                  const myTenantId = (me as { tenantId?: string })?.tenantId ? String((me as { tenantId?: string }).tenantId).trim() : '';
                  const isMyTenant = me?.role === 'TENANT_ADMIN' && myTenantId !== '' && l.tenantId != null && String(l.tenantId).trim() === myTenantId;
                  const storeLink = isMyTenant
                    ? '/tenant'
                    : tenant?.marketId
                      ? `/markets/${tenant.marketId}/tenants/${l.tenantId}`
                      : `/tenants/${l.tenantId}`;
                  const meta = (l as { metadata?: Record<string, unknown> }).metadata;
                  const phone = meta?.phone as string | undefined;
                  const deviceLabel = getDeviceLabel(meta);
                  const phoneDevice = phone ? `${phone} · ${deviceLabel}` : deviceLabel;
                  return (
                    <tr key={l.id} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-medium">{storeName}</td>
                      <td className="px-4 py-3">{getActionLabel(l.type, (l as { contactType?: string }).contactType)}</td>
                      <td className="px-4 py-3 text-gray-600" title={meta?.userAgent as string}>{phoneDevice}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(l.timestamp).toLocaleString('ar-SA')}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={storeLink}
                          className="text-primary hover:underline"
                        >
                          فتح المتجر
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
