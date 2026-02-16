import { Card } from '@nmd/ui';
import { listTenants, getOrdersToday, getOrdersThisWeek } from '@nmd/mock';
import { MockApiClient } from '@nmd/mock';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api';

const api = new MockApiClient();
const USE_API = !!import.meta.env.VITE_MOCK_API_URL;

function ensureArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? v : [];
}

export default function OverviewPage() {
  const { data: tenantsRaw } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.listTenants(),
    enabled: USE_API,
  });
  const { data: ordersRaw } = useQuery({
    queryKey: ['orders-overview'],
    queryFn: async () => {
      try {
        const data = await apiFetch<unknown>('/orders');
        return ensureArray(data);
      } catch {
        return [];
      }
    },
    enabled: USE_API,
  });

  const tenants = ensureArray(tenantsRaw);
  const orders = ensureArray(ordersRaw);

  const stats = useMemo(() => {
    if (USE_API) {
      const today = new Date().toDateString();
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return {
        tenantsEnabled: (tenants as { enabled?: boolean }[]).filter((t) => t.enabled).length,
        ordersToday: (orders as { createdAt?: string }[]).filter((o) => o?.createdAt && new Date(o.createdAt).toDateString() === today).length,
        ordersWeek: (orders as { createdAt?: string }[]).filter((o) => o?.createdAt && new Date(o.createdAt) >= weekAgo).length,
      };
    }
    const t = listTenants();
    return {
      tenantsEnabled: t.filter((x) => x.enabled).length,
      ordersToday: getOrdersToday().length,
      ordersWeek: getOrdersThisWeek().length,
    };
  }, [USE_API, tenants, orders]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Overview</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border-s-4 border-s-[#7C3AED] shadow-md">
          <div className="p-4">
            <p className="text-sm text-gray-500">Active Tenants</p>
            <p className="text-2xl font-bold text-[#7C3AED]">{stats.tenantsEnabled}</p>
          </div>
        </Card>
        <Card className="border-s-4 border-s-[#14B8A6] shadow-md">
          <div className="p-4">
            <p className="text-sm text-gray-500">Orders Today</p>
            <p className="text-2xl font-bold text-[#14B8A6]">{stats.ordersToday}</p>
          </div>
        </Card>
        <Card className="border-s-4 border-s-[#7C3AED] shadow-md">
          <div className="p-4">
            <p className="text-sm text-gray-500">Orders This Week</p>
            <p className="text-2xl font-bold text-[#7C3AED]">{stats.ordersWeek}</p>
          </div>
        </Card>
      </div>
      <Card className="mb-6">
        <div className="p-4">
          <h2 className="font-semibold text-gray-900 mb-3">Modules Enabled</h2>
          <p className="text-sm text-gray-500">Commerce, Restaurant, Apparel, Inventory, Analytics</p>
        </div>
      </Card>
      <Card>
        <div className="p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Growth</h2>
          <div className="h-32 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500 text-sm">
            Chart placeholder
          </div>
        </div>
      </Card>
    </div>
  );
}
