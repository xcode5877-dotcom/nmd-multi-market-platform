-- Additive V3 columns for driver cash reconciliation (non-destructive).
-- Rollback: ALTER TABLE "DriverCollectionSettlement" DROP COLUMN IF EXISTS ...

ALTER TABLE "DriverCollectionSettlement" ADD COLUMN IF NOT EXISTS "settlementMode" TEXT NOT NULL DEFAULT 'PLATFORM_ONLY';
ALTER TABLE "DriverCollectionSettlement" ADD COLUMN IF NOT EXISTS "cashInHandTotal" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "DriverCollectionSettlement" ADD COLUMN IF NOT EXISTS "platformLiabilityTotal" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "DriverCollectionSettlement" ADD COLUMN IF NOT EXISTS "restaurantLiabilityTotal" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "DriverCollectionSettlement" ADD COLUMN IF NOT EXISTS "settlementBasisAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "DriverCollectionSettlement" ADD COLUMN IF NOT EXISTS "settledAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "DriverCollectionSettlement" ADD COLUMN IF NOT EXISTS "differenceAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "DriverCollectionSettlement" ADD COLUMN IF NOT EXISTS "entryType" TEXT NOT NULL DEFAULT 'SETTLEMENT';
