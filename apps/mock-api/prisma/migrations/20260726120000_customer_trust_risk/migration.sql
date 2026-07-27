-- CreateTable
CREATE TABLE "CustomerTrustProfile" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "cashOnDeliveryAllowed" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TEXT,
    "createdAt" TEXT NOT NULL,
    "updatedAt" TEXT NOT NULL,
    "lastIncidentAt" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "CustomerTrustProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerTrustIncident" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT,
    "incidentType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedBy" TEXT,
    "resolvedAt" TEXT,

    CONSTRAINT "CustomerTrustIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerTrustAuditLog" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "CustomerTrustAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerTrustOrderAck" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "confirmedBy" TEXT NOT NULL,
    "confirmedAt" TEXT NOT NULL,

    CONSTRAINT "CustomerTrustOrderAck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerTrustProfile_customerId_key" ON "CustomerTrustProfile"("customerId");

-- CreateIndex
CREATE INDEX "CustomerTrustProfile_riskLevel_idx" ON "CustomerTrustProfile"("riskLevel");

-- CreateIndex
CREATE INDEX "CustomerTrustProfile_status_idx" ON "CustomerTrustProfile"("status");

-- CreateIndex
CREATE INDEX "CustomerTrustProfile_requiresConfirmation_idx" ON "CustomerTrustProfile"("requiresConfirmation");

-- CreateIndex
CREATE INDEX "CustomerTrustProfile_cashOnDeliveryAllowed_idx" ON "CustomerTrustProfile"("cashOnDeliveryAllowed");

-- CreateIndex
CREATE INDEX "CustomerTrustIncident_customerId_idx" ON "CustomerTrustIncident"("customerId");

-- CreateIndex
CREATE INDEX "CustomerTrustIncident_orderId_idx" ON "CustomerTrustIncident"("orderId");

-- CreateIndex
CREATE INDEX "CustomerTrustIncident_incidentType_idx" ON "CustomerTrustIncident"("incidentType");

-- CreateIndex
CREATE INDEX "CustomerTrustIncident_createdAt_idx" ON "CustomerTrustIncident"("createdAt");

-- CreateIndex
CREATE INDEX "CustomerTrustIncident_resolved_idx" ON "CustomerTrustIncident"("resolved");

-- CreateIndex
CREATE INDEX "CustomerTrustAuditLog_customerId_idx" ON "CustomerTrustAuditLog"("customerId");

-- CreateIndex
CREATE INDEX "CustomerTrustAuditLog_createdAt_idx" ON "CustomerTrustAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "CustomerTrustAuditLog_action_idx" ON "CustomerTrustAuditLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerTrustOrderAck_orderId_key" ON "CustomerTrustOrderAck"("orderId");

-- CreateIndex
CREATE INDEX "CustomerTrustOrderAck_customerId_idx" ON "CustomerTrustOrderAck"("customerId");

-- AddForeignKey
ALTER TABLE "CustomerTrustProfile" ADD CONSTRAINT "CustomerTrustProfile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerTrustIncident" ADD CONSTRAINT "CustomerTrustIncident_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerTrustAuditLog" ADD CONSTRAINT "CustomerTrustAuditLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerTrustOrderAck" ADD CONSTRAINT "CustomerTrustOrderAck_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
