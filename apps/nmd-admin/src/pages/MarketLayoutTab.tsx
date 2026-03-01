import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Modal, useToast, Input } from '@nmd/ui';
import { apiFetch } from '../api';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

interface MarketSection {
  id: string;
  title: string;
  type: 'SLIDER';
  storeIds: string[];
}

interface MarketLayoutTabProps {
  marketSlug: string;
  marketId: string;
  tenants: { id: string; slug: string; name: string }[];
}

export default function MarketLayoutTab({ marketSlug, tenants }: MarketLayoutTabProps) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<MarketSection | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formStoreIds, setFormStoreIds] = useState<Set<string>>(new Set());

  const { data: layout = [], isLoading } = useQuery({
    queryKey: ['market-layout', marketSlug],
    queryFn: () => apiFetch<MarketSection[]>(`/markets/by-slug/${marketSlug}/layout`),
    enabled: !!marketSlug && !!MOCK_API_URL,
  });

  const saveMutation = useMutation({
    mutationFn: async (newLayout: MarketSection[]) => {
      return apiFetch<MarketSection[]>(`/markets/by-slug/${marketSlug}/layout`, {
        method: 'PUT',
        body: JSON.stringify(newLayout),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market-layout', marketSlug] });
      addToast('تم الحفظ', 'success');
      setEditModalOpen(false);
      setEditingSection(null);
    },
    onError: (err: Error) => addToast(err?.message ?? 'فشل الحفظ', 'error'),
  });

  const openAdd = () => {
    setEditingSection(null);
    setFormTitle('');
    setFormStoreIds(new Set());
    setEditModalOpen(true);
  };

  const openEdit = (s: MarketSection) => {
    setEditingSection(s);
    setFormTitle(s.title);
    const slugs = s.storeIds.map((id) => tenants.find((t) => t.id === id || t.slug === id)?.slug ?? id);
    setFormStoreIds(new Set(slugs));
    setEditModalOpen(true);
  };

  const toggleStore = (slug: string) => {
    setFormStoreIds((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const handleSave = () => {
    if (!formTitle.trim()) {
      addToast('أدخل عنوان القسم', 'error');
      return;
    }
    const storeIds = Array.from(formStoreIds).filter(Boolean);
    const updated: MarketSection = {
      id: editingSection?.id ?? `s-${Date.now()}`,
      title: formTitle.trim(),
      type: 'SLIDER',
      storeIds,
    };
    const newLayout = editingSection
      ? layout.map((s) => (s.id === editingSection.id ? updated : s))
      : [...layout, updated];
    saveMutation.mutate(newLayout);
  };

  const handleDelete = (id: string) => {
    const newLayout = layout.filter((s) => s.id !== id);
    saveMutation.mutate(newLayout);
  };

  if (isLoading) return <div className="p-8 text-gray-500">جاري التحميل...</div>;

  return (
    <Card>
      <div className="p-4 flex justify-between items-center border-b border-gray-100">
        <span className="text-sm text-gray-600">أقسام الصفحة الرئيسية (الشريط الأفقي)</span>
        <Button size="sm" onClick={openAdd}>
          <Plus className="w-4 h-4" />
          إضافة قسم
        </Button>
      </div>
      <div className="divide-y divide-gray-100">
        {layout.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            لا توجد أقسام. اضغط &quot;إضافة قسم&quot; للبدء.
          </div>
        ) : (
          layout.map((s) => (
            <div key={s.id} className="p-4 flex items-center gap-4">
              <GripVertical className="w-5 h-5 text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{s.title}</p>
                <p className="text-xs text-gray-500">
                  {s.storeIds.length} محل: {s.storeIds.map((id) => tenants.find((t) => t.id === id || t.slug === id)?.name ?? id).join(', ') || '—'}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)} className="text-red-600">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title={editingSection ? 'تعديل القسم' : 'إضافة قسم'} size="md">
        <div className="space-y-4">
          <Input
            label="عنوان القسم"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder="محلات مميزة"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">المحلات في هذا القسم</label>
            <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {tenants.length === 0 ? (
                <div className="p-4 text-center text-gray-500">لا يوجد محلات في هذا السوق</div>
              ) : (
                tenants.map((t) => (
                  <label key={t.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formStoreIds.has(t.slug)}
                      onChange={() => toggleStore(t.slug)}
                    />
                    <span className="font-medium">{t.name}</span>
                    <span className="text-xs text-gray-500">({t.slug})</span>
                  </label>
                ))
              )}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'جاري...' : 'حفظ'}
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
