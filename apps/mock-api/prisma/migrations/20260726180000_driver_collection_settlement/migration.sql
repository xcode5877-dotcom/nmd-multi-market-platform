-- Append-only driver collection settlements (Now Market cash reconciliation).
CREATE TABLE IF NOT EXISTS "DriverCollectionSettlement" (
    "id" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "marketId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "deliveryFeesTotal" DOUBLE PRECISION NOT NULL,
    "platformCommissionTotal" DOUBLE PRECISION NOT NULL,
    "ordersCount" INTEGER NOT NULL,
    "orderIds" TEXT NOT NULL,
    "shiftLabel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SETTLED',
    "settledAt" TEXT NOT NULL,
    "settledBy" TEXT NOT NULL,
    "settlementReference" TEXT,
    "settlementNotes" TEXT,
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "DriverCollectionSettlement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DriverCollectionSettlement_courierId_idx" ON "DriverCollectionSettlement"("courierId");
CREATE INDEX IF NOT EXISTS "DriverCollectionSettlement_settledAt_idx" ON "DriverCollectionSettlement"("settledAt");
CREATE INDEX IF NOT EXISTS "DriverCollectionSettlement_marketId_idx" ON "DriverCollectionSettlement"("marketId");
