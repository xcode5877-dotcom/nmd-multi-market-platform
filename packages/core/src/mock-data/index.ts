import type { Tenant, Category, Product } from '../types';

export const mockTenants: Record<string, Tenant> = {
  default: {
    id: 'default',
    name: 'NMD Store',
    slug: 'default',
    branding: {
      logoUrl: '/logo.svg',
      primaryColor: '#0f766e',
      secondaryColor: '#d4a574',
      fontFamily: '"Cairo", system-ui, sans-serif',
      radiusScale: 1,
      layoutStyle: 'default',
    },
  },
  pizzeria: {
    id: 'pizzeria',
    name: 'NMD Pizzeria',
    slug: 'pizzeria',
    branding: {
      logoUrl: '/logo-pizza.svg',
      primaryColor: '#b91c1c',
      secondaryColor: '#fbbf24',
      fontFamily: '"Cairo", system-ui, sans-serif',
      radiusScale: 1.25,
      layoutStyle: 'default',
    },
  },
};

export const mockCategories: Record<string, Category[]> = {
  default: [
    { id: 'cat-1', tenantId: 'default', name: 'Appetizers', slug: 'appetizers', sortOrder: 0 },
    { id: 'cat-2', tenantId: 'default', name: 'Main Dishes', slug: 'main-dishes', sortOrder: 1 },
    { id: 'cat-3', tenantId: 'default', name: 'Beverages', slug: 'beverages', sortOrder: 2 },
  ],
  pizzeria: [
    { id: 'pcat-1', tenantId: 'pizzeria', name: 'Pizzas', slug: 'pizzas', sortOrder: 0 },
    { id: 'pcat-2', tenantId: 'pizzeria', name: 'Sides', slug: 'sides', sortOrder: 1 },
  ],
};

export const mockProducts: Record<string, Product[]> = {
  default: [
    {
      id: 'prod-1',
      tenantId: 'default',
      categoryId: 'cat-1',
      name: 'Hummus Bowl',
      slug: 'hummus-bowl',
      type: 'SIMPLE',
      basePrice: 15,
      currency: 'ILS',
      images: [{ id: 'img-1', url: 'https://placehold.co/400x300?text=Hummus', sortOrder: 0 }],
      optionGroups: [],
      isAvailable: true,
    },
    {
      id: 'prod-2',
      tenantId: 'default',
      categoryId: 'cat-2',
      name: 'Grilled Chicken',
      slug: 'grilled-chicken',
      type: 'CONFIGURABLE',
      basePrice: 45,
      currency: 'ILS',
      images: [{ id: 'img-2', url: 'https://placehold.co/400x300?text=Chicken', sortOrder: 0 }],
      optionGroups: [
        {
          id: 'og-1',
          name: 'Side',
          required: true,
          minSelected: 1,
          maxSelected: 1,
          selectionType: 'single',
          items: [
            { id: 'oi-1', name: 'Rice', priceModifier: 0, sortOrder: 0 },
            { id: 'oi-2', name: 'Fries', priceModifier: 3, sortOrder: 1 },
          ],
        },
      ],
      isAvailable: true,
    },
    {
      id: 'prod-3',
      tenantId: 'default',
      categoryId: 'cat-3',
      name: 'Fresh Juice',
      slug: 'fresh-juice',
      type: 'CONFIGURABLE',
      basePrice: 12,
      currency: 'ILS',
      images: [{ id: 'img-3', url: 'https://placehold.co/400x300?text=Juice', sortOrder: 0 }],
      optionGroups: [
        {
          id: 'og-2',
          name: 'Flavor',
          required: true,
          minSelected: 1,
          maxSelected: 1,
          selectionType: 'single',
          items: [
            { id: 'oi-3', name: 'Orange', priceModifier: 0, sortOrder: 0 },
            { id: 'oi-4', name: 'Mango', priceModifier: 2, sortOrder: 1 },
          ],
        },
      ],
      isAvailable: true,
    },
    {
      id: 'prod-4',
      tenantId: 'default',
      categoryId: 'cat-2',
      name: 'Last Items Burger',
      slug: 'last-items-burger',
      type: 'SIMPLE',
      basePrice: 35,
      currency: 'ILS',
      images: [{ id: 'img-4', url: 'https://placehold.co/400x300?text=Burger', sortOrder: 0 }],
      optionGroups: [],
      isAvailable: true,
      isLastItems: true,
      lastItemsCount: 3,
    },
  ],
  pizzeria: [
    {
      id: 'pprod-1',
      tenantId: 'pizzeria',
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
          required: false,
          minSelected: 0,
          maxSelected: 3,
          selectionType: 'multi',
          items: [
            { id: 'poi-3', name: 'Mushrooms', priceModifier: 5, sortOrder: 0 },
            { id: 'poi-4', name: 'Olives', priceModifier: 4, sortOrder: 1 },
          ],
        },
      ],
      isAvailable: true,
    },
  ],
};
