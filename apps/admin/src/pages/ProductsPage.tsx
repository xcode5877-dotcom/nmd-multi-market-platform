import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Button, Input, Select, DataTable, Drawer, ConfirmDialog, useToast } from '@nmd/ui';
import { useAdminContext } from '../context/AdminContext';
import { useAdminData } from '../hooks/useAdminData';
import type {
  Product,
  ProductType,
  ProductImage,
  OptionGroup,
  OptionItem,
  ProductVariant,
  VariantOptionValue,
  OptionGroupType,
} from '@nmd/core';
import { generateId, formatMoney } from '@nmd/core';
import { uploadFiles } from '@nmd/mock';

const USE_API = !!import.meta.env.VITE_MOCK_API_URL;

function variantKey(optionValues: VariantOptionValue[]): string {
  return [...optionValues]
    .sort((a, b) => a.groupId.localeCompare(b.groupId) || a.optionId.localeCompare(b.optionId))
    .map((v) => `${v.groupId}:${v.optionId}`)
    .join('|');
}

function generateVariantsFromGroups(groups: OptionGroup[]): ProductVariant[] {
  const withItems = groups.filter((g) => (g.items?.length ?? 0) > 0);
  if (withItems.length === 0) return [];
  const combos: VariantOptionValue[][] = [[]];
  for (const g of withItems) {
    const next: VariantOptionValue[][] = [];
    for (const combo of combos) {
      for (const item of g.items!) {
        next.push([...combo, { groupId: g.id, optionId: item.id }]);
      }
    }
    combos.length = 0;
    combos.push(...next);
  }
  return combos.map((optVals) => ({
    id: generateId(),
    optionValues: optVals,
    stock: 0,
  }));
}

function AddOptionInput({ onAdd }: { onAdd: (label: string) => void }) {
  const [val, setVal] = useState('');
  return (
    <div className="flex gap-1">
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAdd(val), setVal(''))}
        placeholder="+ خيار"
        className="w-24 border border-gray-300 rounded px-2 py-1 text-sm"
      />
      <Button type="button" size="sm" onClick={() => (onAdd(val), setVal(''))}>
        إضافة
      </Button>
    </div>
  );
}

function StockBadge({ product }: { product: Product }) {
  if (!(product.inStock ?? true)) return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">نفد</span>;
  if (product.isLastItems && (product.inStock ?? true))
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">آخر {product.lastItemsCount ?? product.quantity ?? 0}</span>;
  if (product.quantity != null && product.lowStockThreshold != null && product.quantity <= product.lowStockThreshold)
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">{product.quantity}</span>;
  return null;
}

export default function ProductsPage() {
  const { tenantId, tenantType = 'GENERAL' } = useAdminContext();
  const addToast = useToast().addToast;
  const adminData = useAdminData(tenantId);
  const [products, setProducts] = useState<Product[]>(() => adminData.getProducts());
  const categories = adminData.getCategories();
  const prevLoading = useRef(true);
  useEffect(() => {
    if (prevLoading.current && !adminData.isLoading) {
      setProducts(adminData.getProducts());
      prevLoading.current = false;
    }
    if (adminData.isLoading) prevLoading.current = true;
  }, [adminData.isLoading]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    categoryId: '',
    type: 'SIMPLE' as ProductType,
    basePrice: 0,
    imageUrl: '',
    images: [] as ProductImage[],
    optionGroups: [] as OptionGroup[],
    variants: [] as ProductVariant[],
    isFeatured: false,
    inStock: true,
    quantity: undefined as number | undefined,
    lowStockThreshold: undefined as number | undefined,
    isLastItems: false,
    lastItemsCount: 0,
  });
  const [regenerateConfirm, setRegenerateConfirm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toProductImage = (url: string, sortOrder: number): ProductImage => ({
    id: generateId(),
    url,
    sortOrder,
  });

  const save = () => {
    if (!form.name.trim() || !form.categoryId) return;
    setSaving(true);
    const slug = form.slug || form.name.toLowerCase().replace(/\s/g, '-');
    const images = [...(form.images ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    const imageUrl = images.length > 0 ? images[0].url : (form.imageUrl || undefined);
    if (editing) {
      const next = products.map((p) =>
        p.id === editing.id
          ? {
              ...p,
              name: form.name,
              slug,
              description: form.description.trim() || undefined,
              categoryId: form.categoryId,
              type: form.type,
              basePrice: form.basePrice,
              imageUrl,
              images,
              optionGroups: form.optionGroups,
              variants: form.variants,
              isFeatured: form.isFeatured,
              inStock: form.inStock,
              quantity: form.quantity,
              lowStockThreshold: form.lowStockThreshold,
              isLastItems: form.isLastItems,
              lastItemsCount: form.lastItemsCount,
            }
          : p
      );
      setProducts(next);
      adminData.setProducts(next);
    } else {
      const next: Product[] = [
        ...products,
        {
          id: generateId(),
          tenantId,
          categoryId: form.categoryId,
          name: form.name,
          slug,
          description: form.description.trim() || undefined,
          type: form.type,
          basePrice: form.basePrice,
          currency: 'ILS',
          imageUrl,
          images,
          optionGroups: form.optionGroups,
          variants: form.variants,
          createdAt: new Date().toISOString(),
          isFeatured: form.isFeatured,
          isAvailable: form.inStock,
          inStock: form.inStock,
          stock: form.quantity,
          quantity: form.quantity,
          lowStockThreshold: form.lowStockThreshold,
          isLastItems: form.isLastItems,
          lastItemsCount: form.isLastItems ? form.lastItemsCount : undefined,
        },
      ];
      setProducts(next);
      adminData.setProducts(next);
    }
    setDrawerOpen(false);
    setEditing(null);
    setForm({
      name: '',
      slug: '',
      description: '',
      categoryId: '',
      type: 'SIMPLE',
      basePrice: 0,
      imageUrl: '',
      images: [],
      optionGroups: [],
      variants: [],
      isFeatured: false,
      inStock: true,
      quantity: undefined,
      lowStockThreshold: undefined,
      isLastItems: false,
      lastItemsCount: 0,
    });
    setSaving(false);
    addToast('تم الحفظ بنجاح', 'success');
  };

  const remove = (id: string) => {
    const next = products.filter((p) => p.id !== id);
    setProducts(next);
    adminData.setProducts(next);
    if (editing?.id === id) {
      setDrawerOpen(false);
      setEditing(null);
    }
    setDeleteConfirm(null);
    addToast('تم الحذف', 'success');
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    const q = p.quantity ?? p.stock;
    const inStock = p.inStock ?? (q === undefined || q > 0);
    const imgs = (p.images ?? []).sort((a, b) => a.sortOrder - b.sortOrder);
    setForm({
      name: p.name,
      slug: p.slug,
      description: p.description ?? '',
      categoryId: p.categoryId,
      type: p.type,
      basePrice: p.basePrice,
      imageUrl: p.imageUrl ?? '',
      images: imgs,
      optionGroups: p.optionGroups ?? [],
      variants: p.variants ?? [],
      isFeatured: p.isFeatured ?? false,
      inStock,
      quantity: q,
      lowStockThreshold: p.lowStockThreshold,
      isLastItems: p.isLastItems ?? false,
      lastItemsCount: p.lastItemsCount ?? 0,
    });
    setDrawerOpen(true);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({
      name: '',
      slug: '',
      description: '',
      categoryId: categories[0]?.id ?? '',
      type: 'SIMPLE',
      basePrice: 0,
      imageUrl: '',
      images: [],
      optionGroups: [],
      variants: [],
      isFeatured: false,
      inStock: true,
      quantity: undefined,
      lowStockThreshold: undefined,
      isLastItems: false,
      lastItemsCount: 0,
    });
    setDrawerOpen(true);
  };

  const addOptionGroup = () => {
    const id = generateId();
    setForm((f) => ({
      ...f,
      optionGroups: [
        ...f.optionGroups,
        {
          id,
          name: '',
          type: 'CUSTOM' as OptionGroupType,
          required: true,
          minSelected: 1,
          maxSelected: 1,
          selectionType: 'single' as const,
          items: [],
        },
      ],
    }));
  };

  const OPTION_PRESETS = (
    tenantType === 'FOOD'
      ? [] as const
      : [
          { label: 'مقاسات ملابس', type: 'SIZE' as OptionGroupType, items: ['S', 'M', 'L', 'XL'] },
          { label: 'مقاسات رقمية', type: 'SIZE' as OptionGroupType, items: ['36', '38', '40', '42'] },
          { label: 'ألوان شائعة', type: 'COLOR' as OptionGroupType, items: ['أسود', 'أبيض', 'بيج', 'أزرق'] },
        ] as const
  );

  const applyOptionPreset = (preset: (typeof OPTION_PRESETS)[number]) => {
    const groupId = generateId();
    const items: OptionItem[] = preset.items.map((name, i) => ({
      id: generateId(),
      name,
      sortOrder: i,
    }));
    setForm((f) => ({
      ...f,
      optionGroups: [
        ...f.optionGroups,
        {
          id: groupId,
          name: preset.label,
          type: preset.type,
          required: true,
          minSelected: 1,
          maxSelected: 1,
          selectionType: 'single' as const,
          items,
        },
      ],
    }));
    addToast(`تمت إضافة "${preset.label}"`, 'success');
  };

  const updateOptionGroup = (groupId: string, updates: Partial<OptionGroup>) => {
    setForm((f) => ({
      ...f,
      optionGroups: f.optionGroups.map((g) => (g.id === groupId ? { ...g, ...updates } : g)),
    }));
  };

  const removeOptionGroup = (groupId: string) => {
    setForm((f) => ({
      ...f,
      optionGroups: f.optionGroups.filter((g) => g.id !== groupId),
      variants: f.variants.filter((v) => !v.optionValues.some((ov) => ov.groupId === groupId)),
    }));
  };

  const addOptionToGroup = (groupId: string, label: string) => {
    const optId = generateId();
    setForm((f) => {
      const g = f.optionGroups.find((x) => x.id === groupId);
      const items = g?.items ?? [];
      const defaultPlacement = f.type === 'PIZZA' && (g?.type ?? 'CUSTOM') === 'CUSTOM' ? 'HALF' : undefined;
      const item: OptionItem = { id: optId, name: label, sortOrder: items.length, placement: defaultPlacement };
      return {
        ...f,
        optionGroups: f.optionGroups.map((gr) =>
          gr.id === groupId ? { ...gr, items: [...items, item] } : gr
        ),
      };
    });
  };

  const removeOptionFromGroup = (groupId: string, optionId: string) => {
    setForm((f) => ({
      ...f,
      optionGroups: f.optionGroups.map((g) =>
        g.id === groupId ? { ...g, items: (g.items ?? []).filter((i) => i.id !== optionId) } : g
      ),
      variants: f.variants.filter(
        (v) => !v.optionValues.some((ov) => ov.groupId === groupId && ov.optionId === optionId)
      ),
    }));
  };

  const updateOptionItem = (groupId: string, optionId: string, updates: Partial<OptionItem>) => {
    setForm((f) => ({
      ...f,
      optionGroups: f.optionGroups.map((g) =>
        g.id === groupId
          ? { ...g, items: (g.items ?? []).map((i) => (i.id === optionId ? { ...i, ...updates } : i)) }
          : g
      ),
    }));
  };

  const handleGenerateVariants = () => {
    const groups = form.optionGroups.filter((g) => (g.items?.length ?? 0) > 0);
    if (groups.length === 0) {
      addToast('أضف مجموعات خيارات مع عناصر أولاً', 'error');
      return;
    }
    const newVariants = generateVariantsFromGroups(groups);
    setForm((f) => ({ ...f, variants: newVariants }));
    addToast(`تم توليد ${newVariants.length} متغير`, 'success');
  };

  const handleRegenerateVariants = () => {
    const groups = form.optionGroups.filter((g) => (g.items?.length ?? 0) > 0);
    if (groups.length === 0) {
      setForm((f) => ({ ...f, variants: [] }));
      addToast('لا توجد مجموعات خيارات', 'info');
      setRegenerateConfirm(false);
      return;
    }
    const newCombos = generateVariantsFromGroups(groups);
    const existingByKey = new Map(form.variants.map((v) => [variantKey(v.optionValues), v]));
    const merged: ProductVariant[] = newCombos.map((combo) => {
      const key = variantKey(combo.optionValues);
      const existing = existingByKey.get(key);
      if (existing) {
        return { ...existing, optionValues: combo.optionValues };
      }
      return combo;
    });
    setForm((f) => ({ ...f, variants: merged }));
    const removed = form.variants.length - merged.length;
    addToast(removed > 0 ? `تمت إعادة التوليد. تم حذف ${removed} متغير.` : 'تمت إعادة التوليد', 'success');
    setRegenerateConfirm(false);
  };

  const updateVariant = (variantId: string, updates: Partial<Pick<ProductVariant, 'stock' | 'priceOverride'>>) => {
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v) => (v.id === variantId ? { ...v, ...updates } : v)),
    }));
  };

  const removeVariant = (variantId: string) => {
    setForm((f) => ({ ...f, variants: f.variants.filter((v) => v.id !== variantId) }));
  };

  const getVariantLabel = useCallback((v: ProductVariant) => {
    return v.optionValues
      .map((ov) => {
        const g = form.optionGroups.find((x) => x.id === ov.groupId);
        const item = g?.items?.find((i) => i.id === ov.optionId);
        return item?.name ?? ov.optionId;
      })
      .join(' • ');
  }, [form.optionGroups]);

  const processFiles = async (files: File[]) => {
    if (!files.length || !USE_API) {
      if (!USE_API) addToast('رفع الصور يتطلب تشغيل Mock API', 'error');
      return;
    }
    setUploading(true);
    try {
      const urls = await uploadFiles(files);
      const maxOrder = form.images.length > 0 ? Math.max(...form.images.map((i) => i.sortOrder)) : -1;
      const newImages = urls.map((url, i) => toProductImage(url, maxOrder + 1 + i));
      setForm((f) => ({ ...f, images: [...f.images, ...newImages] }));
      addToast(`تم رفع ${urls.length} صورة`, 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'فشل الرفع', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files?.length) await processFiles(Array.from(files));
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (files.length) await processFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
  };

  const removeImage = (id: string) => {
    setForm((f) => ({ ...f, images: f.images.filter((i) => i.id !== id) }));
  };

  const moveImage = (id: string, dir: 'up' | 'down') => {
    setForm((f) => {
      const list = [...f.images].sort((a, b) => a.sortOrder - b.sortOrder);
      const idx = list.findIndex((i) => i.id === id);
      if (idx === -1) return f;
      const swap = dir === 'up' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= list.length) return f;
      [list[idx], list[swap]] = [list[swap], list[idx]];
      const reordered = list.map((i, j) => ({ ...i, sortOrder: j }));
      return { ...f, images: reordered };
    });
  };

  const rows: Record<string, React.ReactNode>[] = products.map((p) => ({
    name: p.name,
    type: p.type,
    price: formatMoney(p.basePrice),
    stock: (
      <div className="flex items-center gap-2">
        <StockBadge product={p} />
        {(p.inStock ?? true) && !p.isLastItems && p.quantity != null && (p.lowStockThreshold == null || p.quantity > p.lowStockThreshold) && (
          <span className="text-gray-500 text-sm">{p.quantity}</span>
        )}
      </div>
    ),
    actions: (
      <div onClick={(e) => e.stopPropagation()}>
        <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
          تعديل
        </Button>
      </div>
    ),
  }));

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">المنتجات</h1>
        <Button onClick={openAdd}>إضافة منتج</Button>
      </div>
      <Card>
        {products.length === 0 ? (
          <div className="p-12 text-center text-gray-500">لا توجد منتجات</div>
        ) : (
          <DataTable
            columns={[
              { key: 'name', label: 'الاسم' },
              { key: 'type', label: 'النوع' },
              { key: 'price', label: 'السعر' },
              { key: 'stock', label: 'المخزون' },
              { key: 'actions', label: 'إجراءات', className: 'w-24' },
            ]}
            rows={rows}
            onRowClick={(_row, index) => openEdit(products[index])}
          />
        )}
      </Card>
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'تعديل منتج' : 'إضافة منتج'}
        side="start"
      >
        <div className="space-y-4">
          <Input
            label="الاسم"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Slug"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
          />
          <Select
            label="التصنيف"
            options={categories.map((c: { id: string; name: string }) => ({ value: c.id, label: c.name }))}
            value={form.categoryId}
            onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
          />
          <div className="space-y-1" dir="rtl">
            <label className="block text-sm font-medium text-gray-700 ms-1">وصف المنتج</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="مثال: قماش قطني ناعم، مقاس طبيعي، مناسب للاستخدام اليومي..."
              className="w-full min-h-[140px] ps-3 pe-3 py-3 rounded-[var(--radius)] border border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-y"
              dir="rtl"
            />
          </div>
          <Select
            label="النوع"
            options={[
              { value: 'SIMPLE', label: 'بسيط' },
              { value: 'CONFIGURABLE', label: 'قابل للتخصيص' },
              { value: 'PIZZA', label: 'بيتزا' },
              { value: 'APPAREL', label: 'ملابس' },
            ]}
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ProductType }))}
          />
          <Input
            label="السعر (₪)"
            type="number"
            value={form.basePrice}
            onChange={(e) => setForm((f) => ({ ...f, basePrice: +e.target.value }))}
          />
          <div className="space-y-2" dir="rtl">
            <label className="block text-sm font-medium text-gray-700">معرض الصور</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative rounded-xl border-2 border-dashed transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400'
              } ${form.images.length > 0 ? 'p-3' : 'p-8'}`}
            >
              {form.images.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {[...form.images].sort((a, b) => a.sortOrder - b.sortOrder).map((img, i, arr) => (
                    <div key={img.id} className="relative group rounded-lg overflow-hidden border border-gray-200 aspect-square bg-gray-50">
                      <img src={img.url} alt={img.alt ?? ''} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-white hover:bg-white/20 h-8 w-8 p-0 min-w-0"
                          onClick={() => moveImage(img.id, 'up')}
                          disabled={i === 0}
                          title="تحريك لأعلى"
                        >
                          ↑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-white hover:bg-white/20 h-8 w-8 p-0 min-w-0"
                          onClick={() => moveImage(img.id, 'down')}
                          disabled={i === arr.length - 1}
                          title="تحريك لأسفل"
                        >
                          ↓
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-white hover:bg-red-500/80 h-8 w-8 p-0 min-w-0"
                          onClick={() => removeImage(img.id)}
                          title="حذف"
                        >
                          ✕
                        </Button>
                      </div>
                      <span className="absolute bottom-1 start-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                        {i + 1}
                      </span>
                    </div>
                  ))}
                  {USE_API && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="aspect-square rounded-lg border-2 border-dashed border-gray-300 hover:border-primary hover:bg-primary/5 flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-primary transition-colors"
                    >
                      {uploading ? (
                        <span className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      ) : (
                        <span className="text-2xl">+</span>
                      )}
                      <span className="text-xs">إضافة</span>
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || !USE_API}
                  className="w-full flex flex-col items-center justify-center gap-2 py-4 text-gray-500 hover:text-primary transition-colors"
                >
                  {uploading ? (
                    <span className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  ) : (
                    <span className="text-4xl opacity-60">📷</span>
                  )}
                  <span className="text-sm font-medium">
                    {uploading ? 'جاري الرفع...' : 'اسحب الصور هنا أو انقر للرفع'}
                  </span>
                  {!USE_API && (
                    <span className="text-xs text-amber-600">يتطلب تشغيل Mock API</span>
                  )}
                </button>
              )}
            </div>
            {(!USE_API || form.images.length === 0) && (
              <Input
                label={USE_API ? 'أو أضف رابط صورة' : 'رابط صورة (يتطلب Mock API للرفع المباشر)'}
                value={form.imageUrl}
                onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                placeholder="https://..."
              />
            )}
          </div>
          {/* Option Groups */}
          <div className="space-y-3" dir="rtl">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <label className="block text-sm font-medium text-gray-700">مجموعات الخيارات (مقاس، لون)</label>
              <div className="flex flex-wrap gap-2">
                {OPTION_PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    onClick={() => applyOptionPreset(preset)}
                    className="text-xs"
                  >
                    + {preset.label}
                  </Button>
                ))}
                <Button variant="outline" size="sm" onClick={addOptionGroup}>
                  إضافة مجموعة
                </Button>
              </div>
            </div>
            {form.optionGroups.map((g) => (
              <div key={g.id} className="p-3 border border-gray-200 rounded-lg space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <Input
                    label="الاسم"
                    value={g.name}
                    onChange={(e) => updateOptionGroup(g.id, { name: e.target.value })}
                    placeholder="مقاس / إضافات"
                    className="flex-1 min-w-[80px]"
                  />
                  <Select
                    label="النوع"
                    options={
                      tenantType === 'FOOD'
                        ? [{ value: 'CUSTOM', label: 'مخصص' }]
                        : [
                            { value: 'SIZE', label: 'مقاس' },
                            { value: 'COLOR', label: 'لون' },
                            { value: 'CUSTOM', label: 'مخصص' },
                          ]
                    }
                    value={tenantType === 'FOOD' ? 'CUSTOM' : (g.type ?? 'CUSTOM')}
                    onChange={(e) => updateOptionGroup(g.id, { type: e.target.value as OptionGroupType })}
                    disabled={tenantType === 'FOOD'}
                  />
                  {form.type === 'PIZZA' && g.type === 'CUSTOM' && (
                    <label className="flex items-center gap-2 mt-6">
                      <input
                        type="checkbox"
                        checked={g.allowHalfPlacement ?? false}
                        onChange={(e) => updateOptionGroup(g.id, { allowHalfPlacement: e.target.checked })}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">نصف (افتراضي للمجموعة)</span>
                    </label>
                  )}
                  <Button variant="ghost" size="sm" className="text-red-600 mt-6" onClick={() => removeOptionGroup(g.id)}>
                    حذف
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 items-end">
                  {(g.items ?? []).map((item) => (
                    <div key={item.id} className="inline-flex items-center gap-1.5 px-2 py-1.5 bg-gray-100 rounded-lg text-sm">
                      <span className="min-w-[4rem]">{item.name}</span>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        placeholder="+₪"
                        value={item.priceDelta ?? ''}
                        onChange={(e) =>
                          updateOptionItem(g.id, item.id, {
                            priceDelta: e.target.value ? +e.target.value : undefined,
                          })
                        }
                        className="w-14 border border-gray-200 rounded px-1.5 py-0.5 text-xs"
                      />
                      {form.type === 'PIZZA' && g.type === 'CUSTOM' && (
                        <label className="flex items-center gap-1" title="يدعم نصف (يمين/يسار)">
                          <input
                            type="checkbox"
                            checked={(item.placement ?? (g.allowHalfPlacement ? 'HALF' : 'WHOLE')) === 'HALF'}
                            onChange={(e) =>
                              updateOptionItem(g.id, item.id, {
                                placement: e.target.checked ? 'HALF' : 'WHOLE',
                              })
                            }
                            className="rounded border-gray-300"
                          />
                          <span className="text-xs text-gray-600">نصف</span>
                        </label>
                      )}
                      <button type="button" onClick={() => removeOptionFromGroup(g.id, item.id)} className="text-red-500 hover:text-red-700">
                        ×
                      </button>
                    </div>
                  ))}
                  <AddOptionInput
                    onAdd={(label) => {
                      if (label.trim()) addOptionToGroup(g.id, label.trim());
                    }}
                  />
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleGenerateVariants}>
                توليد المتغيرات
              </Button>
              {form.variants.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setRegenerateConfirm(true)}>
                  إعادة توليد
                </Button>
              )}
            </div>
          </div>

          {/* Variants Table */}
          {form.variants.length > 0 && (
            <div className="space-y-2" dir="rtl">
              <label className="block text-sm font-medium text-gray-700">المتغيرات ({form.variants.length})</label>
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-start p-2">الخيارات</th>
                      <th className="text-start p-2 w-24">المخزون</th>
                      <th className="text-start p-2 w-24">سعر إضافي (₪)</th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {form.variants.map((v) => (
                      <tr key={v.id} className="border-t border-gray-100">
                        <td className="p-2">{getVariantLabel(v)}</td>
                        <td className="p-2">
                          <input
                            type="number"
                            min={0}
                            value={v.stock}
                            onChange={(e) => updateVariant(v.id, { stock: +e.target.value })}
                            className="w-full border rounded px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={v.priceOverride ?? ''}
                            onChange={(e) => updateVariant(v.id, { priceOverride: e.target.value ? +e.target.value : undefined })}
                            placeholder="—"
                            className="w-full border rounded px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="p-2">
                          <button type="button" onClick={() => removeVariant(v.id)} className="text-red-500 hover:text-red-700 text-xs">
                            حذف
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <label
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-colors cursor-pointer ${
              form.isFeatured ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400"
            />
            <span className="text-lg">⭐</span>
            <span className="font-medium text-gray-800">مميز في الصفحة الرئيسية</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.inStock}
              onChange={(e) => setForm((f) => ({ ...f, inStock: e.target.checked }))}
            />
            متوفر
          </label>
          <Input
            label="الكمية (اختياري)"
            type="number"
            value={form.quantity ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value ? +e.target.value : undefined }))}
          />
          <Input
            label="حد التنبيه (اختياري)"
            type="number"
            value={form.lowStockThreshold ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, lowStockThreshold: e.target.value ? +e.target.value : undefined }))}
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.isLastItems}
              onChange={(e) => setForm((f) => ({ ...f, isLastItems: e.target.checked }))}
            />
            آخر قطع
          </label>
          {form.isLastItems && (
            <Input
              label="عدد القطع"
              type="number"
              value={form.lastItemsCount}
              onChange={(e) => setForm((f) => ({ ...f, lastItemsCount: +e.target.value }))}
            />
          )}
        </div>
        <div className="sticky bottom-0 mt-6 pt-4 pb-4 -mb-4 -mx-4 px-4 bg-white border-t border-gray-200 flex gap-2">
          <Button onClick={save} disabled={saving}>
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                جاري الحفظ...
              </span>
            ) : (
              'حفظ'
            )}
          </Button>
          <Button variant="ghost" onClick={() => setDrawerOpen(false)} disabled={saving}>
            إلغاء
          </Button>
          {editing && (
            <Button variant="ghost" className="text-red-600" onClick={() => setDeleteConfirm(editing)}>
              حذف
            </Button>
          )}
        </div>
      </Drawer>
      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && remove(deleteConfirm.id)}
        title="حذف المنتج"
        message={`هل أنت متأكد من حذف "${deleteConfirm?.name}"؟`}
        confirmLabel="حذف"
        variant="danger"
      />
      <ConfirmDialog
        open={regenerateConfirm}
        onClose={() => setRegenerateConfirm(false)}
        onConfirm={handleRegenerateVariants}
        title="إعادة توليد المتغيرات"
        message="سيتم الحفاظ على المخزون والسعر للمتغيرات المطابقة. المتغيرات التي لم تعد موجودة ستُحذف."
        confirmLabel="إعادة التوليد"
      />
    </div>
  );
}
