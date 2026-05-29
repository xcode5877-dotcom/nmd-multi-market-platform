import { useEffect, useState } from 'react';
import { Modal, Input, Button, Select } from '@nmd/ui';
import type { GlobalCourierRow } from '../../drivers/globalCourierTypes';
import type { MarketOption } from '../../drivers/fetchAllMarketCouriers';

export type CourierFormValues = {
  marketId: string;
  name: string;
  phone: string;
  email: string;
  password: string;
  isActive: boolean;
  isOnline: boolean;
  isAvailable: boolean;
  capacity: number;
  allowedStoreIds: string[];
};

type TenantOption = { id: string; name: string; marketId?: string };

const defaultValues: CourierFormValues = {
  marketId: '',
  name: '',
  phone: '',
  email: '',
  password: '',
  isActive: true,
  isOnline: false,
  isAvailable: true,
  capacity: 3,
  allowedStoreIds: [],
};

export function CourierFormModal({
  open,
  onClose,
  mode,
  markets,
  tenants,
  initial,
  saving,
  canWrite,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  markets: MarketOption[];
  tenants: TenantOption[];
  initial?: GlobalCourierRow | null;
  saving: boolean;
  canWrite: boolean;
  onSubmit: (values: CourierFormValues) => void;
}) {
  const [values, setValues] = useState<CourierFormValues>(defaultValues);

  useEffect(() => {
    if (!open) return;
    if (mode === 'edit' && initial) {
      setValues({
        marketId: initial.marketId,
        name: initial.name,
        phone: initial.phone ?? '',
        email: initial.email ?? '',
        password: '',
        isActive: initial.isActive !== false,
        isOnline: !!initial.isOnline,
        isAvailable: initial.isAvailable !== false,
        capacity: initial.capacity ?? 3,
        allowedStoreIds: Array.isArray(initial.allowedStoreIds) ? [...initial.allowedStoreIds] : [],
      });
    } else {
      setValues({
        ...defaultValues,
        marketId: markets[0]?.id ?? '',
      });
    }
  }, [open, mode, initial, markets]);

  const marketTenants = tenants.filter((t) => t.marketId === values.marketId);

  const handleSubmit = () => {
    if (!values.marketId || !values.name.trim()) return;
    if (mode === 'create' && !values.email.trim()) return;
    onSubmit(values);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'إضافة سائق' : `تعديل — ${initial?.name ?? ''}`}
      size="md"
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto">
        {mode === 'create' ? (
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">السوق *</label>
            <Select
              value={values.marketId}
              onChange={(e) => setValues((v) => ({ ...v, marketId: e.target.value, allowedStoreIds: [] }))}
              options={[
                { value: '', label: 'اختر السوق' },
                ...markets.map((m) => ({ value: m.id, label: m.name })),
              ]}
            />
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            السوق: <span className="font-medium text-gray-900">{initial?.marketName}</span>
          </p>
        )}

        <Input placeholder="الاسم *" value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} />
        <Input placeholder="رقم الجوال" value={values.phone} onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))} />
        <Input
          type="email"
          placeholder="البريد (تسجيل الدخول) *"
          value={values.email}
          onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
        />
        {mode === 'create' && (
          <Input
            type="password"
            placeholder="كلمة المرور (اختياري — الافتراضي 123456)"
            value={values.password}
            onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
          />
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.isActive}
              onChange={(e) => setValues((v) => ({ ...v, isActive: e.target.checked }))}
            />
            نشط
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.isOnline}
              onChange={(e) => setValues((v) => ({ ...v, isOnline: e.target.checked }))}
            />
            متصل
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.isAvailable}
              onChange={(e) => setValues((v) => ({ ...v, isAvailable: e.target.checked }))}
            />
            متاح للطلبات
          </label>
          <div>
            <label className="text-xs text-gray-500 block mb-1">السعة</label>
            <Input
              type="number"
              min={1}
              max={20}
              value={String(values.capacity)}
              onChange={(e) => setValues((v) => ({ ...v, capacity: Math.max(1, Number(e.target.value) || 1) }))}
            />
          </div>
        </div>

        {values.marketId && marketTenants.length > 0 && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">المتاجر المسموح بها (طلبات خارجية)</p>
            <div className="max-h-40 overflow-y-auto rounded border border-gray-200 divide-y">
              {marketTenants.map((t) => (
                <label key={t.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={values.allowedStoreIds.includes(t.id)}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        allowedStoreIds: e.target.checked
                          ? [...v.allowedStoreIds, t.id]
                          : v.allowedStoreIds.filter((id) => id !== t.id),
                      }))
                    }
                  />
                  <span>{t.name}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">بدون تحديد = كل متاجر السوق.</p>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !canWrite || !values.name.trim() || (mode === 'create' && (!values.marketId || !values.email.trim()))}>
            {saving ? 'جاري الحفظ...' : mode === 'create' ? 'إضافة' : 'حفظ'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
