import { useEffect, useState } from 'react';
import { Button, Card, Input } from '@nmd/ui';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  defaultOperationalCosts,
  loadOperationalCosts,
  monthlyOperationalTotal,
  saveOperationalCosts,
  type OperationalCostEntry,
} from '../../lib/economics-costs';
import { formatMoney } from '../../lib/economics';

type Props = {
  orderCount: number;
  onTotalChange: (total: number) => void;
};

export default function EconomicsCostStructurePanel({ orderCount, onTotalChange }: Props) {
  const [entries, setEntries] = useState<OperationalCostEntry[]>(() => loadOperationalCosts());

  useEffect(() => {
    saveOperationalCosts(entries);
    onTotalChange(monthlyOperationalTotal(entries));
  }, [entries, onTotalChange]);

  const total = monthlyOperationalTotal(entries);
  const opsPerOrderEstimate = orderCount > 0 ? total / orderCount : 0;

  const updateEntry = (id: string, patch: Partial<OperationalCostEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };

  return (
    <Card className="overflow-hidden">
      <div className="p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">هيكل التكاليف التشغيلية</h2>
          <p className="text-sm text-gray-500 mt-0.5">مدخلات شهرية محلية — ليست محاسبة رسمية</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEntries(defaultOperationalCosts())}
          >
            <RotateCcw className="w-4 h-4" />
            إعادة ضبط
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setEntries((prev) => [
                ...prev,
                { id: `cost-${Date.now()}`, category: 'misc', label: 'بند جديد', amountMonthly: 0 },
              ])
            }
          >
            <Plus className="w-4 h-4" />
            إضافة
          </Button>
        </div>
      </div>
      <div className="p-5 grid gap-3 md:grid-cols-2">
        {entries.map((e) => (
          <div key={e.id} className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 border border-gray-100">
            <Input
              value={e.label}
              onChange={(ev) => updateEntry(e.id, { label: ev.target.value })}
              className="flex-1 text-sm"
            />
            <Input
              type="number"
              min={0}
              step={1}
              value={e.amountMonthly}
              onChange={(ev) => updateEntry(e.id, { amountMonthly: Number(ev.target.value) || 0 })}
              className="w-28 text-sm"
            />
            <span className="text-xs text-gray-500 whitespace-nowrap">₪/شهر</span>
            <button
              type="button"
              onClick={() => setEntries((prev) => prev.filter((x) => x.id !== e.id))}
              className="p-1.5 text-gray-400 hover:text-red-600"
              aria-label="حذف"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-4 rounded-xl bg-slate-900 text-white">
          <p className="text-sm text-slate-300">إجمالي التكاليف الشهرية</p>
          <p className="text-2xl font-bold mt-1">{formatMoney(total)}</p>
        </div>
        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100">
          <p className="text-sm text-indigo-700">تخصيص تشغيلي تقديري / طلب</p>
          <p className="text-2xl font-bold text-indigo-900 mt-1">
            {orderCount > 0 ? formatMoney(opsPerOrderEstimate) : '—'}
          </p>
          <p className="text-xs text-indigo-600 mt-1">بناءً على معدل الطلبات في الفترة المحددة</p>
        </div>
      </div>
    </Card>
  );
}
