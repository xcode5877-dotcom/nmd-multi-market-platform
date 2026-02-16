import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getTenantListForMall, getTenantListForMallAsync } from '@nmd/mock';
import { Card, Skeleton } from '@nmd/ui';
import { useState, useEffect } from 'react';

const STOREFRONT_URL = import.meta.env.VITE_STOREFRONT_URL ?? 'http://localhost:5173';

export default function StoresPage() {
  const [tenants, setTenants] = useState<ReturnType<typeof getTenantListForMall>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTenantListForMallAsync('dabburiyya')
      .then(setTenants)
      .catch(() => setTenants(getTenantListForMall()))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">دليل المحلات</h1>

      <div className="flex gap-4 mb-6">
        <select className="h-10 px-3 rounded-lg border border-gray-200 bg-white">
          <option>النوع (قريباً)</option>
        </select>
        <select className="h-10 px-3 rounded-lg border border-gray-200 bg-white">
          <option>الأحدث</option>
          <option>الأكثر نشاطاً</option>
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : tenants.length === 0 ? (
        <div className="py-16 text-center rounded-xl bg-white border border-gray-200 shadow-sm">
          <p className="text-4xl mb-4">🏬</p>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">لا توجد محلات حالياً</h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            قريباً سنضيف محلات جديدة. يمكنك متابعتنا أو التواصل لإضافة محلّك.
          </p>
          <Link to="/join" className="text-[#D97706] font-medium hover:underline">
            أضف محلك ←
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {tenants.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <a href={`${STOREFRONT_URL}/${t.slug}`} target="_blank" rel="noopener noreferrer">
                <Card className="h-44 flex flex-col items-center justify-center p-4 hover:shadow-xl transition-shadow cursor-pointer shadow-lg border-0">
                  <div
                    className="w-16 h-16 rounded-full mb-2 flex items-center justify-center text-white font-bold text-xl"
                    style={{ backgroundColor: t.branding.primaryColor }}
                  >
                    {t.name.charAt(0)}
                  </div>
                  <span className="font-semibold text-gray-900 text-center">{t.name}</span>
                  <span className="text-sm text-gray-500 mt-1">{t.slug}</span>
                </Card>
              </a>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
