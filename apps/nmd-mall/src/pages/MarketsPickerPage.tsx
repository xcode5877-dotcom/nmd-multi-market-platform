import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, Skeleton } from '@nmd/ui';
import { Store } from 'lucide-react';
import { useState, useEffect } from 'react';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

interface Market {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  sortOrder?: number;
}

export default function MarketsPickerPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!MOCK_API_URL) {
      setMarkets([]);
      setLoading(false);
      return;
    }
    fetch(`${MOCK_API_URL}/markets`)
      .then((r) => r.json())
      .then((data: Market[]) => setMarkets(data ?? []))
      .catch(() => setMarkets([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8" dir="rtl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">اختر السوق</h1>
      <p className="text-gray-600 mb-8">كل سوق يضم محلات منطقته — تصفح واطلب من سوقك المحلي</p>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : markets.length === 0 ? (
        <div className="py-16 text-center rounded-xl bg-white border border-gray-200 shadow-sm">
          <Store className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">لا توجد أسواق حالياً</h2>
          <p className="text-gray-600">قريباً سنضيف أسواق جديدة</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {markets.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <button
                type="button"
                onClick={() => navigate(`/m/${m.slug}`)}
                className="w-full text-right"
              >
                <Card className="nmd-card-hover p-6 rounded-xl bg-white border border-gray-200 shadow-sm hover:border-[#D97706]/50 hover:shadow-md transition-all flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-[#FEF3C7] flex items-center justify-center text-[#D97706] shrink-0">
                    <Store className="w-7 h-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-lg">{m.name}</h3>
                    <p className="text-sm text-gray-500">/{m.slug}</p>
                  </div>
                  <span className="text-[#D97706] font-medium">ادخل ←</span>
                </Card>
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
