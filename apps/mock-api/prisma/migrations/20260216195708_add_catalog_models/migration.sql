-- CreateTable
CREATE TABLE "CatalogCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "parentId" TEXT,
    "isVisible" BOOLEAN DEFAULT true
);

-- CreateTable
CREATE TABLE "CatalogProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "basePrice" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    "imageUrl" TEXT,
    "images" TEXT,
    "optionGroups" TEXT,
    "variants" TEXT,
    "stock" INTEGER,
    "isAvailable" BOOLEAN NOT NULL,
    "createdAt" TEXT,
    "isFeatured" BOOLEAN
);

-- CreateTable
CREATE TABLE "CatalogOptionGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "required" BOOLEAN NOT NULL,
    "minSelected" INTEGER NOT NULL,
    "maxSelected" INTEGER NOT NULL,
    "selectionType" TEXT NOT NULL,
    "scope" TEXT,
    "scopeId" TEXT,
    "allowHalfPlacement" BOOLEAN,
    "items" TEXT
);

-- CreateIndex
CREATE INDEX "CatalogCategory_tenantId_idx" ON "CatalogCategory"("tenantId");

-- CreateIndex
CREATE INDEX "CatalogProduct_tenantId_idx" ON "CatalogProduct"("tenantId");

-- CreateIndex
CREATE INDEX "CatalogProduct_tenantId_categoryId_idx" ON "CatalogProduct"("tenantId", "categoryId");

-- CreateIndex
CREATE INDEX "CatalogOptionGroup_tenantId_idx" ON "CatalogOptionGroup"("tenantId");
