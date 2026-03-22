-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "tenantId" TEXT,
    "oneTimeUse" BOOLEAN NOT NULL DEFAULT false,
    "winnerPhone" TEXT,
    "usedAt" TEXT,
    "createdAt" TEXT NOT NULL,
    "expiresAt" TEXT,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");
CREATE INDEX "Coupon_code_idx" ON "Coupon"("code");
CREATE INDEX "Coupon_winnerPhone_idx" ON "Coupon"("winnerPhone");
