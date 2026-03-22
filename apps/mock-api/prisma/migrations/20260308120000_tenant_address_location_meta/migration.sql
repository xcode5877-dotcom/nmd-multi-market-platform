-- AlterTable: add addressLine, location, meta to Tenant (store address / geo / import meta)
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "addressLine" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "meta" TEXT;
