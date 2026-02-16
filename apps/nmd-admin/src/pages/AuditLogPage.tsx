import { useQuery } from '@tanstack/react-query';
import { Card } from '@nmd/ui';
import { apiFetch } from '../api';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

interface AuditEvent {
  id: string;
  at: string;
  userId: string;
  role: string;
  marketId?: string;
  action: string;
  entity: string;
  entityId: string;
  reason?: string;
  emergencyMode?: boolean;
}

export default function AuditLogPage() {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['audit-events'],
    queryFn: () => apiFetch<AuditEvent[]>('/audit-events?limit=100'),
    enabled: !!MOCK_API_URL,
  });

  if (!MOCK_API_URL) {
    return <div className="p-4 text-amber-600">يتطلب mock-api</div>;
  }

  if (isLoading) return <div className="text-gray-500">جاري التحميل...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">سجل التدقيق</h1>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-start font-medium text-gray-700">الوقت</th>
                <th className="px-4 py-3 text-start font-medium text-gray-700">المستخدم</th>
                <th className="px-4 py-3 text-start font-medium text-gray-700">الدور</th>
                <th className="px-4 py-3 text-start font-medium text-gray-700">الإجراء</th>
                <th className="px-4 py-3 text-start font-medium text-gray-700">الكيان</th>
                <th className="px-4 py-3 text-start font-medium text-gray-700">السوق</th>
                <th className="px-4 py-3 text-start font-medium text-gray-700">السبب</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    لا توجد أحداث
                  </td>
                </tr>
              ) : (
                events.map((e) => (
                  <tr key={e.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 text-gray-600">{new Date(e.at).toLocaleString('ar')}</td>
                    <td className="px-4 py-3">{e.userId}</td>
                    <td className="px-4 py-3">{e.role}</td>
                    <td className="px-4 py-3">{e.action}</td>
                    <td className="px-4 py-3">{e.entity}/{e.entityId}</td>
                    <td className="px-4 py-3">{e.marketId ?? '—'}</td>
                    <td className="px-4 py-3">
                      {e.reason ?? '—'}
                      {e.emergencyMode && <span className="text-amber-600 text-xs"> (طوارئ)</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
