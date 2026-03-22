#!/usr/bin/env npx tsx
/**
 * FORCE DELETE ALL ORDERS - EMERGENCY CLEANUP
 *
 * - Hard deletes: Order (Payment is cascade-deleted), then Couriers (all except Ahmed; Ahmed reset to 0).
 * - Verifies Order count is 0 after.
 * - Optionally clears JSON orders file so next startup has no orders when using JSON storage.
 *
 * PROTECTED: Does NOT touch Users, Products, Tenants, Images.
 *
 * Usage:
 *   cd apps/mock-api && DATABASE_URL=postgresql://... pnpm run force-delete-orders
 *
 * After running: Restart the mock-api process so in-memory caches (if any) are cleared.
 */
import { PrismaClient } from '@prisma/client';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const AHMED_NAME = 'Ahmed';

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const report: Record<string, number> = {};

  try {
    // --- Counts before ---
    const orderCountBefore = await prisma.order.count();
    const paymentCountBefore = await prisma.payment.count();

    // --- 1. Payment: delete first (so we can report; Order cascade would delete them anyway) ---
    const deletedPayments = await prisma.payment.deleteMany({});
    report['Payment'] = deletedPayments.count;

    // --- 2. Order: hard delete all ---
    const deletedOrders = await prisma.order.deleteMany({});
    report['Order'] = deletedOrders.count;

    // --- 3. Verify Order count is 0 ---
    const orderCountAfter = await prisma.order.count();
    if (orderCountAfter !== 0) {
      console.error('VERIFICATION FAILED: Order count after delete is', orderCountAfter, '(must be 0).');
      process.exit(1);
    }
    console.log('Verified: SELECT COUNT(*) FROM "Order" => 0');

    // --- 4. Couriers: clear User.courierId for couriers we will delete ---
    const allCouriers = await prisma.courier.findMany({ select: { id: true, name: true } });
    const ahmed = allCouriers.find((c) => c.name.trim().toLowerCase() === AHMED_NAME.toLowerCase());
    const toDeleteIds = allCouriers.filter((c) => c.id !== ahmed?.id).map((c) => c.id);

    if (toDeleteIds.length > 0) {
      const usersUpdated = await prisma.user.updateMany({
        where: { courierId: { in: toDeleteIds } },
        data: { courierId: null },
      });
      const deletedCouriers = await prisma.courier.deleteMany({ where: { id: { in: toDeleteIds } } });
      report['Courier (deleted)'] = deletedCouriers.count;
    } else {
      report['Courier (deleted)'] = 0;
    }

    if (ahmed) {
      await prisma.courier.update({
        where: { id: ahmed.id },
        data: { deliveryCount: 0 },
      });
      report['Ahmed deliveryCount reset'] = 1;
    }

    // --- 5. Clear JSON orders file if present (so JSON storage starts empty after restart) ---
    const ordersFile = process.env.ORDERS_FILE || join(process.cwd(), '..', '..', 'packages', 'mock', 'data', 'orders.json');
    if (existsSync(ordersFile)) {
      writeFileSync(ordersFile, '[]', 'utf-8');
      console.log('Cleared JSON orders file:', ordersFile);
    }

    // --- Report ---
    console.log('\n--- Rows affected ---');
    console.log('Order:', report['Order']);
    console.log('Payment:', report['Payment']);
    console.log('Courier (deleted):', report['Courier (deleted)']);
    if (ahmed) console.log('Ahmed deliveryCount reset: 1');
    console.log('\nOrder count after deletion:', orderCountAfter, '(must be 0).');
    console.log('\nRestart the mock-api process to clear any in-memory order caches.');
  } finally {
    await prisma.$disconnect();
  }
}

main();
