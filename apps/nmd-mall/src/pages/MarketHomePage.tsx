import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { MarketCategory } from '@nmd/core';
import { Card, Skeleton } from '@nmd/ui';
import { useState, useEffect, useRef } from 'react';
import { Banknote, Truck, Heart, MessageCircle, Store, ShoppingCart, Package, Search } from 'lucide-react';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';
const STOREFRONT_URL = import.meta.env.VITE_STOREFRONT_URL ?? 'http://localhost:5173';

interface Market {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
}

interface MarketTenant {
  id: string;
  slug: string;
  name: string;
  type: string;
  branding: { logoUrl?: string; primaryColor?: string };
  isActive: boolean;
  marketCategory: string;
}

const CATEGORY_TILES: { marketCategory: MarketCategory; label: string; icon: string }[] = [
  { marketCategory: 'FOOD', label: 'طعام', icon: '🍕' },
  { marketCategory: 'CLOTHING', label: 'ملابس', icon: '🛍' },
  { marketCategory: 'GROCERIES', label: 'خضار', icon: '🥬' },
  { marketCategory: 'BUTCHER', label: 'ملحمة', icon: '🥩' },
  { marketCategory: 'OFFERS', label: 'عروض', icon: '📦' },
];

const ORDER_STEPS = [
  { icon: Store, label: 'اختر المحل' },
  { icon: ShoppingCart, label: 'أضف منتجاتك' },
  { icon: Package, label: 'استلم أو اطلب توصيل' },
];

export default function MarketHomePage() {
  const { marketSlug } = useParams<{ marketSlug: string }>();
  const [market, setMarket] = useState<Market | null>(null);
  const [tenants, setTenants] = useState<MarketTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<'ALL' | MarketCategory>('ALL');
  const [search, setSearch] = useState('');
  const shopsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!marketSlug || !MOCK_API_URL) {
      setMarket(null);
      setTenants([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch(`${MOCK_API_URL}/markets/by-slug/${marketSlug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(async (m) => {
        if (cancelled || !m) {
          if (!cancelled) setMarket(null);
          return;
        }
        setMarket(m);
        const res = await fetch(`${MOCK_API_URL}/markets/${m.id}/tenants`);
        const list = await res.json();
        if (!cancelled) setTenants(list ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setMarket(null);
          setTenants([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [marketSlug]);

  const handleCategoryClick = (cat: MarketCategory) => {
    setActiveCategory((prev) => (prev === cat ? 'ALL' : cat));
    shopsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const visibleTenants = tenants
    .filter((t) => (activeCategory === 'ALL' ? true : (t.marketCategory ?? 'GENERAL') === activeCategory))
    .filter((t) => !search.trim() || t.name.toLowerCase().includes(search.toLowerCase().trim()));

  if (!loading && !market) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center" dir="rtl">
        <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">السوق غير موجود</h2>
        <p className="text-gray-600 mb-6">لم نتمكن من العثور على هذا السوق</p>
        <Link to="/markets" className="text-[#D97706] font-medium hover:underline">
          ← العودة لاختيار السوق
        </Link>
      </div>
    );
  }

  const marketName = market?.name ?? 'السوق';
  const shortName = market?.slug === 'dabburiyya' ? 'دبورية' : market?.slug === 'iksal' ? 'إكسال' : market?.slug ?? '';

  return (
    <div>
      {/* First Order Banner */}
      <div className="flex justify-center py-2 px-4 bg-[#FEF3C7]/50 border-b border-[#FEF3C7]">
        <span className="text-sm text-gray-700">أول طلب لك؟ استخدم السوق الآن بدون تسجيل.</span>
      </div>

      {/* 1. Hero */}
      <section className="relative py-16 md:py-20 overflow-hidden bg-gradient-to-b from-[#FEF3C7]/40 via-white to-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(217,119,6,0.08),transparent)]" />
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-4xl md:text-5xl font-bold text-gray-900 mb-4"
          >
            كل محلات {shortName} في مكان واحد.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-lg text-gray-600 mb-8"
          >
            تسوق بسهولة. اطلب بسرعة. ادعم مشروعك المحلي.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-wrap justify-center gap-3"
          >
            <button
              type="button"
              onClick={() => shopsRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="nmd-btn-active px-6 py-3 rounded-xl bg-[#B45309] text-white font-semibold hover:bg-[#92400E] transition-all shadow-lg shadow-[#D97706]/25"
            >
              تصفح المحلات
            </button>
          </motion.div>
        </div>
      </section>

      {/* 2. Trust Bar */}
      <section className="py-6 border-b border-gray-100 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-6 md:gap-10">
            {[
              { icon: Banknote, label: 'دفع نقدي' },
              { icon: Truck, label: 'توصيل محلي' },
              { icon: Heart, label: 'خدمة محلية' },
              { icon: MessageCircle, label: 'دعم مباشر' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-gray-700">
                <div className="w-8 h-8 rounded-lg bg-[#FEF3C7] flex items-center justify-center text-[#D97706]">
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Quick Start - Category tiles */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.4 }}
        className="py-12 md:py-14"
      >
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">كيف تحب تتسوّق اليوم؟</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6">
            {CATEGORY_TILES.map((c) => {
              const isActive = activeCategory === c.marketCategory;
              return (
                <button
                  key={c.marketCategory}
                  type="button"
                  onClick={() => handleCategoryClick(c.marketCategory)}
                  className={`nmd-card-hover p-6 rounded-xl border-2 transition-all flex flex-col items-center gap-2 min-h-[120px] justify-center ${
                    isActive ? 'bg-[#FEF3C7] border-[#D97706] ring-2 ring-[#D97706]/30 shadow-md' : 'bg-white border-gray-200 hover:border-[#D97706]/50 hover:shadow-md'
                  }`}
                >
                  <span className="text-4xl">{c.icon}</span>
                  <span className={`font-semibold text-center ${isActive ? 'text-[#B45309]' : 'text-gray-900'}`}>{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </motion.section>

      {/* 4. 3 Steps */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.4 }}
        className="py-12 border-t border-gray-100 bg-white"
      >
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-xl font-bold text-gray-900 mb-8 text-center">كيف تطلب خلال 3 خطوات؟</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {ORDER_STEPS.map(({ icon: Icon, label }, i) => (
              <div key={i} className="flex flex-col items-center gap-3 p-6 rounded-xl bg-gray-50/80 border border-gray-100">
                <div className="w-12 h-12 rounded-xl bg-[#FEF3C7] flex items-center justify-center text-[#D97706]">
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-sm font-medium text-gray-500">الخطوة {i + 1}</span>
                <span className="font-semibold text-gray-900 text-center">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* 5. محلات مميزة */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.4 }}
        className="py-12 md:py-14 border-t border-gray-100"
      >
        <div id="shops" ref={shopsRef} className="max-w-6xl mx-auto px-4">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span>🏬</span> محلات مميزة
          </h2>
          <div className="relative mb-6">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="ابحث باسم المحل..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full ps-4 pe-12 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#D97706]/50 focus:border-[#D97706]"
            />
          </div>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : visibleTenants.length === 0 ? (
            <div className="py-16 text-center rounded-xl bg-white border border-gray-200 shadow-sm">
              <span className="text-4xl mb-4 block">🏬</span>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {tenants.length === 0 && !search.trim() && activeCategory === 'ALL'
                  ? 'لا توجد محلات بعد'
                  : 'لا توجد محلات تطابق البحث أو الفئة'}
              </h3>
              <p className="text-gray-600 max-w-md mx-auto">
                {tenants.length === 0 ? 'هذا السوق جاهز لانضمام محلات جديدة.' : 'جرّب تغيير كلمة البحث أو اختر فئة أخرى'}
              </p>
              {tenants.length === 0 && (
                <Link to="/markets" className="inline-block mt-4 text-[#D97706] font-medium hover:underline">
                  ← العودة لاختيار السوق
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {visibleTenants.map((t) => (
                <a key={t.id} href={`${STOREFRONT_URL}/${t.slug}`} target="_blank" rel="noopener noreferrer">
                  <Card className="nmd-card-hover h-40 flex flex-col items-center justify-center p-4 hover:shadow-lg transition-all cursor-pointer shadow-sm border-gray-100">
                    <div
                      className="w-14 h-14 rounded-full mb-2 flex items-center justify-center text-white font-bold text-lg"
                      style={{ backgroundColor: t.branding?.primaryColor ?? '#7C3AED' }}
                    >
                      {t.name.charAt(0)}
                    </div>
                    <span className="font-semibold text-gray-900 text-center text-sm">{t.name}</span>
                  </Card>
                </a>
              ))}
            </div>
          )}
        </div>
      </motion.section>

      {/* 6. لماذا سوقنا؟ */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.4 }}
        className="py-16 md:py-20 border-t border-gray-100 bg-[#FEF3C7]/30"
      >
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">لماذا {marketName}؟</h2>
          <p className="text-gray-700 leading-relaxed">
            كل شراء يدعم التجار والمحلات المحلية. نبني مجتمعاً أقوى معاً — تسوق محلياً، ادعم جيرانك.
          </p>
        </div>
      </motion.section>
    </div>
  );
}
