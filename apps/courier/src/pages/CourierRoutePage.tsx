import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../api';
import { MapPin } from 'lucide-react';

export default function CourierRoutePage() {
  const { user } = useAuth();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['courier-orders'],
    queryFn: () => apiFetch<{ id?: string; tenantId?: string; status?: string; customerName?: string }[]>('/courier/orders'),
    enabled: !!user,
  });

  if (!user) return null;

  const routeOrders = orders.filter((o) => o.status !== 'DELIVERED' && o.status !== 'CANCELED');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-teal-600 text-white p-4 shadow">
        <Link to="/courier" className="text-sm text-teal-100 hover:text-white">
          ← رجوع
        </Link>
        <h1 className="text-lg font-bold mt-1">مسار التوصيل</h1>
      </header>

      <main className="p-4 max-w-md mx-auto">
        {isLoading ? (
          <p className="text-gray-500 text-center py-8">جاري التحميل...</p>
        ) : routeOrders.length === 0 ? (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">لا توجد طلبات في المسار</p>
          </div>
        ) : (
          <div className="space-y-3">
            {routeOrders.map((o, i) => (
              <div key={o.id} className="flex gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-200">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-medium text-sm">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm text-gray-600">#{o.id?.slice(0, 8)}</p>
                  <p className="font-medium text-gray-900">{o.customerName ?? '-'}</p>
                  <span className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${
                    o.status === 'OUT_FOR_DELIVERY' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {o.status === 'OUT_FOR_DELIVERY' ? 'خارج للتوصيل' : 'معيّن'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
