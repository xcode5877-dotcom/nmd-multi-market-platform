-- Phase 2: payroll settlements (freeze period earnings)

CREATE TABLE IF NOT EXISTS "CourierPayrollSettlement" (
    "id" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "marketId" TEXT,
    "periodStart" TEXT NOT NULL,
    "periodEnd" TEXT NOT NULL,
    "grossAmount" DOUBLE PRECISION NOT NULL,
    "expensesAmount" DOUBLE PRECISION NOT NULL,
    "netAmount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "snapshot" TEXT,
    "createdBy" TEXT,
    "createdAt" TEXT NOT NULL,
    CONSTRAINT "CourierPayrollSettlement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CourierPayrollSettlement_courierId_idx" ON "CourierPayrollSettlement"("courierId");
CREATE INDEX IF NOT EXISTS "CourierPayrollSettlement_courierId_periodStart_periodEnd_idx" ON "CourierPayrollSettlement"("courierId", "periodStart", "periodEnd");
CREATE INDEX IF NOT EXISTS "CourierPayrollSettlement_createdAt_idx" ON "CourierPayrollSettlement"("createdAt");
CREATE INDEX IF NOT EXISTS "CourierPayrollSettlement_marketId_idx" ON "CourierPayrollSettlement"("marketId");
