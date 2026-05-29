import { Link } from 'react-router-dom';
import { Card, Skeleton } from '@nmd/ui';
import { Truck, Wallet, BarChart3, LayoutDashboard } from 'lucide-react';
import { useDriverOpsOverview } from '../../drivers/useDriverOpsOverview';
import { DriverOnlineBadge } from '../../components/drivers/DriverOnlineBadge';
import { MockApiClient } from '@nmd/mock';
import { useQuery } from '@tanstack/react-query';

const api = new MockApiClient();
const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

export default function DriversMarketsHubPage() {
  const { data: overview, isLoading: overviewLoading } = useDriverOpsOverview();

  const { data: allCouriersByMarket, isLoading: couriersLoading } = useQuery({
    queryKey: ['driver-ops-all-couriers', overview?.fetchedAt],
    queryFn: async () => {
      if (!overview?.markets.length) return [];
      return Promise.all(
        overview.markets.map(async (m) => {
          const couriers = await api.getMarketCouriers(m.marketId).catch(() => []);
          return { marketId: m.marketId, marketName: m.marketName, couriers };
        })
      );
    },
    enabled: !!MOCK_API_URL && !!overview?.markets.length,
  });

  const isLoading = overviewLoading || couriersLoading;

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        اختصارات تشغيلية لكل سوق. صفحات التوجيه والمالية والتقارير الأصلية لم تتغيّر.
      </p>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        (allCouriersByMarket ?? []).map(({ marketId, marketName, couriers }) => {
          const row = overview?.markets.find((m) => m.marketId === marketId);
          return (
            <Card key={marketId} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{marketName}</h2>
                  {row ? (
                    <p className="text-sm text-gray-500 mt-0.5">
                      {row.activeDeliveries} توصيل نشط · {row.queueCount} في الطابور · {row.deliveriesToday} اليوم
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/markets/${marketId}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    نظرة السوق
                  </Link>
                  <Link
                    to={`/markets/${marketId}/dispatch`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-teal-600 text-white hover:bg-teal-700"
                  >
                    <Truck className="w-4 h-4" />
                    التوجيه
                  </Link>
                  <Link
                    to={`/markets/${marketId}/finance`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
                  >
                    <Wallet className="w-4 h-4" />
                    مالية
                  </Link>
                  <Link
                    to={`/markets/${marketId}/reports`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50"
                  >
                    <BarChart3 className="w-4 h-4" />
                    تقارير
                  </Link>
                </div>
              </div>
              {couriers.length === 0 ? (
                <p className="text-sm text-gray-500">لا يوجد سائقون مسجّلون في هذا السوق.</p>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {couriers.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-2 p-3 rounded-lg border border-gray-100 bg-gray-50/80"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{c.name}</p>
                        {c.phone ? <p className="text-xs text-gray-500 truncate">{c.phone}</p> : null}
                      </div>
                      <DriverOnlineBadge isOnline={c.isOnline} isAvailable={c.isAvailable} isActive={c.isActive} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
