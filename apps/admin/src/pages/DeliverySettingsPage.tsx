import { useState } from 'react';
import type { DeliveryZone } from '@nmd/core';
import { Card, Button, Input, Modal, useToast } from '@nmd/ui';
import { useAdminContext } from '../context/AdminContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import { formatMoney } from '@nmd/core';

const api = new MockApiClient();
const USE_API = !!import.meta.env.VITE_MOCK_API_URL;

export default function DeliverySettingsPage() {
  const { tenantId } = useAdminContext();
  const queryClient = useQueryClient();
  const addToast = useToast().addToast;
  const [modalOpen, setModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [zoneForm, setZoneForm] = useState({ name: '', fee: 0, etaMinutes: 0, isActive: true, sortOrder: 0 });

  const { data: zones = [], isLoading } = useQuery({
    queryKey: ['delivery-zones', tenantId],
    queryFn: () => (USE_API ? api.getDeliveryZones(tenantId) : api.getDeliveryZones(tenantId)),
    enabled: !!tenantId,
  });

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
      if (USE_API) {
        if (editingZone) {
          await api.patchDeliveryZoneApi(tenantId, editingZone.id, zoneForm);
          addToast('تم تحديث المنطقة', 'success');
        } else {
          await api.createDeliveryZoneApi(tenantId, zoneForm);
          addToast('تم إضافة المنطقة', 'success');
        }
      } else {
        if (editingZone) {
          await api.updateDeliveryZoneApi(tenantId, editingZone.id, zoneForm);
          addToast('تم تحديث المنطقة', 'success');
        } else {
          await api.createDeliveryZoneApi(tenantId, zoneForm);
          addToast('تم إضافة المنطقة', 'success');
        }
      }
      queryClient.invalidateQueries({ queryKey: ['delivery-zones', tenantId] });
      setModalOpen(false);
    } catch {
      addToast('حدث خطأ', 'error');
    }
  };

  const handleToggleActive = async (z: DeliveryZone) => {
    try {
      if (USE_API) {
        await api.patchDeliveryZoneApi(tenantId, z.id, { isActive: !z.isActive });
      } else {
        await api.patchDeliveryZoneApi(tenantId, z.id, { isActive: !z.isActive });
      }
      queryClient.invalidateQueries({ queryKey: ['delivery-zones', tenantId] });
      addToast(z.isActive ? 'تم إخفاء المنطقة' : 'تم تفعيل المنطقة', 'success');
    } catch {
      addToast('حدث خطأ', 'error');
    }
  };

  const handleDeleteZone = async (id: string) => {
    try {
      await api.deleteDeliveryZoneApi(tenantId, id);
      queryClient.invalidateQueries({ queryKey: ['delivery-zones', tenantId] });
      addToast('تم حذف المنطقة', 'success');
      setModalOpen(false);
    } catch {
      addToast('حدث خطأ', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">مناطق التوصيل</h1>
      <Card className="p-6 max-w-2xl space-y-6">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="font-medium">المناطق</label>
            <Button size="sm" onClick={handleAddZone}>
              إضافة منطقة
            </Button>
          </div>
          <div className="divide-y divide-gray-200">
            {sortedZones.length === 0 ? (
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
