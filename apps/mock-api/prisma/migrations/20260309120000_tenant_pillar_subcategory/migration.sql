-- AlterTable: add pillarId and subCategoryId to Tenant for market section/category filtering
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "pillarId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "subCategoryId" TEXT;
