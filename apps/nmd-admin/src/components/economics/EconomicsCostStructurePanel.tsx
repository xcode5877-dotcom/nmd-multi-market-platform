import { useEffect, useState } from 'react';
import { Button, Card, Input } from '@nmd/ui';
import { AlertTriangle, Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  defaultOperationalCosts,
  loadOperationalCosts,
  monthlyOperationalTotal,
  saveOperationalCosts,
  type OperationalCostCategory,
  type OperationalCostEntry,
} from '../../lib/economics-costs';
import { formatMoney } from '../../lib/economics';

type Props = {
  orderCount: number;
  onTotalChange: (total: number) => void;
};

const DELIVERY_RELATED_CATEGORIES: OperationalCostCategory[] = ['drivers', 'fuel'];

export default function EconomicsCostStructurePanel({ orderCount, onTotalChange }: Props) {
  const [entries, setEntries] = useState<OperationalCostEntry[]>(() => loadOperationalCosts());

  useEffect(() => {
    saveOperationalCosts(entries);
    onTotalChange(monthlyOperationalTotal(entries));
  }, [entries, onTotalChange]);

  const total = monthlyOperationalTotal(entries);
  const opsPerOrderEstimate = orderCount > 0 ? total / orderCount : 0;
  const deliveryRelatedMonthly = entries
    .filter((e) => DELIVERY_RELATED_CATEGORIES.includes(e.category))
    .reduce((s, e) => s + Math.max(0, e.amountMonthly), 0);

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

      <div className="mx-5 mt-4 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900 flex gap-2">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">تجنّب العد المزدوج لتكاليف التوصيل</p>
          <p className="text-amber-800/90 mt-1 text-xs leading-relaxed">
            يمكنك احتساب تكلفة التوصيل بطريقتين — وليس معًا: (١) متوسط تكلفة توصيل / طلب في المحاكاة
            وهامش التوصيل، أو (٢) بنود السائقين/الوقود ضمن التكاليف الشهرية التشغيلية. لا تُدخل
            نفس تكلفة السائق/الوقود في كلا المكانين.
          </p>
          {deliveryRelatedMonthly > 0 && (
            <p className="text-xs text-amber-800 mt-2">
              بنود توصيل في التكاليف الشهرية: {formatMoney(deliveryRelatedMonthly)} — تأكد أن
              «تكلفة التوصيل / طلب» في المحاكاة لا تكررها.
            </p>
          )}
        </div>
      </div>

      <div className="p-5 grid gap-3 md:grid-cols-2">
        {entries.map((e) => {
          const isDeliveryRelated = DELIVERY_RELATED_CATEGORIES.includes(e.category);
          return (
            <div
              key={e.id}
              className={`flex items-center gap-2 p-3 rounded-lg border ${
                isDeliveryRelated ? 'bg-orange-50/60 border-orange-100' : 'bg-gray-50 border-gray-100'
              }`}
            >
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
              {isDeliveryRelated && (
                <span className="text-[10px] text-orange-700 whitespace-nowrap">توصيل</span>
              )}
              <button
                type="button"
                onClick={() => setEntries((prev) => prev.filter((x) => x.id !== e.id))}
                className="p-1.5 text-gray-400 hover:text-red-600"
                aria-label="حذف"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
      <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-4 rounded-xl bg-slate-900 text-white">
          <p className="text-sm text-slate-300">إجمالي التكاليف الشهرية (تشغيل عام)</p>
          <p className="text-2xl font-bold mt-1">{formatMoney(total)}</p>
          <p className="text-xs text-slate-400 mt-1">VPS، AI، إعلانات، دعم — بدون تكرار تكلفة التوصيل</p>
        </div>
        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100">
          <p className="text-sm text-indigo-700">تخصيص تشغيلي تقديري / طلب</p>
          <p className="text-2xl font-bold text-indigo-900 mt-1">
            {orderCount > 0 ? formatMoney(opsPerOrderEstimate) : '—'}
          </p>
          <p className="text-xs text-indigo-600 mt-1">يُخصم في صافي المساهمة — منفصل عن تكلفة التوصيل / طلب</p>
        </div>
      </div>
    </Card>
  );
}
