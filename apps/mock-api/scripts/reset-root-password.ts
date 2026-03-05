#!/usr/bin/env npx tsx
/**
 * Reset the root admin (root@nmd.com) password in the database.
 * Usage:
 *   pnpm exec tsx scripts/reset-root-password.ts [newPassword]
 *   RESET_ROOT_PASSWORD=myNewPass pnpm exec tsx scripts/reset-root-password.ts
 * Requires DATABASE_URL. New password defaults to "123456" if not provided.
 */
import { PrismaClient } from '@prisma/client';

const ROOT_EMAIL = 'root@nmd.com';
const DEFAULT_PASSWORD = '123456';

async function main() {
  const newPassword =
    process.env.RESET_ROOT_PASSWORD ?? process.argv[2] ?? DEFAULT_PASSWORD;
  if (newPassword.length < 6) {
    console.error('Password must be at least 6 characters.');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error(
      'DATABASE_URL is not set. This script updates the database; for JSON storage, edit data.json "users" entry for root@nmd.com manually.'
    );
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findFirst({
      where: { email: ROOT_EMAIL },
    });
    if (!user) {
      console.error(`User with email "${ROOT_EMAIL}" not found. Run seed first.`);
      process.exit(1);
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { password: newPassword, mustChangePassword: false },
    });
    console.log(`Password for ${ROOT_EMAIL} has been reset successfully.`);
  } finally {
    await prisma.$disconnect();
  }
}

main();
