import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../api';
import { Package, List, MapPin, LogOut, Trophy, Award } from 'lucide-react';

type CourierStats = {
  pointsToday?: number;
  pointsWeek?: number;
  badgesWeek?: string[];
  avgTotalMin?: number | null;
  onTimeRate?: number | null;
};

export default function CourierDashboard() {
  const { user, logout } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ['courier-stats'],
    queryFn: () => apiFetch<CourierStats>('/courier/stats'),
    enabled: !!user,
    refetchInterval: 8000,
  });

  const { data: leaderboardData } = useQuery({
    queryKey: ['leaderboard', user?.marketId],
    queryFn: () => apiFetch<{ leaderboard: { courierId: string; name: string; pointsWeek: number; badgesWeek: string[]; rank: number }[]; myRank: number | null }>(
      `/markets/${user!.marketId}/leaderboard?period=week`
    ),
    enabled: !!user?.marketId,
    refetchInterval: 8000,
  });

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-teal-600 text-white p-4 shadow">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold">مرحباً، {user.courier.name}</h1>
            <p className="text-sm text-teal-100">{user.market.name}</p>
          </div>
          <button
            onClick={logout}
            className="p-2 rounded-lg hover:bg-teal-700 transition-colors"
            aria-label="تسجيل الخروج"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="p-4 max-w-md mx-auto space-y-4">
        <Link
          to="/courier/orders"
          className="block p-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:border-teal-300 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-100 text-teal-600">
              <List className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">طلباتي المعيّنة</h2>
              <p className="text-sm text-gray-500">عرض وتحديث الطلبات المعيّنة لك</p>
            </div>
          </div>
        </Link>

        <Link
          to="/courier/route"
          className="block p-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:border-teal-300 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">مسار التوصيل</h2>
              <p className="text-sm text-gray-500">قائمة الطلبات الحالية في المسار</p>
            </div>
          </div>
        </Link>

        <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-100 text-gray-600">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">الحالة</p>
              <p className={`text-sm ${user.courier.isAvailable ? 'text-green-600' : 'text-amber-600'}`}>
                {user.courier.isAvailable ? 'متاح للتوصيل' : 'مشغول'}
              </p>
            </div>
          </div>
        </div>

        {leaderboardData && (
          <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              لوحة المتصدرين
            </h3>
            <div className="space-y-1.5">
              {leaderboardData.leaderboard.slice(0, 5).map((r) => (
                <div
                  key={r.courierId}
                  className={`flex items-center justify-between py-1.5 px-2 rounded ${r.courierId === user.courierId ? 'bg-teal-50 border border-teal-200' : ''}`}
                >
                  <span className="text-sm font-medium">
                    <span className="text-gray-500 w-6 inline-block">{r.rank}</span>
                    {r.name}
                  </span>
                  <span className="text-sm font-semibold text-teal-600">{r.pointsWeek} نقطة</span>
                </div>
              ))}
            </div>
            {leaderboardData.myRank != null && leaderboardData.myRank > 5 && (
              <p className="text-xs text-gray-500 mt-2">ترتيبك: #{leaderboardData.myRank}</p>
            )}
          </div>
        )}

        {stats && (
          <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              أدائي
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {stats?.pointsToday != null && (
                <div>
                  <p className="text-gray-500">النقاط اليوم</p>
                  <p className="font-semibold text-teal-600">{stats.pointsToday}</p>
                </div>
              )}
              {stats?.pointsWeek != null && (
                <div>
                  <p className="text-gray-500">النقاط الأسبوع</p>
                  <p className="font-semibold text-teal-600">{stats.pointsWeek}</p>
                </div>
              )}
              {stats?.avgTotalMin != null && (
                <div>
                  <p className="text-gray-500">متوسط المدة</p>
                  <p className="font-medium">{stats.avgTotalMin} د</p>
                </div>
              )}
              {stats?.onTimeRate != null && (
                <div>
                  <p className="text-gray-500">ضمن SLA</p>
                  <p className={`font-medium ${stats.onTimeRate >= 80 ? 'text-green-600' : stats.onTimeRate >= 50 ? 'text-amber-600' : 'text-gray-700'}`}>
                    {stats.onTimeRate}%
                  </p>
                </div>
              )}
            </div>
            {(stats?.badgesWeek?.length ?? 0) > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {stats.badgesWeek!.map((b) => (
                  <span key={b} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">
                    <Award className="w-3 h-3" />
                    {b}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
