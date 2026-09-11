import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { useNativeBridge } from '../contexts/NativeBridgeContext';
import {
  ArrowRight,
  Clock,
  Play,
  Square,
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

type Shift = {
  id: string;
  startTime: string;
  endTime?: string | null;
  durationMinutes?: number | null;
  workedMinutes?: number | null;
  hours?: number | null;
  status?: string;
  durationLabel?: string;
  autoClosed?: boolean;
  accountingStatus?: string;
  accountingLabel?: string;
};

type ActiveShiftResponse = {
  shift: Shift | null;
  shiftWarning?: string | null;
  canStartShift?: boolean;
};

type ShiftsHistoryResponse = {
  shifts: Shift[];
  from?: string;
  to?: string;
  timezone?: string;
  period?: string;
  hoursWorked?: number;
  workedMinutes?: number;
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
    </div>
  );
}

export default function CourierEarningsPage() {
  const { user } = useAuth();
  const { isNativeApp } = useNativeBridge();
  const qc = useQueryClient();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['id']>('all');
  const [shiftMsg, setShiftMsg] = useState<string | null>(null);

  const { data: summary, isLoading } = useQuery({
    queryKey: ['courier-earnings', period],
    queryFn: () => apiFetch<EarningsSummary>(`/courier/earnings?period=${period}`),
    enabled: !!user,
    refetchInterval: 15_000,
  });

  const { data: activeShiftData } = useQuery({
    queryKey: ['courier-shift-active'],
    queryFn: () => apiFetch<ActiveShiftResponse>('/courier/shifts/active'),
    enabled: !!user,
    refetchInterval: 10_000,
  });
  const activeShift = activeShiftData?.shift ?? null;
  const canStartShift = activeShiftData?.canStartShift === true;
  const shiftWarning = activeShiftData?.shiftWarning ?? summary?.shiftWarning ?? null;

  const { data: shiftsHistory } = useQuery({
    queryKey: ['courier-shifts-history', period],
    queryFn: () => apiFetch<ShiftsHistoryResponse>(`/courier/shifts?limit=200&period=${period}`),
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const startShift = useMutation({
    mutationFn: () => apiFetch<Shift>('/courier/shifts/start', { method: 'POST' }),
    onSuccess: () => {
      setShiftMsg('تم بدء الدوام');
      qc.invalidateQueries({ queryKey: ['courier-shift-active'] });
      qc.invalidateQueries({ queryKey: ['courier-shifts-history'] });
      qc.invalidateQueries({ queryKey: ['courier-earnings'] });
    },
    onError: (e: Error) => setShiftMsg(e.message),
  });

  const endShift = useMutation({
    mutationFn: () => apiFetch<Shift>('/courier/shifts/end', { method: 'POST' }),
    onSuccess: () => {
      setShiftMsg('تم إنهاء الدوام');
      qc.invalidateQueries({ queryKey: ['courier-shift-active'] });
      qc.invalidateQueries({ queryKey: ['courier-shifts-history'] });
      qc.invalidateQueries({ queryKey: ['courier-earnings'] });
    },
    onError: (e: Error) => setShiftMsg(e.message),
  });

  if (!user) return null;

  const onShift = !!activeShift && !activeShift.endTime;

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      {!isNativeApp && (
        <header className="bg-teal-600 text-white px-4 py-4 shadow">
          <Link to="/" className="text-sm text-teal-100 mb-1 inline-flex items-center gap-1">
            <ArrowRight className="w-4 h-4 rotate-180" />
            الرئيسية
          </Link>
          <h1 className="text-xl font-bold">الدخل</h1>
        </header>
      )}

      <div className="p-4 max-w-md mx-auto space-y-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <h2 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-600" />
            الدوام
          </h2>
          {onShift ? (
            <div className="space-y-3">
              <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 font-semibold">
                قيد الدوام الآن
              </p>
              <p className="text-sm text-slate-700 text-center">
                البداية{' '}
                {new Date(activeShift!.startTime).toLocaleTimeString('ar-IL', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              <p className="text-sm font-semibold text-slate-800 text-center">
                {activeShift?.durationLabel ?? 'قيد الدوام الآن'}
              </p>
              <button
                type="button"
                onClick={() => endShift.mutate()}
                disabled={endShift.isPending}
                className="w-full min-h-[52px] rounded-2xl bg-red-600 text-white font-bold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
              >
                <Square className="w-5 h-5" />
                إنهاء الدوام
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => startShift.mutate()}
                disabled={startShift.isPending || !canStartShift}
                className="w-full min-h-[52px] rounded-2xl bg-teal-600 text-white font-bold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
              >
                <Play className="w-5 h-5" />
                بدء الدوام
              </button>
              {!canStartShift && (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
                  بدء الدوام غير مفعّل. تواصل مع الإدارة
                </p>
              )}
            </div>
          )}
          {shiftMsg && <p className="text-sm text-slate-600 mt-2 text-center">{shiftMsg}</p>}
          {shiftWarning && (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
              {shiftWarning}
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm">
          <h2 className="font-bold text-slate-800 mb-2">سجل الدوام</h2>
          {shiftsHistory && (
            <p className="text-xs text-slate-500 mb-3">
              إجمالي الفترة: {(shiftsHistory.hoursWorked ?? 0).toFixed(1)} س
              {shiftsHistory.from && shiftsHistory.to
                ? ` — ${shiftsHistory.from} → ${shiftsHistory.to}`
                : ''}
              {shiftsHistory.timezone ? ` (${shiftsHistory.timezone})` : ''}
            </p>
          )}
          {!shiftsHistory?.shifts?.length ? (
            <p className="text-sm text-slate-500 text-center py-4">لا توجد ورديات في هذه الفترة</p>
          ) : (
            <ul className="space-y-2">
              {shiftsHistory.shifts.slice(0, 20).map((s) => {
                const isActive = s.status === 'ACTIVE' || !s.endTime;
                return (
                  <li
                    key={s.id}
                    className="flex items-start justify-between gap-3 text-sm border-b border-slate-100 pb-2 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="text-slate-700" dir="ltr">
                        {new Date(s.startTime).toLocaleString('ar-IL', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {s.endTime
                          ? ` → ${new Date(s.endTime).toLocaleTimeString('ar-IL', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}`
                          : ''}
                      </p>
                      {s.autoClosed && <p className="text-xs text-amber-700">إغلاق تلقائي</p>}
                      {s.accountingLabel && (
                        <p className="text-xs text-slate-500">{s.accountingLabel}</p>
                      )}
                    </div>
                    <p className={`shrink-0 font-semibold ${isActive ? 'text-emerald-700' : 'text-slate-900'}`}>
                      {s.durationLabel ?? (isActive ? 'قيد الدوام الآن' : '—')}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

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
