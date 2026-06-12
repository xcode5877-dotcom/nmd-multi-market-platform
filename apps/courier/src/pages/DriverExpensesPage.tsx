import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import { ArrowRight, Fuel, Wrench, Car, ParkingCircle, MoreHorizontal, Check } from 'lucide-react';

const CATEGORIES = [
  { id: 'FUEL', label: 'بنزين', icon: Fuel },
  { id: 'REPAIR', label: 'تصليح', icon: Wrench },
  { id: 'CAR_WASH', label: 'غسيل', icon: Car },
  { id: 'PARKING', label: 'موقف', icon: ParkingCircle },
  { id: 'OTHER', label: 'أخرى', icon: MoreHorizontal },
] as const;

type ExpenseCategory = (typeof CATEGORIES)[number]['id'];

export default function DriverExpensesPage() {
  const qc = useQueryClient();
  const [category, setCategory] = useState<ExpenseCategory>('FUEL');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>('/courier/expenses', {
        method: 'POST',
        body: JSON.stringify({
          category,
          amount: Number(amount.replace(/,/g, '.')),
          note: note.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      setErr(null);
      setAmount('');
      setNote('');
      qc.invalidateQueries({ queryKey: ['courier-earnings'] });
      qc.invalidateQueries({ queryKey: ['courier-daily-summary'] });
    },
    onError: (e: Error) => setErr(e.message),
  });

  const canSubmit = amount.trim() && Number(amount.replace(/,/g, '.')) > 0;

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      <header className="bg-teal-600 text-white px-4 py-4 shadow">
        <Link to="/earnings" className="text-sm text-teal-100 mb-1 inline-flex items-center gap-1">
          <ArrowRight className="w-4 h-4 rotate-180" />
          الدخل
        </Link>
        <h1 className="text-xl font-bold">مصاريف السيارة</h1>
        <p className="text-sm text-teal-100">تُرسل للموافقة — تُحسب فقط بعد الاعتماد</p>
      </header>

      <div className="p-4 max-w-md mx-auto space-y-5">
        <div className="grid grid-cols-2 gap-2">
          {CATEGORIES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setCategory(id)}
              className={`min-h-[52px] rounded-xl text-sm font-bold flex flex-col items-center justify-center gap-1 border-2 transition-colors ${
                category === id
                  ? 'bg-teal-100 border-teal-400 text-teal-900'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="text-slate-700 font-semibold mb-2 block">المبلغ (₪)</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="w-full min-h-[52px] text-lg rounded-xl border-2 border-slate-200 bg-white px-4 py-3 focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none"
          />
        </label>

        <label className="block">
          <span className="text-slate-700 font-semibold mb-2 block">ملاحظة (اختياري)</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="مثال: تعبئة كاملة"
            className="w-full min-h-[48px] text-base rounded-xl border-2 border-slate-200 bg-white px-4 py-3 focus:border-teal-500 outline-none"
          />
        </label>

        {err && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{err}</p>}
        {save.isSuccess && (
          <p className="text-green-700 text-sm bg-green-50 rounded-lg px-3 py-2 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            تم الإرسال — بانتظار موافقة الإدارة
          </p>
        )}

        <button
          type="button"
          disabled={!canSubmit || save.isPending}
          onClick={() => save.mutate()}
          className="w-full min-h-[56px] text-lg font-bold rounded-2xl bg-teal-600 text-white shadow-lg shadow-teal-600/30 active:scale-[0.98] disabled:opacity-50 transition-transform"
        >
          {save.isPending ? 'جاري الحفظ...' : 'إرسال المصروف'}
        </button>
      </div>
    </div>
  );
}
