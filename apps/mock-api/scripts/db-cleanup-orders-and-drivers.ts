#!/usr/bin/env npx tsx
/**
 * DATABASE CLEANUP - RESET ORDERS AND DRIVERS ONLY
 *
 * - Deletes all Orders (Payment cascades).
 * - Resets Courier.deliveryCount for the driver named "Ahmed"; deletes all other couriers.
 * - Clears User.courierId for users that pointed to deleted couriers.
 *
 * PROTECTED: Does not touch Tenants, Products, Categories, Users (customers), Markets, CMS, etc.
 *
 * Usage:
 *   cd apps/mock-api && DATABASE_URL=postgresql://... pnpm run db:cleanup-orders-drivers
 */
import { PrismaClient } from '@prisma/client';

const AHMED_NAME = 'Ahmed';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    // 1. Orders & transactions: delete all orders (Payment cascades)
    const deletedOrders = await prisma.order.deleteMany({});
    console.log('Deleted', deletedOrders.count, 'orders (payments cascaded).');

    // 2. Couriers: find Ahmed and everyone else (case-insensitive name)
    const allCouriers = await prisma.courier.findMany({ select: { id: true, name: true } });
    const ahmed = allCouriers.find((c) => c.name.trim().toLowerCase() === AHMED_NAME.toLowerCase());
    const toDelete = allCouriers.filter((c) => c.id !== ahmed?.id);
    const toDeleteIds = toDelete.map((c) => c.id);

    if (toDeleteIds.length) {
      // Clear User.courierId for users linked to couriers we're about to delete
      const usersUpdated = await prisma.user.updateMany({
        where: { courierId: { in: toDeleteIds } },
        data: { courierId: null },
      });
      console.log('Cleared courierId for', usersUpdated.count, 'user(s).');
      await prisma.courier.deleteMany({ where: { id: { in: toDeleteIds } } });
      console.log('Deleted', toDeleteIds.length, 'courier(s) (all except Ahmed).');
    } else {
      console.log('No couriers to delete (only Ahmed or none).');
    }

    if (ahmed) {
      await prisma.courier.update({
        where: { id: ahmed.id },
        data: { deliveryCount: 0 },
      });
      console.log("Reset Ahmed's deliveryCount to 0.");
    } else {
      console.log('No courier named "Ahmed" found; nothing to reset.');
    }

    console.log('Done. Orders and drivers reset; stores, products, users, and CMS untouched.');
  } finally {
    await prisma.$disconnect();
  }
}

main();
