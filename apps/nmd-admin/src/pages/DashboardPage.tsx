import { Card } from '@nmd/ui';
import { listTenants, getOrdersToday, getOrdersThisWeek } from '@nmd/mock';
import { useEffect, useState } from 'react';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    tenantsEnabled: 0,
    ordersToday: 0,
    ordersWeek: 0,
  });

  useEffect(() => {
    const tenants = listTenants();
    setStats({
      tenantsEnabled: tenants.filter((t) => t.enabled).length,
      ordersToday: getOrdersToday().length,
      ordersWeek: getOrdersThisWeek().length,
    });
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">لوحة التحكم</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-s-4 border-s-[#7C3AED] shadow-md">
          <div className="p-4">
            <p className="text-sm text-gray-500">المستأجرون المفعلون</p>
            <p className="text-2xl font-bold text-[#7C3AED]">{stats.tenantsEnabled}</p>
          </div>
        </Card>
        <Card className="border-s-4 border-s-[#14B8A6] shadow-md">
          <div className="p-4">
            <p className="text-sm text-gray-500">الطلبات اليوم</p>
            <p className="text-2xl font-bold text-[#14B8A6]">{stats.ordersToday}</p>
          </div>
        </Card>
        <Card className="border-s-4 border-s-[#7C3AED] shadow-md">
          <div className="p-4">
            <p className="text-sm text-gray-500">الطلبات هذا الأسبوع</p>
            <p className="text-2xl font-bold text-[#7C3AED]">{stats.ordersWeek}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
