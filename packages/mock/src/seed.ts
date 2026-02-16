import type { RegistryTenant } from './types';

const DEMO_TENANTS: Omit<RegistryTenant, 'id' | 'createdAt'>[] = [
  {
    slug: 'buffalo28',
    name: 'Buffalo28 Pizza',
    logoUrl: '/logo-pizza.svg',
    primaryColor: '#b91c1c',
    secondaryColor: '#fbbf24',
    fontFamily: '"Cairo", system-ui, sans-serif',
    radiusScale: 1.25,
    layoutStyle: 'default',
    enabled: true,
    type: 'FOOD',
  },
  {
    slug: 'ms-brands',
    name: 'MS Brands',
    logoUrl: '/logo.svg',
    primaryColor: '#059669',
    secondaryColor: '#d4a574',
    fontFamily: '"Cairo", system-ui, sans-serif',
    radiusScale: 1,
    layoutStyle: 'default',
    enabled: true,
  },
  {
    slug: 'pizza',
    name: 'NMD Pizzeria',
    logoUrl: '/logo-pizza.svg',
    primaryColor: '#b91c1c',
    secondaryColor: '#fbbf24',
    fontFamily: '"Cairo", system-ui, sans-serif',
    radiusScale: 1.25,
    layoutStyle: 'default',
    enabled: true,
    type: 'FOOD',
  },
  {
    slug: 'groceries',
    name: 'NMD Groceries',
    logoUrl: '/logo.svg',
    primaryColor: '#059669',
    secondaryColor: '#d4a574',
    fontFamily: '"Cairo", system-ui, sans-serif',
    radiusScale: 1,
    layoutStyle: 'default',
    enabled: true,
  },
  {
    slug: 'apparel',
    name: 'NMD Apparel',
    logoUrl: '/logo.svg',
    primaryColor: '#7c3aed',
    secondaryColor: '#a78bfa',
    fontFamily: '"Cairo", system-ui, sans-serif',
    radiusScale: 1,
    layoutStyle: 'default',
    enabled: true,
  },
];

export function seedTenants(): void {
  const existing = loadTenants();
  if (existing.length > 0) return;

  const created = new Date().toISOString();
  const tenants: RegistryTenant[] = DEMO_TENANTS.map((t, i) => ({
    ...t,
    id: `tenant-${i + 1}`,
    createdAt: created,
  }));
  localStorage.setItem('nmd.tenants', JSON.stringify(tenants));
}

function loadTenants(): RegistryTenant[] {
  try {
    const raw = localStorage.getItem('nmd.tenants');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
