-- Driver Payroll Phase 1: config, shifts, earnings ledger, expense approval, audit

CREATE TABLE IF NOT EXISTS "CourierPayrollConfig" (
    "courierId" TEXT NOT NULL,
    "hourlyRate" DOUBLE PRECISION NOT NULL DEFAULT 35,
    "deliveryFeeShare" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "orderCommissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "isPayrollEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TEXT NOT NULL,
    CONSTRAINT "CourierPayrollConfig_pkey" PRIMARY KEY ("courierId")
);

CREATE TABLE IF NOT EXISTS "CourierShift" (
    "id" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT,
    "durationMinutes" INTEGER,
    "createdAt" TEXT NOT NULL,
    CONSTRAINT "CourierShift_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CourierShift_courierId_idx" ON "CourierShift"("courierId");
CREATE INDEX IF NOT EXISTS "CourierShift_courierId_startTime_idx" ON "CourierShift"("courierId", "startTime");

CREATE TABLE IF NOT EXISTS "CourierEarningsLedger" (
    "id" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "marketId" TEXT,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "referenceId" TEXT,
    "description" TEXT,
    "createdAt" TEXT NOT NULL,
    CONSTRAINT "CourierEarningsLedger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CourierEarningsLedger_courierId_createdAt_idx" ON "CourierEarningsLedger"("courierId", "createdAt");
CREATE INDEX IF NOT EXISTS "CourierEarningsLedger_courierId_type_idx" ON "CourierEarningsLedger"("courierId", "type");
CREATE INDEX IF NOT EXISTS "CourierEarningsLedger_referenceId_type_idx" ON "CourierEarningsLedger"("referenceId", "type");

ALTER TABLE "CourierExpense" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "CourierExpense" ADD COLUMN IF NOT EXISTS "reviewedAt" TEXT;
ALTER TABLE "CourierExpense" ADD COLUMN IF NOT EXISTS "reviewedBy" TEXT;

UPDATE "CourierExpense" SET "status" = 'APPROVED' WHERE "status" = 'PENDING' OR "status" IS NULL;

CREATE INDEX IF NOT EXISTS "CourierExpense_status_idx" ON "CourierExpense"("status");

CREATE TABLE IF NOT EXISTS "DriverPayrollAudit" (
    "id" TEXT NOT NULL,
    "courierId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TEXT NOT NULL,
    CONSTRAINT "DriverPayrollAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DriverPayrollAudit_courierId_idx" ON "DriverPayrollAudit"("courierId");
CREATE INDEX IF NOT EXISTS "DriverPayrollAudit_createdAt_idx" ON "DriverPayrollAudit"("createdAt");
