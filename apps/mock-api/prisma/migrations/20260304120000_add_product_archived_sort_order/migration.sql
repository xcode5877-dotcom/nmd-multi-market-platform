-- AlterTable
ALTER TABLE "CatalogProduct" ADD COLUMN "isArchived" BOOLEAN DEFAULT false;
ALTER TABLE "CatalogProduct" ADD COLUMN "sortOrder" INTEGER DEFAULT 0;
