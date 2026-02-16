import type { Category, Product } from '@nmd/core';
import { getCatalog, setCatalog } from './catalog-store';

function seedTenantCatalog(tenantId: string, _slug: string, categories: Category[], products: Product[]): void {
  const existing = getCatalog(tenantId);
  if (existing.categories.length > 0 || existing.products.length > 0) return;

  const cats = categories.map((c) => ({ ...c, tenantId }));
  const prods = products.map((p) => ({ ...p, tenantId }));
  setCatalog(tenantId, { categories: cats, products: prods, optionGroups: existing.optionGroups ?? [], optionItems: existing.optionItems ?? [] });
}

const PIZZA_CATEGORIES: Category[] = [
  { id: 'pcat-1', tenantId: '', name: 'Pizzas', slug: 'pizzas', sortOrder: 0 },
  { id: 'pcat-2', tenantId: '', name: 'Sides', slug: 'sides', sortOrder: 1 },
];

const PIZZA_PRODUCTS: Product[] = [
  {
    id: 'pprod-1',
    tenantId: '',
    categoryId: 'pcat-1',
    name: 'Margherita Pizza',
    slug: 'margherita',
    type: 'PIZZA',
    basePrice: 55,
    currency: 'ILS',
    images: [{ id: 'pimg-1', url: 'https://placehold.co/400x300?text=Pizza', sortOrder: 0 }],
    optionGroups: [
      {
        id: 'pog-1',
        name: 'Size',
        type: 'SIZE',
        required: true,
        minSelected: 1,
        maxSelected: 1,
        selectionType: 'single',
        items: [
          { id: 'poi-1', name: 'Regular', priceModifier: 0, sortOrder: 0 },
          { id: 'poi-2', name: 'Large', priceModifier: 15, sortOrder: 1 },
        ],
      },
      {
        id: 'pog-2',
        name: 'Extra Toppings',
        type: 'CUSTOM',
        required: false,
        minSelected: 0,
        maxSelected: 3,
        selectionType: 'multi',
        allowHalfPlacement: true,
        items: [
          { id: 'poi-3', name: 'Mushrooms', priceModifier: 5, sortOrder: 0, placement: 'HALF' as const },
          { id: 'poi-4', name: 'Olives', priceModifier: 4, sortOrder: 1, placement: 'HALF' as const },
        ],
      },
    ],
    isAvailable: true,
  },
];

const GROCERIES_CATEGORIES: Category[] = [
  { id: 'gcat-1', tenantId: '', name: 'Fruits', slug: 'fruits', sortOrder: 0 },
  { id: 'gcat-2', tenantId: '', name: 'Vegetables', slug: 'vegetables', sortOrder: 1 },
];

const GROCERIES_PRODUCTS: Product[] = [
  {
    id: 'gprod-1',
    tenantId: '',
    categoryId: 'gcat-1',
    name: 'Fresh Apples',
    slug: 'fresh-apples',
    type: 'SIMPLE',
    basePrice: 12,
    currency: 'ILS',
    images: [{ id: 'gimg-1', url: 'https://placehold.co/400x300?text=Apples', sortOrder: 0 }],
    optionGroups: [],
    isAvailable: true,
  },
  {
    id: 'gprod-2',
    tenantId: '',
    categoryId: 'gcat-2',
    name: 'Organic Tomatoes',
    slug: 'organic-tomatoes',
    type: 'SIMPLE',
    basePrice: 8,
    currency: 'ILS',
    images: [{ id: 'gimg-2', url: 'https://placehold.co/400x300?text=Tomatoes', sortOrder: 0 }],
    optionGroups: [],
    isAvailable: true,
  },
];

const APPAREL_CATEGORIES: Category[] = [
  { id: 'acat-1', tenantId: '', name: 'T-Shirts', slug: 't-shirts', sortOrder: 0 },
  { id: 'acat-2', tenantId: '', name: 'Pants', slug: 'pants', sortOrder: 1 },
];

const APPAREL_PRODUCTS: Product[] = [
  {
    id: 'aprod-1',
    tenantId: '',
    categoryId: 'acat-1',
    name: 'Classic Tee',
    slug: 'classic-tee',
    type: 'APPAREL',
    basePrice: 89,
    currency: 'ILS',
    images: [{ id: 'aimg-1', url: 'https://placehold.co/400x300?text=Tee', sortOrder: 0 }],
    optionGroups: [
      {
        id: 'aog-1',
        name: 'Size',
        required: true,
        minSelected: 1,
        maxSelected: 1,
        selectionType: 'single',
        items: [
          { id: 'aoi-1', name: 'S', priceModifier: 0, sortOrder: 0 },
          { id: 'aoi-2', name: 'M', priceModifier: 0, sortOrder: 1 },
          { id: 'aoi-3', name: 'L', priceModifier: 0, sortOrder: 2 },
        ],
      },
    ],
    isAvailable: true,
  },
];

export function seedCatalogForTenants(): void {
  const tenants = JSON.parse(localStorage.getItem('nmd.tenants') ?? '[]') as { id: string; slug: string }[];
  for (const t of tenants) {
    if (t.slug === 'pizza' || t.slug === 'buffalo28') {
      seedTenantCatalog(t.id, t.slug, PIZZA_CATEGORIES, PIZZA_PRODUCTS);
    } else if (t.slug === 'groceries') {
      seedTenantCatalog(t.id, t.slug, GROCERIES_CATEGORIES, GROCERIES_PRODUCTS);
    } else if (t.slug === 'apparel') {
      seedTenantCatalog(t.id, t.slug, APPAREL_CATEGORIES, APPAREL_PRODUCTS);
    }
  }
}
