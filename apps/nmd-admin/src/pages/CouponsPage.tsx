import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import { Card, Button, Input, useToast } from '@nmd/ui';
import { Plus, Phone, Store } from 'lucide-react';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';
const api = new MockApiClient();

type CouponRow = {
  id: string;
  code: string;
  type: string;
  value: number;
  tenantId?: string | null;
  storeId?: string | null;
  oneTimeUse: boolean;
  winnerPhone?: string | null;
  usedAt?: string | null;
  createdAt: string;
  expiresAt?: string | null;
};

export default function CouponsPage() {
  const addToast = useToast().addToast;
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState('');
  const [type, setType] = useState<'FIXED' | 'PERCENT'>('FIXED');
  const [value, setValue] = useState('');
  const [storeId, setStoreId] = useState('');
  const [oneTimeUse, setOneTimeUse] = useState(false);
  const [winnerPhone, setWinnerPhone] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ['coupons'],
    queryFn: () => api.getCoupons(),
    enabled: !!MOCK_API_URL,
  });

  const { data: stores = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.listTenants(),
    enabled: !!MOCK_API_URL,
  });

  const storeNameMap = Object.fromEntries(stores.map((s) => [s.id, s.name]));

  const createMutation = useMutation({
    mutationFn: (body: { code: string; type: 'FIXED' | 'PERCENT'; value: number; tenantId?: string; storeId?: string; oneTimeUse?: boolean; winnerPhone?: string; expiresAt?: string }) =>
      api.createCoupon(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      setCreateOpen(false);
      setCode('');
      setValue('');
      setStoreId('');
      setWinnerPhone('');
      setExpiresAt('');
      setOneTimeUse(false);
      addToast('تم إنشاء كود الخصم', 'success');
    },
    onError: (e: Error) => addToast(e.message, 'error'),
  });

  const handleCreate = () => {
    const codeTrim = code.trim().toUpperCase();
    const valueNum = Number(value);
    if (!codeTrim) {
      addToast('أدخل رمز الكود', 'error');
      return;
    }
    if (Number.isNaN(valueNum) || valueNum <= 0) {
      addToast('قيمة الخصم يجب أن تكون رقماً موجباً', 'error');
      return;
    }
    if (type === 'PERCENT' && valueNum > 100) {
      addToast('نسبة الخصم يجب أن تكون 1–100', 'error');
      return;
    }
    createMutation.mutate({
      code: codeTrim,
      type,
      value: valueNum,
      storeId: storeId.trim() || undefined,
      oneTimeUse,
      winnerPhone: winnerPhone.trim() || undefined,
      expiresAt: expiresAt.trim() || undefined,
    });
  };

  if (!MOCK_API_URL) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">أكواد الخصم</h1>
        <Card className="p-6">
          <p className="text-sm text-amber-600">يتطلب mock-api (VITE_MOCK_API_URL)</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">أكواد الخصم</h1>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          إنشاء كود
        </Button>
      </div>

      {createOpen && (
        <Card className="p-6 mb-6 border-2 border-primary/20">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">كود خصم جديد</h2>
          <div className="grid gap-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">رمز الكود</label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="مثال: WIN2024"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">نوع الخصم</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as 'FIXED' | 'PERCENT')}
                className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900"
              >
                <option value="FIXED">مبلغ ثابت (شيكل)</option>
                <option value="PERCENT">نسبة مئوية (%)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {type === 'PERCENT' ? 'نسبة الخصم (1–100)' : 'قيمة الخصم (شيكل)'}
              </label>
              <Input
                type="number"
                min={type === 'PERCENT' ? 1 : 0.01}
                max={type === 'PERCENT' ? 100 : undefined}
                step={type === 'PERCENT' ? 1 : 0.01}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={type === 'PERCENT' ? '20' : '15'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                <Store className="w-4 h-4" />
                تخصيص لمتجر (اختياري)
              </label>
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900"
              >
                <option value="">جميع المتاجر (بدون تخصيص)</option>
                {stores
                  .filter((s) => s.enabled)
                  .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
                  .map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">عند التخصيص، الكود صالح فقط لمنتجات هذا المتجر</p>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={oneTimeUse}
                onChange={(e) => setOneTimeUse(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary"
              />
              <span className="text-sm font-medium text-gray-700">استخدام لمرة واحدة (للفائز برقم معين)</span>
            </label>
            {oneTimeUse && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Phone className="w-4 h-4" />
                  رقم الفائز (هاتف)
                </label>
                <Input
                  value={winnerPhone}
                  onChange={(e) => setWinnerPhone(e.target.value)}
                  placeholder="05xxxxxxxx"
                  dir="ltr"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">انتهاء الصلاحية (اختياري)</label>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreate} loading={createMutation.isPending}>
                حفظ
              </Button>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                إلغاء
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">جاري التحميل...</div>
        ) : coupons.length === 0 ? (
          <div className="p-8 text-center text-gray-500">لا توجد أكواد خصم. أنشئ كوداً للفائزين أو العروض.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-right py-3 px-4 font-medium text-gray-700">الكود</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">النوع</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">القيمة</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">المتجر</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">مرة واحدة</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">رقم الفائز</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">الحالة</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">انتهاء</th>
                </tr>
              </thead>
              <tbody>
                {(coupons as CouponRow[]).map((c) => (
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="py-3 px-4 font-mono font-semibold" dir="ltr">{c.code}</td>
                    <td className="py-3 px-4">{c.type === 'PERCENT' ? 'نسبة' : 'مبلغ'}</td>
                    <td className="py-3 px-4">{c.type === 'PERCENT' ? `${c.value}%` : `${c.value} ₪`}</td>
                    <td className="py-3 px-4">{c.storeId ? (storeNameMap[c.storeId] ?? c.storeId.slice(0, 8)) : 'الكل'}</td>
                    <td className="py-3 px-4">{c.oneTimeUse ? 'نعم' : '—'}</td>
                    <td className="py-3 px-4" dir="ltr">{c.winnerPhone ?? '—'}</td>
                    <td className="py-3 px-4">{c.usedAt ? 'مستخدم' : 'نشط'}</td>
                    <td className="py-3 px-4">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('ar-EG') : '—'}</td>
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
