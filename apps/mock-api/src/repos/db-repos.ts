import { PrismaClient } from '@prisma/client';
import type { Market, RegistryTenant, User, Courier, Customer } from '../store.js';
import type { TenantCatalog } from '../store.js';
import type { OrderRecord } from './types.js';
import type { MarketsRepo, TenantsRepo, UsersRepo, CouriersRepo, CustomersRepo, OrdersRepo, CatalogRepo, DeliveryRepo, DeliveryZonesRepo, PaymentsRepo } from './types.js';
import type { DeliveryZoneRecord } from '../store.js';

const prisma = new PrismaClient();

function marketToDomain(m: { id: string; name: string; slug: string; branding: string | null; isActive: boolean; sortOrder: number | null; paymentCapabilities: string | null }): Market {
  return {
    id: m.id,
    name: m.name,
    slug: m.slug,
    branding: m.branding ? (JSON.parse(m.branding) as Market['branding']) : undefined,
    isActive: m.isActive,
    sortOrder: m.sortOrder ?? undefined,
    paymentCapabilities: m.paymentCapabilities ? (JSON.parse(m.paymentCapabilities) as Market['paymentCapabilities']) : undefined,
  };
}

function tenantToDomain(t: {
  id: string; slug: string; name: string; logoUrl: string; primaryColor: string; secondaryColor: string;
  fontFamily: string; radiusScale: number; layoutStyle: string; enabled: boolean; createdAt: string;
  templateId: string | null; hero: string | null; banners: string | null; whatsappPhone: string | null;
  type: string | null; businessType: string | null; marketCategory: string | null; marketId: string | null;
  isListedInMarket: boolean | null; marketSortOrder: number | null; tenantType: string | null;
  deliveryProviderMode: string | null; allowMarketCourierFallback: boolean | null; defaultPrepTimeMin: number | null;
  financialConfig: string | null; paymentCapabilities: string | null;
}): RegistryTenant {
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    logoUrl: t.logoUrl,
    primaryColor: t.primaryColor,
    secondaryColor: t.secondaryColor,
    fontFamily: t.fontFamily,
    radiusScale: t.radiusScale,
    layoutStyle: t.layoutStyle as RegistryTenant['layoutStyle'],
    enabled: t.enabled,
    createdAt: t.createdAt,
    templateId: t.templateId ?? undefined,
    hero: t.hero ? (JSON.parse(t.hero) as RegistryTenant['hero']) : undefined,
    banners: t.banners ? (JSON.parse(t.banners) as RegistryTenant['banners']) : undefined,
    whatsappPhone: t.whatsappPhone ?? undefined,
    type: (t.type as RegistryTenant['type']) ?? undefined,
    businessType: (t.businessType as RegistryTenant['businessType']) ?? undefined,
    marketCategory: (t.marketCategory as RegistryTenant['marketCategory']) ?? undefined,
    marketId: t.marketId ?? undefined,
    isListedInMarket: t.isListedInMarket ?? undefined,
    marketSortOrder: t.marketSortOrder ?? undefined,
    tenantType: (t.tenantType as RegistryTenant['tenantType']) ?? undefined,
    deliveryProviderMode: (t.deliveryProviderMode as RegistryTenant['deliveryProviderMode']) ?? undefined,
    allowMarketCourierFallback: t.allowMarketCourierFallback ?? undefined,
    defaultPrepTimeMin: t.defaultPrepTimeMin ?? undefined,
    financialConfig: t.financialConfig ? (JSON.parse(t.financialConfig) as RegistryTenant['financialConfig']) : undefined,
    paymentCapabilities: t.paymentCapabilities ? (JSON.parse(t.paymentCapabilities) as RegistryTenant['paymentCapabilities']) : undefined,
  };
}

function orderToDomain(o: {
  id: string; tenantId: string | null; courierId: string | null; marketId: string | null;
  status: string | null; fulfillmentType: string | null; orderType: string | null; total: number | null;
  createdAt: string | null; payment: string | null; deliveryTimeline: string | null; payload: string | null;
}): OrderRecord {
  const base: OrderRecord = {
    id: o.id,
    tenantId: o.tenantId ?? undefined,
    courierId: o.courierId ?? undefined,
    marketId: o.marketId ?? undefined,
    status: o.status ?? undefined,
    fulfillmentType: o.fulfillmentType ?? undefined,
    orderType: o.orderType ?? 'PRODUCT',
    total: o.total ?? undefined,
    createdAt: o.createdAt ?? undefined,
  };
  if (o.payment) (base as Record<string, unknown>).payment = JSON.parse(o.payment);
  if (o.deliveryTimeline) (base as Record<string, unknown>).deliveryTimeline = JSON.parse(o.deliveryTimeline);
  if (o.payload) {
    const payload = JSON.parse(o.payload) as Record<string, unknown>;
    Object.assign(base, payload);
  }
  return base;
}

function orderToDb(order: OrderRecord): {
  id: string; tenantId: string | null; courierId: string | null; marketId: string | null;
  status: string | null; fulfillmentType: string | null; orderType: string | null; total: number | null;
  createdAt: string | null; payment: string | null; deliveryTimeline: string | null; payload: string | null;
} {
  const { id, tenantId, courierId, marketId, status, fulfillmentType, orderType, total, createdAt, payment, deliveryTimeline, ...rest } = order;
  return {
    id: String(id ?? ''),
    tenantId: tenantId != null ? String(tenantId) : null,
    courierId: courierId != null ? String(courierId) : null,
    marketId: marketId != null ? String(marketId) : null,
    status: status != null ? String(status) : null,
    fulfillmentType: fulfillmentType != null ? String(fulfillmentType) : null,
    orderType: orderType != null ? String(orderType) : 'PRODUCT',
    total: typeof total === 'number' ? total : null,
    createdAt: createdAt != null ? String(createdAt) : null,
    payment: payment != null ? JSON.stringify(payment) : null,
    deliveryTimeline: deliveryTimeline != null ? JSON.stringify(deliveryTimeline) : null,
    payload: Object.keys(rest).length > 0 ? JSON.stringify(rest) : null,
  };
}

export function createDbMarketsRepo(): MarketsRepo {
  return {
    async findAll() {
      const rows = await prisma.market.findMany();
      return rows.map(marketToDomain);
    },
    async setAll(markets: Market[]) {
      await prisma.market.deleteMany();
      if (markets.length > 0) {
        await prisma.market.createMany({
          data: markets.map((m) => ({
            id: m.id,
            name: m.name,
            slug: m.slug,
            branding: m.branding ? JSON.stringify(m.branding) : null,
            isActive: m.isActive ?? true,
            sortOrder: m.sortOrder ?? null,
            paymentCapabilities: m.paymentCapabilities ? JSON.stringify(m.paymentCapabilities) : null,
          })),
        });
      }
    },
  };
}

export function createDbTenantsRepo(): TenantsRepo {
  return {
    async findAll() {
      const rows = await prisma.tenant.findMany();
      return rows.map(tenantToDomain);
    },
    async setAll(tenants: RegistryTenant[]) {
      await prisma.tenant.deleteMany();
      if (tenants.length > 0) {
        await prisma.tenant.createMany({
          data: tenants.map((t) => ({
            id: t.id,
            slug: t.slug,
            name: t.name,
            logoUrl: t.logoUrl ?? '',
            primaryColor: t.primaryColor ?? '#000',
            secondaryColor: t.secondaryColor ?? '#fff',
            fontFamily: t.fontFamily ?? 'inherit',
            radiusScale: t.radiusScale ?? 1,
            layoutStyle: t.layoutStyle ?? 'default',
            enabled: t.enabled ?? true,
            createdAt: t.createdAt ?? new Date().toISOString(),
            templateId: t.templateId ?? null,
            hero: t.hero ? JSON.stringify(t.hero) : null,
            banners: t.banners ? JSON.stringify(t.banners) : null,
            whatsappPhone: t.whatsappPhone ?? null,
            type: t.type ?? null,
            businessType: t.businessType ?? (t.type === 'FOOD' ? 'RESTAURANT' : 'RETAIL'),
            marketCategory: t.marketCategory ?? null,
            marketId: t.marketId ?? null,
            isListedInMarket: t.isListedInMarket ?? null,
            marketSortOrder: t.marketSortOrder ?? null,
            tenantType: t.tenantType ?? null,
            deliveryProviderMode: t.deliveryProviderMode ?? null,
            allowMarketCourierFallback: t.allowMarketCourierFallback ?? null,
            defaultPrepTimeMin: t.defaultPrepTimeMin ?? null,
            financialConfig: t.financialConfig ? JSON.stringify(t.financialConfig) : null,
            paymentCapabilities: t.paymentCapabilities ? JSON.stringify(t.paymentCapabilities) : null,
          })),
        });
      }
    },
  };
}

export function createDbUsersRepo(): UsersRepo {
  return {
    async findAll() {
      const rows = await prisma.user.findMany();
      return rows.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role as User['role'],
        marketId: u.marketId ?? undefined,
        tenantId: u.tenantId ?? undefined,
        courierId: u.courierId ?? undefined,
        password: u.password ?? undefined,
      }));
    },
    async setAll(users: User[]) {
      await prisma.user.deleteMany();
      if (users.length > 0) {
        await prisma.user.createMany({
          data: users.map((u) => ({
            id: u.id,
            email: u.email,
            role: u.role,
            marketId: u.marketId ?? null,
            tenantId: u.tenantId ?? null,
            courierId: u.courierId ?? null,
            password: u.password ?? null,
          })),
        });
      }
    },
  };
}

export function createDbCouriersRepo(): CouriersRepo {
  return {
    async findAll() {
      const rows = await prisma.courier.findMany();
      return rows.map((c) => ({
        id: c.id,
        scopeType: c.scopeType as Courier['scopeType'],
        scopeId: c.scopeId,
        marketId: c.marketId ?? undefined,
        name: c.name,
        phone: c.phone ?? undefined,
        isActive: c.isActive,
        isOnline: c.isOnline,
        capacity: c.capacity,
        isAvailable: c.isAvailable ?? undefined,
        deliveryCount: c.deliveryCount ?? undefined,
      }));
    },
    async setAll(couriers: Courier[]) {
      await prisma.courier.deleteMany();
      if (couriers.length > 0) {
        await prisma.courier.createMany({
          data: couriers.map((c) => ({
            id: c.id,
            scopeType: c.scopeType,
            scopeId: c.scopeId,
            marketId: c.marketId ?? null,
            name: c.name,
            phone: c.phone ?? null,
            isActive: c.isActive ?? true,
            isOnline: c.isOnline ?? false,
            capacity: c.capacity ?? 1,
            isAvailable: c.isAvailable ?? null,
            deliveryCount: c.deliveryCount ?? null,
          })),
        });
      }
    },
  };
}

export function createDbCustomersRepo(): CustomersRepo {
  return {
    async findAll() {
      const rows = await prisma.customer.findMany();
      return rows.map((c) => ({
        id: c.id,
        phone: c.phone,
        createdAt: c.createdAt,
      }));
    },
    async setAll(customers: Customer[]) {
      await prisma.customer.deleteMany();
      if (customers.length > 0) {
        await prisma.customer.createMany({
          data: customers.map((c) => ({
            id: c.id,
            phone: c.phone,
            createdAt: c.createdAt ?? new Date().toISOString(),
          })),
        });
      }
    },
  };
}

export function createDbOrdersRepo(): OrdersRepo {
  return {
    async findAll() {
      const rows = await prisma.order.findMany();
      return rows.map(orderToDomain);
    },
    async setAll(orders: OrderRecord[]) {
      await prisma.order.deleteMany();
      if (orders.length > 0) {
        for (const o of orders) {
          const rec = orderToDb(o);
          if (rec.id) await prisma.order.create({ data: rec });
        }
      }
    },
    async addOrderWithPayment(order: OrderRecord, payment: { method: string; status: string; amount: number; currency?: string }) {
      const rec = orderToDb(order);
      const orderId = rec.id;
      if (!orderId) throw new Error('Order id required');
      const now = new Date().toISOString();
      const paymentId = `pay-${orderId}`;
      await prisma.$transaction([
        prisma.order.create({ data: rec }),
        prisma.payment.upsert({
          where: { id: paymentId },
          create: {
            id: paymentId,
            orderId,
            method: payment.method,
            status: payment.status,
            amount: payment.amount,
            currency: payment.currency ?? 'ILS',
            provider: null,
            providerRef: null,
            createdAt: now,
            updatedAt: now,
          },
          update: {
            status: payment.status,
            amount: payment.amount,
            updatedAt: now,
          },
        }),
      ]);
    },
  };
}

function catalogToDomain(
  categories: { id: string; tenantId: string; name: string; slug: string; description: string | null; imageUrl: string | null; sortOrder: number; parentId: string | null; isVisible: boolean | null }[],
  products: { id: string; tenantId: string; categoryId: string; name: string; slug: string; description: string | null; type: string; basePrice: number; currency: string; imageUrl: string | null; images: string | null; optionGroups: string | null; variants: string | null; stock: number | null; isAvailable: boolean; createdAt: string | null; isFeatured: boolean | null }[],
  optionGroups: { id: string; tenantId: string; name: string; type: string | null; required: boolean; minSelected: number; maxSelected: number; selectionType: string; scope: string | null; scopeId: string | null; allowHalfPlacement: boolean | null; items: string | null }[]
): TenantCatalog {
  const catArr = categories.map((c) => ({
    id: c.id,
    tenantId: c.tenantId,
    name: c.name,
    slug: c.slug,
    description: c.description ?? undefined,
    imageUrl: c.imageUrl ?? undefined,
    sortOrder: c.sortOrder,
    parentId: c.parentId ?? undefined,
    isVisible: c.isVisible ?? true,
  }));
  const prodArr = products.map((p) => {
    const base: Record<string, unknown> = {
      id: p.id,
      tenantId: p.tenantId,
      categoryId: p.categoryId,
      name: p.name,
      slug: p.slug,
      description: p.description ?? undefined,
      type: p.type,
      basePrice: p.basePrice,
      currency: p.currency,
      imageUrl: p.imageUrl ?? undefined,
      stock: p.stock ?? undefined,
      isAvailable: p.isAvailable,
      createdAt: p.createdAt ?? undefined,
      isFeatured: p.isFeatured ?? undefined,
    };
    if (p.images) base.images = JSON.parse(p.images) as unknown;
    if (p.optionGroups) base.optionGroups = JSON.parse(p.optionGroups) as unknown;
    if (p.variants) base.variants = JSON.parse(p.variants) as unknown;
    return base;
  });
  const grpArr = optionGroups.map((g) => {
    const base: Record<string, unknown> = {
      id: g.id,
      tenantId: g.tenantId,
      name: g.name,
      type: g.type ?? undefined,
      required: g.required,
      minSelected: g.minSelected,
      maxSelected: g.maxSelected,
      selectionType: g.selectionType,
      scope: g.scope ?? undefined,
      scopeId: g.scopeId ?? undefined,
      allowHalfPlacement: g.allowHalfPlacement ?? undefined,
    };
    base.items = g.items ? (JSON.parse(g.items) as unknown) : [];
    return base;
  });
  const itemArr = grpArr.flatMap((g) => (g.items as unknown[]) ?? []);
  return {
    categories: catArr,
    products: prodArr,
    optionGroups: grpArr,
    optionItems: itemArr,
  };
}

export function createDbCatalogRepo(): CatalogRepo {
  return {
    async getCatalog(tenantId: string) {
      const [categories, products, optionGroups] = await Promise.all([
        prisma.catalogCategory.findMany({ where: { tenantId } }),
        prisma.catalogProduct.findMany({ where: { tenantId } }),
        prisma.catalogOptionGroup.findMany({ where: { tenantId } }),
      ]);
      return catalogToDomain(categories, products, optionGroups);
    },
    async setCatalog(tenantId: string, catalog: TenantCatalog) {
      await prisma.$transaction([
        prisma.catalogCategory.deleteMany({ where: { tenantId } }),
        prisma.catalogProduct.deleteMany({ where: { tenantId } }),
        prisma.catalogOptionGroup.deleteMany({ where: { tenantId } }),
      ]);
      const cats = (catalog.categories ?? []) as { id?: string; tenantId?: string; name?: string; slug?: string; description?: string; imageUrl?: string; sortOrder?: number; parentId?: string | null; isVisible?: boolean }[];
      const prods = (catalog.products ?? []) as { id?: string; tenantId?: string; categoryId?: string; name?: string; slug?: string; description?: string; type?: string; basePrice?: number; currency?: string; imageUrl?: string; images?: unknown; optionGroups?: unknown; variants?: unknown; stock?: number; isAvailable?: boolean; createdAt?: string; isFeatured?: boolean }[];
      const grps = (catalog.optionGroups ?? []) as { id?: string; tenantId?: string; name?: string; type?: string; required?: boolean; minSelected?: number; maxSelected?: number; selectionType?: string; scope?: string; scopeId?: string; allowHalfPlacement?: boolean; items?: unknown[] }[];
      for (const c of cats) {
        if (c.id) {
          await prisma.catalogCategory.create({
            data: {
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
          });
        }
      }
      for (const p of prods) {
        if (p.id) {
          await prisma.catalogProduct.create({
            data: {
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
              isAvailable: p.isAvailable ?? true,
              createdAt: p.createdAt ?? null,
              isFeatured: p.isFeatured ?? null,
            },
          });
        }
      }
      for (const g of grps) {
        if (g.id) {
          await prisma.catalogOptionGroup.create({
            data: {
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
          });
        }
      }
    },
  };
}

function defaultDeliverySettings(tenantId: string): Record<string, unknown> {
  return {
    tenantId,
    modes: { pickup: true, delivery: true },
    minimumOrder: 0,
    deliveryFee: 5,
    zones: [],
  };
}

export function createDbDeliveryRepo(): DeliveryRepo {
  return {
    async getSettings(tenantId: string) {
      const row = await prisma.tenantDeliverySettings.findUnique({ where: { tenantId } });
      if (!row) {
        const def = defaultDeliverySettings(tenantId);
        await this.setSettings(tenantId, def);
        return def;
      }
      const out: Record<string, unknown> = {
        tenantId: row.tenantId,
        minimumOrder: row.minimumOrder,
        deliveryFee: row.deliveryFee,
      };
      if (row.modes) out.modes = JSON.parse(row.modes) as unknown;
      if (row.payload) Object.assign(out, JSON.parse(row.payload) as Record<string, unknown>);
      return out;
    },
    async setSettings(tenantId: string, settings: Record<string, unknown>) {
      const { modes, minimumOrder, deliveryFee, ...rest } = settings;
      const payload = Object.keys(rest).length > 0 ? JSON.stringify(rest) : null;
      await prisma.tenantDeliverySettings.upsert({
        where: { tenantId },
        create: {
          tenantId,
          modes: modes != null ? JSON.stringify(modes) : null,
          minimumOrder: typeof minimumOrder === 'number' ? minimumOrder : 0,
          deliveryFee: typeof deliveryFee === 'number' ? deliveryFee : 0,
          payload,
        },
        update: {
          modes: modes != null ? JSON.stringify(modes) : undefined,
          minimumOrder: typeof minimumOrder === 'number' ? minimumOrder : undefined,
          deliveryFee: typeof deliveryFee === 'number' ? deliveryFee : undefined,
          payload: payload ?? undefined,
        },
      });
    },
  };
}

export function createDbDeliveryZonesRepo(): DeliveryZonesRepo {
  return {
    async getByTenant(tenantId: string) {
      const rows = await prisma.deliveryZone.findMany({
        where: { tenantId },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
      return rows.map((z) => ({
        id: z.id,
        tenantId: z.tenantId,
        name: z.name,
        fee: z.fee,
        etaMinutes: z.etaMinutes ?? undefined,
        isActive: z.isActive,
        sortOrder: z.sortOrder ?? undefined,
      })) as DeliveryZoneRecord[];
    },
    async setAll(tenantId: string, zones: DeliveryZoneRecord[]) {
      await prisma.deliveryZone.deleteMany({ where: { tenantId } });
      if (zones.length > 0) {
        await prisma.deliveryZone.createMany({
          data: zones.map((z) => ({
            id: z.id,
            tenantId,
            name: z.name,
            fee: z.fee,
            etaMinutes: z.etaMinutes ?? null,
            minimumOrder: (z as Record<string, unknown>).minimumOrder != null ? Number((z as Record<string, unknown>).minimumOrder) : null,
            geo: (z as Record<string, unknown>).geo != null ? JSON.stringify((z as Record<string, unknown>).geo) : null,
            isActive: z.isActive ?? true,
            sortOrder: z.sortOrder ?? null,
          })),
        });
      }
    },
  };
}

export function createDbPaymentsRepo(): PaymentsRepo {
  return {
    async createForOrder(orderId: string, payment: { method: string; status: string; amount: number; currency?: string }) {
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error(`Order ${orderId} not found; cannot create Payment`);
      const now = new Date().toISOString();
      const id = `pay-${orderId}`;
      await prisma.payment.upsert({
        where: { id },
        create: {
          id,
          orderId,
          method: payment.method,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency ?? 'ILS',
          provider: null,
          providerRef: null,
          createdAt: now,
          updatedAt: now,
        },
        update: {
          status: payment.status,
          amount: payment.amount,
          updatedAt: now,
        },
      });
    },
  };
}
