-- Measurement V2: product measurement fields + tenant supportsWeightSelling
-- Existing products default to PIECE / piece / step 1 (behaviourally unchanged).

CREATE TYPE "MeasurementType" AS ENUM ('PIECE', 'WEIGHT', 'VOLUME', 'PACKAGE');
CREATE TYPE "BaseUnitCode" AS ENUM ('KG', 'L', 'PIECE', 'PACK', 'BOX', 'BUNDLE');
CREATE TYPE "DisplayUnitCode" AS ENUM ('KG', 'G', 'L', 'ML', 'PIECE', 'PACK', 'BOX', 'BUNDLE');
CREATE TYPE "PriceBasis" AS ENUM ('PER_BASE_UNIT');

ALTER TABLE "CatalogProduct"
  ADD COLUMN "measurementType" "MeasurementType" NOT NULL DEFAULT 'PIECE',
  ADD COLUMN "baseUnitCode" "BaseUnitCode" NOT NULL DEFAULT 'PIECE',
  ADD COLUMN "displayUnitCode" "DisplayUnitCode" NOT NULL DEFAULT 'PIECE',
  ADD COLUMN "quantityStep" DECIMAL(12,3) NOT NULL DEFAULT 1,
  ADD COLUMN "minimumQuantity" DECIMAL(12,3) NOT NULL DEFAULT 1,
  ADD COLUMN "maximumQuantity" DECIMAL(12,3),
  ADD COLUMN "priceBasis" "PriceBasis" NOT NULL DEFAULT 'PER_BASE_UNIT',
  ADD COLUMN "measurementVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "displayPrecision" INTEGER;

ALTER TABLE "Tenant"
  ADD COLUMN "supportsWeightSelling" BOOLEAN NOT NULL DEFAULT false;
