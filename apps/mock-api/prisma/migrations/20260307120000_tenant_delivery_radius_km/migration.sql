-- AlterTable: add deliveryRadiusKm for Super Admin store management (fix "Out of Range")
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "deliveryRadiusKm" DOUBLE PRECISION;
