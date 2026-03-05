-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "branding" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER,
    "paymentCapabilities" TEXT,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL,
    "secondaryColor" TEXT NOT NULL,
    "fontFamily" TEXT NOT NULL,
    "radiusScale" DOUBLE PRECISION NOT NULL,
    "layoutStyle" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TEXT NOT NULL,
    "templateId" TEXT,
    "hero" TEXT,
    "banners" TEXT,
    "whatsappPhone" TEXT,
    "type" TEXT,
    "businessType" TEXT DEFAULT 'RETAIL',
    "marketCategory" TEXT,
    "marketId" TEXT,
    "isListedInMarket" BOOLEAN,
    "marketSortOrder" INTEGER,
    "tenantType" TEXT,
    "deliveryProviderMode" TEXT,
    "allowMarketCourierFallback" BOOLEAN,
    "defaultPrepTimeMin" INTEGER,
    "financialConfig" TEXT,
    "paymentCapabilities" TEXT,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "marketId" TEXT,
    "tenantId" TEXT,
    "courierId" TEXT,
    "password" TEXT,
    "mustChangePassword" BOOLEAN DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Courier" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "marketId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "isAvailable" BOOLEAN,
    "deliveryCount" INTEGER,

    CONSTRAINT "Courier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "courierId" TEXT,
    "marketId" TEXT,
    "status" TEXT,
    "fulfillmentType" TEXT,
    "orderType" TEXT DEFAULT 'PRODUCT',
    "total" DOUBLE PRECISION,
    "createdAt" TEXT,
    "payment" TEXT,
    "deliveryTimeline" TEXT,
    "payload" TEXT,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "provider" TEXT,
    "providerRef" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "parentId" TEXT,
    "isVisible" BOOLEAN DEFAULT true,

    CONSTRAINT "CatalogCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogProduct" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "imageUrl" TEXT,
    "images" TEXT,
    "optionGroups" TEXT,
    "variants" TEXT,
    "stock" INTEGER,
    "isAvailable" BOOLEAN NOT NULL,
    "createdAt" TEXT,
    "isFeatured" BOOLEAN,

    CONSTRAINT "CatalogProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogOptionGroup" (
    "id" TEXT NOT NULL,
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
    "items" TEXT,

    CONSTRAINT "CatalogOptionGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantDeliverySettings" (
    "tenantId" TEXT NOT NULL,
    "modes" TEXT,
    "minimumOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payload" TEXT,

    CONSTRAINT "TenantDeliverySettings_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "DeliveryZone" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fee" DOUBLE PRECISION NOT NULL,
    "etaMinutes" INTEGER,
    "minimumOrder" DOUBLE PRECISION,
    "geo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER,

    CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Market_slug_key" ON "Market"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orderId_key" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "CatalogCategory_tenantId_idx" ON "CatalogCategory"("tenantId");

-- CreateIndex
CREATE INDEX "CatalogProduct_tenantId_idx" ON "CatalogProduct"("tenantId");

-- CreateIndex
CREATE INDEX "CatalogProduct_tenantId_categoryId_idx" ON "CatalogProduct"("tenantId", "categoryId");

-- CreateIndex
CREATE INDEX "CatalogOptionGroup_tenantId_idx" ON "CatalogOptionGroup"("tenantId");

-- CreateIndex
CREATE INDEX "DeliveryZone_tenantId_idx" ON "DeliveryZone"("tenantId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

