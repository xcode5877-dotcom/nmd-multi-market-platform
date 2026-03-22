/**
 * Seed script: loads data from data.json (and orders from packages/mock/data) into the database.
 *
 * Default data file: apps/mock-api/data/data.json (override with DATA_FILE).
 * Requires DATABASE_URL for Prisma. Run after: npx prisma db push
 *
 * Image linking: logoUrl and product imageUrl in JSON are stored as-is. Ensure files in
 * apps/mock-api/data/uploads match the filenames in those URLs (e.g. .../uploads/X.jpg → data/uploads/X.jpg).
 *
 * Initial admin: root@nmd.com / 123456. Reset: pnpm run reset-root-password
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOCK_API_ROOT = join(__dirname, '..');
const DATA_FILE = process.env.DATA_FILE || join(MOCK_API_ROOT, 'data', 'data.json');
const ORDERS_FILE = process.env.ORDERS_FILE || join(MOCK_API_ROOT, '..', '..', 'packages', 'mock', 'data', 'orders.json');

function loadJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    const raw = readFileSync(path, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function seed() {
  const data = loadJson<{
    markets?: Record<string, unknown>[];
    tenants?: Record<string, unknown>[];
    users?: Record<string, unknown>[];
    couriers?: Record<string, unknown>[];
    customers?: Record<string, unknown>[];
    catalog?: Record<string, { categories?: unknown[]; products?: unknown[]; optionGroups?: unknown[]; optionItems?: unknown[] }>;
    delivery?: Record<string, Record<string, unknown>>;
    deliveryZones?: Record<string, { id: string; tenantId: string; name: string; fee: number; etaMinutes?: number; minimumOrder?: number; isActive?: boolean; sortOrder?: number }[]>;
  }>(DATA_FILE, {});

  const orders = loadJson<Record<string, unknown>[]>(ORDERS_FILE, []);

  // 1. Markets (upsert by id)
  for (const m of data.markets ?? []) {
    const id = String(m.id ?? '');
    if (!id) continue;
    await prisma.market.upsert({
      where: { id },
      create: {
        id,
        name: String(m.name ?? ''),
        slug: String(m.slug ?? id),
        branding: m.branding ? JSON.stringify(m.branding) : null,
        isActive: (m.isActive as boolean) ?? true,
        sortOrder: typeof m.sortOrder === 'number' ? m.sortOrder : null,
        paymentCapabilities: m.paymentCapabilities ? JSON.stringify(m.paymentCapabilities) : null,
      },
      update: {
        name: String(m.name ?? ''),
        slug: String(m.slug ?? id),
        branding: m.branding ? JSON.stringify(m.branding) : null,
        isActive: (m.isActive as boolean) ?? true,
        sortOrder: typeof m.sortOrder === 'number' ? m.sortOrder : null,
        paymentCapabilities: m.paymentCapabilities ? JSON.stringify(m.paymentCapabilities) : null,
      },
    });
  }

  // 2. Tenants (upsert by id)
  for (const t of data.tenants ?? []) {
    const id = String(t.id ?? '');
    if (!id) continue;
    await prisma.tenant.upsert({
      where: { id },
      create: {
        id,
        slug: String(t.slug ?? id),
        name: String(t.name ?? ''),
        logoUrl: String(t.logoUrl ?? ''),
        primaryColor: String(t.primaryColor ?? '#000'),
        secondaryColor: String(t.secondaryColor ?? '#fff'),
        fontFamily: String(t.fontFamily ?? 'inherit'),
        radiusScale: Number(t.radiusScale ?? 1),
        layoutStyle: String(t.layoutStyle ?? 'default'),
        enabled: typeof t.isActive === 'boolean' ? t.isActive : (t.enabled as boolean) ?? true,
        createdAt: String(t.createdAt ?? new Date().toISOString()),
        templateId: t.templateId != null ? String(t.templateId) : null,
        hero: t.hero ? JSON.stringify(t.hero) : null,
        banners: t.banners ? JSON.stringify(t.banners) : null,
        whatsappPhone: t.whatsappPhone != null ? String(t.whatsappPhone) : null,
        type: t.type != null ? String(t.type) : null,
        businessType: t.businessType != null ? String(t.businessType) : ((t.type as string) === 'FOOD' ? 'RESTAURANT' : 'RETAIL'),
        marketCategory: t.marketCategory != null ? String(t.marketCategory) : null,
        marketId: t.marketId != null ? String(t.marketId) : null,
        addressLine: t.addressLine != null ? String(t.addressLine) : null,
        location: t.location != null ? JSON.stringify(t.location) : null,
        meta: t._meta != null ? JSON.stringify(t._meta) : null,
        isListedInMarket: typeof t.isListedInMarket === 'boolean' ? t.isListedInMarket : null,
        marketSortOrder: typeof t.marketSortOrder === 'number' ? t.marketSortOrder : null,
        tenantType: t.tenantType != null ? String(t.tenantType) : null,
        deliveryProviderMode: t.deliveryProviderMode != null ? String(t.deliveryProviderMode) : null,
        allowMarketCourierFallback:
          typeof t.allowMarketCourierFallback === 'boolean' ? t.allowMarketCourierFallback : null,
        defaultPrepTimeMin: typeof t.defaultPrepTimeMin === 'number' ? t.defaultPrepTimeMin : null,
        financialConfig: t.financialConfig ? JSON.stringify(t.financialConfig) : null,
        paymentCapabilities: t.paymentCapabilities ? JSON.stringify(t.paymentCapabilities) : null,
        operationalStatus: t.operationalStatus != null ? String(t.operationalStatus) : null,
        orderPolicy: t.orderPolicy != null ? String(t.orderPolicy) : null,
        businessHours: t.businessHours != null ? JSON.stringify(t.businessHours) : null,
        busyBannerEnabled: typeof t.busyBannerEnabled === 'boolean' ? t.busyBannerEnabled : null,
        busyBannerText: t.busyBannerText != null ? String(t.busyBannerText) : null,
        openTime: t.openTime != null ? String(t.openTime) : null,
        closeTime: t.closeTime != null ? String(t.closeTime) : null,
        phone: t.phone != null ? String(t.phone) : null,
        pillarId: t.pillarId != null ? String(t.pillarId) : null,
        subCategoryId: t.subCategoryId != null ? String(t.subCategoryId) : null,
      },
      update: {
        slug: String(t.slug ?? id),
        name: String(t.name ?? ''),
        logoUrl: String(t.logoUrl ?? ''),
        primaryColor: String(t.primaryColor ?? '#000'),
        secondaryColor: String(t.secondaryColor ?? '#fff'),
        fontFamily: String(t.fontFamily ?? 'inherit'),
        radiusScale: Number(t.radiusScale ?? 1),
        layoutStyle: String(t.layoutStyle ?? 'default'),
        enabled: typeof t.isActive === 'boolean' ? t.isActive : (t.enabled as boolean) ?? true,
        createdAt: String(t.createdAt ?? new Date().toISOString()),
        templateId: t.templateId != null ? String(t.templateId) : null,
        hero: t.hero ? JSON.stringify(t.hero) : null,
        banners: t.banners ? JSON.stringify(t.banners) : null,
        whatsappPhone: t.whatsappPhone != null ? String(t.whatsappPhone) : null,
        type: t.type != null ? String(t.type) : null,
        businessType: t.businessType != null ? String(t.businessType) : ((t.type as string) === 'FOOD' ? 'RESTAURANT' : 'RETAIL'),
        marketCategory: t.marketCategory != null ? String(t.marketCategory) : null,
        marketId: t.marketId != null ? String(t.marketId) : null,
        addressLine: t.addressLine != null ? String(t.addressLine) : null,
        location: t.location != null ? JSON.stringify(t.location) : null,
        meta: t._meta != null ? JSON.stringify(t._meta) : null,
        isListedInMarket: typeof t.isListedInMarket === 'boolean' ? t.isListedInMarket : null,
        marketSortOrder: typeof t.marketSortOrder === 'number' ? t.marketSortOrder : null,
        tenantType: t.tenantType != null ? String(t.tenantType) : null,
        deliveryProviderMode: t.deliveryProviderMode != null ? String(t.deliveryProviderMode) : null,
        allowMarketCourierFallback:
          typeof t.allowMarketCourierFallback === 'boolean' ? t.allowMarketCourierFallback : null,
        defaultPrepTimeMin: typeof t.defaultPrepTimeMin === 'number' ? t.defaultPrepTimeMin : null,
        financialConfig: t.financialConfig ? JSON.stringify(t.financialConfig) : null,
        paymentCapabilities: t.paymentCapabilities ? JSON.stringify(t.paymentCapabilities) : null,
        operationalStatus: t.operationalStatus != null ? String(t.operationalStatus) : null,
        orderPolicy: t.orderPolicy != null ? String(t.orderPolicy) : null,
        businessHours: t.businessHours != null ? JSON.stringify(t.businessHours) : null,
        busyBannerEnabled: typeof t.busyBannerEnabled === 'boolean' ? t.busyBannerEnabled : null,
        busyBannerText: t.busyBannerText != null ? String(t.busyBannerText) : null,
        openTime: t.openTime != null ? String(t.openTime) : null,
        closeTime: t.closeTime != null ? String(t.closeTime) : null,
        phone: t.phone != null ? String(t.phone) : null,
        pillarId: t.pillarId != null ? String(t.pillarId) : null,
        subCategoryId: t.subCategoryId != null ? String(t.subCategoryId) : null,
      },
    });
  }

  // 3. Users (upsert by id)
  for (const u of data.users ?? []) {
    const id = String(u.id ?? '');
    if (!id) continue;
    await prisma.user.upsert({
      where: { id },
      create: {
        id,
        email: String(u.email ?? ''),
        role: String(u.role ?? ''),
        marketId: u.marketId != null ? String(u.marketId) : null,
        tenantId: u.tenantId != null ? String(u.tenantId) : null,
        courierId: u.courierId != null ? String(u.courierId) : null,
        password: u.password != null ? String(u.password) : null,
        mustChangePassword: typeof u.mustChangePassword === 'boolean' ? u.mustChangePassword : null,
      },
      update: {
        email: String(u.email ?? ''),
        role: String(u.role ?? ''),
        marketId: u.marketId != null ? String(u.marketId) : null,
        tenantId: u.tenantId != null ? String(u.tenantId) : null,
        courierId: u.courierId != null ? String(u.courierId) : null,
        password: u.password != null ? String(u.password) : null,
        mustChangePassword: typeof u.mustChangePassword === 'boolean' ? u.mustChangePassword : null,
      },
    });
  }

  // 4. Couriers (upsert by id)
  for (const c of data.couriers ?? []) {
    const id = String(c.id ?? '');
    if (!id) continue;
    await prisma.courier.upsert({
      where: { id },
      create: {
        id,
        scopeType: String(c.scopeType ?? 'MARKET'),
        scopeId: String(c.scopeId ?? ''),
        marketId: c.marketId != null ? String(c.marketId) : null,
        name: String(c.name ?? ''),
        phone: c.phone != null ? String(c.phone) : null,
        isActive: (c.isActive as boolean) ?? true,
        isOnline: (c.isOnline as boolean) ?? false,
        capacity: typeof c.capacity === 'number' ? c.capacity : 1,
        isAvailable: typeof c.isAvailable === 'boolean' ? c.isAvailable : null,
        deliveryCount: typeof c.deliveryCount === 'number' ? c.deliveryCount : null,
      },
      update: {
        scopeType: String(c.scopeType ?? 'MARKET'),
        scopeId: String(c.scopeId ?? ''),
        marketId: c.marketId != null ? String(c.marketId) : null,
        name: String(c.name ?? ''),
        phone: c.phone != null ? String(c.phone) : null,
        isActive: (c.isActive as boolean) ?? true,
        isOnline: (c.isOnline as boolean) ?? false,
        capacity: typeof c.capacity === 'number' ? c.capacity : 1,
        isAvailable: typeof c.isAvailable === 'boolean' ? c.isAvailable : null,
        deliveryCount: typeof c.deliveryCount === 'number' ? c.deliveryCount : null,
      },
    });
  }

  // 5. Customers (replace from data.json - delete first for idempotent seed)
  await prisma.customer.deleteMany();
  for (const c of data.customers ?? []) {
    const id = String(c.id ?? '');
    const phone = String(c.phone ?? '').trim();
    if (!id || !phone) continue;
    await prisma.customer.create({
      data: {
        id,
        phone,
        name: c.name != null ? String(c.name) : null,
        createdAt: String(c.createdAt ?? new Date().toISOString()),
      },
    });
  }

  // 6. Orders (replace from file - delete then upsert for idempotent seed)
  await prisma.order.deleteMany();
  const orderCols = new Set(['id', 'tenantId', 'courierId', 'marketId', 'status', 'fulfillmentType', 'orderType', 'total', 'createdAt', 'payment', 'deliveryTimeline']);
  for (const o of orders) {
    const id = String(o.id ?? '');
    if (!id) continue;
    const payload = Object.fromEntries(
      Object.entries(o).filter(([k]) => !orderCols.has(k))
    );
    await prisma.order.upsert({
      where: { id },
      create: {
        id,
        tenantId: o.tenantId != null ? String(o.tenantId) : null,
        courierId: o.courierId != null ? String(o.courierId) : null,
        marketId: o.marketId != null ? String(o.marketId) : null,
        status: o.status != null ? String(o.status) : null,
        fulfillmentType: o.fulfillmentType != null ? String(o.fulfillmentType) : null,
        orderType: (o.orderType as string) ?? 'PRODUCT',
        total: typeof o.total === 'number' ? o.total : null,
        createdAt: o.createdAt != null ? String(o.createdAt) : null,
        payment: o.payment != null ? JSON.stringify(o.payment) : null,
        deliveryTimeline: o.deliveryTimeline != null ? JSON.stringify(o.deliveryTimeline) : null,
        payload: Object.keys(payload).length > 0 ? JSON.stringify(payload) : null,
      },
      update: {
        tenantId: o.tenantId != null ? String(o.tenantId) : null,
        courierId: o.courierId != null ? String(o.courierId) : null,
        marketId: o.marketId != null ? String(o.marketId) : null,
        status: o.status != null ? String(o.status) : null,
        fulfillmentType: o.fulfillmentType != null ? String(o.fulfillmentType) : null,
        orderType: (o.orderType as string) ?? 'PRODUCT',
        total: typeof o.total === 'number' ? o.total : null,
        createdAt: o.createdAt != null ? String(o.createdAt) : null,
        payment: o.payment != null ? JSON.stringify(o.payment) : null,
        deliveryTimeline: o.deliveryTimeline != null ? JSON.stringify(o.deliveryTimeline) : null,
        payload: Object.keys(payload).length > 0 ? JSON.stringify(payload) : null,
      },
    });
  }

  // 6b. Payment backfill: for each Order without Payment, create CASH/PENDING row (idempotent upsert)
  const allOrders = await prisma.order.findMany({ select: { id: true, total: true, payment: true } });
  const now = new Date().toISOString();
  for (const o of allOrders) {
    const pay = o.payment ? (JSON.parse(o.payment) as { method?: string; status?: string }) : null;
    const method = pay?.method === 'CARD' ? 'CARD' : 'CASH';
    const status = pay?.status === 'COLLECTED' ? 'COLLECTED' : 'PENDING';
    const amount = o.total ?? 0;
    await prisma.payment.upsert({
      where: { id: `pay-${o.id}` },
      create: {
        id: `pay-${o.id}`,
        orderId: o.id,
        method,
        status,
        amount,
        currency: 'ILS',
        provider: null,
        providerRef: null,
        createdAt: now,
        updatedAt: now,
      },
      update: {
        status,
        amount,
        updatedAt: now,
      },
    });
  }

  // 7. Catalog (upsert from data.json - idempotent, supports multiple tenants)
  // Stable keys: id (UUID) for categories, products, optionGroups
  const catalogData = data.catalog ?? {};
  for (const [tenantId, cat] of Object.entries(catalogData)) {
    const cats = (cat.categories ?? []) as { id?: string; name?: string; slug?: string; description?: string; imageUrl?: string; sortOrder?: number; parentId?: string | null; isVisible?: boolean }[];
    const prods = (cat.products ?? []) as { id?: string; categoryId?: string; name?: string; slug?: string; description?: string; type?: string; basePrice?: number; currency?: string; imageUrl?: string; images?: unknown; optionGroups?: unknown; variants?: unknown; stock?: number; isAvailable?: boolean; inStock?: boolean; createdAt?: string; isFeatured?: boolean; isArchived?: boolean; sortOrder?: number }[];
    const grps = (cat.optionGroups ?? []) as { id?: string; name?: string; type?: string; required?: boolean; minSelected?: number; maxSelected?: number; selectionType?: string; scope?: string; scopeId?: string; allowHalfPlacement?: boolean; items?: unknown[] }[];
    for (const c of cats) {
      if (c.id) {
        await prisma.catalogCategory.upsert({
          where: { id: c.id },
          create: {
            id: c.id,
            tenantId,
            name: c.name ?? '',
            slug: c.slug ?? '',
            description: c.description ?? null,
            imageUrl: c.imageUrl ?? null,
            sortOrder: c.sortOrder ?? 0,
            parentId: c.parentId ?? null,
            isVisible: c.isVisible ?? true,
          },
          update: {
            tenantId,
            name: c.name ?? '',
            slug: c.slug ?? '',
            description: c.description ?? null,
            imageUrl: c.imageUrl ?? null,
            sortOrder: c.sortOrder ?? 0,
            parentId: c.parentId ?? null,
            isVisible: c.isVisible ?? true,
          },
        });
      }
    }
    for (const p of prods) {
      if (p.id) {
        await prisma.catalogProduct.upsert({
          where: { id: p.id },
          create: {
            id: p.id,
            tenantId,
            categoryId: p.categoryId ?? '',
            name: p.name ?? '',
            slug: p.slug ?? '',
            description: p.description ?? null,
            type: p.type ?? 'SIMPLE',
            basePrice: p.basePrice ?? 0,
            currency: p.currency ?? 'ILS',
            imageUrl: p.imageUrl ?? null,
            images: p.images != null ? JSON.stringify(p.images) : null,
            optionGroups: p.optionGroups != null ? JSON.stringify(p.optionGroups) : null,
            variants: p.variants != null ? JSON.stringify(p.variants) : null,
            stock: p.stock ?? null,
            isAvailable: typeof p.inStock === 'boolean' ? p.inStock : (p.isAvailable ?? true),
            createdAt: p.createdAt ?? null,
            isFeatured: p.isFeatured ?? null,
            isArchived: typeof p.isArchived === 'boolean' ? p.isArchived : null,
            sortOrder: typeof p.sortOrder === 'number' ? p.sortOrder : null,
          },
          update: {
            tenantId,
            categoryId: p.categoryId ?? '',
            name: p.name ?? '',
            slug: p.slug ?? '',
            description: p.description ?? null,
            type: p.type ?? 'SIMPLE',
            basePrice: p.basePrice ?? 0,
            currency: p.currency ?? 'ILS',
            imageUrl: p.imageUrl ?? null,
            images: p.images != null ? JSON.stringify(p.images) : null,
            optionGroups: p.optionGroups != null ? JSON.stringify(p.optionGroups) : null,
            variants: p.variants != null ? JSON.stringify(p.variants) : null,
            stock: p.stock ?? null,
            isAvailable: typeof p.inStock === 'boolean' ? p.inStock : (p.isAvailable ?? true),
            createdAt: p.createdAt ?? null,
            isFeatured: p.isFeatured ?? null,
            isArchived: typeof p.isArchived === 'boolean' ? p.isArchived : null,
            sortOrder: typeof p.sortOrder === 'number' ? p.sortOrder : null,
          },
        });
      }
    }
    for (const g of grps) {
      if (g.id) {
        await prisma.catalogOptionGroup.upsert({
          where: { id: g.id },
          create: {
            id: g.id,
            tenantId,
            name: g.name ?? '',
            type: g.type ?? null,
            required: g.required ?? false,
            minSelected: g.minSelected ?? 0,
            maxSelected: g.maxSelected ?? 1,
            selectionType: g.selectionType ?? 'single',
            scope: g.scope ?? null,
            scopeId: g.scopeId ?? null,
            allowHalfPlacement: g.allowHalfPlacement ?? null,
            items: g.items != null ? JSON.stringify(g.items) : null,
          },
          update: {
            tenantId,
            name: g.name ?? '',
            type: g.type ?? null,
            required: g.required ?? false,
            minSelected: g.minSelected ?? 0,
            maxSelected: g.maxSelected ?? 1,
            selectionType: g.selectionType ?? 'single',
            scope: g.scope ?? null,
            scopeId: g.scopeId ?? null,
            allowHalfPlacement: g.allowHalfPlacement ?? null,
            items: g.items != null ? JSON.stringify(g.items) : null,
          },
        });
      }
    }
  }

  // 8. Delivery settings (tenant-scoped)
  const deliveryData = data.delivery ?? {};
  for (const [tenantId, settings] of Object.entries(deliveryData)) {
    if (!tenantId) continue;
    const s = settings as Record<string, unknown>;
    const modes = s.modes ?? { pickup: true, delivery: true };
    const minimumOrder = typeof s.minimumOrder === 'number' ? s.minimumOrder : 0;
    const deliveryFee = typeof s.deliveryFee === 'number' ? s.deliveryFee : 0;
    const payload = Object.fromEntries(Object.entries(s).filter(([k]) => !['modes', 'minimumOrder', 'deliveryFee', 'tenantId'].includes(k)));
    const payloadStr = Object.keys(payload).length > 0 ? JSON.stringify(payload) : null;
    await prisma.tenantDeliverySettings.upsert({
      where: { tenantId },
      create: {
        tenantId,
        modes: JSON.stringify(modes),
        minimumOrder,
        deliveryFee,
        payload: payloadStr,
      },
      update: {
        modes: JSON.stringify(modes),
        minimumOrder,
        deliveryFee,
        payload: payloadStr,
      },
    });
  }

  // 9. Delivery zones (tenant-scoped, idempotent upsert)
  const zonesData = data.deliveryZones ?? {};
  for (const [tenantId, zones] of Object.entries(zonesData)) {
    if (!tenantId || !Array.isArray(zones)) continue;
    for (const z of zones) {
      if (!z.id) continue;
      await prisma.deliveryZone.upsert({
        where: { id: z.id },
        create: {
          id: z.id,
          tenantId,
          name: z.name ?? '',
          fee: z.fee ?? 0,
          etaMinutes: z.etaMinutes ?? null,
          minimumOrder: typeof z.minimumOrder === 'number' ? z.minimumOrder : null,
          geo: null,
          isActive: z.isActive ?? true,
          sortOrder: z.sortOrder ?? null,
        },
        update: {
          tenantId,
          name: z.name ?? '',
          fee: z.fee ?? 0,
          etaMinutes: z.etaMinutes ?? null,
          minimumOrder: typeof z.minimumOrder === 'number' ? z.minimumOrder : null,
          geo: null,
          isActive: z.isActive ?? true,
          sortOrder: z.sortOrder ?? null,
        },
      });
    }
  }

  // 10. Ensure a "default" tenant exists (storefront fallback for delivery zones and policies)
  const defaultId = 'default';
  await prisma.tenant.upsert({
    where: { id: defaultId },
    create: {
      id: defaultId,
      slug: 'default',
      name: 'المتجر الافتراضي',
      logoUrl: '',
      primaryColor: '#000000',
      secondaryColor: '#ffffff',
      fontFamily: 'inherit',
      radiusScale: 1,
      layoutStyle: 'default',
      enabled: true,
      createdAt: new Date().toISOString(),
    },
    update: {},
  });
  await prisma.tenantDeliverySettings.upsert({
    where: { tenantId: defaultId },
    create: {
      tenantId: defaultId,
      modes: JSON.stringify({ pickup: true, delivery: true }),
      minimumOrder: 0,
      deliveryFee: 0,
      payload: null,
    },
    update: {},
  });
  const defaultZoneId = 'default-zone';
  await prisma.deliveryZone.upsert({
    where: { id: defaultZoneId },
    create: {
      id: defaultZoneId,
      tenantId: defaultId,
      name: 'المنطقة الافتراضية',
      fee: 0,
      etaMinutes: 30,
      minimumOrder: 0,
      isActive: true,
      sortOrder: 0,
    },
    update: {},
  });

  console.log('Seed complete: markets, tenants, users, couriers, customers, orders, payments, catalog, delivery, deliveryZones, default tenant');
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
