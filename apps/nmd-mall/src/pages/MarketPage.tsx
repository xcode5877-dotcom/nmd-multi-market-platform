import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, Skeleton } from '@nmd/ui';
import { Search, Store, UtensilsCrossed, Shirt, LayoutGrid } from 'lucide-react';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';
const STOREFRONT_URL = import.meta.env.VITE_STOREFRONT_URL ?? 'http://localhost:5173';

type TenantType = 'ALL' | 'FOOD' | 'CLOTHING' | 'GENERAL';

interface MarketTenant {
  id: string;
  slug: string;
  name: string;
  type: string;
  marketCategory?: string;
  branding: { logoUrl?: string; primaryColor?: string };
  isActive: boolean;
}

const TYPE_LABELS: Record<TenantType, string> = {
  ALL: 'الكل',
  FOOD: 'طعام',
  CLOTHING: 'ملابس',
  GENERAL: 'عام',
};

const CATEGORY_ICONS: { type: Exclude<TenantType, 'ALL'>; Icon: typeof UtensilsCrossed; label: string }[] = [
  { type: 'FOOD', Icon: UtensilsCrossed, label: TYPE_LABELS.FOOD },
  { type: 'CLOTHING', Icon: Shirt, label: TYPE_LABELS.CLOTHING },
  { type: 'GENERAL', Icon: LayoutGrid, label: TYPE_LABELS.GENERAL },
];

export default function MarketPage() {
  const { marketSlug } = useParams<{ marketSlug: string }>();
  const [market, setMarket] = useState<{ id: string; name: string; slug: string } | null>(null);
  const [tenants, setTenants] = useState<MarketTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState<TenantType>('ALL');
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!MOCK_API_URL || !marketSlug) {
      setTenants([]);
      setMarket(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch(`${MOCK_API_URL}/markets/by-slug/${marketSlug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(async (m) => {
        if (cancelled || !m) return;
        setMarket(m);
        const res = await fetch(`${MOCK_API_URL}/markets/${m.id}/tenants`);
        const data = await res.json();
        if (!cancelled) setTenants((data ?? []).filter((t: MarketTenant) => t.isActive !== false));
      })
      .catch(() => {
        if (!cancelled) setTenants([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [marketSlug]);

  const handleCategoryClick = (type: Exclude<TenantType, 'ALL'>) => {
    setActiveType((prev) => (prev === type ? 'ALL' : type));
    gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const matchesType = (t: MarketTenant) => {
    if (activeType === 'ALL') return true;
    const cat = t.marketCategory ?? t.type ?? 'GENERAL';
    if (activeType === 'FOOD') return cat === 'FOOD';
    if (activeType === 'CLOTHING') return cat === 'CLOTHING';
    return ['GENERAL', 'GROCERIES', 'BUTCHER', 'OFFERS', 'ELECTRONICS', 'HOME'].includes(cat);
  };

  const visibleTenants = tenants
    .filter((t) => t.isActive !== false)
    .filter(matchesType)
    .filter((t) => !search.trim() || t.name.toLowerCase().includes(search.toLowerCase().trim()));

  if (!marketSlug) return null;

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6" dir="rtl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{market?.name ?? 'المحلات'}</h1>
      <p className="text-gray-600 mb-6">تصفح المحلات وادخل أي محل للطلب</p>

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

      {/* Category icons row */}
      <div className="flex flex-wrap gap-3 mb-6">
        {CATEGORY_ICONS.map(({ type, Icon, label }) => {
          const isActive = activeType === type;
          return (
            <button
              key={type}
              type="button"
              onClick={() => handleCategoryClick(type)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all min-w-[90px] ${
                isActive
                  ? 'bg-[#FEF3C7] border-[#D97706] ring-2 ring-[#D97706]/30 shadow-md'
                  : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  isActive ? 'bg-[#D97706] text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                <Icon className="w-6 h-6" />
              </div>
              <span className={`text-sm font-medium ${isActive ? 'text-[#B45309]' : 'text-gray-700'}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tenant grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : visibleTenants.length === 0 ? (
        <div className="py-16 text-center rounded-xl bg-white border border-gray-200 shadow-sm">
          <Store className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">لا توجد محلات تطابق البحث</h2>
          <p className="text-gray-600 max-w-md mx-auto">
            جرّب تغيير كلمة البحث أو نوع الفلتر
          </p>
        </div>
      ) : (
        <div ref={gridRef} className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {visibleTenants.map((t, i) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
            >
              <a
                href={`${STOREFRONT_URL}/${t.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Card className="h-full flex flex-col items-center justify-center p-4 hover:shadow-xl transition-shadow cursor-pointer shadow-sm border-gray-100 group">
                  <div
                    className="w-16 h-16 rounded-full mb-3 flex items-center justify-center overflow-hidden shrink-0"
                    style={{ backgroundColor: (t.branding as { primaryColor?: string })?.primaryColor ?? '#7C3AED' }}
                  >
                    {t.branding?.logoUrl ? (
                      <img
                        src={t.branding.logoUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-white font-bold text-xl">
                        {t.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <span className="font-semibold text-gray-900 text-center block">{t.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 mt-1">
                    {t.marketCategory === 'FOOD' ? TYPE_LABELS.FOOD : t.marketCategory === 'CLOTHING' ? TYPE_LABELS.CLOTHING : TYPE_LABELS.GENERAL}
                  </span>
                  <span className="mt-3 px-4 py-2 rounded-lg bg-[#D97706] text-white text-sm font-medium group-hover:bg-[#B45309] transition-colors">
                    ادخل المحل
                  </span>
                </Card>
              </a>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
