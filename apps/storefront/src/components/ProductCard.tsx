import { memo, useCallback, useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Info } from 'lucide-react';
import type { Product, Campaign } from '@nmd/core';
import { applyCampaign, formatMoney } from '@nmd/core';
import { Skeleton, useToast } from '@nmd/ui';
import { useAppStore } from '../store/app';
import { useCartStore } from '../store/cart';

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
  const storeType = useAppStore((s) => s.storeType);
  const addItem = useCartStore((s) => s.addItem);
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
  const inStock = product.inStock ?? true;

  const handleAddClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!inStock) return;
    if (needsOptions) {
      navigate(`/${tenantSlug}/p/${product.id}`);
      return;
    }
    const finalPrice = product.basePrice - discount;
    addItem(tenantId, {
      productId: product.id,
      productName: product.name,
      categoryId: product.categoryId,
      quantity: 1,
      basePrice: product.basePrice,
      selectedOptions: [],
      optionGroups: product.optionGroups ?? [],
      totalPrice: finalPrice,
      imageUrl: product.images?.[0]?.url ?? product.imageUrl,
    });
    addToast('انضاف للسلة', 'success');
    setIsBouncing(true);
    if (bounceTimeoutRef.current) clearTimeout(bounceTimeoutRef.current);
    bounceTimeoutRef.current = setTimeout(() => {
      setIsBouncing(false);
      bounceTimeoutRef.current = null;
    }, 250);
  }, [inStock, needsOptions, product, discount, navigate, addItem, tenantId, addToast]);

  const imageUrl = product.images?.[0]?.url ?? product.imageUrl ?? 'https://placehold.co/400x400?text=No+Image';

  return (
    <Link to={`/${tenantSlug}/p/${product.id}`} className="block h-full group">
      <article
        className="bg-white rounded-xl border border-gray-100 hover:shadow-xl transition-all duration-300 flex flex-col h-[380px] md:h-[420px] overflow-hidden relative"
        dir="rtl"
      >
        {/* Image - ~65–70% of card height */}
        <div className="flex-[0_0_65%] min-h-0 w-full bg-[#fcfcfc] relative overflow-hidden shrink-0">
          {!imageLoaded && (
            <Skeleton variant="rectangular" className="absolute inset-0 w-full h-full" />
          )}
          <img
            src={imageUrl}
            alt={product.name}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${!imageLoaded ? 'opacity-0' : 'opacity-100'}`}
          />
          {/* Badges */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
            {isNew && <span className="bg-primary/90 text-white text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">جديد</span>}
            {hasDiscount && <span className="bg-red-500 text-white text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">خصم</span>}
            {!inStock && <span className="bg-gray-200/90 text-gray-700 text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">نفد</span>}
          </div>
        </div>

        {/* Info - Compact, high-end layout */}
        <div className="p-3 flex flex-col flex-1 min-h-0 justify-between gap-1">
          <div className="space-y-0.5">
            <h3 className="text-base font-semibold text-gray-900 line-clamp-2 leading-tight">
              {product.name}
            </h3>
            {hasVariants(product) && (
              <p className="text-sm text-gray-600 leading-tight">خيارات متعددة</p>
            )}
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
                disabled={!inStock}
                className={`w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center transition-all ${
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
