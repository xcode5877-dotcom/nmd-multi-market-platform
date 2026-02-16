-- AlterTable
ALTER TABLE "Order" ADD COLUMN "orderType" TEXT DEFAULT 'PRODUCT';

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "businessType" TEXT DEFAULT 'RETAIL';
