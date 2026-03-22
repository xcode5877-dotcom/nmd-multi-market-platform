import { memo, useCallback, useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Info } from 'lucide-react';
import type { Product, Campaign } from '@nmd/core';
import { applyCampaign, formatMoney } from '@nmd/core';
import { useToast } from '@nmd/ui';
import { useAppStore } from '../store/app';
import { useCartStore } from '../store/cart';
import { resolveImageUrl } from '../lib/image-url';

const NEW_DAYS = 14;

function isNewProduct(createdAt?: string): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  const cutoff = Date.now() - NEW_DAYS * 24 * 60 * 60 * 1000;
  return created >= cutoff;
}

function hasVariants(product: Product): boolean {
  const groups = product.optionGroups ?? [];
  return groups.some((g) => (g.items?.length ?? 0) > 0);
}

function ProductPrice({ product, campaigns }: { product: Product; campaigns: Campaign[] }) {
  const { discount } = applyCampaign(product.basePrice, campaigns, product.id, product.categoryId);
  const finalPrice = product.basePrice - discount;
  if (discount > 0) {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <span className="line-through text-gray-400 text-xs font-medium leading-none">{formatMoney(product.basePrice)}</span>
        <p className="text-lg font-bold text-primary leading-none">
          {formatMoney(finalPrice)}
        </p>
      </div>
    );
  }
  return (
    <p className="text-lg font-bold text-primary leading-none">
      {formatMoney(product.basePrice)}
    </p>
  );
}

function ProductCardInner({
  product,
  campaigns,
}: {
  product: Product;
  campaigns: Campaign[];
}) {
  const tenantId = useAppStore((s) => s.tenantId) ?? 'default';
  const tenantSlug = useAppStore((s) => s.tenantSlug) ?? tenantId;
  const tenantName = useAppStore((s) => s.tenantName);
  const marketId = useAppStore((s) => s.marketId);
  const storeType = useAppStore((s) => s.storeType);
  const addItem = useCartStore((s) => s.addItem);
  const getTenantIdsInCart = useCartStore((s) => s.getTenantIdsInCart);
  const addToast = useToast().addToast;
  const navigate = useNavigate();
  const isProfessional = storeType === 'PROFESSIONAL';
  const bounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isBouncing, setIsBouncing] = useState(false);

  useEffect(() => () => {
    if (bounceTimeoutRef.current) clearTimeout(bounceTimeoutRef.current);
  }, []);

  const isNew = isNewProduct(product.createdAt);
  const { discount } = applyCampaign(product.basePrice, campaigns, product.id, product.categoryId);
  const hasDiscount = discount > 0;
  const needsOptions = hasVariants(product);
  const isAvailable = product.isAvailable !== false;
  const inStock = product.inStock ?? true;
  const canAddToCart = isAvailable && inStock;

  const handleAddClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canAddToCart) return;
    if (needsOptions) {
      navigate(`/${tenantSlug}/p/${product.id}`);
      return;
    }
    const tenantIds = getTenantIdsInCart();
    const cartStoreId = tenantIds.length > 0 ? tenantIds[0] : null;
    if (cartStoreId != null && tenantId !== cartStoreId) {
      addToast('يمكنك الطلب من متجر واحد فقط في كل مرة. افرغ السلة أو أكمل طلبك الحالي.', 'error');
      return;
    }
    const finalPrice = product.basePrice - discount;
    const isWeightBased =
      (product as { isWeightBased?: boolean }).isWeightBased === true ||
      ((product as { quantityStep?: number }).quantityStep ?? 1) < 1;
    addItem(
      tenantId,
      {
        productId: product.id,
        productName: product.name,
        categoryId: product.categoryId,
        quantity: 1,
        basePrice: product.basePrice,
        selectedOptions: [],
        optionGroups: product.optionGroups ?? [],
        totalPrice: finalPrice,
        imageUrl: product.images?.[0]?.url ?? product.imageUrl,
        quantityStep: isWeightBased ? (product as { quantityStep?: number }).quantityStep ?? 1 : 1,
        unitName: isWeightBased ? (product as { unitName?: string }).unitName ?? 'حبة' : 'حبة',
        isWeightBased,
      },
      marketId ?? undefined,
      tenantName ?? undefined
    );
    addToast('انضاف للسلة', 'success');
    setIsBouncing(true);
    if (bounceTimeoutRef.current) clearTimeout(bounceTimeoutRef.current);
    bounceTimeoutRef.current = setTimeout(() => {
      setIsBouncing(false);
      bounceTimeoutRef.current = null;
    }, 250);
  }, [canAddToCart, needsOptions, product, discount, navigate, addItem, tenantId, tenantName, marketId, getTenantIdsInCart, addToast, tenantSlug]);

  const rawImage = product.images?.[0]?.url ?? product.imageUrl;
  const imageUrl = rawImage ? resolveImageUrl(rawImage) : 'https://placehold.co/400x400?text=No+Image';

  return (
    <Link to={`/${tenantSlug}/p/${product.id}`} className="block h-full group">
      <article
        className="bg-white rounded-2xl border border-gray-100 hover:shadow-xl transition-all duration-300 flex flex-col h-[380px] md:h-[420px] overflow-hidden relative"
        dir="rtl"
      >
        {/* Image - lazy load with blur placeholder */}
        <div className="flex-[0_0_65%] min-h-0 w-full bg-[#f0f0f0] relative overflow-hidden shrink-0">
          {!imageLoaded && (
            <div
              className="absolute inset-0 w-full h-full scale-110 blur-xl bg-gradient-to-br from-gray-200 to-gray-300"
              aria-hidden
            />
          )}
          <img
            src={imageUrl}
            alt={product.name}
            loading="lazy"
            decoding="async"
            onLoad={() => setImageLoaded(true)}
            className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-500 ${!imageLoaded ? 'opacity-0 scale-105' : 'opacity-100 scale-100'} ${!isAvailable ? 'opacity-60' : ''}`}
          />
          {/* Badges */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
            {isNew && <span className="bg-primary/90 text-white text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">جديد</span>}
            {hasDiscount && <span className="bg-red-500 text-white text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">خصم</span>}
            {!isAvailable && <span className="bg-gray-200/90 text-gray-700 text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">غير متوفر الآن</span>}
            {isAvailable && !inStock && <span className="bg-gray-200/90 text-gray-700 text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">نفد</span>}
          </div>
        </div>

        {/* Info - Compact, high-end layout */}
        <div className="p-3 flex flex-col flex-1 min-h-0 justify-between gap-1">
          <div className="space-y-0.5 min-h-0">
            <h3 className="text-base font-bold text-gray-900 line-clamp-2 leading-tight">
              {product.name}
            </h3>
            {product.description?.trim() ? (
              <p className="text-sm text-gray-600 leading-tight line-clamp-1">{product.description.trim()}</p>
            ) : null}
          </div>

          <div className="flex items-end justify-between mt-2">
            {!isProfessional && <ProductPrice product={product} campaigns={campaigns} />}
            {isProfessional ? (
              <span className="text-sm font-medium text-primary flex items-center gap-1">
                <Info size={14} />
                تفاصيل الخدمة
              </span>
            ) : (
              <button
                onClick={handleAddClick}
                disabled={!canAddToCart}
                className={`w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center transition-all ${
                  isBouncing ? 'bg-primary text-white' : 'bg-gray-900 text-white hover:bg-primary shadow-sm'
                } disabled:opacity-30`}
              >
                <ShoppingCart size={16} />
              </button>
            )}
          </div>
        </div>
      </article>
    </Link>
  );
}

export const ProductCard = memo(ProductCardInner);
