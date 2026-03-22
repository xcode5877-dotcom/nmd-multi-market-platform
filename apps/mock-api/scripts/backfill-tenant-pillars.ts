/**
 * One-off: backfill Tenant.pillarId and subCategoryId from data.json into PostgreSQL.
 *
 * Run from HOST (DB must be reachable, e.g. localhost:5432):
 *   cd apps/mock-api && DATA_FILE=./data.json DATABASE_URL=postgresql://nmd:nmd@localhost:5432/nmd pnpm exec tsx scripts/backfill-tenant-pillars.ts
 *
 * If tsx fails in Docker (e.g. ERR_MODULE_NOT_FOUND), use SQL instead:
 *   node scripts/generate-pillar-backfill-sql.cjs ./data.json
 *   psql "postgresql://nmd:nmd@localhost:5432/nmd" -f scripts/pillar-backfill.sql
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const dataPath = process.env.DATA_FILE || join(process.cwd(), 'data.json');
if (!existsSync(dataPath)) {
  console.error('DATA_FILE not found:', dataPath);
  process.exit(1);
}
const raw = readFileSync(dataPath, 'utf-8');
const data = JSON.parse(raw) as { tenants?: Array<{ id?: string; pillarId?: string | null; subCategoryId?: string | null }> };
const tenants = data.tenants ?? [];
const prisma = new PrismaClient();

async function main() {
  let updated = 0;
  for (const t of tenants) {
    const id = t.id;
    if (!id) continue;
    const pillarId = t.pillarId != null ? String(t.pillarId) : null;
    const subCategoryId = t.subCategoryId != null ? String(t.subCategoryId) : null;
    await prisma.$executeRaw`
      UPDATE "Tenant"
      SET "pillarId" = ${pillarId}, "subCategoryId" = ${subCategoryId}
      WHERE id = ${id}
    `;
    updated++;
  }
  console.log('Backfilled pillarId/subCategoryId for', updated, 'tenants');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
