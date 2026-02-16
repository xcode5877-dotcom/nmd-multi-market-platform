import { motion } from 'framer-motion';
import { listEnabledTenants } from '@nmd/mock';
import { Card } from '@nmd/ui';
import { persistTenant } from '../lib/tenant';
import { useState, useEffect } from 'react';

export default function TenantSelectPage() {
  const [tenants, setTenants] = useState(listEnabledTenants());

  useEffect(() => {
    setTenants(listEnabledTenants());
  }, []);

  const handleSelect = (slug: string) => {
    persistTenant(slug);
    window.location.href = `/${slug}`;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-bold text-gray-900 mb-6"
      >
        اختر المتجر
      </motion.h1>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl">
        {tenants.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card
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
          </motion.div>
        ))}
      </div>
    </div>
  );
}
