export type ProductType = 'SIMPLE' | 'CONFIGURABLE' | 'PIZZA' | 'APPAREL';

export type OptionSelectionType = 'single' | 'multi';

export type OptionScope = 'PRODUCT' | 'CATEGORY' | 'GLOBAL';

export type OptionGroupType = 'SIZE' | 'COLOR' | 'CUSTOM';

export interface VariantOptionValue {
  groupId: string;
  optionId: string;
}

export interface ProductVariant {
  id: string;
  optionValues: VariantOptionValue[];
  stock: number;
  priceOverride?: number;
}

export interface ProductImage {
  id: string;
  url: string;
  alt?: string;
  sortOrder: number;
}

export type OptionPlacement = 'WHOLE' | 'HALF';

export interface OptionItem {
  id: string;
  groupId?: string;
  name: string;
  /** @deprecated use priceDelta */
  priceModifier?: number;
  priceDelta?: number;
  sortOrder: number;
  enabled?: boolean;
  defaultSelected?: boolean;
  /** When "HALF", storefront shows placement control (يمين/يسار/كامل). Placement does not affect price. */
  placement?: OptionPlacement;
}

export interface OptionGroup {
  id: string;
  tenantId?: string;
  name: string;
  /** SIZE | COLOR | CUSTOM for variant UI (swatches vs pills) */
  type?: OptionGroupType;
  required: boolean;
  minSelected: number;
  maxSelected: number;
  selectionType: OptionSelectionType;
  scope?: OptionScope;
  scopeId?: string;
  items: OptionItem[];
  /** When true, each selected option shows placement control (يمين/يسار/كامل). Pizza add-ons. */
  allowHalfPlacement?: boolean;
}

export type PizzaSliceSelection = 'WHOLE' | 'LEFT' | 'RIGHT';

export interface PizzaOptionSelection {
  optionGroupId: string;
  sliceSelection: PizzaSliceSelection;
  selectedItemIds: string[];
}

export interface Product {
  id: string;
  tenantId: string;
  categoryId: string;
  name: string;
  slug: string;
  description?: string;
  type: ProductType;
  basePrice: number;
  currency: string;
  /** Legacy: single image URL; auto-set from images[0] when images exist */
  imageUrl?: string;
  /** Multi-image gallery; when saving, imageUrl = images[0].url if images has ≥1 item */
  images?: ProductImage[];
  optionGroups: OptionGroup[];
  /** Auto-generated variants (cartesian product of option groups); stock/priceOverride per variant */
  variants?: ProductVariant[];
  stock?: number;
  isAvailable: boolean;
  inStock?: boolean;
  quantity?: number;
  lowStockThreshold?: number;
  isLastItems?: boolean;
  lastItemsCount?: number;
  /** ISO date string - for "وصل حديثًا" sorting and "جديد" badge */
  createdAt?: string;
  /** Show in "مختارات" section on homepage */
  isFeatured?: boolean;
}
