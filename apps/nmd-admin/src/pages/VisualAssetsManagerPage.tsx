import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, Input, Modal, useToast } from '@nmd/ui';
import {
  ImagePlus,
  Search,
  Upload,
  Eye,
  Trash2,
  GripVertical,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  FolderTree,
  LayoutGrid,
  Gift,
} from 'lucide-react';
import { apiUploadSingleImage } from '../api';
import {
  VISUAL_ASSET_TYPE_LABELS,
  createVisualAsset,
  loadVisualAssetsCatalog,
  saveVisualAssetsCatalog,
  type SharedVisualAsset,
  type SharedVisualAssetType,
} from '../types/sharedVisualAsset';

const TYPE_OPTIONS: SharedVisualAssetType[] = [
  'category_icon',
  'reward_icon',
  'service_icon',
  'community_banner',
  'section_cover',
  'placeholder',
];

const QUICK_LINKS = [
  { to: '/pillars', label: 'أعمدة المول', icon: LayoutGrid },
  { to: '/categories', label: 'التصنيفات', icon: FolderTree },
  { to: '/rewards', label: 'المكافآت', icon: Gift },
];

export default function VisualAssetsManagerPage() {
  const addToast = useToast().addToast;
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<SharedVisualAsset[]>(() => loadVisualAssetsCatalog());
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<SharedVisualAssetType | 'all'>('all');
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<SharedVisualAsset | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftType, setDraftType] = useState<SharedVisualAssetType>('category_icon');
  const [dragId, setDragId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((a) => {
      if (typeFilter !== 'all' && a.type !== typeFilter) return false;
      if (!q) return true;
      return a.title.toLowerCase().includes(q) || a.imageUrl.toLowerCase().includes(q);
    });
  }, [items, query, typeFilter]);

  const persist = (next: SharedVisualAsset[]) => {
    setItems(next);
    saveVisualAssetsCatalog(next);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await apiUploadSingleImage(file);
      const asset = createVisualAsset({
        title: draftTitle.trim() || file.name.replace(/\.[^.]+$/, ''),
        type: draftType,
        imageUrl: url,
        thumbnailUrl: url,
        active: true,
      });
      persist([asset, ...items]);
      setDraftTitle('');
      addToast('تم رفع الأصل وإضافته للمكتبة', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'فشل الرفع', 'error');
    } finally {
      setUploading(false);
    }
  };

  const toggleActive = (id: string) => {
    persist(items.map((a) => (a.id === id ? { ...a, active: !a.active } : a)));
  };

  const removeAsset = (id: string) => {
    persist(items.filter((a) => a.id !== id));
    addToast('تم حذف الأصل من المكتبة المحلية', 'success');
  };

  const reorder = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const from = items.findIndex((a) => a.id === dragId);
    const to = items.findIndex((a) => a.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    persist(next.map((a, i) => ({ ...a, sortOrder: i })));
  };

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-teal-600" />
            مكتبة الأصول البصرية
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            ارفع أيقونات وصوراً premium — تُحفظ محلياً وتُربط بالتصنيفات والمكافآت عبر الروابط السريعة.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK_LINKS.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            </Link>
          ))}
        </div>
      </div>

      <Card className="p-5 border border-gray-100 shadow-sm bg-gradient-to-br from-white to-gray-50/80">
        <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
          <div>
            <label className="text-xs font-bold text-gray-600">عنوان الأصل</label>
            <Input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="مثال: أيقونة مطاعم"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600">النوع</label>
            <select
              value={draftType}
              onChange={(e) => setDraftType(e.target.value as SharedVisualAssetType)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
            >
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {VISUAL_ASSET_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/webp,image/jpeg,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(f);
                e.target.value = '';
              }}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="gap-2 bg-teal-600 hover:bg-teal-700"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'جاري الرفع…' : 'رفع صورة'}
            </Button>
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث بالعنوان أو الرابط…"
            className="pr-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterChip active={typeFilter === 'all'} onClick={() => setTypeFilter('all')} label="الكل" />
          {TYPE_OPTIONS.map((t) => (
            <FilterChip
              key={t}
              active={typeFilter === t}
              onClick={() => setTypeFilter(t)}
              label={VISUAL_ASSET_TYPE_LABELS[t]}
            />
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <ImagePlus className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p className="font-bold text-gray-700">لا توجد أصول بعد</p>
          <p className="text-sm text-gray-500 mt-1">ارفع PNG/WebP شفاف لأيقونات premium</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filtered.map((asset) => (
            <Card
              key={asset.id}
              draggable
              onDragStart={() => setDragId(asset.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => reorder(asset.id)}
              className={`group overflow-hidden border transition-all hover:shadow-lg hover:-translate-y-0.5 ${
                asset.active ? 'border-teal-100' : 'border-gray-200 opacity-60'
              }`}
            >
              <div className="relative aspect-square bg-gradient-to-br from-teal-50 to-gray-100 flex items-center justify-center p-4">
                <img
                  src={asset.imageUrl}
                  alt={asset.title}
                  className="max-h-full max-w-full object-contain drop-shadow-sm"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <Button size="sm" variant="secondary" onClick={() => setPreview(asset)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => removeAsset(asset.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <GripVertical className="absolute top-2 left-2 h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-70" />
              </div>
              <div className="p-3 space-y-2">
                <p className="text-sm font-bold truncate">{asset.title}</p>
                <p className="text-[10px] text-gray-500">{VISUAL_ASSET_TYPE_LABELS[asset.type]}</p>
                <button
                  type="button"
                  onClick={() => toggleActive(asset.id)}
                  className="flex items-center gap-1 text-xs font-semibold text-teal-700"
                >
                  {asset.active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                  {asset.active ? 'نشط' : 'معطّل'}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.title ?? 'معاينة'}>
        {preview && (
          <div className="space-y-4">
            <div className="rounded-xl bg-gradient-to-br from-teal-50 to-gray-100 p-8 flex items-center justify-center min-h-[240px]">
              <img src={preview.imageUrl} alt={preview.title} className="max-h-64 object-contain" />
            </div>
            <Input readOnly value={preview.imageUrl} dir="ltr" className="text-xs font-mono" />
            <p className="text-xs text-gray-500">
              انسخ الرابط والصقه في أيقونة التصنيف أو صورة المكافأة من الصفحات المرتبطة.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
        active
          ? 'bg-teal-600 text-white shadow-md shadow-teal-600/25'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  );
}
