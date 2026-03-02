import { useQuery } from '@tanstack/react-query';
import { Card } from '@nmd/ui';
import { MockApiClient } from '@nmd/mock';
import { useAuth } from '../contexts/AuthContext';

const api = new MockApiClient();
const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

export default function CustomersPage() {
  const { user: me } = useAuth();

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.listCustomers(),
    enabled: !!MOCK_API_URL,
  });

  if (!MOCK_API_URL) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">المشتركون</h1>
        <Card className="p-6">
          <p className="text-sm text-amber-600">يتطلب mock-api (VITE_MOCK_API_URL)</p>
        </Card>
      </div>
    );
  }

  const isTenantAdmin = (me as { role?: string })?.role === 'TENANT_ADMIN';
  const subtitle = isTenantAdmin
    ? 'العملاء الذين تواصلوا معك أو طلبوا من متجرك'
    : (me as { role?: string })?.role === 'MARKET_ADMIN'
      ? 'المشتركون في سوقك'
      : 'جميع المشتركين المسجلين في المنصة';

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">المشتركون</h1>
      <p className="text-sm text-gray-600 mb-4">{subtitle}</p>
      <Card className="p-4">
        {isLoading ? (
          <p className="text-gray-500 py-8 text-center">جاري التحميل...</p>
        ) : customers.length === 0 ? (
          <p className="text-gray-500 py-8 text-center">لا يوجد مشتركون مسجلون</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-start font-medium text-gray-700">الاسم</th>
                  <th className="px-4 py-2 text-start font-medium text-gray-700">رقم الجوال</th>
                  <th className="px-4 py-2 text-start font-medium text-gray-700">التسجيل</th>
                </tr>
              </thead>
              <tbody>
                {(customers as { id: string; name?: string; phone: string; createdAt?: string }[]).map((c) => (
                  <tr key={c.id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium">{c.name ?? '—'}</td>
                    <td className="px-4 py-3" dir="ltr">
                      <a href={`tel:${c.phone}`} className="text-primary hover:underline">
                        {c.phone}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {c.createdAt ? new Date(c.createdAt).toLocaleDateString('ar-SA') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
