import { useParams } from 'react-router-dom';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, Package, Truck, MessageCircle, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { MockApiClient } from '@nmd/mock';
import type { Product, OptionGroup, OptionItem, SelectedOption, PizzaSelectedOption, ProductVariant } from '@nmd/core';
import { applyCampaign, formatMoney, filterOptionGroupsForTenant, roundMoney } from '@nmd/core';
import { Skeleton, useToast, Modal } from '@nmd/ui';
import { ImageFullscreenViewer } from '../components/ImageFullscreenViewer';
import { PizzaAddonsSelector } from '../components/PizzaAddonsSelector';
import { ProductPageSkeleton } from '../components/skeletons';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/app';
import { useCartStore } from '../store/cart';
import { useBottomNav } from '../contexts/BottomNavContext';

const api = new MockApiClient();

const TEAL = '#0f766e';

/** Flexible Arabic labels for delivery and store policy (restaurants and stores) */
const DELIVERY_LABEL = 'توصيل سريع ومباشر | يتم التنسيق فور تأكيد الطلب';
const STORE_POLICY_LABEL = 'نضمن لكم أفضل جودة. في حال وجود أي ملاحظة على الطلب، يرجى التواصل مع المتجر مباشرة عبر الواتساب';

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
    const placements = 'optionPlacements' in sel ? (sel.optionPlacements ?? {}) : {};
    const group = product.optionGroups.find((g) => g.id === sel.optionGroupId);
    if (!group) continue;
    if (group.allowHalfPlacement && ids.length === 2) {
      const leftId = ids.find((id) => placements[id] === 'LEFT');
      const rightId = ids.find((id) => placements[id] === 'RIGHT');
      if (leftId != null && rightId != null) {
        const item1 = group.items.find((i) => i.id === leftId);
        const item2 = group.items.find((i) => i.id === rightId);
        const d1 = item1?.priceDelta ?? item1?.priceModifier ?? 0;
        const d2 = item2?.priceDelta ?? item2?.priceModifier ?? 0;
        total += (d1 + d2) / 2;
        continue;
      }
    }
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
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-4 text-start font-medium transition-colors"
        style={{ color: '#0a0a0a' }}
      >
        {title}
        <ChevronDown
          className="w-5 h-5 transition-transform duration-200"
          style={{ color: TEAL }}
        />
      </button>
      {open && (
        <div className="pb-4 text-sm leading-relaxed" style={{ color: '#0a0a0a' }}>
          {children}
        </div>
      )}
    </div>
  );
}

export default function ProductPage() {
  const { productId } = useParams<{ productId: string }>();
  const tenantId = useAppStore((s) => s.tenantId) ?? 'default';
  const tenantName = useAppStore((s) => s.tenantName);
  const marketId = useAppStore((s) => s.marketId);
  const tenantType = useAppStore((s) => s.tenantType) ?? 'GENERAL';
  const storeType = useAppStore((s) => s.storeType);
  const isProfessional = storeType === 'PROFESSIONAL';
  const addToast = useToast().addToast;
  const addItem = useCartStore((s) => s.addItem);
  const getTenantIdsInCart = useCartStore((s) => s.getTenantIdsInCart);
  const [differentMarketModalOpen, setDifferentMarketModalOpen] = useState(false);

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
  const isWeightBasedProduct =
    (product && (product as { isWeightBased?: boolean }).isWeightBased === true) ||
    ((product && (product as { quantityStep?: number }).quantityStep) ?? 1) < 1;
  const quantityStep = isWeightBasedProduct
    ? ((product && (product as { quantityStep?: number }).quantityStep) ?? 1)
    : 1;
  const unitName = isWeightBasedProduct
    ? ((product && (product as { unitName?: string }).unitName) ?? 'حبة')
    : 'حبة';
  const showUnitLabel =
    isWeightBasedProduct &&
    !['حبة', 'pcs'].includes((unitName ?? '').trim().toLowerCase());
  const minQuantity = quantityStep > 0 ? quantityStep : 1;
  const [quantity, setQuantity] = useState(minQuantity);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [mainImageLoaded, setMainImageLoaded] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [addButtonBouncing, setAddButtonBouncing] = useState(false);
  useEffect(() => setMainImageLoaded(false), [mainImageIndex]);

  const variantGroups = useMemo(() => {
    const groups = (product?.optionGroups ?? []).filter((g) => (g.items?.length ?? 0) > 0);
    return filterOptionGroupsForTenant(tenantType, groups);
  }, [product?.optionGroups, tenantType]);

  const [addonCartEntries, setAddonCartEntries] = useState<
    { optionGroupId: string; optionItemIds: string[]; optionPlacements: Record<string, 'WHOLE' | 'LEFT' | 'RIGHT'> }[]
  >([]);

  const images = useMemo(() => (product ? getProductImages(product) : []), [product]);
  const mainImageUrl = images[mainImageIndex] ?? 'https://placehold.co/400x500?text=No+Image';
  const hasImages = images.length > 0;
  const hasVariants = variantGroups.length > 0;
  const hasVariantSystem = (product?.variants?.length ?? 0) > 0;

  const groupHasHalfOptions = useCallback((g: OptionGroup) =>
    g.allowHalfPlacement || (g.items ?? []).some((i) => i.placement === 'HALF'),
  []);

  const nonAddonGroups = useMemo(
    () => variantGroups.filter((g) => !groupHasHalfOptions(g)),
    [variantGroups, groupHasHalfOptions]
  );

  /** All add-on groups (half placement or CUSTOM multi-select). Rendered together in one PizzaAddonsSelector. */
  const addonGroups = useMemo(
    () => variantGroups.filter((g) => groupHasHalfOptions(g)),
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
  const isAvailable = product?.isAvailable !== false;
  const inStock = useMemo(() => {
    if (!product) return true;
    if (matchingVariant != null) return matchingVariant.stock > 0;
    return product.inStock ?? true;
  }, [product, matchingVariant]);
  const canAdd = isAvailable && inStock && selectionValid && !isAdding;

  const unitPrice = useMemo(() => {
    if (!product) return 0;
    if (matchingVariant?.priceOverride != null) return matchingVariant.priceOverride;
    return calculatePrice(product, effectiveSelected);
  }, [product, matchingVariant, effectiveSelected]);
  const totalPrice = roundMoney(unitPrice * quantity);
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
    if (product.isAvailable === false) return;
    const tenantIds = getTenantIdsInCart();
    const cartStoreId = tenantIds.length > 0 ? tenantIds[0] : null;
    if (cartStoreId != null && tenantId !== cartStoreId) {
      setDifferentMarketModalOpen(true);
      return;
    }
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
      addItem(
        tenantId,
        {
          productId: product.id,
          productName: product.name,
          categoryId: product.categoryId,
          quantity,
          basePrice: product.basePrice,
          selectedOptions: effectiveSelected,
          optionGroups: product.optionGroups,
          totalPrice,
          imageUrl: product.images?.[0]?.url ?? product.imageUrl,
          quantityStep,
          unitName,
          isWeightBased: isWeightBasedProduct,
        },
        marketId ?? undefined,
        tenantName ?? undefined
      );
      addToast('انضاف للسلة', 'success');
      setAddButtonBouncing(true);
      setTimeout(() => setAddButtonBouncing(false), 250);
    } finally {
      setIsAdding(false);
    }
  }, [product, canAdd, selectionValid, requiresSizeColorValidation, missingRequiredGroup, addToast, addItem, tenantId, tenantName, marketId, getTenantIdsInCart, effectiveSelected, quantity, totalPrice]);

  if (isLoading || !product) {
    return <ProductPageSkeleton />;
  }

  return (
    <div className="max-w-5xl mx-auto p-4 pb-[120px] md:pb-4 bg-[#ffffff] min-h-screen w-full" dir="rtl" style={{ margin: 0 }}>
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
              <div className="w-full h-full flex flex-col items-center justify-center" style={{ color: '#0a0a0a' }}>
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
                <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/95" style={{ color: '#0a0a0a' }}>
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
                  <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/95" style={{ color: TEAL }}>
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
                  className="flex-shrink-0 w-16 h-20 rounded-full overflow-hidden border-2 transition-colors"
                    style={{ borderColor: mainImageIndex === i ? TEAL : 'transparent' }}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold line-clamp-2" style={{ color: '#0a0a0a' }}>{product.name}</h1>
          <p className="text-xl font-bold" style={{ color: '#0a0a0a' }}>
            {discount > 0 ? (
              <>
                <span className="line-through opacity-60 text-base me-1">{formatMoney(totalPrice)}</span>
                {formatMoney(finalPrice)}
              </>
            ) : (
              formatMoney(finalPrice)
            )}
          </p>

          {/* Product Description — line-clamp-1, above options */}
          <div className="pt-2">
            <h3 className="text-sm font-semibold mb-1.5" style={{ color: '#0a0a0a' }}>{isProfessional ? 'تفاصيل الخدمة' : 'وصف المنتج'}</h3>
            <p className="text-sm leading-relaxed line-clamp-1" style={{ color: '#0a0a0a' }}>
              {product.description || 'لا يوجد وصف متاح حالياً.'}
            </p>
          </div>

          {/* All option groups: vertical stack. Non-addon (size/color) first, then ALL add-on groups together. */}
          {nonAddonGroups.map((group) => (
            <div key={group.id} className="space-y-2">
              <VariantSelector
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
            </div>
          ))}
          {addonGroups.length > 0 && (
            <div className="space-y-2 mb-6">
              <PizzaAddonsSelector
                optionGroups={addonGroups}
                product={product}
                onChange={(entries) => setAddonCartEntries(entries)}
              />
            </div>
          )}

          {!isProfessional && !selectionValid && (
            <p className="text-sm" style={{ color: TEAL }}>
              {requiresSizeColorValidation
                ? 'اختاري المقاس/اللون'
                : missingRequiredGroup
                  ? `اختر من ${missingRequiredGroup.name}`
                  : 'أكمل الاختيارات'}
            </p>
          )}

          {/* Desktop: Quantity + Add inline; Mobile uses fixed bar below */}
          {isProfessional ? (
            <div className="pt-4 p-4 rounded-full bg-white" style={{ border: `1px solid ${TEAL}33` }} dir="rtl">
              <p className="text-sm font-medium mb-1" style={{ color: '#0a0a0a' }}>للحصول على هذه الخدمة</p>
              <p className="text-sm" style={{ color: '#0a0a0a' }}>تواصل معنا عبر الأزرار أدناه</p>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-3 pt-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs" style={{ color: '#0a0a0a' }}>الكمية المطلوبة</span>
                <div className="flex items-center rounded-full bg-white h-12 overflow-hidden shadow-sm" style={{ border: `1px solid rgba(15,118,110,0.2)` }}>
                  <button
                    type="button"
                    disabled={!isAvailable}
                    onClick={() =>
                      isAvailable &&
                      setQuantity((q) => {
                        const next = isWeightBasedProduct
                          ? roundMoney(Math.max(minQuantity, q - quantityStep))
                          : Math.max(1, Math.round(q) - 1);
                        return next < minQuantity ? minQuantity : next;
                      })
                    }
                    className={`w-10 h-12 flex items-center justify-center ${isAvailable ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'}`}
                    style={{ color: TEAL }}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={minQuantity}
                    step={quantityStep}
                    value={isWeightBasedProduct ? quantity : Math.round(quantity)}
                    onChange={(e) => {
                      if (!isAvailable) return;
                      const v = parseFloat(e.target.value);
                      if (Number.isNaN(v) || v < minQuantity) return;
                      setQuantity(isWeightBasedProduct ? roundMoney(v) : Math.max(1, Math.round(v)));
                    }}
                    disabled={!isAvailable}
                    className={`w-14 h-12 text-center text-sm font-medium border-0 bg-transparent p-0 leading-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${!isAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
                    style={{ color: TEAL }}
                    aria-label="الكمية المطلوبة"
                  />
                  {showUnitLabel && <span className="pr-2 text-sm leading-none" style={{ color: TEAL }}>{unitName}</span>}
                  <button
                    type="button"
                    disabled={!isAvailable}
                    onClick={() =>
                      isAvailable &&
                      setQuantity((q) =>
                        isWeightBasedProduct ? roundMoney(q + quantityStep) : Math.round(q) + 1
                      )
                    }
                    className={`w-10 h-12 flex items-center justify-center ${isAvailable ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'}`}
                    style={{ color: TEAL }}
                  >
                    +
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={!canAdd}
                className={`flex-1 h-12 rounded-full flex items-center justify-center font-semibold text-white transition-all ${addButtonBouncing ? 'animate-bounce-subtle' : ''} ${!canAdd ? 'opacity-50 cursor-not-allowed' : ''}`}
                style={{ backgroundColor: TEAL }}
              >
                {!isAvailable ? 'غير متوفر الآن' : isAdding ? 'جاري الإضافة...' : 'أضف للسلة'}
              </button>
            </div>
          )}

          {/* Accordion */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            {!isProfessional && (
              <>
                <AccordionSection title="التوصيل">
                  {DELIVERY_LABEL}
                </AccordionSection>
                <AccordionSection title="سياسة المتجر وضمان الجودة">
                  <div className="space-y-2 text-sm leading-relaxed">
                    <p>{STORE_POLICY_LABEL}</p>
                    <p className="flex items-center gap-2 mt-2">
                      <Truck className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} style={{ color: TEAL }} />
                      <span>توصيل سريع</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} style={{ color: TEAL }} />
                      <span>نضمن لكم أفضل جودة</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} style={{ color: TEAL }} />
                      <span>دفع آمن 100٪</span>
                    </p>
                  </div>
                </AccordionSection>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Fixed action bar: Quantity (pill) + Add to Cart + View Cart when items exist (mobile only) */}
      {!isProfessional && (
        <ProductPageFixedBar
          quantity={quantity}
          setQuantity={setQuantity}
          minQuantity={minQuantity}
          quantityStep={quantityStep}
          isWeightBasedProduct={isWeightBasedProduct}
          showUnitLabel={showUnitLabel}
          unitName={unitName}
          isAvailable={isAvailable}
          canAdd={canAdd}
          isAdding={isAdding}
          addButtonBouncing={addButtonBouncing}
          handleAddToCart={handleAddToCart}
        />
      )}

      {fullscreenOpen && hasImages && (
        <ImageFullscreenViewer
          images={images}
          initialIndex={mainImageIndex}
          onClose={() => setFullscreenOpen(false)}
          productName={product.name}
        />
      )}

      <Modal open={differentMarketModalOpen} onClose={() => setDifferentMarketModalOpen(false)} title="مجموعة طلب مختلفة" size="sm">
        <p className="text-[#0a0a0a]">لا يمكن الجمع بين متاجر من مجموعات طلب مختلفة. يمكنك الطلب معاً فقط من متاجر في نفس مجموعة الطلب المشترك (من قسم التخطيط في لوحة السوق). أكمّل طلبك الحالي أو افرغ السلة ثم أضف من هذا المتجر.</p>
      </Modal>
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

/** Fixed bar: Quantity pill + Add to Cart. When cart has items, includes View Cart link. Positioned above bottom nav and CartBar. */
function ProductPageFixedBar(props: {
  quantity: number;
  setQuantity: React.Dispatch<React.SetStateAction<number>>;
  minQuantity: number;
  quantityStep: number;
  isWeightBasedProduct: boolean;
  showUnitLabel: boolean;
  unitName: string;
  isAvailable: boolean;
  canAdd: boolean;
  isAdding: boolean;
  addButtonBouncing: boolean;
  handleAddToCart: () => void;
}) {
  const {
    quantity,
    setQuantity,
    minQuantity,
    quantityStep,
    isWeightBasedProduct,
    showUnitLabel,
    unitName,
    isAvailable,
    canAdd,
    isAdding,
    addButtonBouncing,
    handleAddToCart,
  } = props;
  const { visible: bottomNavVisible, height: bottomNavHeight } = useBottomNav();
  const tenantSlug = useAppStore((s) => s.tenantSlug ?? s.tenantId ?? '');
  const carts = useCartStore((s) => s.carts);
  const tenantIds = Object.keys(carts).filter((id) => (carts[id]?.length ?? 0) > 0);
  const cartCount = tenantIds.reduce((sum, tid) => sum + (carts[tid] ?? []).reduce((s, i) => s + i.quantity, 0), 0);
  const firstTenantInCart = tenantIds[0];
  const cartPath = tenantSlug ? `/${tenantSlug}/cart` : firstTenantInCart ? `/${firstTenantInCart}/cart` : '/';

  const cartBarHeight = 88; // ~5.5rem
  const bottomOffset = bottomNavVisible
    ? cartCount > 0
      ? `calc(${bottomNavHeight}px + ${cartBarHeight}px + env(safe-area-inset-bottom, 0px))`
      : `calc(${bottomNavHeight}px + env(safe-area-inset-bottom, 0px))`
    : cartCount > 0
      ? `calc(${cartBarHeight}px + env(safe-area-inset-bottom, 0px))`
      : 'env(safe-area-inset-bottom, 0px)';

  return (
    <div
      className="md:hidden fixed left-0 right-0 z-[9998] bg-white shadow-[0_-2px_12px_rgba(0,0,0,0.06)]"
      style={{
        bottom: bottomOffset,
        paddingTop: 12,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 16,
        paddingRight: 16,
      }}
      dir="rtl"
    >
      <div className="flex flex-col gap-3 items-center w-full">
        <div className="flex items-center gap-3 w-full max-w-[340px] mx-auto">
          <div className="flex items-center rounded-full bg-white h-11 overflow-hidden shadow-sm flex-1 shrink-0" style={{ border: '1px solid rgba(15,118,110,0.25)' }}>
            <button
              type="button"
              disabled={!isAvailable}
              onClick={() =>
                isAvailable &&
                setQuantity((q) => {
                  const next = isWeightBasedProduct
                    ? roundMoney(Math.max(minQuantity, q - quantityStep))
                    : Math.max(1, Math.round(q) - 1);
                  return next < minQuantity ? minQuantity : next;
                })
              }
              className={`w-11 h-11 flex items-center justify-center text-lg font-medium ${isAvailable ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'}`}
              style={{ color: TEAL }}
            >
              −
            </button>
            <input
              type="number"
              min={minQuantity}
              step={quantityStep}
              value={isWeightBasedProduct ? quantity : Math.round(quantity)}
              onChange={(e) => {
                if (!isAvailable) return;
                const v = parseFloat(e.target.value);
                if (Number.isNaN(v) || v < minQuantity) return;
                setQuantity(isWeightBasedProduct ? roundMoney(v) : Math.max(1, Math.round(v)));
              }}
              disabled={!isAvailable}
              className="w-14 h-11 text-center text-sm font-medium border-0 bg-transparent p-0 leading-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              style={{ color: TEAL }}
              aria-label="الكمية"
            />
            {showUnitLabel && <span className="pe-2 text-xs" style={{ color: TEAL }}>{unitName}</span>}
            <button
              type="button"
              disabled={!isAvailable}
              onClick={() =>
                isAvailable &&
                setQuantity((q) =>
                  isWeightBasedProduct ? roundMoney(q + quantityStep) : Math.round(q) + 1
                )
              }
              className={`w-11 h-11 flex items-center justify-center text-lg font-medium ${isAvailable ? 'hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'}`}
              style={{ color: TEAL }}
            >
              +
            </button>
          </div>
          {cartCount > 0 && (
            <Link
              to={cartPath}
              className="h-11 px-5 rounded-full font-semibold text-sm shrink-0 flex items-center justify-center border-2 transition-colors"
              style={{ borderColor: TEAL, color: TEAL }}
            >
              عرض السلة
            </Link>
          )}
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!canAdd}
            className={`flex-1 min-w-0 h-11 rounded-full flex items-center justify-center font-semibold text-white transition-all shrink-0 ${addButtonBouncing ? 'animate-bounce-subtle' : ''} ${!canAdd ? 'opacity-50 cursor-not-allowed' : ''}`}
            style={{ backgroundColor: TEAL }}
          >
            {!isAvailable ? 'غير متوفر' : isAdding ? 'جاري...' : 'أضف للسلة'}
          </button>
        </div>
      </div>
    </div>
  );
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
        <label className="block text-sm font-medium" style={{ color: '#0a0a0a' }}>
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
                className={`chip-transition rounded-full px-4 py-2 text-sm font-medium ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                style={{
                  backgroundColor: isSelected ? TEAL : '#ffffff',
                  color: isSelected ? '#ffffff' : '#0a0a0a',
                  border: isSelected ? 'none' : '1px solid rgba(15,118,110,0.2)',
                }}
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
        <label className="block text-sm font-medium" style={{ color: '#0a0a0a' }}>
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
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium shrink-0 transition-all duration-200 ${
                  disabled ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                style={{
                  backgroundColor: hex ?? '#f0f0f0',
                  border: isSelected ? `2px solid ${TEAL}` : '2px solid transparent',
                  boxShadow: isSelected ? `0 0 0 2px ${TEAL}` : undefined,
                }}
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
      <label className="block text-sm font-medium" style={{ color: '#0a0a0a' }}>
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
              className={`px-4 py-2 rounded-full text-sm font-medium min-w-[2.5rem] transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              style={{
                backgroundColor: isSelected ? TEAL : '#ffffff',
                color: isSelected ? '#ffffff' : '#0a0a0a',
                border: isSelected ? 'none' : '1px solid rgba(15,118,110,0.2)',
              }}
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
