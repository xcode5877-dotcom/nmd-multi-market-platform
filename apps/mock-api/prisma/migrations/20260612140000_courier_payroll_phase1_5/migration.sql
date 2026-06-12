-- Phase 1.5: ledger idempotency, shift auto-close, tenant commission overrides

-- Partial unique: one DELIVERY_FEE / ORDER_COMMISSION per courier+order
CREATE UNIQUE INDEX IF NOT EXISTS "CourierEarningsLedger_courier_type_ref_order_unique"
ON "CourierEarningsLedger" ("courierId", "type", "referenceId")
WHERE "type" IN ('DELIVERY_FEE', 'ORDER_COMMISSION') AND "referenceId" IS NOT NULL;

ALTER TABLE "CourierShift" ADD COLUMN IF NOT EXISTS "autoClosed" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "TenantDriverCommissionOverride" (
    "tenantId" TEXT NOT NULL,
    "orderCommissionPercent" DOUBLE PRECISION NOT NULL,
    "updatedAt" TEXT NOT NULL,
    CONSTRAINT "TenantDriverCommissionOverride_pkey" PRIMARY KEY ("tenantId")
);

CREATE TABLE IF NOT EXISTS "CourierTenantCommissionOverride" (
    "tenantId" TEXT NOT NULL,
    "courierId" TEXT NOT NULL,
    "orderCommissionPercent" DOUBLE PRECISION NOT NULL,
    "updatedAt" TEXT NOT NULL,
    CONSTRAINT "CourierTenantCommissionOverride_pkey" PRIMARY KEY ("tenantId", "courierId")
);

CREATE INDEX IF NOT EXISTS "CourierTenantCommissionOverride_courierId_idx"
ON "CourierTenantCommissionOverride"("courierId");
