import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Card, Button, Modal, Input, useToast } from '@nmd/ui';
import { apiFetch, apiHeaders } from '../api';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

interface GlobalCategory {
  id: string;
  title: string;
  icon: string;
  isProfessional: boolean;
  sortOrder: number;
  legacyCode?: string;
}

export default function CategoriesAdminPage() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editCat, setEditCat] = useState<GlobalCategory | null>(null);
  const [deleteCat, setDeleteCat] = useState<GlobalCategory | null>(null);
  const [form, setForm] = useState({ title: '', icon: '📦', isProfessional: false, sortOrder: 0 });

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['global-categories'],
    queryFn: () => fetch(`${MOCK_API_URL}/global-categories`, { headers: apiHeaders() }).then((r) => r.json()),
    enabled: !!MOCK_API_URL,
  });
  const list = Array.isArray(categories) ? categories : [];

  const createMutation = useMutation({
    mutationFn: (body: { title: string; icon: string; isProfessional: boolean; sortOrder: number }) =>
      apiFetch<GlobalCategory>('/global-categories', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-categories'] });
      addToast('تم إنشاء التصنيف', 'success');
      setCreateOpen(false);
      setForm({ title: '', icon: '📦', isProfessional: false, sortOrder: 0 });
    },
    onError: (err: Error) => addToast(err?.message ?? 'فشل الإنشاء', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<GlobalCategory> }) =>
      apiFetch<GlobalCategory>(`/global-categories/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-categories'] });
      addToast('تم تحديث التصنيف', 'success');
      setEditCat(null);
    },
    onError: (err: Error) => addToast(err?.message ?? 'فشل التحديث', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/global-categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-categories'] });
      addToast('تم حذف التصنيف', 'success');
      setDeleteCat(null);
    },
    onError: (err: Error) => addToast(err?.message ?? 'فشل الحذف', 'error'),
  });

  const handleCreate = () => {
    if (!form.title.trim()) {
      addToast('العنوان مطلوب', 'error');
      return;
    }
    createMutation.mutate(form);
  };

  const handleUpdate = () => {
    if (!editCat || !form.title.trim()) return;
    updateMutation.mutate({ id: editCat.id, body: form });
  };

  const openEdit = (c: GlobalCategory) => {
    setEditCat(c);
    setForm({ title: c.title, icon: c.icon, isProfessional: c.isProfessional, sortOrder: c.sortOrder });
  };

  if (!MOCK_API_URL) {
    return (
      <div className="p-8 text-center text-gray-500">
        لتشغيل إدارة التصنيفات، ضبط VITE_MOCK_API_URL
      </div>
    );
  }

  return (
    <div dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">إدارة التصنيفات</h1>
        <Button onClick={() => { setCreateOpen(true); setForm({ title: '', icon: '📦', isProfessional: false, sortOrder: list.length }); }} className="gap-2">
          <Plus className="w-4 h-4" />
          إضافة تصنيف
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <Card className="p-6">
          <div className="space-y-3">
            {list.map((c: GlobalCategory) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{c.icon}</span>
                  <div>
                    <p className="font-semibold text-gray-900">{c.title}</p>
                    <p className="text-sm text-gray-500">
                      {c.isProfessional ? 'خدمة مهنية (بدون سلة)' : 'متجر عادي'}
                      {c.legacyCode && ` • ${c.legacyCode}`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(c)} className="gap-1">
                    <Pencil className="w-4 h-4" />
                    تعديل
                  </Button>
                  {!c.legacyCode && (
                    <Button size="sm" variant="outline" onClick={() => setDeleteCat(c)} className="gap-1 text-red-600 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                      حذف
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="إضافة تصنيف جديد" size="sm">
        <div className="space-y-4">
          <Input label="العنوان" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="مثال: طعام" />
          <Input label="الأيقونة (emoji)" value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value || '📦' }))} placeholder="🍕" />
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="create-prof"
              checked={form.isProfessional}
              onChange={(e) => setForm((f) => ({ ...f, isProfessional: e.target.checked }))}
              className="rounded"
            />
            <label htmlFor="create-prof">خدمة مهنية (بدون سلة)</label>
          </div>
          <Input type="number" label="ترتيب العرض" value={String(form.sortOrder)} onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))} />
          <Button onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'جاري الحفظ...' : 'إضافة'}
          </Button>
        </div>
      </Modal>

      <Modal open={!!editCat} onClose={() => setEditCat(null)} title="تعديل التصنيف" size="sm">
        {editCat && (
          <div className="space-y-4">
            <Input label="العنوان" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            <Input label="الأيقونة" value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value || '📦' }))} />
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="edit-prof"
                checked={form.isProfessional}
                onChange={(e) => setForm((f) => ({ ...f, isProfessional: e.target.checked }))}
                className="rounded"
              />
              <label htmlFor="edit-prof">خدمة مهنية (بدون سلة)</label>
            </div>
            <Input type="number" label="ترتيب العرض" value={String(form.sortOrder)} onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))} />
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
            </Button>
          </div>
        )}
      </Modal>

      <Modal open={!!deleteCat} onClose={() => setDeleteCat(null)} title="حذف التصنيف" size="sm">
        {deleteCat && (
          <div className="space-y-4">
            <p className="text-gray-600">هل تريد حذف &quot;{deleteCat.title}&quot;؟</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDeleteCat(null)}>إلغاء</Button>
              <Button variant="outline" className="text-red-600" onClick={() => deleteMutation.mutate(deleteCat.id)} disabled={deleteMutation.isPending}>
                حذف
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
