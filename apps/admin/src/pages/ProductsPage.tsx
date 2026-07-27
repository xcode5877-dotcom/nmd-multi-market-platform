import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card, Button, Input, Select, Drawer, ConfirmDialog, Modal, useToast } from '@nmd/ui';
import { Pencil, Trash2, Package, GripVertical } from 'lucide-react';
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
import {
  generateId,
  formatMoney,
  defaultCatalogMeasurementForm,
  measurementFormFromProduct,
  buildMeasurementApiPayload,
  validateCatalogMeasurementForm,
  mapMeasurementErrorToAr,
  measurementBadgeAr,
  measurementPriceBadgeAr,
  measurementStepHintAr,
  resolveProductMeasurementForRead,
  type CatalogMeasurementFormState,
  type CatalogMeasurementFieldError,
} from '@nmd/core';
import { uploadFiles, MockApiClient } from '@nmd/mock';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { fetchMarketModifierIcons, resolveMarketSlugFromId } from '../lib/modifierIcons';
import { MeasurementProductFields } from '../components/MeasurementProductFields';

const USE_API = !!import.meta.env.VITE_MOCK_API_URL;
const api = new MockApiClient();

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

function ProductCard({
  product,
  categoryName,
  onToggle,
  onEdit,
  onDelete,
  onPriceClick,
  isQuickPriceActive,
  quickPriceValue,
  onQuickPriceChange,
  onQuickPriceSave,
  onQuickPriceCancel,
}: {
  product: Product;
  categoryName: string;
  onToggle: (p: Product) => void;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
  onPriceClick: (p: Product) => void;
  isQuickPriceActive: boolean;
  quickPriceValue: string;
  onQuickPriceChange: (v: string) => void;
  onQuickPriceSave: () => void;
  onQuickPriceCancel: () => void;
}) {
  const imgUrl = product.images?.length
    ? [...product.images].sort((a, b) => a.sortOrder - b.sortOrder)[0].url
    : product.imageUrl;
  const isAvailable = product.isAvailable ?? true;

  return (
    <Card className={`overflow-hidden shadow-sm border border-slate-100 flex flex-col h-full text-right transition-opacity ${!isAvailable ? 'opacity-60' : ''}`} dir="rtl">
      <div className="flex gap-3 p-4">
        <div className="w-20 h-20 rounded-xl bg-slate-100 shrink-0 overflow-hidden flex items-center justify-center">
          {imgUrl ? (
            <img src={imgUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Package className="w-8 h-8 text-slate-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-slate-900 truncate">{product.name}</h3>
          <p className="text-sm text-slate-500 truncate">{categoryName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {(() => {
              const m = resolveProductMeasurementForRead(product as unknown as Record<string, unknown>);
              const badge = measurementBadgeAr(m.measurementType);
              const priceBadge = measurementPriceBadgeAr(m.measurementType);
              const stepHint = measurementStepHintAr(product as unknown as Record<string, unknown>);
              return (
                <>
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700">
                    {badge}
                  </span>
                  {priceBadge && (
                    <span className="inline-flex items-center rounded-md bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-500">
                      {priceBadge}
                    </span>
                  )}
                  {stepHint && (
                    <span className="text-[11px] text-slate-500 truncate max-w-full">{stepHint}</span>
                  )}
                </>
              );
            })()}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            {isQuickPriceActive ? (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={quickPriceValue}
                  onChange={(e) => onQuickPriceChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onQuickPriceSave();
                    if (e.key === 'Escape') onQuickPriceCancel();
                  }}
                  className="w-20 px-2 py-1 rounded-lg border border-slate-200 text-lg font-bold text-primary"
                  dir="ltr"
                  autoFocus
                />
                <Button size="sm" variant="primary" onClick={onQuickPriceSave}>✓</Button>
                <Button size="sm" variant="ghost" onClick={onQuickPriceCancel}>✕</Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onPriceClick(product)}
                className="font-bold text-xl text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                title="تعديل السعر"
              >
                ₪{formatMoney(product.basePrice)}
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="px-4 pb-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(product); }}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
            title="تعديل"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(product); }}
            className="p-2 rounded-lg hover:bg-red-50 text-red-600"
            title="حذف"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <label className="flex items-center gap-2 cursor-pointer shrink-0">
          <span className="text-xs font-medium text-slate-600">
            {isAvailable ? 'متوفر' : 'غير متوفر'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isAvailable}
            onClick={(e) => { e.preventDefault(); onToggle(product); }}
            className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
              isAvailable ? 'bg-emerald-500' : 'bg-slate-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-1 ${
                isAvailable ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </label>
      </div>
    </Card>
  );
}

export default function ProductsPage() {
  const { tenantId, tenantType = 'GENERAL' } = useAdminContext();
  const { user } = useAuth();
  const addToast = useToast().addToast;
  const queryClient = useQueryClient();
  const adminData = useAdminData(tenantId);
  const { data: tenant } = useQuery({
    queryKey: ['tenant-by-id', tenantId],
    queryFn: () => api.getTenant(tenantId!),
    enabled: !!tenantId && USE_API,
  });
  const marketId = (tenant as { marketId?: string } | null)?.marketId ?? user?.marketId;
  const { data: marketSlug = 'dabburiyya' } = useQuery({
    queryKey: ['market-slug-products', marketId],
    queryFn: () => resolveMarketSlugFromId(marketId),
    enabled: !!marketId,
  });
  const { data: modifierIcons = [] } = useQuery({
    queryKey: ['modifier-icons', marketSlug],
    queryFn: () => fetchMarketModifierIcons(marketSlug),
    enabled: !!marketSlug.trim(),
    staleTime: 60_000,
  });
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
    /** IDs of catalog option groups to link (from Options page) */
    selectedOptionGroupIds: [] as string[],
    optionGroups: [] as OptionGroup[],
    variants: [] as ProductVariant[],
    isFeatured: false,
    inStock: true,
    quantity: undefined as number | undefined,
    lowStockThreshold: undefined as number | undefined,
    isLastItems: false,
    lastItemsCount: 0,
    isArchived: false,
    sortOrder: 0,
    measurement: defaultCatalogMeasurementForm('PIECE') as CatalogMeasurementFormState,
  });
  const [measurementErrors, setMeasurementErrors] = useState<CatalogMeasurementFieldError[]>([]);
  const supportsWeightSelling =
    (tenant as { supportsWeightSelling?: boolean } | null)?.supportsWeightSelling === true;
  /** Option groups for current tenant only (from catalog / Options page). */
  const catalogOptionGroups = adminData.getOptionGroups().filter(
    (g) =>
      (g as { tenantId?: string; ownerId?: string }).tenantId === tenantId ||
      (g as { tenantId?: string; ownerId?: string }).ownerId === tenantId ||
      (!(g as { tenantId?: string; ownerId?: string }).tenantId && !(g as { tenantId?: string; ownerId?: string }).ownerId)
  );
  const [regenerateConfirm, setRegenerateConfirm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [reorderExpanded, setReorderExpanded] = useState(false);
  const [draggedProductId, setDraggedProductId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [quickPriceProduct, setQuickPriceProduct] = useState<Product | null>(null);
  const [quickPriceValue, setQuickPriceValue] = useState<string>('');
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [templatePicks, setTemplatePicks] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: optionTemplates = [] } = useQuery({
    queryKey: ['option-templates', tenantId],
    queryFn: () => api.getOptionTemplates(tenantId!),
    enabled: !!tenantId && USE_API && templatesModalOpen,
  });
  const templatesForModal = USE_API ? (optionTemplates as OptionGroup[]) : catalogOptionGroups;

  const productsByCategory = useMemo(() => {
    const map = new Map<string, Product[]>();
    const sorted = [...products].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
    for (const p of sorted) {
      const catId = p.categoryId || '_';
      if (!map.has(catId)) map.set(catId, []);
      map.get(catId)!.push(p);
    }
    return map;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const sorted = [...products].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
    if (!categoryFilter) return sorted;
    return sorted.filter((p) => (p.categoryId || '_') === categoryFilter);
  }, [products, categoryFilter]);

  const toggleAvailability = useCallback(
    (p: Product) => {
      const next = products.map((prod) =>
        prod.id === p.id ? { ...prod, isAvailable: !prod.isAvailable } : prod
      );
      setProducts(next);
      adminData.setProducts(next);
      addToast(p.isAvailable ? 'تم إخفاء المنتج عن المتجر' : 'المنتج ظاهر الآن في المتجر', 'success');
    },
    [products, adminData, addToast]
  );

  const saveQuickPrice = useCallback(() => {
    if (!quickPriceProduct || quickPriceValue === '') return;
    const num = Number(quickPriceValue.replace(/,/g, '.'));
    if (Number.isNaN(num) || num < 0) {
      addToast('أدخل سعراً صالحاً', 'error');
      return;
    }
    const next = products.map((prod) =>
      prod.id === quickPriceProduct.id ? { ...prod, basePrice: num } : prod
    );
    setProducts(next);
    adminData.setProducts(next);
    setQuickPriceProduct(null);
    setQuickPriceValue('');
    addToast('تم تحديث السعر', 'success');
  }, [quickPriceProduct, quickPriceValue, products, adminData, addToast]);

  const bulkSortMutation = useMutation({
    mutationFn: (items: { id: string; sortOrder: number }[]) =>
      api.bulkSortCatalog(tenantId!, 'products', items),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['catalog', tenantId] });
      setProducts((data.products ?? []) as Product[]);
      addToast('تم تحديث الترتيب', 'success');
    },
    onError: () => addToast('فشل حفظ الترتيب', 'error'),
  });

  const handleReorder = useCallback((categoryId: string, fromIndex: number, toIndex: number) => {
    const list = productsByCategory.get(categoryId) ?? [];
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= list.length) return;
    const reordered = [...list];
    const [removed] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, removed);
    const orderMap = new Map(reordered.map((p, i) => [p.id, i]));
    const next = products.map((p) =>
      p.categoryId === categoryId ? { ...p, sortOrder: orderMap.get(p.id) ?? p.sortOrder ?? 0 } : p
    );
    setProducts(next);
    if (USE_API) {
      bulkSortMutation.mutate(reordered.map((p, i) => ({ id: p.id, sortOrder: i })));
    } else {
      adminData.setProducts(next);
      addToast('تم تحديث الترتيب', 'success');
    }
  }, [productsByCategory, products, adminData, addToast, bulkSortMutation]);

  const toProductImage = (url: string, sortOrder: number): ProductImage => ({
    id: generateId(),
    url,
    sortOrder,
  });

  const save = async () => {
    if (!form.name.trim() || !form.categoryId) return;
    const mErrors = validateCatalogMeasurementForm(form.measurement, {
      supportsWeightSelling,
    });
    if (mErrors.length > 0) {
      setMeasurementErrors(mErrors);
      addToast(mErrors[0]?.message || 'تحقق من إعدادات القياس', 'error');
      return;
    }
    setMeasurementErrors([]);
    setSaving(true);
    const slug = form.slug || form.name.toLowerCase().replace(/\s/g, '-');
    const images = [...(form.images ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    const imageUrl = images.length > 0 ? images[0].url : (form.imageUrl || undefined);
    const linkedGroups = catalogOptionGroups.filter((g) => form.selectedOptionGroupIds.includes(g.id));
    const allOptionGroups = [...linkedGroups, ...form.optionGroups];
    const optionGroupIds = form.selectedOptionGroupIds;
    const measurementApi = buildMeasurementApiPayload(form.measurement);
    let next: Product[];
    if (editing) {
      next = products.map((p) =>
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
              optionGroups: allOptionGroups,
              optionGroupIds,
              variants: form.variants,
              isFeatured: form.isFeatured,
              inStock: form.inStock,
              quantity: form.quantity,
              lowStockThreshold: form.lowStockThreshold,
              isLastItems: form.isLastItems,
              lastItemsCount: form.lastItemsCount,
              isArchived: form.isArchived,
              sortOrder: form.sortOrder,
              ...measurementApi,
            }
          : p
      );
    } else {
      const maxOrder = products.length > 0 ? Math.max(...products.map((p) => p.sortOrder ?? 0), 0) : 0;
      next = [
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
          optionGroups: allOptionGroups,
          optionGroupIds,
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
          isArchived: form.isArchived,
          sortOrder: form.sortOrder ?? maxOrder + 1,
          ...measurementApi,
        },
      ];
    }
    try {
      if (USE_API) {
        await api.setCatalogApi(tenantId!, {
          categories: adminData.getCategories(),
          products: next,
          optionGroups: adminData.getOptionGroups(),
        });
        queryClient.invalidateQueries({ queryKey: ['catalog', tenantId] });
      } else {
        adminData.setProducts(next);
      }
      setProducts(next);
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
        selectedOptionGroupIds: [],
        optionGroups: [],
        variants: [],
        isFeatured: false,
        inStock: true,
        quantity: undefined,
        lowStockThreshold: undefined,
        isLastItems: false,
        lastItemsCount: 0,
        isArchived: false,
        sortOrder: 0,
        measurement: defaultCatalogMeasurementForm('PIECE'),
      });
      addToast('تم الحفظ بنجاح', 'success');
    } catch (err) {
      const e = err as Error & {
        code?: string;
        messageAr?: string;
        details?: { field?: string };
      };
      const code = e.code || 'INVALID_MEASUREMENT_CONFIG';
      const field = typeof e.details?.field === 'string' ? e.details.field : 'measurementType';
      const message = mapMeasurementErrorToAr(code, e.messageAr || e.message || 'فشل حفظ المنتج');
      setMeasurementErrors([{ field, code, message }]);
      addToast(message, 'error');
    } finally {
      setSaving(false);
    }
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
    const linkedIds = (p as { optionGroupIds?: string[] }).optionGroupIds ?? (p.optionGroups ?? []).map((g) => g.id);
    const catalogIdsSet = new Set(catalogOptionGroups.map((g) => g.id));
    const inlineOnly = (p.optionGroups ?? []).filter((g) => !catalogIdsSet.has(g.id));
    setForm({
      name: p.name,
      slug: p.slug,
      description: p.description ?? '',
      categoryId: p.categoryId,
      type: p.type,
      basePrice: p.basePrice,
      imageUrl: p.imageUrl ?? '',
      images: imgs,
      selectedOptionGroupIds: linkedIds,
      optionGroups: inlineOnly,
      variants: p.variants ?? [],
      isFeatured: p.isFeatured ?? false,
      inStock,
      quantity: q,
      lowStockThreshold: p.lowStockThreshold,
      isLastItems: p.isLastItems ?? false,
      lastItemsCount: p.lastItemsCount ?? 0,
      isArchived: p.isArchived ?? false,
      sortOrder: p.sortOrder ?? 0,
      measurement: measurementFormFromProduct(p as unknown as Record<string, unknown>),
    });
    setMeasurementErrors([]);
    setDrawerOpen(true);
  };

  const openAdd = () => {
    setEditing(null);
    const maxOrder = products.length > 0 ? Math.max(...products.map((p) => p.sortOrder ?? 0), 0) : 0;
    // Never auto-enable WEIGHT from tenant capability — always start PIECE.
    setForm({
      name: '',
      slug: '',
      description: '',
      categoryId: categories[0]?.id ?? '',
      type: 'SIMPLE',
      basePrice: 0,
      imageUrl: '',
      images: [],
      selectedOptionGroupIds: [],
      optionGroups: [],
      variants: [],
      isFeatured: false,
      inStock: true,
      quantity: undefined,
      lowStockThreshold: undefined,
      isLastItems: false,
      lastItemsCount: 0,
      isArchived: false,
      sortOrder: maxOrder + 1,
      measurement: defaultCatalogMeasurementForm('PIECE'),
    });
    setMeasurementErrors([]);
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

  const effectiveOptionGroupsForVariants = useMemo(() => {
    const linked = catalogOptionGroups.filter((g) => form.selectedOptionGroupIds.includes(g.id));
    return [...linked, ...form.optionGroups];
  }, [catalogOptionGroups, form.selectedOptionGroupIds, form.optionGroups]);

  const handleGenerateVariants = () => {
    const groups = effectiveOptionGroupsForVariants.filter((g) => (g.items?.length ?? 0) > 0);
    if (groups.length === 0) {
      addToast('أضف مجموعات خيارات مع عناصر أولاً (ربط مجموعات أو إضافة مخصصة)', 'error');
      return;
    }
    const newVariants = generateVariantsFromGroups(groups);
    setForm((f) => ({ ...f, variants: newVariants }));
    addToast(`تم توليد ${newVariants.length} متغير`, 'success');
  };

  const handleRegenerateVariants = () => {
    const groups = effectiveOptionGroupsForVariants.filter((g) => (g.items?.length ?? 0) > 0);
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

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">المنتجات</h1>
        <Button onClick={openAdd}>إضافة منتج</Button>
      </div>

      {products.length > 0 && (
        <Card className="mb-6">
          <button
            type="button"
            onClick={() => setReorderExpanded((e) => !e)}
            className="w-full flex items-center justify-between p-4 text-start hover:bg-gray-50 rounded-lg transition-colors"
          >
            <span className="font-semibold text-gray-900">ترتيب المنتجات حسب التصنيف</span>
            <span className="text-gray-500">{reorderExpanded ? '▼' : '◀'}</span>
          </button>
          {reorderExpanded && (
            <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-4">
              {Array.from(productsByCategory.entries()).map(([catId, list]) => {
                const catName = categories.find((c) => c.id === catId)?.name ?? catId;
                return (
                  <div key={catId} className="rounded-lg border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">{catName}</div>
                    <ul className="divide-y divide-gray-100">
                      {list.map((p, idx) => (
                        <li
                          key={p.id}
                          draggable
                          onDragStart={() => setDraggedProductId(p.id)}
                          onDragEnd={() => setDraggedProductId(null)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const targetId = (e.currentTarget as HTMLElement).dataset.productId;
                            const targetIdx = list.findIndex((x) => x.id === targetId);
                            if (targetIdx !== -1 && draggedProductId) {
                              const fromIdx = list.findIndex((x) => x.id === draggedProductId);
                              handleReorder(catId, fromIdx, targetIdx);
                            }
                            setDraggedProductId(null);
                          }}
                          data-product-id={p.id}
                          className={`flex items-center gap-2 px-3 py-2 bg-white hover:bg-gray-50 cursor-grab active:cursor-grabbing ${draggedProductId === p.id ? 'opacity-50' : ''}`}
                        >
                          <GripVertical className="w-4 h-4 text-gray-400 shrink-0" aria-hidden />
                          <span className="flex-1 font-medium text-gray-900">{p.name}</span>
                          <span className="text-xs text-gray-500">ترتيب: {(p as Product & { sortOrder?: number }).sortOrder ?? idx}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Category filter tabs — horizontal scroll */}
      {products.length > 0 && (
        <div className="mb-4 overflow-x-auto pb-2 -mx-1 px-1">
          <div className="flex gap-2 min-w-max">
            <button
              type="button"
              onClick={() => setCategoryFilter('')}
              className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                !categoryFilter ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              الكل
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryFilter(c.id)}
                className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  categoryFilter === c.id ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <Card className="shadow-sm border border-slate-100">
        {filteredProducts.length === 0 ? (
          <div className="p-12 sm:p-16 text-center" dir="rtl">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 text-slate-400 mb-4">
              <Package className="w-8 h-8" />
            </div>
            <h3 className="font-semibold text-slate-900 text-lg mb-1">
              {products.length === 0 ? 'لا توجد منتجات بعد' : 'لا منتجات في هذا التصنيف'}
            </h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto mb-6">
              {products.length === 0
                ? 'أضف منتجك الأول ليبقى في الكتالوج ويظهر في المتجر.'
                : 'غيّر التصنيف من التبويبات أعلاه أو أضف منتجات لهذا التصنيف.'}
            </p>
            {products.length === 0 && (
              <Button onClick={openAdd}>إضافة منتج</Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                categoryName={categories.find((c) => c.id === (p.categoryId || '_'))?.name ?? p.categoryId ?? '—'}
                onToggle={toggleAvailability}
                onEdit={openEdit}
                onDelete={setDeleteConfirm}
                onPriceClick={(prod) => {
                  setQuickPriceProduct(prod);
                  setQuickPriceValue(String(prod.basePrice));
                }}
                isQuickPriceActive={quickPriceProduct?.id === p.id}
                quickPriceValue={quickPriceProduct?.id === p.id ? quickPriceValue : ''}
                onQuickPriceChange={setQuickPriceValue}
                onQuickPriceSave={saveQuickPrice}
                onQuickPriceCancel={() => { setQuickPriceProduct(null); setQuickPriceValue(''); }}
              />
            ))}
          </div>
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
            label="السعر الأساسي (₪)"
            type="number"
            value={form.basePrice}
            onChange={(e) => setForm((f) => ({ ...f, basePrice: +e.target.value }))}
          />
          <MeasurementProductFields
            value={form.measurement}
            onChange={(measurement) => {
              setForm((f) => ({ ...f, measurement }));
              setMeasurementErrors([]);
            }}
            basePrice={form.basePrice}
            supportsWeightSelling={supportsWeightSelling}
            lockedWeightedExisting={
              !!editing &&
              !supportsWeightSelling &&
              (form.measurement.measurementType === 'WEIGHT' ||
                form.measurement.measurementType === 'VOLUME')
            }
            fieldErrors={measurementErrors}
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
            <div className="space-y-2" dir="rtl">
              <label className="block text-sm font-medium text-gray-700">ربط مجموعات الخيارات</label>
              <p className="text-xs text-gray-500 mb-1">اختر مجموعات معرّفة من صفحة مجموعات الخيارات لربطها بهذا المنتج.</p>
              <Button variant="outline" size="sm" className="mb-2" onClick={() => { setTemplatesModalOpen(true); setTemplatePicks([]); }}>
                إضافة من القوالب الجاهزة
              </Button>
              {catalogOptionGroups.length === 0 ? (
                <p className="text-sm text-amber-600">لا توجد مجموعات خيارات. أضفها من صفحة &quot;مجموعات الخيارات&quot; أولاً.</p>
              ) : (
                <div className="flex flex-wrap gap-2 p-2 border border-gray-200 rounded-lg bg-gray-50/50">
                  {catalogOptionGroups.map((g) => (
                    <label key={g.id} className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.selectedOptionGroupIds.includes(g.id)}
                        onChange={(e) => {
                          setForm((f) => ({
                            ...f,
                            selectedOptionGroupIds: e.target.checked
                              ? [...f.selectedOptionGroupIds, g.id]
                              : f.selectedOptionGroupIds.filter((id) => id !== g.id),
                          }));
                        }}
                        className="rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-sm text-gray-800">{g.name || g.id}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
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
                  {g.type === 'CUSTOM' && (
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
                      {g.type === 'CUSTOM' && (
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
                      {modifierIcons.length > 0 && (
                        <select
                          title="أيقونة الإضافة"
                          value={item.modifierIconKey ?? ''}
                          onChange={(e) =>
                            updateOptionItem(g.id, item.id, {
                              modifierIconKey: e.target.value || undefined,
                            })
                          }
                          className="max-w-[5.5rem] border border-gray-200 rounded px-1 py-0.5 text-[10px]"
                        >
                          <option value="">تلقائي</option>
                          {modifierIcons
                            .filter((ic) => ic.active)
                            .map((ic) => (
                              <option key={ic.key} value={ic.key}>
                                {ic.labelAr}
                              </option>
                            ))}
                        </select>
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
          <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-colors cursor-pointer ${form.isArchived ? 'border-amber-300 bg-amber-50' : 'border-gray-200 hover:border-gray-300'}`}>
            <input
              type="checkbox"
              checked={form.isArchived}
              onChange={(e) => setForm((f) => ({ ...f, isArchived: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300"
            />
            <span className="font-medium text-gray-800">أرشفة المنتج (إخفاء من المتجر)</span>
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
        onConfirm={() => { if (deleteConfirm) remove(deleteConfirm.id); }}
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
      <Modal open={templatesModalOpen} onClose={() => setTemplatesModalOpen(false)} title="إضافة من القوالب الجاهزة">
        <div className="space-y-4" dir="rtl">
          <p className="text-sm text-gray-600">اختر مجموعة أو أكثر لربطها بهذا المنتج.</p>
          {templatesForModal.length === 0 ? (
            <p className="text-sm text-amber-600">لا توجد قوالب. أنشئ مجموعات من صفحة &quot;مجموعات الخيارات&quot; أولاً.</p>
          ) : (
            <div className="flex flex-wrap gap-2 p-2 border border-gray-200 rounded-lg bg-gray-50/50 max-h-64 overflow-y-auto">
              {templatesForModal.map((g) => (
                <label key={g.id} className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={templatePicks.includes(g.id)}
                    onChange={(e) => {
                      setTemplatePicks((prev) =>
                        e.target.checked ? [...prev, g.id] : prev.filter((id) => id !== g.id)
                      );
                    }}
                    className="rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-gray-800">{g.name || g.id}</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setTemplatesModalOpen(false)}>إلغاء</Button>
            <Button
              onClick={() => {
                setForm((f) => ({
                  ...f,
                  selectedOptionGroupIds: [...new Set([...f.selectedOptionGroupIds, ...templatePicks])],
                }));
                setTemplatesModalOpen(false);
                setTemplatePicks([]);
              }}
              disabled={templatePicks.length === 0}
            >
              إضافة المحدد
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
