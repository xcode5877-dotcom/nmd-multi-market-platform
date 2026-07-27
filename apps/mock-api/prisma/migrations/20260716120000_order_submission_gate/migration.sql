-- AlterTable
ALTER TABLE "Order" ADD COLUMN "submissionScheduledAt" TIMESTAMP(3),
ADD COLUMN "submittedAt" TIMESTAMP(3),
ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "cancelledBeforeSubmission" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Order_submittedAt_submissionScheduledAt_idx" ON "Order"("submittedAt", "submissionScheduledAt");

-- Backfill omitted: production audit 2026-07-16 found 0 rows with gate keys in payload.
-- If needed later, run a one-time UPDATE from payload JSON (non-destructive).
