import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import type { DeliveryZone } from '@nmd/core';
import { Card, Button, Input, Modal, useToast } from '@nmd/ui';
import { useAdminContext } from '../context/AdminContext';
import { useAuth } from '../contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import { formatMoney } from '@nmd/core';
import { isPlatformAdmin } from '../lib/is-platform-admin';
import { DeliveryZoneMapPicker } from '../components/DeliveryZoneMapPicker';

const api = new MockApiClient();
const USE_API = !!import.meta.env.VITE_MOCK_API_URL;

export default function DeliverySettingsPage() {
  const { tenantId } = useAdminContext();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const addToast = useToast().addToast;
  const [modalOpen, setModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [zoneForm, setZoneForm] = useState({
    name: '',
    fee: 0,
    etaMinutes: 0,
    isActive: true,
    sortOrder: 0,
    centerLat: undefined as number | undefined,
    centerLng: undefined as number | undefined,
    radiusKm: 2,
  });

  const canManageDelivery = isPlatformAdmin(currentUser?.role);
  const { data: deliverySettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['delivery-settings', tenantId],
    queryFn: () => api.getDeliverySettingsApi(tenantId) as Promise<{ modes?: { pickup?: boolean; delivery?: boolean }; minimumOrder?: number; deliveryFee?: number } | null>,
    enabled: !!tenantId && canManageDelivery,
  });
  const { data: zones = [], isLoading: zonesLoading } = useQuery({
    queryKey: ['delivery-zones', tenantId],
    queryFn: () => api.getDeliveryZones(tenantId),
    enabled: !!tenantId && canManageDelivery,
  });

  const [modeSettings, setModeSettings] = useState({
    pickup: deliverySettings?.modes?.pickup ?? true,
    delivery: deliverySettings?.modes?.delivery ?? true,
    minimumOrder: deliverySettings?.minimumOrder ?? 0,
    deliveryFee: deliverySettings?.deliveryFee ?? 0,
  });
  const [modeSettingsDirty, setModeSettingsDirty] = useState(false);
  useEffect(() => {
    if (deliverySettings) {
      setModeSettings({
        pickup: deliverySettings.modes?.pickup ?? true,
        delivery: deliverySettings.modes?.delivery ?? true,
        minimumOrder: deliverySettings.minimumOrder ?? 0,
        deliveryFee: deliverySettings.deliveryFee ?? 0,
      });
    }
  }, [deliverySettings]);

  const sortedZones = [...zones].sort((a, b) => {
    const soA = a.sortOrder ?? 999;
    const soB = b.sortOrder ?? 999;
    if (soA !== soB) return soA - soB;
    return (a.name ?? '').localeCompare(b.name ?? '');
  });

  /** Default center for radius map when saved coordinates are null (forces map to render on iOS/Safari). */
  const DEFAULT_RADIUS_MAP_CENTER = { lat: 32.70, lng: 35.37 };

  const handleAddZone = () => {
    setEditingZone(null);
    setZoneForm({
      name: '',
      fee: 0,
      etaMinutes: 0,
      isActive: true,
      sortOrder: sortedZones.length,
      centerLat: DEFAULT_RADIUS_MAP_CENTER.lat,
      centerLng: DEFAULT_RADIUS_MAP_CENTER.lng,
      radiusKm: 2,
    });
    setModalOpen(true);
  };

  const handleEditZone = (z: DeliveryZone) => {
    setEditingZone(z);
    const geo = z as DeliveryZone & { centerLat?: number; centerLng?: number; radiusKm?: number };
    setZoneForm({
      name: z.name,
      fee: z.fee,
      etaMinutes: z.etaMinutes ?? 0,
      isActive: z.isActive ?? true,
      sortOrder: z.sortOrder ?? 0,
      centerLat: geo.centerLat ?? DEFAULT_RADIUS_MAP_CENTER.lat,
      centerLng: geo.centerLng ?? DEFAULT_RADIUS_MAP_CENTER.lng,
      radiusKm: geo.radiusKm ?? 2,
    });
    setModalOpen(true);
  };

  const handleSaveZone = async () => {
    if (!zoneForm.name.trim()) return;
    const payload = {
      name: zoneForm.name.trim(),
      fee: zoneForm.fee,
      etaMinutes: zoneForm.etaMinutes,
      isActive: zoneForm.isActive,
      sortOrder: zoneForm.sortOrder,
      centerLat: zoneForm.centerLat,
      centerLng: zoneForm.centerLng,
      radiusKm: zoneForm.radiusKm,
    };
    try {
      if (USE_API) {
        if (editingZone) {
          await api.patchDeliveryZoneApi(tenantId, editingZone.id, payload);
          addToast('تم تحديث المنطقة', 'success');
        } else {
          await api.createDeliveryZoneApi(tenantId, payload);
          addToast('تم إضافة المنطقة', 'success');
        }
      } else {
        if (editingZone) {
          await api.updateDeliveryZoneApi(tenantId, editingZone.id, payload);
          addToast('تم تحديث المنطقة', 'success');
        } else {
          await api.createDeliveryZoneApi(tenantId, payload);
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

  const handleSaveModeSettings = async () => {
    try {
      await api.saveDeliverySettingsApi(tenantId, {
        ...(deliverySettings && typeof deliverySettings === 'object' ? deliverySettings : {}),
        tenantId,
        modes: { pickup: modeSettings.pickup, delivery: modeSettings.delivery },
        minimumOrder: modeSettings.minimumOrder,
        deliveryFee: modeSettings.deliveryFee,
      });
      queryClient.invalidateQueries({ queryKey: ['delivery-settings', tenantId] });
      setModeSettingsDirty(false);
      addToast('تم حفظ إعدادات التوصيل', 'success');
    } catch {
      addToast('حدث خطأ', 'error');
    }
  };

  if (!canManageDelivery) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">إعدادات التوصيل</h1>

      {/* Delivery mode settings — shown when settings loaded (or minimal loader) */}
      {settingsLoading && !deliverySettings ? (
        <Card className="p-6 max-w-2xl">
          <div className="flex items-center gap-2 text-gray-500">
            <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
            جاري تحميل إعدادات الوضع...
          </div>
        </Card>
      ) : (
        <Card className="p-6 max-w-2xl">
          <h2 className="font-semibold text-gray-900 mb-4">وضع التوصيل والحد الأدنى للطلب</h2>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={modeSettings.pickup}
                  onChange={(e) => { setModeSettings((s) => ({ ...s, pickup: e.target.checked })); setModeSettingsDirty(true); }}
                />
                <span>استلام من المحل</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={modeSettings.delivery}
                  onChange={(e) => { setModeSettings((s) => ({ ...s, delivery: e.target.checked })); setModeSettingsDirty(true); }}
                />
                <span>توصيل</span>
              </label>
            </div>
            <div className="flex flex-wrap gap-4 items-center">
              <div>
                <label className="block text-sm text-gray-600 mb-1">الحد الأدنى للطلب (₪)</label>
                <Input
                  type="number"
                  min={0}
                  value={modeSettings.minimumOrder}
                  onChange={(e) => { setModeSettings((s) => ({ ...s, minimumOrder: +e.target.value || 0 })); setModeSettingsDirty(true); }}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">رسوم التوصيل الافتراضية (₪)</label>
                <Input
                  type="number"
                  min={0}
                  value={modeSettings.deliveryFee}
                  onChange={(e) => { setModeSettings((s) => ({ ...s, deliveryFee: +e.target.value || 0 })); setModeSettingsDirty(true); }}
                />
              </div>
            </div>
            {modeSettingsDirty && (
              <Button onClick={handleSaveModeSettings}>حفظ إعدادات الوضع</Button>
            )}
          </div>
        </Card>
      )}

      {/* Delivery Zones table — always visible for platform admin; uses api.getDeliveryZones(tenantId) */}
      <Card className="p-6 max-w-2xl space-y-6">
          <h2 className="font-semibold text-gray-900">جدول مناطق التوصيل (دبورية، إكسال، وغيرها)</h2>
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="font-medium">المناطق</label>
              <Button size="sm" onClick={handleAddZone}>
                إضافة منطقة
              </Button>
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
          <DeliveryZoneMapPicker
            center={
              zoneForm.centerLat != null && zoneForm.centerLng != null
                ? { lat: zoneForm.centerLat, lng: zoneForm.centerLng }
                : DEFAULT_RADIUS_MAP_CENTER
            }
            radiusKm={zoneForm.radiusKm}
            onCenterChange={(lat, lng) => setZoneForm((f) => ({ ...f, centerLat: lat, centerLng: lng }))}
            onRadiusChange={(km) => setZoneForm((f) => ({ ...f, radiusKm: km }))}
            allZones={sortedZones}
            editingZoneId={editingZone?.id}
          />
        </div>
        <div className="mt-6 flex gap-2">
          <Button onClick={handleSaveZone}>حفظ</Button>
          <Button variant="ghost" onClick={() => setModalOpen(false)}>إلغاء</Button>
        </div>
      </Modal>
    </div>
  );
}
