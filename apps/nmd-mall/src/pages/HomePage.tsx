import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getTenantListForMall } from '@nmd/mock';
import { Card, Skeleton } from '@nmd/ui';
import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

const CATEGORY_CHIPS = [
  { id: 'food', label: 'طعام', slug: 'food' },
  { id: 'clothes', label: 'ملابس', slug: 'clothes' },
  { id: 'electronics', label: 'إلكترونيات', slug: 'electronics' },
  { id: 'home', label: 'منزل', slug: 'home' },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<ReturnType<typeof getTenantListForMall>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setTenants(getTenantListForMall());
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-14 md:py-20 mb-12 rounded-2xl bg-gradient-to-b from-[#0F172A] via-[#1a1f3a] to-[#1E293B] shadow-xl"
      >
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 inline-block">
          قرية الدبورية التقنية
          <span className="block mt-2 h-1 w-24 mx-auto rounded-full bg-gradient-to-r from-[#7C3AED] to-[#14B8A6] shadow-[0_0_12px_rgba(124,58,237,0.5)]" aria-hidden />
        </h1>
        <p className="text-lg text-gray-300 mb-2">
          Dabburiyya Tech Village
        </p>
        <p className="text-gray-400 mb-8 max-w-xl mx-auto">
          اكتشف المحلات والتجار في مكان واحد — طعام، إلكترونيات، ملابس والمزيد
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const q = (e.currentTarget.elements.namedItem('q') as HTMLInputElement)?.value?.trim();
            if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
          }}
          className="relative max-w-md mx-auto"
        >
          <Search className="absolute top-1/2 end-3 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            name="q"
            type="search"
            placeholder="ابحث عن منتج..."
            className="w-full h-12 pe-10 ps-4 rounded-xl border border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-[#7C3AED] shadow-lg"
          />
        </form>
        <div className="flex flex-wrap justify-center gap-2 mt-6">
          {CATEGORY_CHIPS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => navigate(`/search?q=${encodeURIComponent(c.label)}`)}
              className="px-4 py-2 rounded-full text-sm font-medium bg-white/10 hover:bg-[#14B8A6]/30 border border-white/20 hover:border-[#14B8A6] text-white transition-colors"
            >
              {c.label}
            </button>
          ))}
        </div>
      </motion.section>

      <section className="mb-10">
        <h2 className="text-xl font-bold text-gray-900 mb-4">المحلات المميزة</h2>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
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
                <Link to={`/store/${t.slug}`}>
                  <Card className="h-40 flex flex-col items-center justify-center p-4 hover:shadow-xl transition-shadow cursor-pointer shadow-lg border-0">
                    <div
                      className="w-16 h-16 rounded-full mb-2 flex items-center justify-center text-white font-bold text-xl"
                      style={{ backgroundColor: t.branding.primaryColor }}
                    >
                      {t.name.charAt(0)}
                    </div>
                    <span className="font-semibold text-gray-900 text-center">{t.name}</span>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      <section className="pb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">التصنيفات</h2>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_CHIPS.map((c) => (
            <Link
              key={c.id}
              to={`/search?q=${encodeURIComponent(c.label)}`}
              className="px-4 py-3 rounded-xl border border-gray-200 hover:border-[#14B8A6] hover:bg-[#14B8A6]/10 transition-colors text-gray-700 font-medium"
            >
              {c.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
