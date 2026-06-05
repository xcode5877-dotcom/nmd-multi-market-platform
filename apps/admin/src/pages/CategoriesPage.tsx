import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Button, Input, Modal, ConfirmDialog, Select } from '@nmd/ui';
import { useAdminContext } from '../context/AdminContext';
import { useAdminData } from '../hooks/useAdminData';
import { MockApiClient } from '@nmd/mock';
import type { Category } from '@nmd/core';
import { generateId } from '@nmd/core';
import { GripVertical } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const api = new MockApiClient();

export default function CategoriesPage() {
  const { tenantId } = useAdminContext();
  const queryClient = useQueryClient();
  const adminData = useAdminData(tenantId);
  const [categories, setCategories] = useState<Category[]>(() => adminData.getCategories());
  const prevLoading = useRef(true);
  useEffect(() => {
    if (prevLoading.current && !adminData.isLoading) {
      setCategories(adminData.getCategories());
      prevLoading.current = false;
    }
    if (adminData.isLoading) prevLoading.current = true;
  }, [adminData.isLoading]);
  const [editing, setEditing] = useState<Category | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', parentId: null as string | null, markupExempt: false });
  const [deleteConfirm, setDeleteConfirm] = useState<Category | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [reorderMode, setReorderMode] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const bulkSortMutation = useMutation({
    mutationFn: (items: { id: string; sortOrder: number }[]) =>
      api.bulkSortCatalog(tenantId!, 'categories', items),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['catalog', tenantId] });
      setCategories((data.categories ?? []) as Category[]);
    },
  });

  const handleCategoryDragEnd = useCallback(() => {
    setDragId(null);
    setDropIndex(null);
  }, []);

  const handleCategoryDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      const id = e.dataTransfer.getData('text/plain');
      if (!id || !tenantId) return;
      const main = categories
        .filter((c) => !c.parentId || c.parentId === '')
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      const fromIndex = main.findIndex((c) => c.id === id);
      if (fromIndex === -1) return;
      const reordered = [...main];
      const [removed] = reordered.splice(fromIndex, 1);
      reordered.splice(targetIndex, 0, removed);
      const items = reordered.map((c, i) => ({ id: c.id, sortOrder: i }));
      const allCategories = categories.map((c) => {
        const idx = reordered.findIndex((r) => r.id === c.id);
        if (idx >= 0) return { ...c, sortOrder: idx };
        return c;
      });
      setCategories(allCategories);
      bulkSortMutation.mutate(items);
      setDragId(null);
      setDropIndex(null);
    },
    [categories, tenantId, bulkSortMutation]
  );

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const mainCategories = categories.filter((c) => !c.parentId || c.parentId === '');
  const getSubcategories = (parentId: string) =>
    categories.filter((c) => c.parentId === parentId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const save = () => {
    if (!form.name.trim()) return;
    const slug = form.slug || form.name.toLowerCase().replace(/\s/g, '-');
    if (editing) {
      const next = categories.map((c) =>
        c.id === editing.id
          ? { ...c, name: form.name, slug, parentId: form.parentId ?? null, markupExempt: form.markupExempt }
          : c
      );
      setCategories(next);
      adminData.setCategories(next);
    } else {
      const siblings = form.parentId ? getSubcategories(form.parentId) : mainCategories;
      const next = [
        ...categories,
        {
          id: generateId(),
          tenantId: tenantId,
          name: form.name,
          slug,
          sortOrder: siblings.length,
          parentId: form.parentId ?? null,
          isVisible: true,
          markupExempt: form.markupExempt,
        },
      ];
      setCategories(next);
      adminData.setCategories(next);
    }
    setModalOpen(false);
    setEditing(null);
    setForm({ name: '', slug: '', parentId: null, markupExempt: false });
  };

  const remove = (id: string) => {
    const toRemove = [id, ...categories.filter((c) => c.parentId === id).map((c) => c.id)];
    const next = categories.filter((c) => !toRemove.includes(c.id));
    setCategories(next);
    adminData.setCategories(next);
    setDeleteConfirm(null);
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setForm({ name: cat.name, slug: cat.slug, parentId: cat.parentId ?? null, markupExempt: cat.markupExempt ?? false });
    setModalOpen(true);
  };

  const openAdd = (parentId?: string | null) => {
    setEditing(null);
    setForm({ name: '', slug: '', parentId: parentId ?? null, markupExempt: false });
    setModalOpen(true);
  };

  const sortedMain = mainCategories.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-gray-900">التصنيفات</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setReorderMode((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium ${
              reorderMode ? 'bg-primary/10 border-primary text-primary' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <GripVertical className="w-4 h-4" />
            {reorderMode ? 'إنهاء الترتيب' : 'وضع الترتيب'}
          </button>
          <Button onClick={() => openAdd()}>
            إضافة تصنيف
          </Button>
        </div>
      </div>
      <Card>
        <div className="divide-y divide-gray-200">
          {sortedMain.map((cat, index) => {
            const subs = getSubcategories(cat.id);
            const hasSubs = subs.length > 0;
            const isExpanded = expandedIds.has(cat.id);
            const isDragOver = reorderMode && dropIndex === index;
            return (
              <div
                key={cat.id}
                className={`rtl ${isDragOver ? 'bg-primary/5' : ''}`}
                draggable={reorderMode}
                onDragStart={(e) => {
                  if (!reorderMode) return;
                  setDragId(cat.id);
                  e.dataTransfer.setData('text/plain', cat.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={handleCategoryDragEnd}
                onDragOver={(e) => {
                  if (!reorderMode || !dragId) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDropIndex(index);
                }}
                onDrop={(e) => reorderMode && handleCategoryDrop(e, index)}
              >
                <div className="flex items-center justify-between p-4 gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {reorderMode && (
                      <span className="cursor-grab active:cursor-grabbing text-gray-400 flex-shrink-0" aria-hidden>
                        <GripVertical className="w-5 h-5" />
                      </span>
                    )}
                    {hasSubs ? (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(cat.id)}
                        className="p-1 rounded hover:bg-gray-100 transition-colors flex-shrink-0"
                        aria-expanded={isExpanded}
                      >
                        <span className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : ''}`}>▶</span>
                      </button>
                    ) : (
                      <span className="w-6 flex-shrink-0" />
                    )}
                    <span className="font-medium truncate">{cat.name}</span>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button variant="outline" size="sm" onClick={() => openAdd(cat.id)} title="إضافة فرعي">
                      +
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(cat)}>
                      تعديل
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(cat)} className="text-red-600">
                      حذف
                    </Button>
                  </div>
                </div>
                {hasSubs && isExpanded && (
                  <div className="me-14 ps-4 border-s-2 border-gray-200 bg-gray-50/50">
                    {subs.map((sub) => (
                      <div key={sub.id} className="flex items-center justify-between py-2 px-3 hover:bg-gray-50/50">
                        <span className="text-gray-600">— {sub.name}</span>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEdit(sub)}>
                            تعديل
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(sub)} className="text-red-600">
                            حذف
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'تعديل تصنيف' : 'إضافة تصنيف'}>
        <Input
          label="الاسم"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <Input
          label="Slug"
          value={form.slug}
          onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          className="mt-4"
        />
        <Select
          label="التصنيف الأب (اختياري)"
          value={form.parentId ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value || null }))}
          options={[
            { value: '', label: '— تصنيف رئيسي —' },
            ...mainCategories.map((c) => ({ value: c.id, label: c.name })),
          ]}
          className="mt-4"
        />
        <label className="mt-4 flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.markupExempt}
            onChange={(e) => setForm((f) => ({ ...f, markupExempt: e.target.checked }))}
            className="rounded border-gray-300"
          />
          <span className="text-sm text-gray-800">معفى من عمولة المنصة (مشروبات / ماء / كولا)</span>
        </label>
        <div className="mt-6 flex gap-2">
          <Button onClick={save}>حفظ</Button>
          <Button variant="ghost" onClick={() => setModalOpen(false)}>
            إلغاء
          </Button>
        </div>
      </Modal>
      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => { if (deleteConfirm) remove(deleteConfirm.id); }}
        title="حذف التصنيف"
        message={`هل أنت متأكد من حذف "${deleteConfirm?.name}"؟`}
        confirmLabel="حذف"
        variant="danger"
      />
    </div>
  );
}
