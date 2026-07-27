#!/usr/bin/env npx tsx
/**
 * Verify Phase B.1 migration SQL safely on a disposable database.
 * Clones schema (no data) from local `nmd`, then applies only the B.1 ALTER.
 * Never runs against production data. Never uses prisma migrate deploy on `nmd`.
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DB = 'nmd_b1_verify';
const CONTAINER = 'nmd-multi-market-platform-postgres-1';

function sh(cmd: string): string {
  return execSync(cmd, { encoding: 'utf8' }).trim();
}

console.log('Disposable B.1 migration verify →', DB);

sh(`docker exec ${CONTAINER} psql -U nmd -d postgres -c "DROP DATABASE IF EXISTS ${DB};"`);
sh(`docker exec ${CONTAINER} psql -U nmd -d postgres -c "CREATE DATABASE ${DB};"`);

const dumpPath = join(tmpdir(), `nmd-schema-${Date.now()}.sql`);
sh(`docker exec ${CONTAINER} pg_dump -U nmd -d nmd --schema-only --no-owner --no-privileges > ${dumpPath}`);
sh(`docker exec -i ${CONTAINER} psql -U nmd -d ${DB} < ${dumpPath}`);
unlinkSync(dumpPath);

// Baseline: strip B.1 column if schema dump already had it (from prior prod apply? unlikely)
sh(
  `docker exec ${CONTAINER} psql -U nmd -d ${DB} -c 'ALTER TABLE "Order" DROP COLUMN IF EXISTS "pricingSchemaVersion";'`
);

const beforeOrders = sh(
  `docker exec ${CONTAINER} psql -U nmd -d ${DB} -tAc 'SELECT count(*) FROM "Order";'`
);
const beforePayments = sh(
  `docker exec ${CONTAINER} psql -U nmd -d ${DB} -tAc 'SELECT count(*) FROM "Payment";'`
);

const migPath = join(ROOT, 'prisma/migrations/20260726150000_measurement_v2_order_snapshots/migration.sql');
const migSql = readFileSync(migPath, 'utf8');
const sum = createHash('sha256').update(migSql).digest('hex');
console.log('B.1 migration sha256=', sum);

const tmpSql = join(tmpdir(), `b1-mig-${Date.now()}.sql`);
writeFileSync(tmpSql, migSql);
sh(`docker exec -i ${CONTAINER} psql -U nmd -d ${DB} -v ON_ERROR_STOP=1 < ${tmpSql}`);
unlinkSync(tmpSql);

const afterOrders = sh(
  `docker exec ${CONTAINER} psql -U nmd -d ${DB} -tAc 'SELECT count(*) FROM "Order";'`
);
const afterPayments = sh(
  `docker exec ${CONTAINER} psql -U nmd -d ${DB} -tAc 'SELECT count(*) FROM "Payment";'`
);
const col = sh(
  `docker exec ${CONTAINER} psql -U nmd -d ${DB} -tAc "SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='Order' AND column_name='pricingSchemaVersion';"`
);
const nulls = sh(
  `docker exec ${CONTAINER} psql -U nmd -d ${DB} -tAc 'SELECT count(*) FROM "Order" WHERE "pricingSchemaVersion" IS NULL;'`
);

console.log({ beforeOrders, afterOrders, beforePayments, afterPayments, col, nulls });

if (beforeOrders !== afterOrders || beforePayments !== afterPayments) {
  console.error('FAIL: row counts changed');
  process.exit(1);
}
if (col !== '1') {
  console.error('FAIL: pricingSchemaVersion missing');
  process.exit(1);
}
if (nulls !== '0') {
  console.error('FAIL: null pricingSchemaVersion values');
  process.exit(1);
}

console.log('Migration verification OK (schema-only disposable DB; production untouched)');
