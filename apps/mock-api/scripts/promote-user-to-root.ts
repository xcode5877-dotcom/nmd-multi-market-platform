#!/usr/bin/env npx tsx
/**
 * Promote a user to ROOT_ADMIN (platform super admin) by email.
 * Use this if the Admin UI does not show delivery settings for you — your account may be TENANT_ADMIN.
 *
 * Usage:
 *   pnpm exec tsx apps/mock-api/scripts/promote-user-to-root.ts your@email.com
 *   PROMOTE_USER_EMAIL=your@email.com pnpm exec tsx apps/mock-api/scripts/promote-user-to-root.ts
 *
 * Works with:
 *   - Database (Prisma): set DATABASE_URL, then run. Updates the User.role to ROOT_ADMIN.
 *   - JSON storage: set DATA_FILE to your data.json path (e.g. apps/mock-api/data/data.json), then run.
 *     If DATA_FILE is not set, uses apps/mock-api/data/data.json relative to script.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOCK_API_ROOT = join(__dirname, '..');
const DEFAULT_DATA_FILE = join(MOCK_API_ROOT, 'data', 'data.json');

const TARGET_ROLE = 'ROOT_ADMIN';

async function main() {
  const email = (process.env.PROMOTE_USER_EMAIL ?? process.argv[2] ?? '').trim().toLowerCase();
  if (!email) {
    console.error('Usage: promote-user-to-root.ts <email>');
    console.error('   or: PROMOTE_USER_EMAIL=your@email.com tsx promote-user-to-root.ts');
    process.exit(1);
  }

  if (process.env.DATABASE_URL) {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const all = await prisma.user.findMany();
      const user = all.find((u) => (u.email ?? '').toLowerCase() === email);
      if (!user) {
        console.error(`User with email "${email}" not found in database.`);
        process.exit(1);
      }
      if (user.role === TARGET_ROLE) {
        console.log(`User ${email} already has role ${TARGET_ROLE}.`);
        return;
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { role: TARGET_ROLE },
      });
      console.log(`Updated role to ${TARGET_ROLE} for user: ${user.email} (id: ${user.id}).`);
    } finally {
      await prisma.$disconnect();
    }
    return;
  }

  const dataPath = process.env.DATA_FILE || DEFAULT_DATA_FILE;
  if (!existsSync(dataPath)) {
    console.error(`DATA_FILE not found: ${dataPath}. Set DATA_FILE or run from repo with data.`);
    process.exit(1);
  }

  const raw = readFileSync(dataPath, 'utf-8');
  const data = JSON.parse(raw) as { users?: Array<{ id: string; email?: string; role?: string }> };
  const users = data.users ?? [];
  const idx = users.findIndex((u) => (u.email ?? '').toLowerCase() === email);
  if (idx < 0) {
    console.error(`User with email "${email}" not found in ${dataPath}.`);
    process.exit(1);
  }

  if (users[idx].role === TARGET_ROLE) {
    console.log(`User ${email} already has role ${TARGET_ROLE}.`);
    return;
  }

  users[idx] = { ...users[idx], role: TARGET_ROLE };
  writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Updated role to ${TARGET_ROLE} for user: ${users[idx].email} (id: ${users[idx].id}) in ${dataPath}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
