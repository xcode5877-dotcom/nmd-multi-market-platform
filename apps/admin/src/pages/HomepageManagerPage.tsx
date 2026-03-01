import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Input, Select, useToast } from '@nmd/ui';
import { useAdminContext } from '../context/AdminContext';
import { useAdminData } from '../hooks/useAdminData';
import { MockApiClient } from '@nmd/mock';
import { getTenantById } from '@nmd/mock';
import type { HomeCollection, Category, Product } from '@nmd/core';
import { generateId } from '@nmd/core';

const api = new MockApiClient();
const USE_API = !!import.meta.env.VITE_MOCK_API_URL;

const DEFAULT_COLLECTION: Omit<HomeCollection, 'id'> = {
  title: '',
  type: 'category',
  targetId: '',
  isActive: true,
  sortOrder: 0,
};

export default function HomepageManagerPage() {
  const { tenantId } = useAdminContext();
  const addToast = useToast().addToast;
  const queryClient = useQueryClient();
  const adminData = useAdminData(tenantId ?? '');

  const { data: tenantFromApi } = useQuery({
    queryKey: ['tenant-registry', tenantId],
    queryFn: () => api.getTenantById(tenantId!),
    enabled: !!tenantId && USE_API,
  });

  const { data: catalog } = useQuery({
    queryKey: ['catalog', tenantId],
    queryFn: () => api.getCatalogApi(tenantId!),
    enabled: !!tenantId && USE_API,
  });

  const tenant = USE_API ? tenantFromApi : (tenantId ? getTenantById(tenantId) : null);
  const collections = (tenant as { collections?: HomeCollection[] })?.collections ?? [];
  const categories = (USE_API ? (catalog?.categories ?? []) : adminData.getCategories()) as Category[];
  const products = (USE_API ? (catalog?.products ?? []) : adminData.getProducts()) as Product[];

  const [items, setItems] = useState<HomeCollection[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<HomeCollection>(() => ({
    ...DEFAULT_COLLECTION,
    id: generateId(),
    targetIds: [],
  }));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const sorted = [...collections].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    setItems(sorted);
  }, [collections]);

  const mainCategories = categories.filter((c) => !c.parentId || c.parentId === '');

  const addSection = () => {
    const newId = generateId();
    setForm({
      id: newId,
      title: '',
      type: 'category',
      targetId: mainCategories[0]?.id ?? '',
      isActive: true,
      sortOrder: items.length,
      targetIds: [],
    });
    setEditingId(newId);
  };

  const startEdit = (c: HomeCollection) => {
    setForm({
      id: c.id,
      title: c.title,
      type: c.type,
      targetId: c.targetId ?? '',
      targetIds: c.targetIds ?? [],
      isActive: c.isActive,
      sortOrder: c.sortOrder ?? 0,
    });
    setEditingId(c.id);
  };

  const updateForm = (updates: Partial<HomeCollection>) => {
    setForm((f) => ({ ...f, ...updates }));
  };

  const saveEdit = () => {
    if (!form.title.trim()) {
      addToast('أدخل عنوان القسم', 'error');
      return;
    }
    if (form.type === 'category' && !form.targetId) {
      addToast('اختر تصنيفًا', 'error');
      return;
    }
    if (form.type === 'manual' && (!form.targetIds || form.targetIds.length === 0)) {
      addToast('اختر منتجات على الأقل', 'error');
      return;
    }
    const existing = items.find((i) => i.id === form.id);
    const payload = {
      ...form,
      targetId: form.type === 'category' ? form.targetId : undefined,
      targetIds: form.type === 'manual' ? form.targetIds : undefined,
      sortOrder: existing ? existing.sortOrder ?? items.length : items.length,
    };
    const next = existing
      ? items.map((i) => (i.id === form.id ? payload : i))
      : [...items, payload];
    setItems(next);
    setEditingId(null);
  };

  const removeSection = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const moveSection = (id: string, direction: 'up' | 'down') => {
    setItems((prev) => {
      const list = [...prev];
      const idx = list.findIndex((i) => i.id === id);
      if (idx === -1) return prev;
      if (direction === 'up' && idx === 0) return prev;
      if (direction === 'down' && idx === list.length - 1) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      [list[idx], list[swapIdx]] = [list[swapIdx], list[idx]];
      return list.map((item, i) => ({ ...item, sortOrder: i }));
    });
  };

  const toggleActive = (id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, isActive: !i.isActive } : i))
    );
  };

  const persist = async () => {
    setSaving(true);
    try {
      const toSave = items.map((item, i) => ({
        ...item,
        sortOrder: i,
      }));
      await api.updateCollectionsApi(tenantId!, toSave);
      addToast('تم حفظ أقسام الصفحة الرئيسية', 'success');
      if (USE_API) {
        queryClient.invalidateQueries({ queryKey: ['tenant-registry', tenantId] });
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'فشل الحفظ', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addProductToManual = (productId: string) => {
    if (form.targetIds?.includes(productId)) return;
    setForm((f) => ({
      ...f,
      targetIds: [...(f.targetIds ?? []), productId],
    }));
  };

  const removeProductFromManual = (productId: string) => {
    setForm((f) => ({
      ...f,
      targetIds: (f.targetIds ?? []).filter((id) => id !== productId),
    }));
  };

  const isEditing = editingId !== null;
  const editingItem = items.find((i) => i.id === editingId);

  return (
    <div className="pb-24">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">مدير الصفحة الرئيسية</h1>
      <p className="text-gray-600 mb-6">
        أضف أقسامًا ديناميكية تظهر في الصفحة الرئيسية (مثل: مختارات، وصل حديثًا، أفضل المبيعات).
      </p>

      <div className="flex flex-col gap-6">
        <Card>
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-gray-900">الأقسام</h2>
              <Button onClick={addSection}>إضافة قسم</Button>
            </div>

            {items.length === 0 ? (
              <p className="text-gray-500 py-8 text-center">
                لا توجد أقسام. انقر &quot;إضافة قسم&quot; للبدء.
              </p>
            ) : (
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-4 rounded-lg border ${
                      editingId === item.id ? 'border-primary bg-primary/5' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => moveSection(item.id, 'up')}
                        disabled={idx === 0}
                        className="p-1 rounded hover:bg-gray-200 disabled:opacity-40"
                        aria-label="تحريك لأعلى"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSection(item.id, 'down')}
                        disabled={idx === items.length - 1}
                        className="p-1 rounded hover:bg-gray-200 disabled:opacity-40"
                        aria-label="تحريك لأسفل"
                      >
                        ▼
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.title || '(بدون عنوان)'}</p>
                      <p className="text-sm text-gray-500">
                        {item.type === 'category'
                          ? `تصنيف: ${mainCategories.find((c) => c.id === item.targetId)?.name ?? item.targetId}`
                          : `يدوي: ${(item.targetIds ?? []).length} منتج`}
                      </p>
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={item.isActive}
                        onChange={() => toggleActive(item.id)}
                      />
                      <span className="text-sm">ظاهر</span>
                    </label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(item)}
                      >
                        تعديل
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeSection(item.id)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        حذف
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {isEditing && (
          <Card>
            <div className="p-6 space-y-4">
              <h2 className="font-semibold text-gray-900">
                {editingItem ? 'تعديل القسم' : 'قسم جديد'}
              </h2>
              <Input
                label="عنوان القسم"
                value={form.title}
                onChange={(e) => updateForm({ title: e.target.value })}
                placeholder="مثال: مختارات، وصل حديثًا"
              />
              <Select
                label="نوع المحتوى"
                options={[
                  { value: 'category', label: 'تصنيف (عرض منتجات التصنيف)' },
                  { value: 'manual', label: 'يدوي (اختيار منتجات محددة)' },
                ]}
                value={form.type}
                onChange={(e) =>
                  updateForm({
                    type: e.target.value as 'category' | 'manual',
                    targetId: form.type === 'category' ? form.targetId : undefined,
                    targetIds: form.type === 'manual' ? form.targetIds : [],
                  })
                }
              />
              {form.type === 'category' && (
                <Select
                  label="التصنيف"
                  options={mainCategories.map((c) => ({ value: c.id, label: c.name }))}
                  value={form.targetId ?? ''}
                  onChange={(e) => updateForm({ targetId: e.target.value })}
                />
              )}
              {form.type === 'manual' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    المنتجات المختارة
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(form.targetIds ?? []).map((pid) => {
                      const p = products.find((x) => x.id === pid);
                      return (
                        <span
                          key={pid}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-sm"
                        >
                          {p?.name ?? pid}
                          <button
                            type="button"
                            onClick={() => removeProductFromManual(pid)}
                            className="hover:bg-primary/20 rounded-full p-0.5"
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                  <Select
                    label="إضافة منتج"
                    options={[
                      { value: '', label: '-- اختر منتجًا --' },
                      ...products
                        .filter((p) => !form.targetIds?.includes(p.id))
                        .map((p) => ({ value: p.id, label: p.name })),
                    ]}
                    value=""
                    onChange={(e) => {
                      if (e.target.value) addProductToManual(e.target.value);
                    }}
                  />
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={saveEdit}>حفظ التعديل</Button>
                <Button variant="outline" onClick={() => setEditingId(null)}>
                  إلغاء
                </Button>
              </div>
            </div>
          </Card>
        )}

        {items.length > 0 && (
          <div className="flex justify-end">
            <Button onClick={persist} disabled={saving}>
              {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
