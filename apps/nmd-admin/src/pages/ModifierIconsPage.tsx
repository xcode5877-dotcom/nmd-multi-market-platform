import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Input, Modal, Select, useToast } from '@nmd/ui';
import {
  ImagePlus,
  Plus,
  Save,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  apiFetch,
  apiUploadSingleImage,
  listMarketModifierIcons,
  saveMarketModifierIcons,
} from '../api';
import { normalizeMarketsList } from '../lib/feedCampaignNormalize';
import {
  MODIFIER_ICON_CATEGORY_LABELS,
  createModifierIcon,
  normalizeModifierIconsList,
  type ModifierIcon,
} from '../types/modifierIcon';

const CATEGORY_OPTIONS = Object.entries(MODIFIER_ICON_CATEGORY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export default function ModifierIconsPage() {
  const addToast = useToast().addToast;
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [marketSlug, setMarketSlug] = useState('dabburiyya');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [working, setWorking] = useState<ModifierIcon[]>([]);
  const [serverKey, setServerKey] = useState('');
  const [uploading, setUploading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ModifierIcon>(() => createModifierIcon());

  const { data: markets = [] } = useQuery({
    queryKey: ['markets-list-modifier-icons'],
    queryFn: async () => normalizeMarketsList(await apiFetch<unknown>('/markets')),
  });

  const { data: items = [], isLoading, refetch } = useQuery({
    queryKey: ['modifier-icons', marketSlug],
    queryFn: () => listMarketModifierIcons(marketSlug),
    enabled: !!marketSlug.trim(),
  });

  useEffect(() => {
    const sorted = normalizeModifierIconsList(items);
    setWorking(sorted);
    setServerKey(JSON.stringify(sorted));
  }, [items, marketSlug]);

  const dirty = JSON.stringify(working) !== serverKey;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return working.filter((icon) => {
      if (categoryFilter !== 'all' && (icon.category ?? 'pizza') !== categoryFilter) return false;
      if (!q) return true;
      return (
        icon.key.includes(q) ||
        icon.labelAr.toLowerCase().includes(q) ||
        (icon.labelEn ?? '').toLowerCase().includes(q) ||
        icon.keywords.some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [working, query, categoryFilter]);

  const saveMutation = useMutation({
    mutationFn: (next: ModifierIcon[]) => saveMarketModifierIcons(marketSlug, next),
    onSuccess: async (data) => {
      queryClient.setQueryData(['modifier-icons', marketSlug], data);
      const sorted = normalizeModifierIconsList(data);
      setWorking(sorted);
      setServerKey(JSON.stringify(sorted));
      addToast('تم حفظ مكتبة الأيقونات', 'success');
      await refetch();
    },
    onError: (e: Error) => addToast(e.message || 'فشل الحفظ', 'error'),
  });

  const persistLocal = (next: ModifierIcon[]) => {
    const sorted = [...next].sort((a, b) => a.sortOrder - b.sortOrder);
    setWorking(sorted);
  };

  const openNew = () => {
    setEditingId(null);
    setDraft(createModifierIcon({ sortOrder: working.length }));
    setModalOpen(true);
  };

  const openEdit = (icon: ModifierIcon) => {
    setEditingId(icon.id);
    setDraft({ ...icon, keywords: [...icon.keywords] });
    setModalOpen(true);
  };

  const saveDraft = () => {
    if (!draft.key.trim() || !draft.labelAr.trim()) {
      addToast('المفتاح والاسم العربي مطلوبان', 'error');
      return;
    }
    const normalized = createModifierIcon({
      ...draft,
      key: draft.key.trim().toLowerCase(),
      keywords: draft.keywords.filter(Boolean),
    });
    if (editingId) {
      persistLocal(working.map((i) => (i.id === editingId ? normalized : i)));
    } else {
      if (working.some((i) => i.key === normalized.key)) {
        addToast('المفتاح مستخدم مسبقاً', 'error');
        return;
      }
      persistLocal([...working, normalized]);
    }
    setModalOpen(false);
  };

  const handleUpload = async (file: File, targetId?: string) => {
    setUploading(true);
    try {
      const url = await apiUploadSingleImage(file);
      if (targetId) {
        persistLocal(working.map((i) => (i.id === targetId ? { ...i, iconUrl: url } : i)));
        addToast('تم رفع الأيقونة', 'success');
      } else {
        setDraft((d) => ({ ...d, iconUrl: url }));
      }
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'فشل الرفع', 'error');
    } finally {
      setUploading(false);
    }
  };

  const moveIcon = (id: string, dir: -1 | 1) => {
    const idx = working.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const next = [...working];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    persistLocal(next.map((row, i) => ({ ...row, sortOrder: i })));
  };

  const keywordsText = draft.keywords.join(', ');

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">مكتبة أيقونات الإضافات</h1>
          <p className="text-sm text-gray-600 mt-1">
            مكتبة مركزية لجميع المتاجر — يختار التاجر مفتاحاً فقط دون رفع صور عشوائية.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            تحديث
          </Button>
          <Button
            onClick={() => saveMutation.mutate(working)}
            disabled={!dirty || saveMutation.isPending}
          >
            <Save className="w-4 h-4 ms-1" />
            {saveMutation.isPending ? 'جاري الحفظ…' : 'حفظ المكتبة'}
          </Button>
        </div>
      </div>

      <Card className="p-4 flex flex-wrap gap-4 items-end">
        <div className="min-w-[200px]">
          <Select
            label="السوق"
            value={marketSlug}
            onChange={(e) => setMarketSlug(e.target.value)}
            options={markets.map((m) => ({ value: m.slug, label: m.name || m.slug }))}
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <Input
            label="بحث"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="زيتون، olive، pizza…"
          />
        </div>
        <div className="min-w-[160px]">
          <Select
            label="التصنيف"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            options={[{ value: 'all', label: 'الكل' }, ...CATEGORY_OPTIONS]}
          />
        </div>
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 ms-1" />
          إضافة أيقونة
        </Button>
      </Card>

      {dirty && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          لديك تغييرات غير محفوظة — اضغط «حفظ المكتبة» قبل المغادرة.
        </p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          const tid = fileRef.current?.dataset.targetId;
          if (f) void handleUpload(f, tid || undefined);
          e.target.value = '';
          if (fileRef.current) delete fileRef.current.dataset.targetId;
        }}
      />

      {isLoading ? (
        <Card className="p-8 text-center text-gray-500">جاري التحميل…</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">لا توجد أيقونات مطابقة.</Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((icon) => (
            <Card key={icon.id} className={`p-4 ${icon.active ? '' : 'opacity-60'}`}>
              <div className="flex gap-3">
                <div className="w-14 h-14 rounded-xl bg-gray-100 border flex items-center justify-center overflow-hidden shrink-0">
                  {icon.iconUrl ? (
                    <img src={icon.iconUrl} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <ImagePlus className="w-6 h-6 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 truncate">{icon.labelAr}</p>
                  <p className="text-xs text-gray-500 font-mono">{icon.key}</p>
                  <p className="text-xs text-gray-500">
                    {MODIFIER_ICON_CATEGORY_LABELS[icon.category ?? 'pizza'] ?? icon.category}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                <Button variant="outline" size="sm" onClick={() => openEdit(icon)}>
                  تعديل
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (fileRef.current) {
                      fileRef.current.dataset.targetId = icon.id;
                      fileRef.current.click();
                    }
                  }}
                  disabled={uploading}
                >
                  <Upload className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => moveIcon(icon.id, -1)}>
                  ↑
                </Button>
                <Button variant="ghost" size="sm" onClick={() => moveIcon(icon.id, 1)}>
                  ↓
                </Button>
                <button
                  type="button"
                  className="p-1"
                  onClick={() =>
                    persistLocal(
                      working.map((i) =>
                        i.id === icon.id ? { ...i, active: !i.active } : i,
                      ),
                    )
                  }
                  title={icon.active ? 'تعطيل' : 'تفعيل'}
                >
                  {icon.active ? (
                    <ToggleRight className="w-5 h-5 text-teal-700" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={() => {
                    if (!confirm('حذف هذا المدخل من المكتبة؟')) return;
                    persistLocal(working.filter((i) => i.id !== icon.id));
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'تعديل أيقونة' : 'أيقونة جديدة'}>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-xl bg-gray-100 border flex items-center justify-center overflow-hidden">
              {draft.iconUrl ? (
                <img src={draft.iconUrl} alt="" className="w-full h-full object-contain" />
              ) : (
                <span className="text-xs text-gray-500 text-center px-1">بدون رفع — fallback</span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = () => {
                  const f = input.files?.[0];
                  if (f) void handleUpload(f);
                };
                input.click();
              }}
            >
              <Upload className="w-4 h-4 ms-1" />
              رفع صورة
            </Button>
            {draft.iconUrl && (
              <Button variant="ghost" size="sm" onClick={() => setDraft((d) => ({ ...d, iconUrl: '' }))}>
                إزالة الصورة
              </Button>
            )}
          </div>
          <Input
            label="المفتاح (إنجليزي — يُخزَّن على الخيار)"
            value={draft.key}
            onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value }))}
            disabled={!!editingId}
            placeholder="olive"
          />
          <Input
            label="الاسم بالعربية"
            value={draft.labelAr}
            onChange={(e) => setDraft((d) => ({ ...d, labelAr: e.target.value }))}
          />
          <Input
            label="الاسم بالإنجليزية (اختياري)"
            value={draft.labelEn ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, labelEn: e.target.value }))}
          />
          <Input
            label="الاسم بالعبرية (اختياري)"
            value={draft.labelHe ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, labelHe: e.target.value }))}
          />
          <Select
            label="التصنيف"
            value={draft.category ?? 'pizza'}
            onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
            options={CATEGORY_OPTIONS}
          />
          <Input
            label="كلمات مطابقة (مفصولة بفاصلة)"
            value={keywordsText}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                keywords: e.target.value.split(/[,،]/).map((s) => s.trim()).filter(Boolean),
              }))
            }
            placeholder="زيتون, olive, זית"
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
            />
            <span className="text-sm">مفعّل للمتاجر</span>
          </label>
        </div>
        <div className="mt-6 flex gap-2">
          <Button onClick={saveDraft}>تم</Button>
          <Button variant="ghost" onClick={() => setModalOpen(false)}>
            إلغاء
          </Button>
        </div>
      </Modal>
    </div>
  );
}
