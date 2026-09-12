import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNativeBridge } from '../contexts/NativeBridgeContext';
import { CourierAttendancePanel } from '../components/CourierAttendancePanel';
import { CourierCollectionsPanel } from '../components/CourierCollectionsPanel';
import { ArrowRight } from 'lucide-react';
import { useCallback } from 'react';
import type { CollectionsPeriod } from '../lib/collectionsSummary';
import type { AttendancePeriod } from '../components/CourierAttendancePanel';

function parsePeriodParam(raw: string | null): CollectionsPeriod {
  if (raw === 'week' || raw === 'month' || raw === 'all' || raw === 'today') return raw;
  return 'today';
}

/**
 * Route /earnings kept for backward compatibility.
 * Shows الدوام + تحصيل (company money through courier) — not personal wages.
 */
export default function CourierEarningsPage() {
  const { user } = useAuth();
  const { isNativeApp } = useNativeBridge();
  const [searchParams, setSearchParams] = useSearchParams();
  const period = parsePeriodParam(searchParams.get('period'));

  const setPeriod = useCallback(
    (p: CollectionsPeriod) => {
      setSearchParams({ period: p }, { replace: true });
    },
    [setSearchParams]
  );

  const attendancePeriod: AttendancePeriod =
    period === 'today' || period === 'week' || period === 'month' || period === 'all'
      ? period
      : 'all';

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      {!isNativeApp && (
        <header className="bg-teal-600 text-white px-4 py-4 shadow">
          <Link to="/" className="text-sm text-teal-100 mb-1 inline-flex items-center gap-1">
            <ArrowRight className="w-4 h-4 rotate-180" />
            الرئيسية
          </Link>
          <h1 className="text-xl font-bold">الدوام والتحصيل</h1>
          <p className="text-xs text-teal-100 mt-1">ساعات العمل + مبالغ الشركة عبرك</p>
        </header>
      )}

      <div className="p-4 max-w-md mx-auto space-y-4">
        <section aria-label="الدوام">
          <CourierAttendancePanel
            key={attendancePeriod}
            enabled={!!user.courierId}
            defaultPeriod={attendancePeriod}
          />
        </section>

        <CourierCollectionsPanel
          enabled={!!user}
          courierId={user.courierId}
          period={period}
          onPeriodChange={setPeriod}
          variant="light"
          title="التحصيل المالي"
        />

        <Link to="/expenses" className="block text-center text-sm text-teal-700 font-medium py-2">
          تسجيل مصروف تشغيلي ←
        </Link>
      </div>
    </div>
  );
}
