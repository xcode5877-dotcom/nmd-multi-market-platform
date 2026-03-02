import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Modal, useToast, Input, Select } from '@nmd/ui';
import { apiFetch, apiUploadBanner } from '../api';
import { Plus, Pencil, Trash2, Upload } from 'lucide-react';

const MOCK_API_URL = import.meta.env.VITE_MOCK_API_URL ?? '';

const BANNER_PLACEHOLDER = 'https://placehold.co/1200x400/1e293b/ffffff?text=إعلان';
const BANNER_MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ['image/webp', 'image/jpeg', 'image/jpg', 'image/png'];
const ALLOWED_EXT = ['.webp', '.jpg', '.jpeg', '.png'];

function validateBannerFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'فقط WebP أو JPG أو PNG مسموح';
  }
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  if (!ALLOWED_EXT.includes(ext)) return 'امتداد الملف غير مدعوم';
  if (file.size > BANNER_MAX_BYTES) return 'الحد الأقصى 2 ميجابايت';
  return null;
}

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
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const { data: banners = [], isLoading } = useQuery({
    queryKey: ['market-banners', marketSlug],
    queryFn: () => apiFetch<MarketBanner[]>(`/markets/by-slug/${marketSlug}/banners`),
    enabled: !!marketSlug && !!MOCK_API_URL,
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { newBanners: MarketBanner[]; imageUrl?: string }) => {
      const { newBanners } = payload;
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
      setPendingFile(null);
      if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    },
    onError: (err: Error) => addToast(err?.message ?? 'فشل الحفظ', 'error'),
  });

  const openAdd = () => {
    setEditingBanner(null);
    setPendingFile(null);
    setPreviewUrl(null);
    setForm({
      id: `b-${Date.now()}`,
      imageUrl: BANNER_PLACEHOLDER,
      title: '',
      linkTo: tenants[0]?.slug ?? '',
      active: true,
    });
    setEditModalOpen(true);
  };

  const openEdit = (b: MarketBanner) => {
    setEditingBanner(b);
    setForm({ ...b });
    setPendingFile(null);
    setPreviewUrl(null);
    setEditModalOpen(true);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateBannerFile(file);
    if (err) {
      addToast(err, 'error');
      return;
    }
    if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setForm((f) => ({ ...f, imageUrl: f.imageUrl || BANNER_PLACEHOLDER }));
  };

  const handleSave = async () => {
    if (!form.id || !form.title) {
      addToast('املأ الحقول المطلوبة', 'error');
      return;
    }
    let imageUrl = form.imageUrl ?? BANNER_PLACEHOLDER;
    if (pendingFile && MOCK_API_URL) {
      try {
        const { urls } = await apiUploadBanner(pendingFile);
        imageUrl = urls[0];
      } catch (e) {
        addToast(e instanceof Error ? e.message : 'فشل رفع الصورة', 'error');
        return;
      }
    } else if (pendingFile && !MOCK_API_URL) {
      addToast('رفع الصورة يتطلب الاتصال بالخادم (VITE_MOCK_API_URL)', 'error');
      return;
    }
    const updated: MarketBanner = {
      id: form.id,
      imageUrl,
      title: form.title,
      linkTo: form.linkTo ?? '',
      active: form.active ?? true,
    };
    const newBanners = editingBanner
      ? banners.map((b) => (b.id === editingBanner.id ? updated : b))
      : [...banners, updated];
    saveMutation.mutate({ newBanners });
  };

  const handleDelete = (id: string) => {
    const newBanners = banners.filter((b) => b.id !== id);
    saveMutation.mutate({ newBanners });
  };

  const displayPreviewUrl = previewUrl ?? (form.imageUrl || BANNER_PLACEHOLDER);

  if (isLoading) {
    return <div className="p-8 text-gray-500">جاري التحميل...</div>;
  }

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
              <div className="w-24 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0 aspect-[3/1] max-h-12">
                <img
                  src={b.imageUrl || BANNER_PLACEHOLDER}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = BANNER_PLACEHOLDER;
                  }}
                />
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
          {/* 3:1 preview */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">معاينة (نسبة 3:1)</p>
            <div className="relative w-full rounded-xl overflow-hidden border border-gray-200 bg-gray-100" style={{ aspectRatio: '3/1' }}>
              <img
                src={displayPreviewUrl}
                alt="معاينة"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = BANNER_PLACEHOLDER;
                }}
              />
            </div>
          </div>

          {/* File upload */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".webp,.jpg,.jpeg,.png,image/webp,image/jpeg,image/png"
              className="hidden"
              onChange={onFileChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {pendingFile ? pendingFile.name : 'اختر صورة (WebP, JPG, PNG - حد 2 ميجا)'}
            </Button>
            <p className="text-xs text-gray-500 mt-1">WebP، JPG أو PNG فقط. الحد الأقصى 2 ميجابايت.</p>
          </div>

          <Input
            label="رابط الصورة (اختياري إذا رفعت ملفاً)"
            value={form.imageUrl ?? ''}
            onChange={(e) => {
              setForm((f) => ({ ...f, imageUrl: e.target.value }));
              if (!pendingFile) setPreviewUrl(null);
            }}
            placeholder="https://... أو ارفع ملفاً أعلاه"
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
