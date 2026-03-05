-- AlterTable: add openTime, closeTime, forceClosed to Tenant (business hours / force closed)
-- Safe for already-updated DBs: IF NOT EXISTS prevents duplicate column errors
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "openTime" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "closeTime" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "forceClosed" BOOLEAN DEFAULT false;
