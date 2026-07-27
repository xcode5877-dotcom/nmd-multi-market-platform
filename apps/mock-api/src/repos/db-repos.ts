import type { Market, RegistryTenant, User, Courier, Customer } from '../store.js';
import { prisma } from '../db.js';
import { logOrderAudit } from '../order-protection.js';
import type { TenantCatalog } from '../store.js';
import type { OrderRecord } from './types.js';
import type { MarketsRepo, TenantsRepo, UsersRepo, CouriersRepo, CustomersRepo, OrdersRepo, CatalogRepo, DeliveryRepo, DeliveryZonesRepo, PaymentsRepo } from './types.js';
import type { DeliveryZoneRecord } from '../store.js';
import { parseMarketBrandingColumn, serializeMarketBrandingColumn } from '../market-branding-storage.js';
import { syncCustomersFromRepo } from '../customer-identity.js';
import {
  attachMeasurementToProduct,
  coerceMeasurementDecimalString,
  defaultPieceMeasurement,
  normalizeCatalogProductsForWrite,
  toPrismaBaseUnitCode,
  toPrismaDisplayUnitCode,
} from '@nmd/core';
import type { Prisma } from '@prisma/client';

function marketToDomain(m: { id: string; name: string; slug: string; imageUrl: string | null; branding: string | null; isActive: boolean; sortOrder: number | null; paymentCapabilities: string | null; paymentMethods?: string | null }): Market {
  const { branding, platformFeeConfig } = parseMarketBrandingColumn(m.branding);
  return {
    id: m.id,
    name: m.name,
    slug: m.slug,
    imageUrl: m.imageUrl ?? undefined,
    branding,
    platformFeeConfig,
    isActive: m.isActive,
    sortOrder: m.sortOrder ?? undefined,
    paymentCapabilities: m.paymentCapabilities ? (JSON.parse(m.paymentCapabilities) as Market['paymentCapabilities']) : undefined,
    paymentMethods: m.paymentMethods ? (JSON.parse(m.paymentMethods) as Market['paymentMethods']) : undefined,
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
  operationalStatus: string | null; orderPolicy: string | null; businessHours: string | null;
  busyBannerEnabled: boolean | null; busyBannerText: string | null; bookingEnabled: boolean | null;
  about: string | null; officeHours: string | null; openTime: string | null; closeTime: string | null; forceClosed: boolean | null;
  overrideStatus: string | null;
  phone: string | null; storeType: string | null; appointmentDuration: number | null;
  collections: string | null;
  addressLine?: string | null; location?: string | null; deliveryRadiusKm?: number | null;
  pillarId?: string | null; subCategoryId?: string | null;
  supportsWeightSelling?: boolean | null;
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
    collections: t.collections ? (JSON.parse(t.collections) as RegistryTenant['collections']) : undefined,
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
    operationalStatus: (t.operationalStatus as RegistryTenant['operationalStatus']) ?? undefined,
    orderPolicy: (t.orderPolicy as RegistryTenant['orderPolicy']) ?? undefined,
    businessHours: t.businessHours ? (JSON.parse(t.businessHours) as RegistryTenant['businessHours']) : undefined,
    busyBannerEnabled: t.busyBannerEnabled ?? undefined,
    busyBannerText: t.busyBannerText ?? undefined,
    bookingEnabled: t.bookingEnabled ?? undefined,
    about: t.about ?? undefined,
    officeHours: t.officeHours ?? undefined,
    openTime: t.openTime ?? undefined,
    closeTime: t.closeTime ?? undefined,
    forceClosed: t.forceClosed ?? undefined,
    overrideStatus: (t.overrideStatus as RegistryTenant['overrideStatus']) ?? undefined,
    phone: t.phone ?? undefined,
    storeType: (t.storeType as RegistryTenant['storeType']) ?? undefined,
    appointmentDuration: t.appointmentDuration ?? undefined,
    addressLine: t.addressLine ?? undefined,
    location: t.location ? (JSON.parse(t.location) as { lat: number; lng: number }) : undefined,
    deliveryRadiusKm: t.deliveryRadiusKm ?? undefined,
    pillarId: t.pillarId ?? undefined,
    subCategoryId: t.subCategoryId ?? undefined,
    supportsWeightSelling: t.supportsWeightSelling === true,
  };
}

function orderToDomain(o: {
  id: string; tenantId: string | null; courierId: string | null; marketId: string | null;
  status: string | null; fulfillmentType: string | null; orderType: string | null; total: number | null;
  createdAt: string | null; payment: string | null; deliveryTimeline: string | null; payload: string | null;
  isExternal?: boolean | null;
  externalDestination?: string | null;
  manualStoreName?: string | null;
  submissionScheduledAt?: Date | null;
  submittedAt?: Date | null;
  revision?: number | null;
  cancelledBeforeSubmission?: boolean | null;
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
    isExternal: o.isExternal ?? false,
    externalDestination: o.externalDestination ?? undefined,
    manualStoreName: o.manualStoreName ?? undefined,
  };
  if (o.payment) (base as Record<string, unknown>).payment = JSON.parse(o.payment);
  if (o.deliveryTimeline) (base as Record<string, unknown>).deliveryTimeline = JSON.parse(o.deliveryTimeline);
  if (o.payload) {
    const payload = JSON.parse(o.payload) as Record<string, unknown>;
    Object.assign(base, payload);
  }
  // DB columns win over legacy payload keys
  (base as Record<string, unknown>).isExternal = o.isExternal ?? false;
  if (o.externalDestination != null) (base as Record<string, unknown>).externalDestination = o.externalDestination;
  if (o.manualStoreName != null) (base as Record<string, unknown>).manualStoreName = o.manualStoreName;
  // Gate columns are source of truth (overwrite any payload copies)
  (base as Record<string, unknown>).submissionScheduledAt = o.submissionScheduledAt
    ? o.submissionScheduledAt.toISOString()
    : undefined;
  (base as Record<string, unknown>).submittedAt = o.submittedAt ? o.submittedAt.toISOString() : undefined;
  (base as Record<string, unknown>).revision = typeof o.revision === 'number' ? o.revision : 0;
  (base as Record<string, unknown>).cancelledBeforeSubmission = o.cancelledBeforeSubmission === true;
  return base;
}

function parseOrderDateField(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function orderToDb(order: OrderRecord): {
  id: string; tenantId: string | null; courierId: string | null; marketId: string | null;
  status: string | null; fulfillmentType: string | null; orderType: string | null; total: number | null;
  createdAt: string | null; payment: string | null; deliveryTimeline: string | null; payload: string | null;
  isExternal: boolean;
  externalDestination: string | null;
  manualStoreName: string | null;
  submissionScheduledAt: Date | null;
  submittedAt: Date | null;
  revision: number;
  cancelledBeforeSubmission: boolean;
} {
  const {
    id,
    tenantId,
    courierId,
    marketId,
    status,
    fulfillmentType,
    orderType,
    total,
    createdAt,
    payment,
    deliveryTimeline,
    isExternal,
    externalDestination,
    manualStoreName,
    submissionScheduledAt,
    submittedAt,
    revision,
    cancelledBeforeSubmission,
    ...rest
  } = order;
  // Strip gate keys from payload so columns remain source of truth
  delete (rest as Record<string, unknown>).submissionScheduledAt;
  delete (rest as Record<string, unknown>).submittedAt;
  delete (rest as Record<string, unknown>).revision;
  delete (rest as Record<string, unknown>).cancelledBeforeSubmission;
  // Append-only history lives in OrderModification table — never persist in payload
  delete (rest as Record<string, unknown>).modificationHistory;
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
    isExternal: Boolean(isExternal),
    externalDestination: externalDestination != null ? String(externalDestination) : null,
    manualStoreName: manualStoreName != null ? String(manualStoreName) : null,
    submissionScheduledAt: parseOrderDateField(submissionScheduledAt),
    submittedAt: parseOrderDateField(submittedAt),
    revision: typeof revision === 'number' && Number.isFinite(revision) ? Math.max(0, Math.floor(revision)) : 0,
    cancelledBeforeSubmission: cancelledBeforeSubmission === true,
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
            imageUrl: m.imageUrl ?? null,
            branding: serializeMarketBrandingColumn(m),
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
            operationalStatus: t.operationalStatus ?? null,
            orderPolicy: t.orderPolicy ?? null,
            businessHours: t.businessHours ? JSON.stringify(t.businessHours) : null,
            busyBannerEnabled: t.busyBannerEnabled ?? null,
            busyBannerText: t.busyBannerText ?? null,
            bookingEnabled: t.bookingEnabled ?? null,
            about: t.about ?? null,
            officeHours: t.officeHours ?? null,
            openTime: (t as RegistryTenant).openTime ?? null,
            closeTime: (t as RegistryTenant).closeTime ?? null,
            forceClosed: (t as RegistryTenant).forceClosed ?? null,
            overrideStatus: (t as RegistryTenant).overrideStatus ?? null,
            phone: t.phone ?? null,
            storeType: t.storeType ?? null,
            appointmentDuration: t.appointmentDuration ?? null,
            collections: (t as RegistryTenant).collections ? JSON.stringify((t as RegistryTenant).collections) : null,
            addressLine: (t as RegistryTenant).addressLine ?? null,
            location: (t as RegistryTenant).location ? JSON.stringify((t as RegistryTenant).location) : null,
            deliveryRadiusKm: (t as RegistryTenant).deliveryRadiusKm ?? null,
            pillarId: (t as RegistryTenant).pillarId ?? null,
            subCategoryId: (t as RegistryTenant).subCategoryId ?? null,
            supportsWeightSelling: (t as RegistryTenant).supportsWeightSelling === true,
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
        mustChangePassword: u.mustChangePassword ?? undefined,
        fcmToken: u.fcmToken ?? undefined,
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
            mustChangePassword: u.mustChangePassword ?? null,
            fcmToken: (u as User & { fcmToken?: string }).fcmToken ?? null,
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
        password: c.password ?? undefined,
        isActive: c.isActive,
        isOnline: c.isOnline,
        capacity: c.capacity,
        isAvailable: c.isAvailable ?? undefined,
        deliveryCount: c.deliveryCount ?? undefined,
        allowedStoreIds: c.allowedStoreIds ? (JSON.parse(c.allowedStoreIds) as string[]) : undefined,
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
            password: c.password ?? null,
            isActive: c.isActive ?? true,
            isOnline: c.isOnline ?? false,
            capacity: c.capacity ?? 1,
            isAvailable: c.isAvailable ?? null,
            deliveryCount: c.deliveryCount ?? null,
            allowedStoreIds: c.allowedStoreIds ? JSON.stringify(c.allowedStoreIds) : null,
          })),
        });
      }
    },
  };
}

export function createDbCustomersRepo(): CustomersRepo {
  return {
    async findAll() {
      const rows = await prisma.customer.findMany({ orderBy: { createdAt: 'desc' } });
      return rows.map((c) => ({
        // accountExtras may be missing from stale Prisma client typings in some environments.
        accountExtras: ((c as unknown as { accountExtras?: unknown }).accountExtras as import('../store.js').Customer['accountExtras']) ?? undefined,
        id: c.id,
        phone: c.phone,
        name: c.name ?? undefined,
        email: c.email ?? undefined,
        city: c.city ?? undefined,
        avatarUrl: c.avatarUrl ?? undefined,
        createdAt: c.createdAt,
      }));
    },
    async setAll(customers: Customer[]) {
      await syncCustomersFromRepo(prisma, customers);
    },
  };
}

export function createDbOrdersRepo(): OrdersRepo {
  async function upsertOne(order: OrderRecord, auditAction?: 'created' | 'updated'): Promise<void> {
    const rec = orderToDb(order);
    if (!rec.id) throw new Error('Order id required');
    const existing = auditAction
      ? null
      : await prisma.order.findUnique({ where: { id: rec.id }, select: { id: true } });
    await prisma.order.upsert({
      where: { id: rec.id },
      create: rec,
      update: rec,
    });
    logOrderAudit(auditAction ?? (existing ? 'updated' : 'created'), order);
  }

  return {
    async findAll() {
      const rows = await prisma.order.findMany();
      return rows.map(orderToDomain);
    },
    async create(order: OrderRecord) {
      const rec = orderToDb(order);
      if (!rec.id) throw new Error('Order id required');
      await prisma.order.create({ data: rec });
      logOrderAudit('created', order);
    },
    async update(order: OrderRecord) {
      const rec = orderToDb(order);
      if (!rec.id) throw new Error('Order id required');
      await prisma.order.update({ where: { id: rec.id }, data: rec });
      logOrderAudit('updated', order);
    },
    async upsert(order: OrderRecord) {
      await upsertOne(order);
    },
    async updateMany(orders: OrderRecord[]) {
      for (const o of orders) {
        await upsertOne(o);
      }
    },
    async restore(order: OrderRecord) {
      const rec = orderToDb(order);
      if (!rec.id) throw new Error('Order id required');
      await prisma.order.upsert({
        where: { id: rec.id },
        create: rec,
        update: rec,
      });
      logOrderAudit('restored', order);
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
      logOrderAudit('created', order);
    },
    async deleteById(id: string) {
      await prisma.order.delete({ where: { id } });
    },
    async deleteByTenantId(tenantId: string) {
      const rows = await prisma.order.findMany({ where: { tenantId }, select: { id: true } });
      for (const row of rows) {
        await prisma.order.delete({ where: { id: row.id } });
      }
    },
    async deleteByCourierId(courierId: string) {
      const rows = await prisma.order.findMany({ where: { courierId }, select: { id: true } });
      for (const row of rows) {
        await prisma.order.delete({ where: { id: row.id } });
      }
    },
    async unassignCourier(courierId: string) {
      const rows = await prisma.order.findMany({ where: { courierId } });
      for (const row of rows) {
        const domain = orderToDomain(row);
        const updated: OrderRecord = { ...domain, courierId: undefined };
        const rec = orderToDb(updated);
        await prisma.order.update({ where: { id: rec.id }, data: rec });
        logOrderAudit('updated', updated);
      }
    },
  };
}

function decimalToApiString(value: unknown, fallback = '1'): string {
  if (value == null) return fallback;
  return coerceMeasurementDecimalString(
    typeof value === 'object' && value !== null && 'toString' in value
      ? String((value as { toString: () => string }).toString())
      : value,
    fallback
  );
}

function catalogToDomain(
  categories: { id: string; tenantId: string; name: string; slug: string; description: string | null; imageUrl: string | null; sortOrder: number; parentId: string | null; isVisible: boolean | null; markupExempt?: boolean }[],
  products: Array<{
    id: string; tenantId: string; categoryId: string; name: string; slug: string; description: string | null; type: string; basePrice: number; currency: string; imageUrl: string | null; images: string | null; optionGroups: string | null; variants: string | null; stock: number | null; isAvailable: boolean; createdAt: string | null; isFeatured: boolean | null; isArchived: boolean | null; sortOrder: number | null;
    measurementType?: string;
    baseUnitCode?: string;
    displayUnitCode?: string;
    quantityStep?: unknown;
    minimumQuantity?: unknown;
    maximumQuantity?: unknown;
    priceBasis?: string;
    measurementVersion?: number | null;
    displayPrecision?: number | null;
  }>,
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
    markupExempt: c.markupExempt ?? false,
  }));
  const prodArr = products.map((p) => {
    const defaults = defaultPieceMeasurement();
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
      isArchived: p.isArchived ?? undefined,
      sortOrder: p.sortOrder ?? undefined,
      measurementType: p.measurementType ?? defaults.measurementType,
      baseUnitCode: p.baseUnitCode ?? defaults.baseUnitCode,
      displayUnitCode: p.displayUnitCode ?? defaults.displayUnitCode,
      quantityStep: decimalToApiString(p.quantityStep, defaults.quantityStep),
      minimumQuantity: decimalToApiString(p.minimumQuantity, defaults.minimumQuantity),
      maximumQuantity:
        p.maximumQuantity == null ? null : decimalToApiString(p.maximumQuantity, defaults.minimumQuantity),
      priceBasis: p.priceBasis ?? defaults.priceBasis,
      measurementVersion: p.measurementVersion ?? defaults.measurementVersion,
      displayPrecision: p.displayPrecision ?? null,
    };
    if (p.images) base.images = JSON.parse(p.images) as unknown;
    if (p.optionGroups) base.optionGroups = JSON.parse(p.optionGroups) as unknown;
    if (p.variants) base.variants = JSON.parse(p.variants) as unknown;
    // Dual-emit legacy + normalize API unit codes (Prisma enums → lowercase)
    return attachMeasurementToProduct(base);
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
      const cats = (catalog.categories ?? []) as { id?: string; tenantId?: string; name?: string; slug?: string; description?: string; imageUrl?: string; sortOrder?: number; parentId?: string | null; isVisible?: boolean; markupExempt?: boolean }[];
      const rawProds = (catalog.products ?? []) as Record<string, unknown>[];
      const grps = (catalog.optionGroups ?? []) as { id?: string; tenantId?: string; name?: string; type?: string; required?: boolean; minSelected?: number; maxSelected?: number; selectionType?: string; scope?: string; scopeId?: string; allowHalfPlacement?: boolean; items?: unknown[] }[];

      // Fail-closed BEFORE any DB mutation: invalid measurement aborts with previous catalog intact.
      const prods = normalizeCatalogProductsForWrite(rawProds);

      await prisma.$transaction(async (tx) => {
        await tx.catalogCategory.deleteMany({ where: { tenantId } });
        await tx.catalogProduct.deleteMany({ where: { tenantId } });
        await tx.catalogOptionGroup.deleteMany({ where: { tenantId } });

        for (const c of cats) {
          if (c.id) {
            await tx.catalogCategory.create({
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
                markupExempt: c.markupExempt ?? false,
              },
            });
          }
        }
        for (const p of prods) {
          if (!p.id) continue;
          await tx.catalogProduct.create({
            data: {
              id: String(p.id),
              tenantId,
              categoryId: String(p.categoryId ?? ''),
              name: String(p.name ?? ''),
              slug: String(p.slug ?? ''),
              description: (p.description as string | undefined) ?? null,
              type: String(p.type ?? 'SIMPLE'),
              basePrice: Number(p.basePrice) || 0,
              currency: String(p.currency ?? 'ILS'),
              imageUrl: (p.imageUrl as string | undefined) ?? null,
              images: p.images != null ? JSON.stringify(p.images) : null,
              optionGroups: p.optionGroups != null ? JSON.stringify(p.optionGroups) : null,
              variants: p.variants != null ? JSON.stringify(p.variants) : null,
              stock: p.stock != null ? Number(p.stock) : null,
              isAvailable: p.isAvailable !== false,
              createdAt: (p.createdAt as string | undefined) ?? null,
              isFeatured: (p.isFeatured as boolean | undefined) ?? null,
              isArchived: (p.isArchived as boolean | undefined) ?? false,
              sortOrder: Number(p.sortOrder) || 0,
              measurementType: p.measurementType,
              baseUnitCode: toPrismaBaseUnitCode(p.baseUnitCode),
              displayUnitCode: toPrismaDisplayUnitCode(p.displayUnitCode),
              quantityStep: p.quantityStep as unknown as Prisma.Decimal,
              minimumQuantity: p.minimumQuantity as unknown as Prisma.Decimal,
              maximumQuantity:
                p.maximumQuantity == null ? null : (p.maximumQuantity as unknown as Prisma.Decimal),
              priceBasis: p.priceBasis,
              measurementVersion: p.measurementVersion,
              displayPrecision: p.displayPrecision,
            },
          });
        }
        for (const g of grps) {
          if (g.id) {
            await tx.catalogOptionGroup.create({
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
      });
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
    async deleteSettings(tenantId: string) {
      await prisma.tenantDeliverySettings.deleteMany({ where: { tenantId } });
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
          data: zones.map((z) => {
            const zExtra = z as unknown as { minimumOrder?: unknown; geo?: unknown };
            return {
              id: z.id,
              tenantId,
              name: z.name,
              fee: z.fee,
              etaMinutes: z.etaMinutes ?? null,
              minimumOrder: zExtra.minimumOrder != null ? Number(zExtra.minimumOrder) : null,
              geo: zExtra.geo != null ? JSON.stringify(zExtra.geo) : null,
              isActive: z.isActive ?? true,
              sortOrder: z.sortOrder ?? null,
            };
          }),
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
    async deleteForOrderIds(orderIds: string[]) {
      if (orderIds.length === 0) return;
      await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    },
  };
}
