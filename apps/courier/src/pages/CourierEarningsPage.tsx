import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useNativeBridge } from '../contexts/NativeBridgeContext';
import { CourierAttendancePanel, type AttendancePeriod } from '../components/CourierAttendancePanel';
import {
  ArrowRight,
  Clock,
  TrendingUp,
  Truck,
  Percent,
  Receipt,
  Gift,
  Wallet,
} from 'lucide-react';

type EarningsSummary = {
  from: string;
  to: string;
  timezone?: string;
  period?: string;
  ordersCount: number;
  deliveryEarnings: number;
  commissionEarnings: number;
  bonuses: number;
  expenses: number;
  hourlyPay: number;
  hoursWorked: number;
  netEarnings: number;
  hourlyRate: number;
  outstandingBalance?: number;
  shiftWarning?: string | null;
};

const PERIODS = [
  { id: 'today', label: 'اليوم' },
  { id: 'week', label: 'هذا الأسبوع' },
  { id: 'month', label: 'هذا الشهر' },
  { id: 'all', label: 'الكل' },
] as const;

function SummaryCard({ summary }: { summary: EarningsSummary }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-white rounded-xl p-3 border border-slate-100">
          <p className="text-slate-500 flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> طلبات</p>
          <p className="text-xl font-bold text-slate-900">{summary.ordersCount}</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-slate-100">
          <p className="text-slate-500 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> ساعات</p>
          <p className="text-xl font-bold text-slate-900">{summary.hoursWorked.toFixed(1)}</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-slate-100">
          <p className="text-slate-500 flex items-center gap-1"><Truck className="w-3.5 h-3.5" /> توصيل</p>
          <p className="text-lg font-bold text-emerald-700">₪{summary.deliveryEarnings.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-slate-100">
          <p className="text-slate-500 flex items-center gap-1"><Percent className="w-3.5 h-3.5" /> عمولة</p>
          <p className="text-lg font-bold text-emerald-700">₪{summary.commissionEarnings.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-slate-100">
          <p className="text-slate-500 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> أجر ساعي</p>
          <p className="text-lg font-bold text-blue-700">₪{summary.hourlyPay.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-slate-100">
          <p className="text-slate-500 flex items-center gap-1"><Gift className="w-3.5 h-3.5" /> مكافآت</p>
          <p className="text-lg font-bold text-violet-700">₪{summary.bonuses.toFixed(2)}</p>
        </div>
      </div>
      <div className="bg-white rounded-xl p-3 border border-slate-100 flex justify-between items-center">
        <span className="text-slate-500 flex items-center gap-1"><Receipt className="w-4 h-4" /> مصاريف معتمدة</span>
        <span className="font-bold text-amber-700">— ₪{summary.expenses.toFixed(2)}</span>
      </div>
      <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-2xl p-4 text-white flex justify-between items-center">
        <span className="flex items-center gap-2 font-semibold"><Wallet className="w-5 h-5" /> صافي الدخل</span>
        <span className="text-2xl font-black">₪{summary.netEarnings.toFixed(2)}</span>
      </div>
      <p className="text-xs text-slate-400 text-center">
        أجر ساعي ₪{summary.hourlyRate}/س — الفترة {summary.from} → {summary.to}
        {summary.timezone ? ` (${summary.timezone})` : ''}
      </p>
      {summary.hoursWorked === 0 && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
          لا توجد ساعات ضمن هذه الفترة — جرّب «الكل» أو فترة أخرى
        </p>
      )}
    </div>
  );
}

export default function CourierEarningsPage() {
  const { user } = useAuth();
  const { isNativeApp } = useNativeBridge();
  const [period, setPeriod] = useState<AttendancePeriod>('all');

  const { data: summary, isLoading } = useQuery({
    queryKey: ['courier-earnings', period],
    queryFn: () => apiFetch<EarningsSummary>(`/courier/earnings?period=${period}`),
    enabled: !!user,
    refetchInterval: 15_000,
  });

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      {!isNativeApp && (
        <header className="bg-teal-600 text-white px-4 py-4 shadow">
          <Link to="/" className="text-sm text-teal-100 mb-1 inline-flex items-center gap-1">
            <ArrowRight className="w-4 h-4 rotate-180" />
            الرئيسية
          </Link>
          <h1 className="text-xl font-bold">الدخل والدوام</h1>
        </header>
      )}

      <div className="p-4 max-w-md mx-auto space-y-4">
        <CourierAttendancePanel enabled={!!user.courierId} defaultPeriod={period} />

        <div className="flex gap-2 p-1 bg-white rounded-xl border border-slate-200 overflow-x-auto">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`flex-1 min-w-[4.5rem] py-2 rounded-lg text-sm font-semibold transition-colors ${
                period === p.id ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-slate-700 font-semibold">
          <TrendingUp className="w-5 h-5 text-teal-600" />
          ملخص الدخل
        </div>

        {isLoading && <p className="text-center text-slate-500 py-8">جاري التحميل...</p>}
        {summary && <SummaryCard summary={summary} />}

        <Link
          to="/expenses"
          className="block text-center text-sm text-teal-700 font-medium py-2"
        >
          تسجيل مصروف جديد ←
        </Link>
      </div>
    </div>
  );
}
