import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Input, Select, Modal, useToast } from '@nmd/ui';
import { MockApiClient } from '@nmd/mock';
import type { DeliveryZone } from '@nmd/core';
import { formatMoney } from '@nmd/core';
import { ArrowLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTenantOptional } from '../tenant-portal/contexts/TenantContext';

const api = new MockApiClient();
const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

const TENANT_TYPES = [
  { value: 'RESTAURANT', label: 'مطعم' },
  { value: 'SHOP', label: 'متجر' },
  { value: 'SERVICE', label: 'خدمة' },
];

const DELIVERY_MODES = [
  { value: 'TENANT', label: 'توصيل المستأجر (سائقون خاصون)' },
  { value: 'MARKET', label: 'توصيل السوق (سائقون السوق)' },
  { value: 'PICKUP_ONLY', label: 'استلام فقط' },
];

export default function TenantDeliverySettingsPage() {
  const params = useParams<{ id: string; tenantId: string }>();
  const tenantCtx = useTenantOptional();
  const { data: me } = useQuery({ queryKey: ['me', tenantCtx?.tenantId], queryFn: () => api.getMe(), enabled: !!MOCK_API_URL && !tenantCtx });
  const tenantId = tenantCtx?.tenantId ?? params.tenantId ?? params.id ?? me?.tenantId;
  const marketId = params.tenantId ? params.id : undefined;
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [form, setForm] = useState({
    tenantType: 'SHOP',
    deliveryProviderMode: 'TENANT',
    allowMarketCourierFallback: true,
    defaultPrepTimeMin: 30,
  });

  const { data: tenant, isLoading } = useQuery({
    queryKey: ['tenant-registry', tenantId],
    queryFn: () => api.getTenantById(tenantId!),
    enabled: !!tenantId && !!MOCK_API_URL,
  });

  useEffect(() => {
    if (tenant) {
      setForm({
        tenantType: (tenant as { tenantType?: string }).tenantType ?? 'SHOP',
        deliveryProviderMode: (tenant as { deliveryProviderMode?: string }).deliveryProviderMode ?? 'TENANT',
        allowMarketCourierFallback: (tenant as { allowMarketCourierFallback?: boolean }).allowMarketCourierFallback ?? true,
        defaultPrepTimeMin: (tenant as { defaultPrepTimeMin?: number }).defaultPrepTimeMin ?? 30,
      });
    }
  }, [tenant]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.patchTenantDeliverySettings(tenantId!, {
        tenantType: form.tenantType,
        deliveryProviderMode: form.deliveryProviderMode,
        allowMarketCourierFallback: form.allowMarketCourierFallback,
        defaultPrepTimeMin: form.defaultPrepTimeMin,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-registry', tenantId] });
      addToast('تم الحفظ', 'success');
    },
    onError: (e) => addToast(e instanceof Error ? e.message : 'فشل الحفظ', 'error'),
  });

  const { data: zones = [], isLoading: zonesLoading } = useQuery({
    queryKey: ['delivery-zones', tenantId],
    queryFn: () => api.getDeliveryZones(tenantId!),
    enabled: !!tenantId,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [zoneForm, setZoneForm] = useState({ name: '', fee: 0, etaMinutes: 0, isActive: true, sortOrder: 0 });

  const sortedZones = [...zones].sort((a, b) => {
    const soA = a.sortOrder ?? 999;
    const soB = b.sortOrder ?? 999;
    if (soA !== soB) return soA - soB;
    return (a.name ?? '').localeCompare(b.name ?? '');
  });

  const handleAddZone = () => {
    setEditingZone(null);
    setZoneForm({ name: '', fee: 0, etaMinutes: 0, isActive: true, sortOrder: sortedZones.length });
    setModalOpen(true);
  };
  const handleEditZone = (z: DeliveryZone) => {
    setEditingZone(z);
    setZoneForm({
      name: z.name,
      fee: z.fee,
      etaMinutes: z.etaMinutes ?? 0,
      isActive: z.isActive ?? true,
      sortOrder: z.sortOrder ?? 0,
    });
    setModalOpen(true);
  };
  const handleSaveZone = async () => {
    if (!zoneForm.name.trim()) return;
    try {
      if (editingZone) {
        await api.patchDeliveryZoneApi(tenantId!, editingZone.id, zoneForm);
        addToast('تم تحديث المنطقة', 'success');
      } else {
        await api.createDeliveryZoneApi(tenantId!, zoneForm);
        addToast('تم إضافة المنطقة', 'success');
      }
      queryClient.invalidateQueries({ queryKey: ['delivery-zones', tenantId] });
      setModalOpen(false);
    } catch {
      addToast('حدث خطأ', 'error');
    }
  };
  const handleToggleActive = async (z: DeliveryZone) => {
    try {
      await api.patchDeliveryZoneApi(tenantId!, z.id, { isActive: !z.isActive });
      queryClient.invalidateQueries({ queryKey: ['delivery-zones', tenantId] });
      addToast(z.isActive ? 'تم إخفاء المنطقة' : 'تم تفعيل المنطقة', 'success');
    } catch {
      addToast('حدث خطأ', 'error');
    }
  };
  const handleDeleteZone = async (id: string) => {
    try {
      await api.deleteDeliveryZoneApi(tenantId!, id);
      queryClient.invalidateQueries({ queryKey: ['delivery-zones', tenantId] });
      addToast('تم حذف المنطقة', 'success');
      setModalOpen(false);
    } catch {
      addToast('حدث خطأ', 'error');
    }
  };

  const syncToMarketMutation = useMutation({
    mutationFn: () => api.syncMarketDeliveryApi(marketId!, tenantId!),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['delivery-zones', tenantId] });
      addToast(data.synced > 0 ? `تم تطبيق المناطق على ${data.synced} متجر في السوق` : 'لا توجد متاجر أخرى في هذا السوق لتطبيق المناطق عليها', 'success');
    },
    onError: (e) => addToast(e instanceof Error ? e.message : 'فشل مزامنة المناطق', 'error'),
  });

  if (!tenantId || !MOCK_API_URL) {
    return <div className="p-8 text-gray-500">جاري التحميل...</div>;
  }
  if (isLoading) {
    return <div className="p-8 text-gray-500">جاري التحميل...</div>;
  }
  if (!tenant) {
    return <div className="p-8 text-red-600">المستأجر غير موجود</div>;
  }

  return (
    <div>
      <Link
        to={marketId ? `/markets/${marketId}/tenants/${tenantId}` : `/tenants/${tenantId}`}
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        رجوع
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">إعدادات التوصيل - {tenant.name}</h1>

      <Card className="p-6 max-w-md">
        <div className="space-y-4">
          <Select
            label="نوع المستأجر"
            options={TENANT_TYPES}
            value={form.tenantType}
            onChange={(e) => setForm((f) => ({ ...f, tenantType: e.target.value }))}
          />
          <Select
            label="وضع التوصيل"
            options={DELIVERY_MODES}
            value={form.deliveryProviderMode}
            onChange={(e) => setForm((f) => ({ ...f, deliveryProviderMode: e.target.value }))}
          />
          {form.deliveryProviderMode === 'TENANT' && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.allowMarketCourierFallback}
                onChange={(e) => setForm((f) => ({ ...f, allowMarketCourierFallback: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <span className="text-sm">السماح بالانتقال لتوصيل السوق عند التأخر</span>
            </label>
          )}
          {form.tenantType === 'RESTAURANT' && (
            <Input
              label="وقت التحضير الافتراضي (دقيقة)"
              type="number"
              min={5}
              max={120}
              value={String(form.defaultPrepTimeMin)}
              onChange={(e) => setForm((f) => ({ ...f, defaultPrepTimeMin: parseInt(e.target.value, 10) || 30 }))}
            />
          )}
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
          </Button>
        </div>
      </Card>

      <Card className="p-6 max-w-2xl mt-6 space-y-6">
        <h2 className="font-semibold text-gray-900">جدول مناطق التوصيل (دبورية، إكسال، وغيرها)</h2>
        <div>
          <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
            <label className="font-medium">المناطق</label>
            <div className="flex gap-2">
              {marketId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncToMarketMutation.mutate()}
                  disabled={syncToMarketMutation.isPending || sortedZones.length === 0}
                >
                  {syncToMarketMutation.isPending ? 'جاري التطبيق...' : 'تطبيق على كل متاجر السوق'}
                </Button>
              )}
              <Button size="sm" onClick={handleAddZone}>
                إضافة منطقة
              </Button>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {zonesLoading ? (
              <div className="flex items-center gap-2 text-gray-500 py-6">
                <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
                جاري تحميل المناطق...
              </div>
            ) : sortedZones.length === 0 ? (
              <p className="text-gray-500 py-4">لا توجد مناطق. أضف منطقة لتوصيل العملاء.</p>
            ) : (
              sortedZones.map((z) => (
                <div key={z.id} className="flex justify-between items-center py-3">
                  <div>
                    <span className={`font-medium ${!z.isActive ? 'text-gray-400 line-through' : ''}`}>{z.name}</span>
                    <span className="text-gray-500 text-sm me-2">- {formatMoney(z.fee)}</span>
                    {z.etaMinutes ? (
                      <span className="text-xs text-gray-400">({z.etaMinutes} د)</span>
                    ) : null}
                    {!z.isActive && (
                      <span className="text-xs text-amber-600 me-2">(غير نشط)</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleToggleActive(z)}>
                      {z.isActive ? 'إخفاء' : 'تفعيل'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEditZone(z)}>
                      تعديل
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeleteZone(z.id)}>
                      حذف
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingZone ? 'تعديل منطقة' : 'إضافة منطقة'}>
        <div className="space-y-4">
          <Input label="الاسم" value={zoneForm.name} onChange={(e) => setZoneForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="الرسوم (₪)" type="number" value={zoneForm.fee} onChange={(e) => setZoneForm((f) => ({ ...f, fee: +e.target.value }))} />
          <Input label="الوقت التقريبي (دقيقة)" type="number" value={zoneForm.etaMinutes} onChange={(e) => setZoneForm((f) => ({ ...f, etaMinutes: +e.target.value }))} />
          <Input label="ترتيب العرض" type="number" value={zoneForm.sortOrder} onChange={(e) => setZoneForm((f) => ({ ...f, sortOrder: +e.target.value }))} />
          {editingZone && (
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={zoneForm.isActive}
                onChange={(e) => setZoneForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
              نشط
            </label>
          )}
        </div>
        <div className="mt-6 flex gap-2">
          <Button onClick={handleSaveZone}>حفظ</Button>
          <Button variant="ghost" onClick={() => setModalOpen(false)}>إلغاء</Button>
        </div>
      </Modal>
    </div>
  );
}
