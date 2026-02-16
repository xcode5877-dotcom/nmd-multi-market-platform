import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getTenantBySlug, getCatalog } from '@nmd/mock';
import { formatMoney } from '@nmd/core';
import { Card, Button } from '@nmd/ui';
import { ExternalLink, MessageCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

const STOREFRONT_URL = import.meta.env.VITE_STOREFRONT_URL ?? (import.meta.env.DEV ? 'http://localhost:5173' : '/storefront');

export default function StorePreviewPage() {
  const { slug } = useParams<{ slug: string }>();
  const [tenant, setTenant] = useState(getTenantBySlug(slug ?? ''));

  useEffect(() => {
    setTenant(getTenantBySlug(slug ?? ''));
  }, [slug]);

  const catalog = tenant ? getCatalog(tenant.id) : null;
  const products = catalog?.products?.slice(0, 3) ?? [];

  if (!tenant) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <p className="text-gray-600 mb-4">المحل غير موجود</p>
        <Link to="/stores">
          <Button>عودة للمحلات</Button>
        </Link>
      </div>
    );
  }

  const openStoreUrl = `${STOREFRONT_URL}/${tenant.slug}`;

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <section>
          <Card className="overflow-hidden shadow-sm border-gray-100">
            <div className="h-32 bg-gradient-to-b from-gray-200 to-gray-100 flex items-center justify-center text-gray-400 text-sm">
              صورة الغلاف
            </div>
            <div className="p-6">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shrink-0 overflow-hidden -mt-12 border-4 border-white shadow-md"
                  style={{ backgroundColor: tenant.primaryColor }}
                >
                  {tenant.logoUrl ? (
                    <img src={tenant.logoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    tenant.name.charAt(0)
                  )}
                </div>
                <div className="text-center sm:text-start flex-1">
                  <div className="flex items-center gap-2 justify-center sm:justify-start">
                    <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
                    <span className="text-xs px-2 py-0.5 rounded bg-[#FEF3C7] text-[#D97706] font-medium">
                      محل موثوق
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm mt-1">/{tenant.slug}</p>
                  <p className="text-gray-600 text-sm mt-2 max-w-md">
                    محل محلي في سوق دبورية الرقمي — تسوق بسهولة وادعم مشروعك المحلي.
                  </p>
                  <p className="text-gray-500 text-xs mt-1">١٢ طلب اليوم</p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <a href={openStoreUrl} target="_blank" rel="noopener noreferrer" className="inline-block">
                      <Button className="gap-2 w-full sm:w-auto bg-[#D97706] hover:bg-[#B45309]">
                        <ExternalLink className="w-4 h-4" />
                        تصفح المتجر
                      </Button>
                    </a>
                    <a
                      href="#"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm"
                    >
                      <MessageCircle className="w-4 h-4 text-green-600" />
                      واتساب
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </section>

        {products.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">منتجات مختارة</h2>
            <div className="grid grid-cols-3 gap-3">
              {products.map((p) => (
                <a
                  key={p.id}
                  href={`${STOREFRONT_URL}/${tenant.slug}/p/${p.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Card className="overflow-hidden hover:shadow-md transition-shadow">
                    <div className="aspect-square bg-gray-100">
                      <img
                        src={p.images?.[0]?.url ?? p.imageUrl ?? 'https://placehold.co/400x400?text=No+Image'}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-2">
                      <p className="font-medium text-sm truncate">{p.name}</p>
                      <p className="text-primary font-bold text-xs">{formatMoney(p.basePrice)}</p>
                    </div>
                  </Card>
                </a>
              ))}
            </div>
          </section>
        )}
      </motion.div>
    </div>
  );
}
