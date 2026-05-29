import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Layers, FolderTree } from 'lucide-react';
import { Card, Button, Modal, Input, useToast } from '@nmd/ui';
import { apiFetch, apiHeaders } from '../api';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

interface Pillar {
  id: string;
  name: string;
  nameAr?: string;
  slug: string;
  icon?: string;
  sortOrder: number;
}

interface SubCategory {
  id: string;
  pillarId: string;
  name: string;
  nameAr?: string;
  slug?: string;
  sortOrder: number;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  marketId?: string;
  pillarId?: string | null;
  subCategoryId?: string | null;
}

export default function PillarCategoryManagerPage() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [pillarForm, setPillarForm] = useState({ name: '', nameAr: '', slug: '', icon: '', sortOrder: 0 });
  const [subForm, setSubForm] = useState({ name: '', nameAr: '', pillarId: '', sortOrder: 0 });
  const [createPillarOpen, setCreatePillarOpen] = useState(false);
  const [editPillar, setEditPillar] = useState<Pillar | null>(null);
  const [deletePillar, setDeletePillar] = useState<Pillar | null>(null);
  const [createSubOpen, setCreateSubOpen] = useState(false);
  const [editSub, setEditSub] = useState<SubCategory | null>(null);
  const [deleteSub, setDeleteSub] = useState<SubCategory | null>(null);
  const [selectedMarketId, setSelectedMarketId] = useState<string>('');

  const { data: pillars = [], isLoading: pillarsLoading } = useQuery({
    queryKey: ['pillars'],
    queryFn: () => fetch(`${MOCK_API_URL}/pillars`, { headers: apiHeaders() }).then((r) => r.json()),
    enabled: !!MOCK_API_URL,
  });
  const pillarList = Array.isArray(pillars) ? pillars : [];

  const { data: subCategories = [], isLoading: subsLoading } = useQuery({
    queryKey: ['sub-categories'],
    queryFn: () => fetch(`${MOCK_API_URL}/sub-categories`, { headers: apiHeaders() }).then((r) => r.json()),
    enabled: !!MOCK_API_URL,
  });
  const subList = Array.isArray(subCategories) ? subCategories : [];

  const { data: markets = [] } = useQuery({
    queryKey: ['markets'],
    queryFn: () => fetch(`${MOCK_API_URL}/markets`, { headers: apiHeaders() }).then((r) => r.json()),
    enabled: !!MOCK_API_URL,
  });
  const marketList = Array.isArray(markets) ? markets : [];
  const effectiveMarketId = selectedMarketId || (marketList[0] as { id?: string })?.id || '';

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ['markets', effectiveMarketId, 'tenants'],
    queryFn: async () => {
      const res = await fetch(`${MOCK_API_URL}/markets/${effectiveMarketId}/tenants`, { headers: apiHeaders() });
      const raw = await res.json();
      const list = Array.isArray(raw) ? raw : [];
      return list.map((t: Record<string, unknown>) => ({
        ...t,
        id: String(t.id ?? ''),
        pillarId: t.pillarId != null && t.pillarId !== '' ? String(t.pillarId) : null,
        subCategoryId: t.subCategoryId != null && t.subCategoryId !== '' ? String(t.subCategoryId) : null,
      })) as Tenant[];
    },
    enabled: !!MOCK_API_URL && !!effectiveMarketId,
  });
  const tenantList = Array.isArray(tenants) ? tenants : [];

  const createPillarMutation = useMutation({
    mutationFn: (body: { name: string; nameAr?: string; slug?: string; icon?: string; sortOrder?: number }) =>
      apiFetch<Pillar>('/pillars', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pillars'] });
      addToast('تم إنشاء العمود', 'success');
      setCreatePillarOpen(false);
    },
    onError: (e: Error) => addToast(e?.message ?? 'فشل الإنشاء', 'error'),
  });

  const updatePillarMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Pillar> }) =>
      apiFetch<Pillar>(`/pillars/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pillars'] });
      addToast('تم تحديث العمود', 'success');
      setEditPillar(null);
    },
    onError: (e: Error) => addToast(e?.message ?? 'فشل التحديث', 'error'),
  });

  const deletePillarMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/pillars/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pillars'] });
      queryClient.invalidateQueries({ queryKey: ['sub-categories'] });
      addToast('تم حذف العمود', 'success');
      setDeletePillar(null);
    },
    onError: (e: Error) => addToast(e?.message ?? 'فشل الحذف', 'error'),
  });

  const createSubMutation = useMutation({
    mutationFn: (body: { pillarId: string; name: string; nameAr?: string; sortOrder?: number }) =>
      apiFetch<SubCategory>('/sub-categories', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-categories'] });
      addToast('تم إنشاء التصنيف الفرعي', 'success');
      setCreateSubOpen(false);
      setSubForm({ name: '', nameAr: '', pillarId: pillarList[0]?.id ?? '', sortOrder: subList.length });
    },
    onError: (e: Error) => addToast(e?.message ?? 'فشل الإنشاء', 'error'),
  });

  const updateSubMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<SubCategory> }) =>
      apiFetch<SubCategory>(`/sub-categories/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-categories'] });
      addToast('تم تحديث التصنيف الفرعي', 'success');
      setEditSub(null);
    },
    onError: (e: Error) => addToast(e?.message ?? 'فشل التحديث', 'error'),
  });

  const deleteSubMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/sub-categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-categories'] });
      queryClient.invalidateQueries({ queryKey: ['markets', effectiveMarketId, 'tenants'] });
      addToast('تم حذف التصنيف الفرعي', 'success');
      setDeleteSub(null);
    },
    onError: (e: Error) => addToast(e?.message ?? 'فشل الحذف', 'error'),
  });

  const updateTenantPillarMutation = useMutation({
    mutationFn: ({ id, pillarId, subCategoryId }: { id: string; pillarId: string | null; subCategoryId: string | null }) =>
      apiFetch(`/tenants/${id}`, { method: 'PATCH', body: JSON.stringify({ pillarId, subCategoryId }) }),
    onMutate: async ({ id, pillarId, subCategoryId }) => {
      await queryClient.cancelQueries({ queryKey: ['markets', effectiveMarketId, 'tenants'] });
      const prev = queryClient.getQueryData<Tenant[]>(['markets', effectiveMarketId, 'tenants']);
      queryClient.setQueryData<Tenant[]>(['markets', effectiveMarketId, 'tenants'], (old) =>
        Array.isArray(old)
          ? old.map((t) =>
              t.id === id
                ? {
                    ...t,
                    pillarId: pillarId != null && pillarId !== '' ? String(pillarId) : null,
                    subCategoryId: subCategoryId != null && subCategoryId !== '' ? String(subCategoryId) : null,
                  }
                : t
            )
          : old
      );
      return { prev };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['markets', effectiveMarketId, 'tenants'] });
      addToast('تم تحديث المحل', 'success');
    },
    onError: (e: Error, _vars, context) => {
      if (context?.prev != null) queryClient.setQueryData(['markets', effectiveMarketId, 'tenants'], context.prev);
      addToast(e?.message ?? 'فشل التحديث', 'error');
    },
  });

  const handleCreatePillar = () => {
    if (!pillarForm.name.trim()) {
      addToast('الاسم مطلوب', 'error');
      return;
    }
    createPillarMutation.mutate({
      name: pillarForm.name.trim(),
      nameAr: pillarForm.nameAr.trim() || undefined,
      slug: pillarForm.slug.trim() || undefined,
      icon: pillarForm.icon.trim() || undefined,
      sortOrder: pillarForm.sortOrder,
    });
  };

  const handleCreateSub = () => {
    if (!subForm.pillarId || !subForm.name.trim()) {
      addToast('العمود والاسم مطلوبان', 'error');
      return;
    }
    createSubMutation.mutate({
      pillarId: subForm.pillarId,
      name: subForm.name.trim(),
      nameAr: subForm.nameAr.trim() || undefined,
      sortOrder: subForm.sortOrder,
    });
  };

  const handleTenantPillarChange = (tenant: Tenant, pillarId: string | null, subCategoryId: string | null) => {
    updateTenantPillarMutation.mutate({ id: tenant.id, pillarId, subCategoryId });
  };

  if (!MOCK_API_URL) {
    return (
      <div className="p-8 text-center text-gray-500">
        لتشغيل إدارة الأعمدة والتصنيفات، ضبط VITE_MOCK_API_URL
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">الأعمدة والتصنيفات</h1>
          <p className="text-sm text-gray-500 mt-1">نظام التصنيف الحالي للمول</p>
        </div>
        <Button onClick={() => { setCreatePillarOpen(true); setPillarForm({ name: '', nameAr: '', slug: '', icon: '', sortOrder: pillarList.length }); }} className="gap-2">
          <Plus className="w-4 h-4" />
          إضافة عمود
        </Button>
      </div>

      {/* Pillars & Sub-categories */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5" />
          الأعمدة والتصنيفات الفرعية
        </h2>
        {pillarsLoading || subsLoading ? (
          <p className="text-gray-500">جاري التحميل...</p>
        ) : (
          <div className="space-y-6">
            {pillarList.map((p) => (
              <div key={p.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50/50">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-gray-900">{p.nameAr || p.name}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setEditPillar(p); setPillarForm({ name: p.name, nameAr: p.nameAr ?? '', slug: p.slug, icon: p.icon ?? '', sortOrder: p.sortOrder }); }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600" onClick={() => setDeletePillar(p)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button size="sm" onClick={() => { setSubForm({ ...subForm, pillarId: p.id }); setCreateSubOpen(true); }}>
                      <Plus className="w-4 h-4" /> تصنيف فرعي
                    </Button>
                  </div>
                </div>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                  {subList.filter((s) => s.pillarId === p.id).map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2">
                      <span>{s.nameAr || s.name}</span>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setEditSub(s); setSubForm({ name: s.name, nameAr: s.nameAr ?? '', pillarId: s.pillarId, sortOrder: s.sortOrder }); }}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setDeleteSub(s)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Assign stores */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <FolderTree className="w-5 h-5" />
          تعيين المحلات
        </h2>
        {marketList.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">السوق</label>
            <select
              value={selectedMarketId || (marketList[0] as { id: string })?.id}
              onChange={(e) => setSelectedMarketId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {marketList.map((m: { id: string; name: string }) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        )}
        {tenantsLoading ? (
          <p className="text-gray-500">جاري تحميل المحلات...</p>
        ) : tenantList.length === 0 ? (
          <p className="text-gray-500">لا محلات في هذا السوق</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-right">
                  <th className="py-2 px-2">المحل</th>
                  <th className="py-2 px-2">العمود</th>
                  <th className="py-2 px-2">التصنيف الفرعي</th>
                </tr>
              </thead>
              <tbody>
                {tenantList.map((t: Tenant) => (
                  <tr key={t.id} className="border-b border-gray-100">
                    <td className="py-2 px-2 font-medium">{t.name}</td>
                    <td className="py-2 px-2">
                      <select
                        value={t.pillarId ?? ''}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const pid = raw === '' ? null : raw;
                          const subId = pid != null ? (subList.find((s) => String(s.pillarId) === String(pid))?.id ?? null) : null;
                          handleTenantPillarChange(t, pid, subId);
                        }}
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-full max-w-[140px]"
                      >
                        <option value="">—</option>
                        {pillarList.map((p) => (
                          <option key={p.id} value={String(p.id)}>{p.nameAr || p.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-2">
                      <select
                        value={t.subCategoryId ?? ''}
                        onChange={(e) => {
                          const raw = e.target.value;
                          handleTenantPillarChange(t, t.pillarId ?? null, raw === '' ? null : raw);
                        }}
                        className="border border-gray-300 rounded px-2 py-1 text-sm w-full max-w-[160px]"
                      >
                        <option value="">—</option>
                        {subList.filter((s) => String(s.pillarId) === String(t.pillarId ?? '')).map((s) => (
                          <option key={s.id} value={String(s.id)}>{s.nameAr || s.name}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create Pillar Modal */}
      <Modal open={createPillarOpen} onClose={() => setCreatePillarOpen(false)} title="إضافة عمود">
        <div className="space-y-3">
          <Input label="الاسم (EN)" value={pillarForm.name} onChange={(e) => setPillarForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="الاسم (AR)" value={pillarForm.nameAr} onChange={(e) => setPillarForm((f) => ({ ...f, nameAr: e.target.value }))} />
          <Input label="Slug" value={pillarForm.slug} onChange={(e) => setPillarForm((f) => ({ ...f, slug: e.target.value }))} placeholder="food" />
          <Input label="أيقونة" value={pillarForm.icon} onChange={(e) => setPillarForm((f) => ({ ...f, icon: e.target.value }))} placeholder="🍽️" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setCreatePillarOpen(false)}>إلغاء</Button>
          <Button onClick={handleCreatePillar}>إنشاء</Button>
        </div>
      </Modal>

      {/* Edit Pillar Modal */}
      <Modal open={!!editPillar} onClose={() => setEditPillar(null)} title="تعديل العمود">
        {editPillar && (
          <>
            <div className="space-y-3">
              <Input label="الاسم (EN)" value={pillarForm.name} onChange={(e) => setPillarForm((f) => ({ ...f, name: e.target.value }))} />
              <Input label="الاسم (AR)" value={pillarForm.nameAr} onChange={(e) => setPillarForm((f) => ({ ...f, nameAr: e.target.value }))} />
              <Input label="Slug" value={pillarForm.slug} onChange={(e) => setPillarForm((f) => ({ ...f, slug: e.target.value }))} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditPillar(null)}>إلغاء</Button>
              <Button onClick={() => updatePillarMutation.mutate({ id: editPillar.id, body: pillarForm })}>حفظ</Button>
            </div>
          </>
        )}
      </Modal>

      {/* Delete Pillar Modal */}
      <Modal open={!!deletePillar} onClose={() => setDeletePillar(null)} title="حذف العمود">
        {deletePillar && (
          <>
            <p className="text-gray-600">هل أنت متأكد من حذف &quot;{deletePillar.nameAr || deletePillar.name}&quot;؟ يجب حذف أو نقل التصنيفات الفرعية أولاً.</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeletePillar(null)}>إلغاء</Button>
              <Button variant="primary" className="bg-red-600 hover:bg-red-700" onClick={() => deletePillarMutation.mutate(deletePillar.id)}>حذف</Button>
            </div>
          </>
        )}
      </Modal>

      {/* Create Sub-category Modal */}
      <Modal open={createSubOpen} onClose={() => setCreateSubOpen(false)} title="إضافة تصنيف فرعي">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">العمود</label>
            <select
              value={subForm.pillarId}
              onChange={(e) => setSubForm((f) => ({ ...f, pillarId: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 w-full"
            >
              {pillarList.map((p) => (
                <option key={p.id} value={p.id}>{p.nameAr || p.name}</option>
              ))}
            </select>
          </div>
          <Input label="الاسم (EN)" value={subForm.name} onChange={(e) => setSubForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="الاسم (AR)" value={subForm.nameAr} onChange={(e) => setSubForm((f) => ({ ...f, nameAr: e.target.value }))} />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setCreateSubOpen(false)}>إلغاء</Button>
          <Button onClick={handleCreateSub}>إنشاء</Button>
        </div>
      </Modal>

      {/* Edit Sub-category Modal */}
      <Modal open={!!editSub} onClose={() => setEditSub(null)} title="تعديل التصنيف الفرعي">
        {editSub && (
          <>
            <div className="space-y-3">
              <Input label="الاسم (EN)" value={subForm.name} onChange={(e) => setSubForm((f) => ({ ...f, name: e.target.value }))} />
              <Input label="الاسم (AR)" value={subForm.nameAr} onChange={(e) => setSubForm((f) => ({ ...f, nameAr: e.target.value }))} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditSub(null)}>إلغاء</Button>
              <Button onClick={() => updateSubMutation.mutate({ id: editSub.id, body: { name: subForm.name, nameAr: subForm.nameAr || undefined, sortOrder: subForm.sortOrder } })}>حفظ</Button>
            </div>
          </>
        )}
      </Modal>

      {/* Delete Sub-category Modal */}
      <Modal open={!!deleteSub} onClose={() => setDeleteSub(null)} title="حذف التصنيف الفرعي">
        {deleteSub && (
          <>
            <p className="text-gray-600">هل أنت متأكد من حذف &quot;{deleteSub.nameAr || deleteSub.name}&quot;؟ سيُزال تعيين المحلات من هذا التصنيف.</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteSub(null)}>إلغاء</Button>
              <Button variant="primary" className="bg-red-600 hover:bg-red-700" onClick={() => deleteSubMutation.mutate(deleteSub.id)}>حذف</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
