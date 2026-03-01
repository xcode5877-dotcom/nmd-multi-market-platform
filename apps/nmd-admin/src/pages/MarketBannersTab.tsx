import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Modal, useToast, Input, Select } from '@nmd/ui';
import { apiFetch } from '../api';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

interface MarketBanner {
  id: string;
  imageUrl: string;
  title: string;
  linkTo: string;
  active: boolean;
}

interface MarketBannersTabProps {
  marketSlug: string;
  marketId: string;
  tenants: { id: string; slug: string; name: string }[];
}

export default function MarketBannersTab({ marketSlug, tenants }: MarketBannersTabProps) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<MarketBanner | null>(null);
  const [form, setForm] = useState<Partial<MarketBanner>>({});

  const { data: banners = [], isLoading } = useQuery({
    queryKey: ['market-banners', marketSlug],
    queryFn: () => apiFetch<MarketBanner[]>(`/markets/by-slug/${marketSlug}/banners`),
    enabled: !!marketSlug && !!MOCK_API_URL,
  });

  const saveMutation = useMutation({
    mutationFn: async (newBanners: MarketBanner[]) => {
      return apiFetch<MarketBanner[]>(`/markets/by-slug/${marketSlug}/banners`, {
        method: 'PUT',
        body: JSON.stringify(newBanners),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market-banners', marketSlug] });
      addToast('تم الحفظ', 'success');
      setEditModalOpen(false);
      setEditingBanner(null);
    },
    onError: (err: Error) => addToast(err?.message ?? 'فشل الحفظ', 'error'),
  });

  const openAdd = () => {
    setEditingBanner(null);
    setForm({
      id: `b-${Date.now()}`,
      imageUrl: 'https://placehold.co/1200x514/1e293b/ffffff?text=إعلان',
      title: '',
      linkTo: tenants[0]?.slug ?? '',
      active: true,
    });
    setEditModalOpen(true);
  };

  const openEdit = (b: MarketBanner) => {
    setEditingBanner(b);
    setForm({ ...b });
    setEditModalOpen(true);
  };

  const handleSave = () => {
    if (!form.id || !form.imageUrl || !form.title) {
      addToast('املأ الحقول المطلوبة', 'error');
      return;
    }
    const updated: MarketBanner = {
      id: form.id,
      imageUrl: form.imageUrl,
      title: form.title,
      linkTo: form.linkTo ?? '',
      active: form.active ?? true,
    };
    const newBanners = editingBanner
      ? banners.map((b) => (b.id === editingBanner.id ? updated : b))
      : [...banners, updated];
    saveMutation.mutate(newBanners);
  };

  const handleDelete = (id: string) => {
    const newBanners = banners.filter((b) => b.id !== id);
    saveMutation.mutate(newBanners);
  };

  if (isLoading) return <div className="p-8 text-gray-500">جاري التحميل...</div>;

  return (
    <Card>
      <div className="p-4 flex justify-between items-center border-b border-gray-100">
        <span className="text-sm text-gray-600">إعلانات الهيرو (الشريط العلوي)</span>
        <Button size="sm" onClick={openAdd}>
          <Plus className="w-4 h-4" />
          إضافة إعلان
        </Button>
      </div>
      <div className="divide-y divide-gray-100">
        {banners.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            لا توجد إعلانات. اضغط إضافة إعلان للبدء.
          </div>
        ) : (
          banners.map((b) => (
            <div key={b.id} className="p-4 flex items-center gap-4">
              <div className="w-24 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                <img src={b.imageUrl} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{b.title || '(بدون عنوان)'}</p>
                <p className="text-xs text-gray-500">
                  الرابط: {(tenants.find((t) => t.slug === b.linkTo)?.name ?? b.linkTo) || '—'} •{' '}
                  {b.active ? 'نشط' : 'غير نشط'}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="ghost" size="sm" onClick={() => openEdit(b)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(b.id)} className="text-red-600">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)} title={editingBanner ? 'تعديل الإعلان' : 'إضافة إعلان'} size="md">
        <div className="space-y-4">
          <Input
            label="رابط الصورة (imageUrl)"
            value={form.imageUrl ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
            placeholder="https://..."
          />
          <Input
            label="العنوان"
            value={form.title ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="بيتسا إيطالية طازجة"
          />
          <Select
            label="المحل المرتبط (الرابط عند النقر)"
            value={form.linkTo ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, linkTo: e.target.value }))}
            options={[
              { value: '', label: '— لا رابط —' },
              ...tenants.map((t) => ({ value: t.slug, label: `${t.name} (${t.slug})` })),
            ]}
          />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.active ?? true}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            <span className="text-sm">نشط (يظهر في الشريط)</span>
          </label>
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
