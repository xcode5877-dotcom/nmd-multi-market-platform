/**
 * Quick verification: print name and pillarId of first 10 tenants from PostgreSQL.
 * Run from apps/mock-api: pnpm exec tsx scripts/verify-tenant-pillars.ts
 * Or with DATABASE_URL: DATABASE_URL=postgresql://... pnpm exec tsx scripts/verify-tenant-pillars.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({
    take: 10,
    select: { id: true, name: true, pillarId: true, subCategoryId: true },
  });
  console.log('First 10 tenants in Postgres (name, pillarId, subCategoryId):');
  console.log('---');
  for (const t of tenants) {
    const pillar = t.pillarId ?? '(NULL)';
    const sub = t.subCategoryId ?? '(NULL)';
    console.log(t.name ?? t.id, '| pillarId:', pillar, '| subCategoryId:', sub);
  }
  console.log('---');
  const withPillar = await prisma.tenant.count({ where: { pillarId: { not: null } } });
  const total = await prisma.tenant.count();
  console.log('Tenants with non-null pillarId:', withPillar, 'of', total);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
