import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Input, Select, Modal, useToast, Skeleton } from '@nmd/ui';
import { MockApiClient } from '@nmd/mock';
import {
  Plus,
  RefreshCw,
  Eye,
  Pencil,
  KeyRound,
  Truck,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import { useGlobalCouriers, useMarketOptions } from '../../drivers/useGlobalCouriers';
import { filterGlobalCouriers } from '../../drivers/fetchAllMarketCouriers';
import type { GlobalCourierRow, GlobalCourierFilters } from '../../drivers/globalCourierTypes';
import { DriverOnlineBadge } from '../../components/drivers/DriverOnlineBadge';
import { CourierWriteGuardBanner, useCourierWriteAccess } from '../../components/drivers/CourierWriteGuardBanner';
import { CourierFormModal, type CourierFormValues } from '../../components/drivers/CourierFormModal';
import { CourierDetailsDrawer } from '../../components/drivers/CourierDetailsDrawer';
import { CourierDeleteConfirmModal } from '../../components/drivers/CourierDeleteConfirmModal';

const api = new MockApiClient();

const EMPTY_FILTERS: GlobalCourierFilters = {
  marketId: '',
  online: '',
  active: '',
  available: '',
  search: '',
};

function invalidateCourierQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['global-couriers'] });
  qc.invalidateQueries({ queryKey: ['driver-ops-overview'] });
}

export default function DriversCouriersPage() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { canWrite, isRootAdmin } = useCourierWriteAccess();
  const { data: couriers = [], isLoading, isError, refetch, isFetching } = useGlobalCouriers(true);
  const { data: markets = [] } = useMarketOptions();
  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => api.listTenants(),
  });

  const [filters, setFilters] = useState<GlobalCourierFilters>(EMPTY_FILTERS);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editTarget, setEditTarget] = useState<GlobalCourierRow | null>(null);
  const [detailsCourier, setDetailsCourier] = useState<GlobalCourierRow | null>(null);
  const [passwordModal, setPasswordModal] = useState<GlobalCourierRow | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [deleteModal, setDeleteModal] = useState<GlobalCourierRow | null>(null);
  const [deleteCascade, setDeleteCascade] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [dangerOpenId, setDangerOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!dangerOpenId) return;
    const close = () => setDangerOpenId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [dangerOpenId]);

  const filtered = useMemo(() => filterGlobalCouriers(couriers, filters), [couriers, filters]);

  const createMutation = useMutation({
    mutationFn: async (v: CourierFormValues) => {
      const created = await api.createMarketCourier(v.marketId, {
        name: v.name.trim(),
        email: v.email.trim(),
        phone: v.phone.trim() || undefined,
        password: v.password.trim().length >= 6 ? v.password.trim() : undefined,
        allowedStoreIds: v.allowedStoreIds.length > 0 ? v.allowedStoreIds : undefined,
      });
      if (v.isOnline || v.isAvailable === false || v.capacity !== 3) {
        await api.patchMarketCourier(v.marketId, created.id, {
          isOnline: v.isOnline,
          isAvailable: v.isAvailable,
          capacity: v.capacity,
        });
      }
      return created;
    },
    onSuccess: (_, v) => {
      invalidateCourierQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ['market-couriers', v.marketId] });
      addToast('تم إضافة السائق', 'success');
      setFormOpen(false);
    },
    onError: (e) => addToast(e instanceof Error ? e.message : 'فشل الإضافة', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ row, v }: { row: GlobalCourierRow; v: CourierFormValues }) =>
      api.patchMarketCourier(row.marketId, row.id, {
        name: v.name.trim(),
        email: v.email.trim() || undefined,
        phone: v.phone.trim() || undefined,
        isActive: v.isActive,
        isOnline: v.isOnline,
        isAvailable: v.isAvailable,
        capacity: v.capacity,
        allowedStoreIds: v.allowedStoreIds,
      }),
    onSuccess: (_, { row }) => {
      invalidateCourierQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ['market-couriers', row.marketId] });
      addToast('تم تحديث السائق', 'success');
      setFormOpen(false);
      setEditTarget(null);
      setDetailsCourier((prev) => (prev?.id === row.id ? { ...prev, ...row } : prev));
    },
    onError: (e) => addToast(e instanceof Error ? e.message : 'فشل التحديث', 'error'),
  });

  const patchMutation = useMutation({
    mutationFn: ({
      row,
      updates,
    }: {
      row: GlobalCourierRow;
      updates: Partial<{ isActive: boolean; isOnline: boolean; isAvailable: boolean }>;
    }) => api.patchMarketCourier(row.marketId, row.id, updates),
    onSuccess: (_, { row }) => {
      invalidateCourierQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ['market-couriers', row.marketId] });
      addToast('تم التحديث', 'success');
    },
    onError: (e) => addToast(e instanceof Error ? e.message : 'فشل', 'error'),
  });

  const passwordMutation = useMutation({
    mutationFn: ({ row, password }: { row: GlobalCourierRow; password: string }) =>
      api.changeMarketCourierPassword(row.marketId, row.id, password),
    onSuccess: () => {
      addToast('تم تحديث كلمة المرور', 'success');
      setPasswordModal(null);
      setNewPassword('');
    },
    onError: (e) => addToast(e instanceof Error ? e.message : 'فشل', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: ({ row, cascade }: { row: GlobalCourierRow; cascade: boolean }) =>
      api.deleteMarketCourier(row.marketId, row.id, cascade),
    onSuccess: async (_, { row }) => {
      invalidateCourierQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: ['market-couriers', row.marketId] });
      await refetch();
      addToast('تم حذف السائق', 'success');
      setDeleteModal(null);
      setDeleteCascade(false);
      setDeleteError(null);
      setDetailsCourier(null);
      setDangerOpenId(null);
    },
    onError: (e) => {
      const message = e instanceof Error ? e.message : 'فشل حذف السائق';
      setDeleteError(message);
      addToast(message, 'error');
    },
  });

  const openCreate = () => {
    setFormMode('create');
    setEditTarget(null);
    setFormOpen(true);
  };

  const openEdit = (row: GlobalCourierRow) => {
    setFormMode('edit');
    setEditTarget(row);
    setFormOpen(true);
    setDetailsCourier(null);
  };

  return (
    <div className="space-y-4">
      <CourierWriteGuardBanner />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          {filtered.length} سائق من {couriers.length}
          {isFetching ? ' · جاري التحديث...' : ''}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            <RefreshCw className={`w-4 h-4 ml-1 ${isFetching ? 'animate-spin' : ''}`} />
            تحديث
          </Button>
          <Button size="sm" onClick={openCreate} disabled={!canWrite}>
            <Plus className="w-4 h-4 ml-1" />
            إضافة سائق
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          <Select
            value={filters.marketId}
            onChange={(e) => setFilters((f) => ({ ...f, marketId: e.target.value }))}
            options={[{ value: '', label: 'كل الأسواق' }, ...markets.map((m) => ({ value: m.id, label: m.name }))]}
          />
          <Select
            value={filters.online}
            onChange={(e) => setFilters((f) => ({ ...f, online: e.target.value as GlobalCourierFilters['online'] }))}
            options={[
              { value: '', label: 'الاتصال: الكل' },
              { value: 'online', label: 'متصل' },
              { value: 'offline', label: 'غير متصل' },
            ]}
          />
          <Select
            value={filters.active}
            onChange={(e) => setFilters((f) => ({ ...f, active: e.target.value as GlobalCourierFilters['active'] }))}
            options={[
              { value: '', label: 'الحساب: الكل' },
              { value: 'active', label: 'نشط' },
              { value: 'inactive', label: 'معطّل' },
            ]}
          />
          <Select
            value={filters.available}
            onChange={(e) => setFilters((f) => ({ ...f, available: e.target.value as GlobalCourierFilters['available'] }))}
            options={[
              { value: '', label: 'التوفر: الكل' },
              { value: 'available', label: 'متاح' },
              { value: 'busy', label: 'مشغول' },
            ]}
          />
          <Input
            placeholder="بحث: اسم، جوال، بريد..."
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : isError ? (
          <p className="text-red-600 text-center py-8">فشل تحميل السائقين</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500 text-center py-8">لا يوجد سائقون مطابقون للفلاتر</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 font-medium text-gray-700">السائق</th>
                  <th className="px-3 py-2 font-medium text-gray-700">السوق</th>
                  <th className="px-3 py-2 font-medium text-gray-700">الحالة</th>
                  <th className="px-3 py-2 font-medium text-gray-700">السعة</th>
                  <th className="px-3 py-2 font-medium text-gray-700">توصيلات</th>
                  <th className="px-3 py-2 font-medium text-gray-700">متاجر</th>
                  <th className="px-3 py-2 font-medium text-gray-700">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const storeCount = Array.isArray(c.allowedStoreIds) ? c.allowedStoreIds.length : 0;
                  return (
                    <tr key={`${c.marketId}-${c.id}`} className="border-t border-gray-100 hover:bg-gray-50/50">
                      <td className="px-3 py-3">
                        <button type="button" className="text-start" onClick={() => setDetailsCourier(c)}>
                          <p className="font-medium text-gray-900 hover:text-teal-700">{c.name}</p>
                          <p className="text-xs text-gray-500">{c.phone ?? '—'}</p>
                          {c.email && <p className="text-xs text-gray-400 truncate max-w-[180px]">{c.email}</p>}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-gray-700">{c.marketName}</td>
                      <td className="px-3 py-3">
                        <DriverOnlineBadge isOnline={c.isOnline} isAvailable={c.isAvailable} isActive={c.isActive} />
                      </td>
                      <td className="px-3 py-3 tabular-nums">{c.capacity ?? 3}</td>
                      <td className="px-3 py-3 tabular-nums">{c.deliveryCount ?? 0}</td>
                      <td className="px-3 py-3 text-xs">{storeCount > 0 ? storeCount : 'الكل'}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1 justify-end">
                          <button
                            type="button"
                            title="تفاصيل"
                            className="p-1.5 rounded hover:bg-gray-100"
                            onClick={() => setDetailsCourier(c)}
                          >
                            <Eye className="w-4 h-4 text-gray-600" />
                          </button>
                          <Link
                            to={`/markets/${c.marketId}/dispatch`}
                            title="التوجيه"
                            className="p-1.5 rounded hover:bg-gray-100 inline-flex"
                          >
                            <Truck className="w-4 h-4 text-teal-600" />
                          </Link>
                          {canWrite && (
                            <>
                              <button
                                type="button"
                                title="تعديل"
                                className="p-1.5 rounded hover:bg-gray-100"
                                onClick={() => openEdit(c)}
                              >
                                <Pencil className="w-4 h-4 text-gray-600" />
                              </button>
                              <button
                                type="button"
                                title="كلمة المرور"
                                className="p-1.5 rounded hover:bg-gray-100"
                                onClick={() => {
                                  setPasswordModal(c);
                                  setNewPassword('');
                                }}
                              >
                                <KeyRound className="w-4 h-4 text-violet-600" />
                              </button>
                              <button
                                type="button"
                                title={c.isActive ? 'تعطيل' : 'تفعيل'}
                                className="px-2 py-1 text-xs rounded border border-gray-200 hover:bg-gray-50"
                                onClick={() =>
                                  patchMutation.mutate({ row: c, updates: { isActive: !c.isActive } })
                                }
                              >
                                {c.isActive ? 'تعطيل' : 'تفعيل'}
                              </button>
                              <div className="relative">
                                <button
                                  type="button"
                                  title="إجراءات متقدمة"
                                  className="p-1.5 rounded hover:bg-gray-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDangerOpenId(dangerOpenId === c.id ? null : c.id);
                                  }}
                                >
                                  <MoreVertical className="w-4 h-4 text-gray-500" />
                                </button>
                                {dangerOpenId === c.id && (
                                  <div
                                    className="absolute left-0 z-10 mt-1 w-48 rounded-lg border border-red-200 bg-white shadow-lg p-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <p className="px-3 py-1 text-[10px] font-medium text-red-600 uppercase tracking-wide">
                                      متقدم / خطر
                                    </p>
                                    <button
                                      type="button"
                                      className="w-full text-start px-3 py-2 text-xs text-red-700 hover:bg-red-50 rounded flex items-center gap-1"
                                      onClick={() => {
                                        setDeleteError(null);
                                        setDeleteCascade(false);
                                        setDeleteModal(c);
                                        setDangerOpenId(null);
                                      }}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      حذف السائق
                                    </button>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CourierFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditTarget(null);
        }}
        mode={formMode}
        markets={markets}
        tenants={tenants as { id: string; name: string; marketId?: string }[]}
        initial={editTarget}
        saving={createMutation.isPending || updateMutation.isPending}
        canWrite={canWrite}
        onSubmit={(v) => {
          if (formMode === 'create') createMutation.mutate(v);
          else if (editTarget) updateMutation.mutate({ row: editTarget, v });
        }}
      />

      <CourierDetailsDrawer
        courier={detailsCourier}
        open={!!detailsCourier}
        onClose={() => setDetailsCourier(null)}
        onEdit={() => detailsCourier && openEdit(detailsCourier)}
        onChangePassword={() => {
          if (detailsCourier) {
            setPasswordModal(detailsCourier);
            setNewPassword('');
          }
        }}
        canWrite={canWrite}
        onDelete={
          canWrite
            ? () => {
                if (detailsCourier) {
                  setDeleteError(null);
                  setDeleteCascade(false);
                  setDeleteModal(detailsCourier);
                }
              }
            : undefined
        }
      />

      <Modal
        open={!!passwordModal}
        onClose={() => {
          setPasswordModal(null);
          setNewPassword('');
        }}
        title={`تغيير كلمة المرور — ${passwordModal?.name ?? ''}`}
        size="sm"
      >
        <div className="space-y-4">
          <Input
            type="password"
            placeholder="كلمة المرور الجديدة (6 أحرف فأكثر)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setPasswordModal(null)}>
              إلغاء
            </Button>
            <Button
              disabled={newPassword.trim().length < 6 || passwordMutation.isPending || !canWrite}
              onClick={() => {
                if (passwordModal) passwordMutation.mutate({ row: passwordModal, password: newPassword.trim() });
              }}
            >
              {passwordMutation.isPending ? 'جاري...' : 'حفظ'}
            </Button>
          </div>
        </div>
      </Modal>

      <CourierDeleteConfirmModal
        courier={deleteModal}
        open={!!deleteModal}
        cascade={deleteCascade}
        onCascadeChange={setDeleteCascade}
        onClose={() => {
          setDeleteModal(null);
          setDeleteCascade(false);
          setDeleteError(null);
        }}
        onConfirm={() => {
          if (deleteModal) {
            setDeleteError(null);
            deleteMutation.mutate({ row: deleteModal, cascade: deleteCascade });
          }
        }}
        isPending={deleteMutation.isPending}
        error={deleteError}
        canWrite={canWrite}
        isRootAdmin={isRootAdmin}
      />
    </div>
  );
}
