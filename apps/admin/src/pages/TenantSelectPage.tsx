import { listEnabledTenants } from '@nmd/mock';
import { Card } from '@nmd/ui';
import { persistAdminTenant } from '../store/admin-tenant';
import { useState, useEffect } from 'react';

export default function TenantSelectPage() {
  const [tenants, setTenants] = useState(listEnabledTenants());

  useEffect(() => {
    setTenants(listEnabledTenants());
  }, []);

  const handleSelect = (slug: string) => {
    persistAdminTenant(slug);
    window.location.href = `/?tenant=${slug}`;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Tenant Admin - اختر المستأجر</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl">
        {tenants.map((t) => (
          <Card
            key={t.id}
            className="h-36 flex flex-col items-center justify-center p-4 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => handleSelect(t.slug)}
          >
            <div
              className="w-16 h-16 rounded-full mb-2 flex items-center justify-center text-white font-bold text-xl"
              style={{ backgroundColor: t.primaryColor }}
            >
              {t.name.charAt(0)}
            </div>
            <span className="font-semibold text-gray-900 text-center">{t.name}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}
