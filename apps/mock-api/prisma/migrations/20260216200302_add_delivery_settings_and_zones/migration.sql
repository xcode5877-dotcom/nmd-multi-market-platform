-- CreateTable
CREATE TABLE "TenantDeliverySettings" (
    "tenantId" TEXT NOT NULL PRIMARY KEY,
    "modes" TEXT,
    "minimumOrder" REAL NOT NULL DEFAULT 0,
    "deliveryFee" REAL NOT NULL DEFAULT 0,
    "payload" TEXT
);

-- CreateTable
CREATE TABLE "DeliveryZone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fee" REAL NOT NULL,
    "etaMinutes" INTEGER,
    "minimumOrder" REAL,
    "geo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER
);

-- CreateIndex
CREATE INDEX "DeliveryZone_tenantId_idx" ON "DeliveryZone"("tenantId");
