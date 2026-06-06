import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import { Card, Button, Input, useToast } from '@nmd/ui';
import { Plus, Pencil, CircleDot } from 'lucide-react';

const TEAL = '#0f766e';
const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';
const api = new MockApiClient();

type WheelPrizeRow = {
  id: string;
  label: string;
  type: string;
  value: number;
  chanceWeight: number;
  isActive: boolean;
  sortOrder: number;
};

const TYPE_LABELS: Record<string, string> = {
  PERCENT: 'نسبة مئوية',
  FIXED: 'مبلغ ثابت',
  COINS: 'عملات',
  NO_WIN: 'حظاً أوفر',
};

export default function LuckyWheelAdmin() {
  const addToast = useToast().addToast;
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [type, setType] = useState<string>('NO_WIN');
  const [value, setValue] = useState('');
  const [chanceWeight, setChanceWeight] = useState('10');
  const [isActive, setIsActive] = useState(true);

  const { data: prizes = [], isLoading } = useQuery({
    queryKey: ['admin-wheel-prizes'],
    queryFn: () => api.getAdminWheelPrizes(),
    enabled: !!MOCK_API_URL,
  });

  const upsertMutation = useMutation({
    mutationFn: (body: {
      id?: string;
      label: string;
      type: string;
      value?: number;
      chanceWeight?: number;
      isActive?: boolean;
      sortOrder?: number;
    }) => api.upsertWheelPrize(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-wheel-prizes'] });
      resetForm();
      addToast('تم حفظ الجائزة', 'success');
    },
    onError: (e: Error) => addToast(e.message, 'error'),
  });

  const resetForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setLabel('');
    setType('NO_WIN');
    setValue('');
    setChanceWeight('10');
    setIsActive(true);
  };

  const openEdit = (p: WheelPrizeRow) => {
    setEditingId(p.id);
    setLabel(p.label);
    setType(p.type);
    setValue(String(p.value));
    setChanceWeight(String(p.chanceWeight));
    setIsActive(p.isActive);
    setFormOpen(true);
  };

  const handleSubmit = () => {
    const labelTrim = label.trim();
    if (!labelTrim) {
      addToast('أدخل اسم الجائزة', 'error');
      return;
    }
    const valueNum = Number(value);
    const weightNum = Math.min(100, Math.max(1, Math.floor(Number(chanceWeight) || 1)));
    if ((type === 'PERCENT' || type === 'FIXED' || type === 'COINS') && (Number.isNaN(valueNum) || valueNum < 0)) {
      addToast('أدخل قيمة صحيحة', 'error');
      return;
    }
    if (type === 'PERCENT' && valueNum > 100) {
      addToast('النسبة يجب أن تكون 1–100', 'error');
      return;
    }
    upsertMutation.mutate({
      id: editingId ?? undefined,
      label: labelTrim,
      type,
      value: type !== 'NO_WIN' ? valueNum : 0,
      chanceWeight: weightNum,
      isActive,
      sortOrder: prizes.length,
    });
  };

  if (!MOCK_API_URL) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">عجلة الحظ — إدارة الجوائز</h1>
        <Card className="p-6">
          <p className="text-sm text-amber-600">يتطلب mock-api (VITE_MOCK_API_URL)</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <CircleDot className="w-7 h-7" style={{ color: TEAL }} />
          عجلة الحظ — إدارة الجوائز
        </h1>
        <Button
          onClick={() => {
            resetForm();
            setFormOpen(true);
          }}
          className="gap-2 rounded-full px-6 font-semibold"
          style={{ backgroundColor: TEAL, color: 'white' }}
        >
          <Plus className="w-4 h-4" />
          إضافة جائزة
        </Button>
      </div>

      {formOpen && (
        <Card
          className="p-6 mb-6 rounded-3xl border-2"
          style={{ borderColor: `${TEAL}30`, boxShadow: `0 4px 20px ${TEAL}20` }}
        >
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {editingId ? 'تعديل الجائزة' : 'جائزة جديدة'}
          </h2>
          <div className="grid gap-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">اسم الجائزة</label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="مثال: خصم 10%"
                className="rounded-full px-4"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">نوع الجائزة</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full h-10 px-4 rounded-full border border-gray-300 bg-white text-gray-900"
              >
                <option value="PERCENT">نسبة مئوية</option>
                <option value="FIXED">مبلغ ثابت</option>
                <option value="COINS">عملات</option>
                <option value="NO_WIN">حظاً أوفر</option>
              </select>
            </div>
            {(type === 'PERCENT' || type === 'FIXED' || type === 'COINS') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {type === 'PERCENT' ? 'النسبة (1–100)' : type === 'COINS' ? 'عدد العملات' : 'قيمة الخصم (شيكل)'}
                </label>
                <Input
                  type="number"
                  min={type === 'PERCENT' ? 1 : 0}
                  max={type === 'PERCENT' ? 100 : undefined}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={type === 'PERCENT' ? '10' : type === 'COINS' ? '10' : '15'}
                  className="rounded-full px-4"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">وزن الاحتمال (1–100)</label>
              <Input
                type="number"
                min={1}
                max={100}
                value={chanceWeight}
                onChange={(e) => setChanceWeight(e.target.value)}
                placeholder="10"
                className="rounded-full px-4"
              />
              <p className="text-xs text-gray-500 mt-1">كلما زاد الوزن، زاد احتمال ظهور هذه الجائزة</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded"
                style={{ accentColor: TEAL }}
              />
              <span className="text-sm font-medium text-gray-700">نشطة (تظهر للعملاء)</span>
            </label>
            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                loading={upsertMutation.isPending}
                className="rounded-full px-6 font-semibold"
                style={{ backgroundColor: TEAL, color: 'white' }}
              >
                حفظ
              </Button>
              <Button
                variant="outline"
                onClick={resetForm}
                className="rounded-full px-6"
                style={{ borderColor: TEAL, color: TEAL }}
              >
                إلغاء
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden rounded-2xl">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">جاري التحميل...</div>
        ) : prizes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            لا توجد جوائز. أضف جوائز لعجلة الحظ ليظهرها العملاء.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ backgroundColor: `${TEAL}12` }}>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">الجائزة</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">النوع</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">القيمة</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">الوزن</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">الحالة</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {(prizes as WheelPrizeRow[]).map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-3 px-4 font-medium text-gray-900">{p.label}</td>
                    <td className="py-3 px-4">{TYPE_LABELS[p.type] ?? p.type}</td>
                    <td className="py-3 px-4">
                      {p.type === 'PERCENT' ? `${p.value}%` : p.type === 'COINS' ? `${p.value} عملة` : p.type === 'FIXED' ? `₪${p.value}` : '—'}
                    </td>
                    <td className="py-3 px-4">{p.chanceWeight}</td>
                    <td className="py-3 px-4">
                      <span
                        className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: p.isActive ? `${TEAL}20` : '#fee2e2',
                          color: p.isActive ? TEAL : '#b91c1c',
                        }}
                      >
                        {p.isActive ? 'نشطة' : 'معطّلة'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
                        style={{ backgroundColor: `${TEAL}15`, color: TEAL }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        تعديل
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
