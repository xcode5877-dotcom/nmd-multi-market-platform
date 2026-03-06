/**
 * Ensures a "default" tenant exists in the database (for storefront fallback:
 * delivery zones and policies). Run after `pnpm --filter mock-api db:push`
 * when DATABASE_URL is set (e.g. from host or a dev container).
 *
 * Usage: from repo root with DATABASE_URL in env:
 *   pnpm exec tsx apps/mock-api/scripts/ensure-default-tenant.ts
 * Or from apps/mock-api:
 *   tsx scripts/ensure-default-tenant.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_ID = 'default';

async function main() {
  await prisma.tenant.upsert({
    where: { id: DEFAULT_ID },
    create: {
      id: DEFAULT_ID,
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
    where: { tenantId: DEFAULT_ID },
    create: {
      tenantId: DEFAULT_ID,
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
      tenantId: DEFAULT_ID,
      name: 'المنطقة الافتراضية',
      fee: 0,
      etaMinutes: 30,
      minimumOrder: 0,
      isActive: true,
      sortOrder: 0,
    },
    update: {},
  });

  console.log('Default tenant (slug: default) and delivery settings/zones are in place.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
