#!/usr/bin/env npx tsx
/**
 * Delete default/placeholder stores (مخبز دبورية, إلكترونيات دبورية) from PostgreSQL.
 * Removes related: orders (and payments via cascade), users, catalog, delivery settings/zones, then tenants.
 *
 * Usage:
 *   cd apps/mock-api && DATABASE_URL=postgresql://... pnpm exec tsx scripts/delete-default-stores-db.ts
 */
import { PrismaClient } from '@prisma/client';

const DEFAULT_STORE_IDS = ['store-dab-bakery', 'store-dab-electronics'];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    for (const tenantId of DEFAULT_STORE_IDS) {
      const orders = await prisma.order.findMany({ where: { tenantId }, select: { id: true } });
      const orderIds = orders.map((o) => o.id);

      if (orderIds.length) {
        await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
        console.log('Deleted', orderIds.length, 'orders (payments cascaded) for', tenantId);
      }

      const users = await prisma.user.deleteMany({ where: { tenantId } });
      console.log('Deleted', users.count, 'users for', tenantId);

      await prisma.catalogCategory.deleteMany({ where: { tenantId } });
      await prisma.catalogProduct.deleteMany({ where: { tenantId } });
      await prisma.catalogOptionGroup.deleteMany({ where: { tenantId } });
      await prisma.tenantDeliverySettings.deleteMany({ where: { tenantId } });
      await prisma.deliveryZone.deleteMany({ where: { tenantId } });

      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (tenant) {
        await prisma.tenant.delete({ where: { id: tenantId } });
        console.log('Deleted tenant', tenantId);
      } else {
        console.log('Tenant', tenantId, 'was not in DB');
      }
    }
    console.log('Done. Default stores removed from database.');
  } finally {
    await prisma.$disconnect();
  }
}

main();
