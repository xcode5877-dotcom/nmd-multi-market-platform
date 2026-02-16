import { memo, useCallback, useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
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
      <p className="font-semibold text-primary text-[16px] md:text-[17px]">
        <span className="line-through text-gray-400 text-xs font-medium me-1">{formatMoney(product.basePrice)}</span>
        {formatMoney(finalPrice)}
      </p>
    );
  }
  return (
    <p className="font-semibold text-gray-900 text-[16px] md:text-[17px]">
      {formatMoney(product.basePrice)}
    </p>
  );
}

interface CartButtonProps {
  onClick: (e: React.MouseEvent) => void;
  disabled: boolean;
  isBouncing: boolean;
  ariaLabel: string;
}

function CartButton({ onClick, disabled, isBouncing, ariaLabel }: CartButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex-shrink-0 w-9 h-9 rounded-full bg-primary/12 text-primary shadow-sm flex items-center justify-center hover:bg-primary hover:text-white hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
        isBouncing ? 'animate-bounce-subtle' : ''
      }`}
      aria-label={ariaLabel}
    >
      <ShoppingCart className="w-4 h-4" strokeWidth={1.75} />
    </button>
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
  const addItem = useCartStore((s) => s.addItem);
  const addToast = useToast().addToast;
  const navigate = useNavigate();
  const bounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isBouncing, setIsBouncing] = useState(false);

  useEffect(
    () => () => {
      if (bounceTimeoutRef.current) clearTimeout(bounceTimeoutRef.current);
    },
    []
  );

  const isNew = isNewProduct(product.createdAt);
  const { discount } = applyCampaign(product.basePrice, campaigns, product.id, product.categoryId);
  const hasDiscount = discount > 0;
  const needsOptions = hasVariants(product);
  const inStock = product.inStock ?? true;

  const handleAddClick = useCallback(
    (e: React.MouseEvent) => {
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
    },
    [inStock, needsOptions, product, discount, navigate, addItem, tenantId, addToast]
  );

  const imageUrl = product.images?.[0]?.url ?? product.imageUrl ?? 'https://placehold.co/400x500?text=No+Image';

  return (
    <Link to={`/${tenantSlug}/p/${product.id}`} className="block group">
      <article
        className="bg-white rounded-2xl shadow-sm hover:shadow-md overflow-hidden transition-all duration-200"
        dir="rtl"
      >
        {/* Image */}
        <div className="aspect-[4/5] w-full bg-gray-100 relative overflow-hidden transition-shadow duration-300 group-hover:shadow-md">
          {!imageLoaded && (
            <Skeleton
              variant="rectangular"
              className="absolute inset-0 w-full h-full rounded-none"
            />
          )}
          <img
            src={imageUrl}
            alt={product.name}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageLoaded(true)}
            className={`w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105 ${
              !imageLoaded ? 'opacity-0' : 'opacity-100'
            }`}
          />
          {/* Badges - top-right (RTL) */}
          <div className="absolute top-2 end-2 flex flex-col gap-1.5">
            {isNew && (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                جديد
              </span>
            )}
            {hasDiscount && (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                خصم
              </span>
            )}
            {!inStock && (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-200/90 text-gray-600">
                نفد
              </span>
            )}
            {(product.isLastItems ||
              (product.quantity != null &&
                product.lowStockThreshold != null &&
                product.quantity <= product.lowStockThreshold)) &&
              inStock && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100/90 text-amber-800">
                  آخر {product.lastItemsCount ?? product.quantity ?? 0}
                </span>
              )}
          </div>
        </div>

        {/* Content */}
        <div className="p-3 flex flex-col gap-0.5">
          <h3 className="text-[15px] md:text-[16px] font-medium text-gray-900 line-clamp-2 leading-snug">
            {product.name}
          </h3>
          <div className="flex items-center justify-between gap-2">
            <ProductPrice product={product} campaigns={campaigns} />
            <CartButton
              onClick={handleAddClick}
              disabled={!inStock}
              isBouncing={isBouncing}
              ariaLabel={needsOptions ? 'عرض المنتج' : 'أضف للسلة'}
            />
          </div>
          {hasVariants(product) && (
            <p className="text-xs text-gray-500 mt-0.5">متوفر بعدة خيارات</p>
          )}
        </div>
      </article>
    </Link>
  );
}

export const ProductCard = memo(ProductCardInner);
