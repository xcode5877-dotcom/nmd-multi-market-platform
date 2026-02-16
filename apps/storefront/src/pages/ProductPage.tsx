import { useParams } from 'react-router-dom';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Package, Truck, RefreshCw, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import type { Product, OptionGroup, OptionItem, SelectedOption, PizzaSelectedOption, ProductVariant } from '@nmd/core';
import { applyCampaign, formatMoney, filterOptionGroupsForTenant } from '@nmd/core';
import { Button, Skeleton, useToast } from '@nmd/ui';
import { ImageFullscreenViewer } from '../components/ImageFullscreenViewer';
import { PizzaAddonsSelector } from '../components/PizzaAddonsSelector';
import { ProductPageSkeleton } from '../components/skeletons';
import { useAppStore } from '../store/app';
import { useCartStore } from '../store/cart';

const api = new MockApiClient();

/** Color name to hex mapping for fashion variants */
const COLOR_MAP: Record<string, string> = {
  أحمر: '#ef4444',
  red: '#ef4444',
  أزرق: '#3b82f6',
  blue: '#3b82f6',
  أخضر: '#22c55e',
  green: '#22c55e',
  أسود: '#1f2937',
  black: '#1f2937',
  أبيض: '#f8fafc',
  white: '#f8fafc',
  رمادي: '#6b7280',
  gray: '#6b7280',
  grey: '#6b7280',
  وردي: '#ec4899',
  pink: '#ec4899',
  بني: '#92400e',
  brown: '#92400e',
  أصفر: '#eab308',
  yellow: '#eab308',
  بيج: '#d4a574',
  beige: '#d4a574',
  كحلي: '#1e3a5f',
  navy: '#1e3a5f',
};

function getColorHex(name: string): string | null {
  const key = name.trim().toLowerCase();
  for (const [k, v] of Object.entries(COLOR_MAP)) {
    if (k.toLowerCase() === key) return v;
  }
  return null;
}

function isColorGroup(group: OptionGroup): boolean {
  if (group.type === 'COLOR') return true;
  const n = (group.name ?? '').toLowerCase();
  return /لون|color|colour/.test(n);
}

function findMatchingVariant(
  product: Product,
  selected: SelectedOption[] | PizzaSelectedOption[]
): ProductVariant | null {
  const variants = product.variants ?? [];
  if (variants.length === 0) return null;
  const groups = (product.optionGroups ?? []).filter((g) => (g.items?.length ?? 0) > 0);
  if (product.type === 'PIZZA') return null;
  const selectedMap = new Map<string, string>();
  for (const s of selected) {
    const ids = 'optionItemIds' in s ? s.optionItemIds : [];
    if (ids.length > 0) selectedMap.set(s.optionGroupId, ids[0]);
  }
  if (selectedMap.size !== groups.length) return null;
  return variants.find((v) => {
    if (v.optionValues.length !== groups.length) return false;
    return v.optionValues.every(
      (ov) => selectedMap.get(ov.groupId) === ov.optionId
    );
  }) ?? null;
}

function calculatePrice(
  product: Product,
  selected: SelectedOption[] | PizzaSelectedOption[]
): number {
  let total = product.basePrice;
  for (const sel of selected) {
    const ids = 'optionItemIds' in sel ? sel.optionItemIds : [];
    const group = product.optionGroups.find((g) => g.id === sel.optionGroupId);
    if (!group) continue;
    for (const itemId of ids) {
      const item = group.items.find((i) => i.id === itemId);
      if (item) total += item.priceDelta ?? item.priceModifier ?? 0;
    }
  }
  return total;
}

function getProductImages(product: Product): string[] {
  const fromImages = (product.images ?? [])
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((i) => i.url)
    .filter((u) => !!u);
  if (fromImages.length > 0) return fromImages;
  if (product.imageUrl) return [product.imageUrl];
  return [];
}

function isSelectionValid(
  product: Product,
  selected: SelectedOption[] | PizzaSelectedOption[],
  groupsToCheck?: OptionGroup[]
): boolean {
  const groups = groupsToCheck ?? product.optionGroups ?? [];
  return groups.every((g) => {
    const sel = selected.find((s) => s.optionGroupId === g.id);
    const ids = sel ? ('optionItemIds' in sel ? sel.optionItemIds : []) : [];
    const count = ids.length;
    if (g.required && count < g.minSelected) return false;
    if (count > g.maxSelected) return false;
    return true;
  });
}

function AccordionSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-4 text-start text-gray-900 font-medium"
      >
        {title}
        <ChevronDown
          className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="pb-4 text-gray-600 text-sm leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}

export default function ProductPage() {
  const { productId } = useParams<{ productId: string }>();
  const tenantId = useAppStore((s) => s.tenantId) ?? 'default';
  const tenantType = useAppStore((s) => s.tenantType) ?? 'GENERAL';
  const addToast = useToast().addToast;
  const addItem = useCartStore((s) => s.addItem);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', tenantId, productId],
    queryFn: () => api.getProduct(tenantId, productId!),
    enabled: !!tenantId && !!productId,
  });

  const { data: campaigns } = useQuery({
    queryKey: ['campaigns', tenantId],
    queryFn: () => api.getCampaigns(tenantId),
    enabled: !!tenantId,
  });

  const [selected, setSelected] = useState<SelectedOption[] | PizzaSelectedOption[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [mainImageLoaded, setMainImageLoaded] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [addButtonBouncing, setAddButtonBouncing] = useState(false);
  useEffect(() => setMainImageLoaded(false), [mainImageIndex]);

  const addonGroups = useMemo(
    () =>
      (product?.optionGroups ?? []).filter(
        (g) => g.allowHalfPlacement || (g.items ?? []).some((i) => i.placement === 'HALF')
      ),
    [product?.optionGroups]
  );
  const [addonCartEntries, setAddonCartEntries] = useState<
    { optionGroupId: string; optionItemIds: string[]; optionPlacements: Record<string, 'WHOLE' | 'LEFT' | 'RIGHT'> }[]
  >([]);

  const images = useMemo(() => (product ? getProductImages(product) : []), [product]);
  const mainImageUrl = images[mainImageIndex] ?? 'https://placehold.co/400x500?text=No+Image';
  const hasImages = images.length > 0;
  const variantGroups = useMemo(() => {
    const groups = (product?.optionGroups ?? []).filter((g) => (g.items?.length ?? 0) > 0);
    return filterOptionGroupsForTenant(tenantType, groups);
  }, [product?.optionGroups, tenantType]);
  const hasVariants = variantGroups.length > 0;
  const hasVariantSystem = (product?.variants?.length ?? 0) > 0;

  const groupHasHalfOptions = useCallback((g: OptionGroup) =>
    g.allowHalfPlacement || (g.items ?? []).some((i) => i.placement === 'HALF'),
  []);

  const nonAddonGroups = useMemo(
    () => variantGroups.filter((g) => !groupHasHalfOptions(g)),
    [variantGroups, groupHasHalfOptions]
  );

  /** For FOOD tenants or PIZZA products: bypass size/color validation; only validate addons. */
  const requiresSizeColorValidation = tenantType !== 'FOOD' && product?.type !== 'PIZZA';

  const effectiveSelected = useMemo(() => {
    const nonAddon = selected.filter((s) => {
      const g = product?.optionGroups?.find((gr) => gr.id === s.optionGroupId);
      return !g || !groupHasHalfOptions(g);
    });
    // addonCartEntries already has optionPlacements (optionId -> WHOLE|LEFT|RIGHT).
    // sliceSelection is a required type field for base pizza; addon placement lives in optionPlacements.
    const addonEntries: PizzaSelectedOption[] = addonCartEntries.map((e) => ({
      ...e,
      sliceSelection: 'WHOLE' as const,
      optionPlacements: e.optionPlacements,
    }));
    return [...nonAddon, ...addonEntries];
  }, [selected, addonCartEntries, product?.optionGroups, groupHasHalfOptions]);

  /** Build selected-by-group map from both selected (non-addon) and addonCartEntries. */
  const selectedByGroup = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of selected) {
      const g = product?.optionGroups?.find((gr) => gr.id === s.optionGroupId);
      if (g && groupHasHalfOptions(g)) continue;
      const ids = 'optionItemIds' in s ? s.optionItemIds : [];
      if (ids.length > 0) map.set(s.optionGroupId, ids);
    }
    for (const e of addonCartEntries) {
      const ids = e.optionItemIds ?? [];
      if (ids.length > 0) map.set(e.optionGroupId, ids);
    }
    return map;
  }, [selected, addonCartEntries, product?.optionGroups, groupHasHalfOptions]);

  /** Groups to validate for required selection. FOOD/pizza: variantGroups only. CLOTHING: nonAddonGroups. */
  const groupsToValidate = requiresSizeColorValidation ? nonAddonGroups : variantGroups;

  const requiredGroups = useMemo(
    () => groupsToValidate.filter((g) => g.required),
    [groupsToValidate]
  );

  const missingRequired = useMemo(
    () =>
      requiredGroups.some(
        (g) => (selectedByGroup.get(g.id)?.length ?? 0) < g.minSelected
      ),
    [requiredGroups, selectedByGroup]
  );

  const overMaxSelected = useMemo(
    () =>
      groupsToValidate.some((g) => {
        const count = selectedByGroup.get(g.id)?.length ?? 0;
        const isFoodAddon =
          !requiresSizeColorValidation &&
          (g.type === 'CUSTOM' || (g.type ?? 'CUSTOM') === 'CUSTOM') &&
          groupHasHalfOptions(g);
        if (isFoodAddon) return false;
        return count > g.maxSelected;
      }),
    [groupsToValidate, selectedByGroup, requiresSizeColorValidation, groupHasHalfOptions]
  );

  const selectionValid = useMemo(() => {
    if (requiresSizeColorValidation) {
      return !hasVariants || isSelectionValid(product!, effectiveSelected);
    }
    return !missingRequired && !overMaxSelected;
  }, [requiresSizeColorValidation, hasVariants, product, effectiveSelected, missingRequired, overMaxSelected]);

  const missingRequiredGroup = useMemo(
    () =>
      requiredGroups.find(
        (g) => (selectedByGroup.get(g.id)?.length ?? 0) < g.minSelected
      ),
    [requiredGroups, selectedByGroup]
  );

  const matchingVariant = useMemo(
    () => (product && hasVariantSystem ? findMatchingVariant(product, effectiveSelected) : null),
    [product, effectiveSelected, hasVariantSystem]
  );
  const inStock = useMemo(() => {
    if (!product) return true;
    if (matchingVariant != null) return matchingVariant.stock > 0;
    return product.inStock ?? true;
  }, [product, matchingVariant]);
  const canAdd = inStock && selectionValid && !isAdding;

  const unitPrice = useMemo(() => {
    if (!product) return 0;
    if (matchingVariant?.priceOverride != null) return matchingVariant.priceOverride;
    return calculatePrice(product, effectiveSelected);
  }, [product, matchingVariant, effectiveSelected]);
  const totalPrice = unitPrice * quantity;
  const { discount } = product
    ? applyCampaign(totalPrice, campaigns ?? [], product.id, product.categoryId)
    : { discount: 0 };
  const finalPrice = totalPrice - discount;

  const handleOptionChange = (
    groupId: string,
    itemIds: string[],
    sliceSelection?: 'WHOLE' | 'LEFT' | 'RIGHT',
    _optionPlacements?: Record<string, 'WHOLE' | 'LEFT' | 'RIGHT'>
  ) => {
    const group = product?.optionGroups?.find((g) => g.id === groupId);
    if (product?.type === 'PIZZA' && group && groupHasHalfOptions(group)) {
      return;
    }
    if (product?.type === 'PIZZA' && sliceSelection) {
      setSelected((prev) => {
        const rest = (prev as PizzaSelectedOption[]).filter(
          (p) =>
            !(
              p.optionGroupId === groupId &&
              'sliceSelection' in p &&
              (p as PizzaSelectedOption).sliceSelection === sliceSelection
            )
        );
        return [...rest, { optionGroupId: groupId, sliceSelection, optionItemIds: itemIds }];
      });
    } else {
      setSelected((prev) => {
        const rest = (prev as SelectedOption[]).filter((p) => p.optionGroupId !== groupId);
        return [...rest, { optionGroupId: groupId, optionItemIds: itemIds }];
      });
    }
  };

  const handleAddToCart = useCallback(async () => {
    if (!product || !canAdd) return;
    if (!selectionValid) {
      if (requiresSizeColorValidation) {
        addToast('اختاري المقاس/اللون', 'error');
      } else if (missingRequiredGroup) {
        addToast(`اختر من ${missingRequiredGroup.name}`, 'error');
      }
      return;
    }
    setIsAdding(true);
    try {
      addItem(tenantId, {
        productId: product.id,
        productName: product.name,
        categoryId: product.categoryId,
        quantity,
        basePrice: product.basePrice,
        selectedOptions: effectiveSelected,
        optionGroups: product.optionGroups,
        totalPrice,
        imageUrl: product.images?.[0]?.url ?? product.imageUrl,
      });
      addToast('انضاف للسلة', 'success');
      setAddButtonBouncing(true);
      setTimeout(() => setAddButtonBouncing(false), 250);
    } finally {
      setIsAdding(false);
    }
  }, [product, canAdd, selectionValid, requiresSizeColorValidation, missingRequiredGroup, addToast, addItem, tenantId, effectiveSelected, quantity, totalPrice]);

  if (isLoading || !product) {
    return <ProductPageSkeleton />;
  }

  return (
    <div className="max-w-5xl mx-auto p-4" dir="rtl">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="grid md:grid-cols-2 gap-6 md:gap-8"
      >
        {/* Image Gallery */}
        <div className="space-y-3">
          <div
            className="aspect-[4/5] w-full rounded-2xl overflow-hidden bg-gray-100 relative cursor-zoom-in"
            role="button"
            tabIndex={0}
            onClick={() => hasImages && setFullscreenOpen(true)}
            onKeyDown={(e) => hasImages && (e.key === 'Enter' || e.key === ' ') && setFullscreenOpen(true)}
            aria-label="عرض الصورة بحجم كامل"
          >
            {!hasImages ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                <Package className="w-16 h-16 mb-2" strokeWidth={1} />
                <span className="text-sm">لا توجد صورة</span>
              </div>
            ) : (
              <>
                {!mainImageLoaded && (
                  <Skeleton
                    variant="rectangular"
                    className="absolute inset-0 w-full h-full rounded-none"
                  />
                )}
                <img
                  src={mainImageUrl}
                  alt={product.name}
                  loading="eager"
                  onLoad={() => setMainImageLoaded(true)}
                  onError={() => setMainImageLoaded(true)}
                  key={mainImageIndex}
                  className={`w-full h-full object-cover transition-opacity duration-200 ${
                    !mainImageLoaded ? 'opacity-0' : 'opacity-100'
                  }`}
                />
              </>
            )}
            {!inStock && (
              <div className="absolute top-3 start-3">
                <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-gray-200/95 text-gray-700">
                  نفد
                </span>
              </div>
            )}
            {(product.isLastItems ||
              (product.quantity != null &&
                product.lowStockThreshold != null &&
                product.quantity <= product.lowStockThreshold)) &&
              inStock && (
                <div className="absolute top-3 start-3">
                  <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-amber-100/95 text-amber-800">
                    آخر {product.lastItemsCount ?? product.quantity ?? 0}
                  </span>
                </div>
              )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1">
              {images.slice(0, 6).map((url, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setMainImageIndex(i)}
                  className={`flex-shrink-0 w-16 h-20 rounded-xl overflow-hidden border-2 transition-colors ${
                    mainImageIndex === i ? 'border-primary' : 'border-transparent hover:border-gray-300'
                  }`}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-4">
          <h1 className="text-xl font-medium text-gray-900 line-clamp-2">{product.name}</h1>
          <p className="text-lg font-semibold text-gray-900">
            {discount > 0 ? (
              <>
                <span className="line-through text-gray-400 text-base me-1">{formatMoney(totalPrice)}</span>
                {formatMoney(finalPrice)}
              </>
            ) : (
              formatMoney(finalPrice)
            )}
          </p>
          {hasVariants && (
            <p className="text-xs text-gray-500">متوفر بعدة خيارات</p>
          )}

          {/* Variants - non-addon groups (Size, etc.) */}
          {nonAddonGroups.map((group) => (
            <VariantSelector
              key={group.id}
              group={group}
              product={product}
              value={selected.find((s) => {
                if (product.type === 'PIZZA' && 'sliceSelection' in s)
                  return s.optionGroupId === group.id && (s as PizzaSelectedOption).sliceSelection === 'WHOLE';
                return s.optionGroupId === group.id;
              })}
              onChange={(ids, _placements) =>
                handleOptionChange(
                  group.id,
                  ids,
                  product.type === 'PIZZA' ? 'WHOLE' : undefined
                )
              }
            />
          ))}
          {/* Variants - add-on groups (pizza toppings with placement) */}
          {addonGroups.length > 0 && (
            <PizzaAddonsSelector
              key={productId}
              optionGroups={addonGroups}
              product={product}
              onChange={setAddonCartEntries}
            />
          )}

          {!selectionValid && (
            <p className="text-sm text-amber-600">
              {requiresSizeColorValidation
                ? 'اختاري المقاس/اللون'
                : missingRequiredGroup
                  ? `اختر من ${missingRequiredGroup.name}`
                  : 'أكمل الاختيارات'}
            </p>
          )}

          {/* Quantity + Add */}
          <div className="flex items-center gap-3 pt-2">
            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-10 h-10 flex items-center justify-center border-e border-gray-200 hover:bg-gray-50"
              >
                −
              </button>
              <span className="w-10 text-center text-sm font-medium">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => q + 1)}
                className="w-10 h-10 flex items-center justify-center border-s border-gray-200 hover:bg-gray-50"
              >
                +
              </button>
            </div>
            <Button
              onClick={handleAddToCart}
              disabled={!canAdd}
              className={`flex-1 ${addButtonBouncing ? 'animate-bounce-subtle' : ''}`}
            >
              {isAdding ? 'جاري الإضافة...' : 'أضف للسلة'}
            </Button>
          </div>

          {/* Trust layer */}
          <div className="mt-4 flex flex-col gap-2" dir="rtl">
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Truck className="w-4 h-4 flex-shrink-0 text-neutral-400" strokeWidth={1.5} />
              <span>توصيل سريع خلال 2–3 أيام</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <RefreshCw className="w-4 h-4 flex-shrink-0 text-neutral-400" strokeWidth={1.5} />
              <span>استبدال خلال 7 أيام</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <ShieldCheck className="w-4 h-4 flex-shrink-0 text-neutral-400" strokeWidth={1.5} />
              <span>دفع آمن 100٪</span>
            </div>
          </div>

          {/* Accordion */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <AccordionSection title="وصف المنتج" defaultOpen>
              <p className={`text-gray-600 text-sm leading-relaxed ${product.description ? 'whitespace-pre-line' : 'text-neutral-400 italic'}`}>
                {product.description || 'لا يوجد وصف متاح حالياً.'}
              </p>
            </AccordionSection>
            <AccordionSection title="التوصيل">
              التوصيل متاح لجميع المناطق. يتم الشحن خلال 2-5 أيام عمل.
            </AccordionSection>
            <AccordionSection title="الاستبدال والاسترجاع">
              يمكنك الاستبدال أو الاسترجاع خلال 14 يوماً من الاستلام في حال عدم الاستخدام.
            </AccordionSection>
          </div>
        </div>
      </motion.div>

      {fullscreenOpen && hasImages && (
        <ImageFullscreenViewer
          images={images}
          initialIndex={mainImageIndex}
          onClose={() => setFullscreenOpen(false)}
          productName={product.name}
        />
      )}
    </div>
  );
}

function getOptionStockFromVariants(
  product: Product,
  groupId: string,
  optionId: string
): number {
  const variants = product.variants ?? [];
  if (variants.length === 0) return 1;
  const relevant = variants.filter((v) =>
    v.optionValues.some((ov) => ov.groupId === groupId && ov.optionId === optionId)
  );
  return relevant.reduce((sum, v) => sum + v.stock, 0);
}

function VariantSelector({
  group,
  value,
  onChange,
  product,
}: {
  group: OptionGroup;
  value: SelectedOption | PizzaSelectedOption | undefined;
  onChange: (itemIds: string[], placements?: Record<string, 'WHOLE' | 'LEFT' | 'RIGHT'>) => void;
  product: Product;
}) {
  const items = group.items ?? [];
  if (items.length === 0) return null;

  const selectedIds = value ? ('optionItemIds' in value ? value.optionItemIds : []) : [];
  const isColor = isColorGroup(group);

  const toggle = useCallback(
    (itemId: string) => {
      if (group.selectionType === 'single') {
        onChange([itemId]);
      } else {
        const next = selectedIds.includes(itemId)
          ? selectedIds.filter((id) => id !== itemId)
          : [...selectedIds, itemId];
        onChange(next.slice(0, group.maxSelected));
      }
    },
    [group.selectionType, group.maxSelected, selectedIds, onChange]
  );

  if (group.selectionType === 'multi' && !isColor) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {group.name}
          {group.required && <span className="text-red-500 me-1">*</span>}
        </label>
        <div className="flex flex-wrap gap-2" dir="rtl">
          {items.map((item) => {
            const itemStock = (item as OptionItem & { stock?: number }).stock;
            const variantStock = getOptionStockFromVariants(product, group.id, item.id);
            const stock = product.variants?.length ? variantStock : (itemStock ?? 1);
            const disabled = stock === 0;
            const isSelected = selectedIds.includes(item.id);
            const priceStr =
              ((item.priceDelta ?? item.priceModifier ?? 0) > 0)
                ? ` +${formatMoney(item.priceDelta ?? item.priceModifier ?? 0)}`
                : '';
            return (
              <button
                key={`${group.id}::${item.id}`}
                type="button"
                onClick={() => !disabled && toggle(item.id)}
                disabled={disabled}
                className={`chip-transition rounded-full px-3 py-1.5 text-sm font-medium ${
                  isSelected
                    ? 'bg-primary text-white border border-primary shadow-sm'
                    : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {item.name}
                {priceStr}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (isColor) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          {group.name}
          {group.required && <span className="text-red-500 me-1">*</span>}
        </label>
        <div className="flex flex-wrap gap-2" dir="rtl">
          {items.map((item) => {
            const hex = getColorHex(item.name);
            const itemStock = (item as OptionItem & { stock?: number }).stock;
            const variantStock = getOptionStockFromVariants(product, group.id, item.id);
            const stock = product.variants?.length ? variantStock : (itemStock ?? 1);
            const disabled = stock === 0;
            const isSelected = selectedIds.includes(item.id);
            return (
              <button
                key={`${group.id}::${item.id}`}
                type="button"
                onClick={() => !disabled && toggle(item.id)}
                disabled={disabled}
                title={item.name}
                className={`w-9 h-9 rounded-full border-2 transition-all duration-200 flex items-center justify-center text-xs font-medium shrink-0 ${
                  disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400'
                } ${isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-gray-200'}`}
                style={hex ? { backgroundColor: hex } : { backgroundColor: '#e5e7eb' }}
              >
                {!hex && item.name.charAt(0).toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {group.name}
        {group.required && <span className="text-red-500 me-1">*</span>}
      </label>
      <div className="flex flex-wrap gap-2" dir="rtl">
        {items.map((item) => {
          const itemStock = (item as OptionItem & { stock?: number }).stock;
          const variantStock = getOptionStockFromVariants(product, group.id, item.id);
          const stock = product.variants?.length ? variantStock : (itemStock ?? 1);
          const disabled = stock === 0;
          const isSelected = selectedIds.includes(item.id);
          return (
            <button
              key={`${group.id}::${item.id}`}
              type="button"
              onClick={() => !disabled && toggle(item.id)}
              disabled={disabled}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors min-w-[2.5rem] ${
                isSelected ? 'bg-primary text-white border-primary' : 'border-gray-200 hover:border-primary'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {item.name}
              {((item.priceDelta ?? item.priceModifier ?? 0) > 0) &&
                ` +${formatMoney(item.priceDelta ?? item.priceModifier ?? 0)}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
