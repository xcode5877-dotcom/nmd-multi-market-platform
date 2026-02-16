-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "branding" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER,
    "paymentCapabilities" TEXT
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL,
    "secondaryColor" TEXT NOT NULL,
    "fontFamily" TEXT NOT NULL,
    "radiusScale" REAL NOT NULL,
    "layoutStyle" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TEXT NOT NULL,
    "templateId" TEXT,
    "hero" TEXT,
    "banners" TEXT,
    "whatsappPhone" TEXT,
    "type" TEXT,
    "marketCategory" TEXT,
    "marketId" TEXT,
    "isListedInMarket" BOOLEAN,
    "marketSortOrder" INTEGER,
    "tenantType" TEXT,
    "deliveryProviderMode" TEXT,
    "allowMarketCourierFallback" BOOLEAN,
    "defaultPrepTimeMin" INTEGER,
    "financialConfig" TEXT,
    "paymentCapabilities" TEXT
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "marketId" TEXT,
    "tenantId" TEXT,
    "courierId" TEXT,
    "password" TEXT
);

-- CreateTable
CREATE TABLE "Courier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "marketId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "isAvailable" BOOLEAN,
    "deliveryCount" INTEGER
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT,
    "courierId" TEXT,
    "marketId" TEXT,
    "status" TEXT,
    "fulfillmentType" TEXT,
    "total" REAL,
    "createdAt" TEXT,
    "payment" TEXT,
    "deliveryTimeline" TEXT,
    "payload" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Market_slug_key" ON "Market"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
