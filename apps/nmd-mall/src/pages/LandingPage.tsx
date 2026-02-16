import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getTenantListForMall, getTenantListForMallAsync } from '@nmd/mock';
import type { MarketCategory } from '@nmd/core';
import { Card, Skeleton } from '@nmd/ui';
import { useState, useEffect, useRef } from 'react';
import { Banknote, Truck, Heart, MessageCircle, Store, ShoppingCart, Package, Search } from 'lucide-react';

const STOREFRONT_URL = import.meta.env.VITE_STOREFRONT_URL ?? 'http://localhost:5173';

const CATEGORY_TILES: { marketCategory: MarketCategory; label: string; icon: string }[] = [
  { marketCategory: 'FOOD', label: 'طعام', icon: '🍕' },
  { marketCategory: 'CLOTHING', label: 'ملابس', icon: '🛍' },
  { marketCategory: 'GROCERIES', label: 'خضار', icon: '🥬' },
  { marketCategory: 'BUTCHER', label: 'ملحمة', icon: '🥩' },
  { marketCategory: 'OFFERS', label: 'عروض', icon: '📦' },
];

const SHOP_CATEGORIES = [
  { id: 'food', label: 'طعام', icon: '🍽️' },
  { id: 'clothes', label: 'ملابس', icon: '👕' },
  { id: 'electronics', label: 'إلكترونيات', icon: '📱' },
  { id: 'home', label: 'منزل', icon: '🏠' },
];

const LIVE_ORDER_STORES = ['بيتزا المدينة', 'ملحمة الخير', 'سوبر ماركت الهدى', 'محل الأناقة'];

const OFFER_CARDS = [
  { id: 1, label: 'عرض اليوم 1', discount: 20, image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop', alt: 'طعام' },
  { id: 2, label: 'عرض اليوم 2', discount: 25, image: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=400&h=300&fit=crop', alt: 'ملابس' },
  { id: 3, label: 'عرض اليوم 3', discount: 30, image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&h=300&fit=crop', alt: 'سوبر ماركت' },
  { id: 4, label: 'عرض اليوم 4', discount: 35, image: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400&h=300&fit=crop', alt: 'ملحمة' },
  { id: 5, label: 'عرض اليوم 5', discount: 40, image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop', alt: 'طعام' },
];

const ORDER_STEPS = [
  { icon: Store, label: 'اختر المحل' },
  { icon: ShoppingCart, label: 'أضف منتجاتك' },
  { icon: Package, label: 'استلم أو اطلب توصيل' },
];

export default function LandingPage() {
  const [tenants, setTenants] = useState<ReturnType<typeof getTenantListForMall>>([]);
  const [loading, setLoading] = useState(true);
  const [liveStoreIndex, setLiveStoreIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState<'ALL' | MarketCategory>('ALL');
  const [search, setSearch] = useState('');
  const shopsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getTenantListForMallAsync('dabburiyya')
      .then((list) => setTenants(list))
      .catch(() => setTenants(getTenantListForMall()))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveStoreIndex((i) => (i + 1) % LIVE_ORDER_STORES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCategoryClick = (cat: MarketCategory) => {
    setActiveCategory((prev) => (prev === cat ? 'ALL' : cat));
    shopsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const visibleTenants = tenants
    .filter((t) => (activeCategory === 'ALL' ? true : (t.marketCategory ?? 'GENERAL') === activeCategory))
    .filter((t) => !search.trim() || t.name.toLowerCase().includes(search.toLowerCase().trim()));

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
            كل محلات دبورية في مكان واحد.
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
            <Link
              to="/market"
              className="nmd-btn-active px-6 py-3 rounded-xl bg-[#B45309] text-white font-semibold hover:bg-[#92400E] transition-all shadow-lg shadow-[#D97706]/25"
            >
              تصفح المحلات
            </Link>
            <Link
              to="/market"
              className="nmd-btn-active px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 transition-all"
            >
              اطلب الآن
            </Link>
          </motion.div>
        </div>
      </section>

      {/* 2. Trust Bar */}
      <section className="py-6 border-b border-gray-100 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-6 md:gap-10">
            {[
              { icon: Banknote, label: 'دفع نقدي' },
              { icon: Truck, label: 'توصيل داخل دبورية' },
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
          <p className="text-center text-sm text-gray-500 mt-4">التوصيل داخل دبورية خلال نفس اليوم</p>
        </div>
      </section>

      {/* 2b. Live Orders Bar */}
      <section className="py-3 px-4 bg-[#F0FDF4]/60 border-b border-gray-100">
        <div className="max-w-6xl mx-auto flex items-center justify-center gap-2">
          <span className="text-sm text-gray-600">الآن يتم الطلب من</span>
          <div className="flex items-center gap-2 min-w-[140px] justify-center">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse-dot shrink-0" />
            <span className="relative min-w-[120px] h-6 flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.span
                  key={liveStoreIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="font-semibold text-gray-900 absolute"
                >
                  {LIVE_ORDER_STORES[liveStoreIndex]}
                </motion.span>
              </AnimatePresence>
            </span>
          </div>
        </div>
      </section>

      {/* 3. Quick Start - Category tiles filter shops */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.4 }}
        className="py-12 md:py-14"
      >
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">
            كيف تحب تتسوّق اليوم؟
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6">
            {CATEGORY_TILES.map((c) => {
              const isActive = activeCategory === c.marketCategory;
              return (
                <button
                  key={c.marketCategory}
                  type="button"
                  onClick={() => handleCategoryClick(c.marketCategory)}
                  className={`nmd-card-hover p-6 rounded-xl border-2 transition-all flex flex-col items-center gap-2 min-h-[120px] justify-center ${
                    isActive
                      ? 'bg-[#FEF3C7] border-[#D97706] ring-2 ring-[#D97706]/30 shadow-md'
                      : 'bg-white border-gray-200 hover:border-[#D97706]/50 hover:shadow-md'
                  }`}
                >
                  <span className="text-4xl">{c.icon}</span>
                  <span className={`font-semibold text-center ${isActive ? 'text-[#B45309]' : 'text-gray-900'}`}>
                    {c.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </motion.section>

      {/* 3b. 3 Steps Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.4 }}
        className="py-12 border-t border-gray-100 bg-white"
      >
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-xl font-bold text-gray-900 mb-8 text-center">
            كيف تطلب خلال 3 خطوات؟
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {ORDER_STEPS.map(({ icon: Icon, label }, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-3 p-6 rounded-xl bg-gray-50/80 border border-gray-100"
              >
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

      {/* 4. عروض اليوم */}
      <section className="py-12 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4">
          {/* Daily Orders Counter */}
          <div className="mb-6 p-3 rounded-xl bg-[#F0FDF4]/80 border border-green-200 inline-flex items-center gap-2">
            <span className="text-green-600">🟢</span>
            <span className="text-sm font-medium text-gray-700">تم تنفيذ 87 طلب اليوم</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span>🔥</span> عروض اليوم
          </h2>
          <div className="overflow-x-auto overflow-y-hidden pb-4 -ms-4 ps-4 flex gap-4 scroll-smooth" style={{ scrollbarWidth: 'thin' }}>
            {OFFER_CARDS.map((offer) => (
              <div
                key={offer.id}
                className="nmd-card-hover flex-shrink-0 w-52 p-4 rounded-xl bg-white border-2 border-[#FEF3C7] hover:border-[#D97706]/50 shadow-sm hover:shadow-md transition-all"
              >
                <span className="text-xs px-2 py-0.5 rounded bg-[#D97706] text-white font-medium">
                  خصم اليوم
                </span>
                <div className="aspect-[4/3] rounded-lg mt-3 overflow-hidden bg-gray-100">
                  <img
                    src={offer.image}
                    alt={offer.alt}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="font-bold text-xl text-[#D97706] mt-2">-{offer.discount}%</p>
                <p className="font-medium text-gray-900 text-sm mt-1">{offer.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. محلات مميزة - Shops grid filtered by category + search */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.4 }}
        className="py-12 md:py-14 border-t border-gray-100"
      >
        <div ref={shopsRef} className="max-w-6xl mx-auto px-4">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span>🏬</span> محلات مميزة
          </h2>
          {/* Search */}
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
              <h3 className="text-lg font-semibold text-gray-900 mb-2">لا توجد محلات تطابق البحث أو الفئة</h3>
              <p className="text-gray-600 max-w-md mx-auto">
                جرّب تغيير كلمة البحث أو اختر فئة أخرى
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {visibleTenants.map((t) => (
                <a key={t.id} href={`${STOREFRONT_URL}/${t.slug}`} target="_blank" rel="noopener noreferrer">
                  <Card className="nmd-card-hover h-40 flex flex-col items-center justify-center p-4 hover:shadow-lg transition-all cursor-pointer shadow-sm border-gray-100">
                    <div
                      className="w-14 h-14 rounded-full mb-2 flex items-center justify-center text-white font-bold text-lg"
                      style={{ backgroundColor: t.branding.primaryColor }}
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

      {/* 6. تسوق حسب الفئة */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.4 }}
        className="py-12 md:py-14 border-t border-gray-100"
      >
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <span>🛍</span> تسوق حسب الفئة
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {SHOP_CATEGORIES.map((c) => (
              <Link
                key={c.id}
                to={`/search?q=${encodeURIComponent(c.label)}`}
                className="nmd-card-hover p-6 rounded-xl bg-white border border-gray-200 hover:border-[#D97706]/50 hover:shadow-md transition-all flex flex-col items-center"
              >
                <span className="text-3xl mb-2">{c.icon}</span>
                <span className="font-semibold text-gray-900">{c.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </motion.section>

      {/* 7. Testimonials */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.4 }}
        className="py-12 md:py-14 border-t border-gray-100"
      >
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-xl font-bold text-gray-900 mb-8 text-center">
            ماذا يقول أهل دبورية؟
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {[
              { quote: 'تجربة ممتازة، الطلب وصل سريع والمحلات جداً منظمة.', name: 'أحمد م.' },
              { quote: 'سهل الاستخدام وكل شي متوفر. أنصح الجميع يجرب.', name: 'فاطمة خ.' },
              { quote: 'دعم محلي حقيقي. فرق كبير عن الطلب من برا القرية.', name: 'محمد س.' },
            ].map((t, i) => (
              <div key={i} className="p-6 rounded-xl bg-white border border-gray-200 shadow-sm">
                <div className="flex gap-1 mb-3 text-[#D97706]">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <span key={s}>★</span>
                  ))}
                </div>
                <p className="text-gray-700 text-sm leading-relaxed mb-4">&quot;{t.quote}&quot;</p>
                <p className="text-gray-500 text-xs">{t.name}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* 8. لماذا سوق دبورية؟ */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.4 }}
        className="py-16 md:py-20 border-t border-gray-100 bg-[#FEF3C7]/30"
      >
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center justify-center gap-2">
            لماذا سوق دبورية؟
          </h2>
          <p className="text-gray-700 leading-relaxed">
            كل شراء من سوق دبورية الرقمي يدعم التجار والمحلات المحلية في القرية. نبني مجتمعاً أقوى معاً — تسوق محلياً، ادعم جيرانك، واستمتع بكل ما تقدمه دبورية.
          </p>
        </div>
      </motion.section>
    </div>
  );
}
