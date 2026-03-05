import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@nmd/ui';
import { MockApiClient } from '@nmd/mock';
import { formatDateTimeGregorian } from '@nmd/core';
import { useAuth } from '../contexts/AuthContext';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';
const api = new MockApiClient();

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

function getWhoLabel(metadata?: Record<string, unknown>): string {
  const customerName = (metadata?.customerName as string)?.trim();
  if (customerName) return customerName;
  const customerId = (metadata?.customerId as string) ?? '';
  const userAgent = (metadata?.userAgent as string) ?? '';
  if (userAgent.includes('iPhone')) return customerId ? `عميل · iPhone` : 'زائر · iPhone';
  if (userAgent.includes('Android')) return customerId ? `عميل · Android` : 'زائر · Android';
  return customerId ? 'عميل مسجّل' : 'زائر';
}

export default function LeadsPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? '';
  const tenantSlug = (user as { tenantSlug?: string })?.tenantSlug ?? '';

  useEffect(() => {
    if (import.meta.env?.DEV && (tenantId || tenantSlug)) {
      console.log('[LeadsPage] API:', MOCK_API_URL, '| user.tenantId:', tenantId, '| user.tenantSlug:', tenantSlug);
    }
  }, [tenantId, tenantSlug]);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', tenantId, tenantSlug],
    queryFn: () => api.listLeads(tenantSlug || undefined),
    enabled: !!MOCK_API_URL && !!(tenantId || tenantSlug),
  });

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
  if (!tenantId && !tenantSlug) {
    return (
      <div className="p-4 text-amber-600">
        لا يوجد متجر مرتبط بحسابك. تواصل مع المسؤول.
      </div>
    );
  }
  if (isLoading) {
    return <div className="text-gray-500">جاري التحميل...</div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">سجل الطلبات والاستفسارات</h1>

      <div className="mb-6 p-4 rounded-xl bg-primary/10 border border-primary/20">
        <p className="text-sm text-gray-600">إجمالي الطلبات اليوم</p>
        <p className="text-3xl font-bold text-primary">{leadsToday.length}</p>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start font-medium text-gray-700">نوع الإجراء</th>
                <th className="px-4 py-3 text-start font-medium text-gray-700">من</th>
                <th className="px-4 py-3 text-start font-medium text-gray-700">رقم الهاتف</th>
                <th className="px-4 py-3 text-start font-medium text-gray-700">التاريخ والوقت</th>
              </tr>
            </thead>
            <tbody>
              {sortedLeads.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    لا توجد طلبات أو استفسارات حتى الآن
                  </td>
                </tr>
              ) : (
                sortedLeads.map((l) => {
                  const meta = (l as { metadata?: Record<string, unknown> }).metadata;
                  const who = getWhoLabel(meta);
                  const phone = (meta?.customerPhone as string)?.trim() || '—';
                  return (
                    <tr key={l.id} className="border-t border-gray-100">
                      <td className="px-4 py-3 font-medium">
                        {getActionLabel(l.type, (l as { contactType?: string }).contactType)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{who}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {phone !== '—' ? (
                          <a href={`tel:${phone}`} className="text-primary hover:underline" dir="ltr">
                            {phone}
                          </a>
                        ) : (
                          phone
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatDateTimeGregorian(l.timestamp)}
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
