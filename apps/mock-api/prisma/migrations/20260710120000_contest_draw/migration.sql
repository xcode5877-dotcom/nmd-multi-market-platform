-- ContestDraw: permanent promotional draw audit log (Super Admin).
-- Do NOT delete rows. Winner selection uses crypto.randomInt on the server.

CREATE TABLE "ContestDraw" (
    "id" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "winnerCustomerId" TEXT NOT NULL,
    "winnerParticipationId" TEXT NOT NULL,
    "winnerNameSnapshot" TEXT NOT NULL,
    "winnerPhoneSnapshot" TEXT NOT NULL,
    "participantsCount" INTEGER NOT NULL,
    "eligibleParticipantsCount" INTEGER NOT NULL,
    "performedByUserId" TEXT NOT NULL,
    "performedByRole" TEXT NOT NULL,
    "randomIndex" INTEGER NOT NULL,
    "randomMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "confirmedAt" TEXT,
    "confirmationBy" TEXT,
    "cancelReason" TEXT,
    "cancelledAt" TEXT,
    "cancelledBy" TEXT,
    "metadata" TEXT,
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "notificationError" TEXT,

    CONSTRAINT "ContestDraw_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContestDraw_contestId_idx" ON "ContestDraw"("contestId");
CREATE INDEX "ContestDraw_status_idx" ON "ContestDraw"("status");
CREATE INDEX "ContestDraw_createdAt_idx" ON "ContestDraw"("createdAt");
CREATE INDEX "ContestDraw_winnerCustomerId_idx" ON "ContestDraw"("winnerCustomerId");

ALTER TABLE "ContestDraw" ADD CONSTRAINT "ContestDraw_contestId_fkey"
  FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
