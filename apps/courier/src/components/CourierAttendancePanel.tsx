import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Play, Square, RefreshCw } from 'lucide-react';
import { apiFetch } from '../api';

export type AttendanceShift = {
  id: string;
  startTime: string;
  endTime?: string | null;
  workedMinutes?: number | null;
  hours?: number | null;
  status?: string;
  durationLabel?: string;
  autoClosed?: boolean;
  accountingStatus?: string;
  accountingLabel?: string;
};

type ActiveShiftResponse = {
  shift: AttendanceShift | null;
  shiftWarning?: string | null;
  canStartShift?: boolean;
};

type ShiftsHistoryResponse = {
  shifts: AttendanceShift[];
  from?: string;
  to?: string;
  timezone?: string;
  period?: string;
  hoursWorked?: number;
  workedMinutes?: number;
};

export type AttendancePeriod = 'today' | 'week' | 'month' | 'all';

const PERIODS: { id: AttendancePeriod; label: string }[] = [
  { id: 'today', label: 'اليوم' },
  { id: 'week', label: 'هذا الأسبوع' },
  { id: 'month', label: 'هذا الشهر' },
  { id: 'all', label: 'الكل' },
];

type UiState =
  | 'LOADING'
  | 'READY_ALLOWED'
  | 'READY_BLOCKED'
  | 'ACTIVE_SHIFT'
  | 'HISTORY_EMPTY'
  | 'API_ERROR'
  | 'PROFILE_NOT_LINKED';

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('ar-IL', { hour: '2-digit', minute: '2-digit' });
}

function liveElapsedLabel(startIso: string, nowMs: number): string {
  const mins = Math.max(0, Math.floor((nowMs - new Date(startIso).getTime()) / 60_000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h <= 0) return `${m} دقيقة · قيد الدوام الآن`;
  if (m === 0) return `${h} ساعات · قيد الدوام الآن`;
  return `${h} ساعات و${m} دقيقة · قيد الدوام الآن`;
}

export function CourierAttendancePanel({
  enabled,
  compact = false,
  defaultPeriod = 'all',
  showEarningsLink = false,
}: {
  enabled: boolean;
  compact?: boolean;
  defaultPeriod?: AttendancePeriod;
  showEarningsLink?: boolean;
}) {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<AttendancePeriod>(defaultPeriod);
  const [shiftMsg, setShiftMsg] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const activeQ = useQuery({
    queryKey: ['courier-shift-active'],
    queryFn: () => apiFetch<ActiveShiftResponse>('/courier/shifts/active'),
    enabled,
    refetchInterval: 10_000,
    retry: 1,
  });

  const historyQ = useQuery({
    queryKey: ['courier-shifts-history', period],
    queryFn: () => apiFetch<ShiftsHistoryResponse>(`/courier/shifts?limit=200&period=${period}`),
    enabled,
    refetchInterval: 30_000,
    retry: 1,
  });

  const activeShift = activeQ.data?.shift ?? null;
  const onShift = !!activeShift && !activeShift.endTime;
  const canStartShift = activeQ.data?.canStartShift === true;

  useEffect(() => {
    if (!onShift) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [onShift]);

  const startShift = useMutation({
    mutationFn: () => apiFetch<AttendanceShift>('/courier/shifts/start', { method: 'POST' }),
    onSuccess: () => {
      setShiftMsg('تم بدء الدوام');
      qc.invalidateQueries({ queryKey: ['courier-shift-active'] });
      qc.invalidateQueries({ queryKey: ['courier-shifts-history'] });
      qc.invalidateQueries({ queryKey: ['courier-earnings'] });
    },
    onError: (e: Error) => setShiftMsg(e.message),
  });

  const endShift = useMutation({
    mutationFn: () => apiFetch<AttendanceShift>('/courier/shifts/end', { method: 'POST' }),
    onSuccess: () => {
      setShiftMsg('تم إنهاء الدوام');
      qc.invalidateQueries({ queryKey: ['courier-shift-active'] });
      qc.invalidateQueries({ queryKey: ['courier-shifts-history'] });
      qc.invalidateQueries({ queryKey: ['courier-earnings'] });
    },
    onError: (e: Error) => setShiftMsg(e.message),
  });

  let uiState: UiState = 'LOADING';
  if (!enabled) uiState = 'PROFILE_NOT_LINKED';
  else if (activeQ.isError || historyQ.isError) uiState = 'API_ERROR';
  else if (activeQ.isLoading || (historyQ.isLoading && !historyQ.data)) uiState = 'LOADING';
  else if (onShift) uiState = 'ACTIVE_SHIFT';
  else if (!canStartShift) uiState = 'READY_BLOCKED';
  else uiState = 'READY_ALLOWED';

  const historyEmpty = !historyQ.data?.shifts?.length;
  const periodLabel =
    historyQ.data?.from && historyQ.data?.to
      ? `${historyQ.data.from} → ${historyQ.data.to}${historyQ.data.timezone ? ` (${historyQ.data.timezone})` : ''}`
      : PERIODS.find((p) => p.id === period)?.label ?? period;
  const hoursWorked = historyQ.data?.hoursWorked ?? 0;

  const retry = () => {
    void activeQ.refetch();
    void historyQ.refetch();
  };

  return (
    <section
      className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3"
      aria-label="الدوام"
      data-attendance-state={uiState}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold text-slate-800 flex items-center gap-2">
          <Clock className="w-5 h-5 text-teal-600" />
          الدوام
        </h2>
        {showEarningsLink && (
          <Link to="/earnings" className="text-xs font-semibold text-teal-700 hover:underline">
            تفاصيل الدخل ←
          </Link>
        )}
      </div>

      {uiState === 'PROFILE_NOT_LINKED' && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          لا يوجد ملف سائق مرتبط بهذا الحساب. تواصل مع الإدارة.
        </p>
      )}

      {uiState === 'LOADING' && (
        <p className="text-sm text-slate-500 text-center py-4">جاري تحميل حالة الدوام...</p>
      )}

      {uiState === 'API_ERROR' && (
        <div className="space-y-2">
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            تعذّر تحميل بيانات الدوام. تحقق من الاتصال ثم أعد المحاولة.
          </p>
          <button
            type="button"
            onClick={retry}
            className="w-full min-h-[44px] rounded-xl border border-slate-200 text-slate-700 font-semibold flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            إعادة المحاولة
          </button>
        </div>
      )}

      {(uiState === 'READY_ALLOWED' || uiState === 'READY_BLOCKED' || uiState === 'ACTIVE_SHIFT') && (
        <>
          <p className="text-xs text-slate-500">
            إذن بدء الدوام:{' '}
            <span className={canStartShift ? 'text-emerald-700 font-semibold' : 'text-amber-800 font-semibold'}>
              {canStartShift ? 'مسموح بدء الدوام' : 'بدء الدوام موقوف'}
            </span>
          </p>

          {uiState === 'ACTIVE_SHIFT' && activeShift ? (
            <div className="space-y-3">
              <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 font-semibold">
                قيد الدوام الآن
              </p>
              <p className="text-sm text-slate-700 text-center">البداية {formatClock(activeShift.startTime)}</p>
              <p className="text-sm font-semibold text-slate-800 text-center">
                {activeShift.durationLabel?.includes('قيد الدوام')
                  ? activeShift.durationLabel
                  : liveElapsedLabel(activeShift.startTime, nowMs)}
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
                disabled={startShift.isPending || uiState === 'READY_BLOCKED'}
                className="w-full min-h-[52px] rounded-2xl bg-teal-600 text-white font-bold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
              >
                <Play className="w-5 h-5" />
                بدء الدوام
              </button>
              {uiState === 'READY_BLOCKED' && (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
                  بدء الدوام غير مفعّل. تواصل مع الإدارة
                </p>
              )}
            </div>
          )}
        </>
      )}

      {shiftMsg && <p className="text-sm text-slate-600 text-center">{shiftMsg}</p>}
      {activeQ.data?.shiftWarning && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {activeQ.data.shiftWarning}
        </p>
      )}

      {uiState !== 'PROFILE_NOT_LINKED' && uiState !== 'LOADING' && (
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <div className="flex gap-1 p-1 bg-slate-50 rounded-xl overflow-x-auto">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriod(p.id)}
                className={`flex-1 min-w-[4rem] py-1.5 rounded-lg text-xs font-semibold ${
                  period === p.id ? 'bg-teal-600 text-white' : 'text-slate-600'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div>
            <h3 className="font-bold text-slate-800 text-sm mb-1">سجل الدوام</h3>
            <p className="text-xs text-slate-500 mb-2">
              إجمالي الفترة: {hoursWorked.toFixed(1)} س — {periodLabel}
            </p>
            {historyQ.isError ? (
              <p className="text-sm text-red-700">تعذّر تحميل السجل</p>
            ) : historyEmpty ? (
              <p className="text-sm text-slate-500 text-center py-3" data-attendance-history="empty">
                {hoursWorked === 0
                  ? 'لا توجد ساعات ضمن هذه الفترة'
                  : 'لا توجد ورديات في هذه الفترة'}
              </p>
            ) : (
              <ul className={`space-y-2 ${compact ? 'max-h-48 overflow-y-auto' : ''}`}>
                {(historyQ.data?.shifts ?? []).slice(0, compact ? 5 : 20).map((s) => {
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
                          {s.endTime ? ` → ${formatClock(s.endTime)}` : ''}
                        </p>
                        {s.autoClosed && <p className="text-xs text-amber-700">إغلاق تلقائي</p>}
                        {s.accountingLabel && <p className="text-xs text-slate-500">{s.accountingLabel}</p>}
                      </div>
                      <p className={`shrink-0 font-semibold ${isActive ? 'text-emerald-700' : 'text-slate-900'}`}>
                        {s.durationLabel ?? (isActive ? 'قيد الدوام الآن' : '—')}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
            {historyEmpty && period !== 'all' && (
              <button
                type="button"
                onClick={() => setPeriod('all')}
                className="mt-2 w-full text-sm text-teal-700 font-semibold py-2"
              >
                عرض الكل
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
