-- CreateTable
CREATE TABLE "Contest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "options" TEXT,
    "correctAnswer" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rewardCode" TEXT,
    "expiresAt" TEXT,
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "Contest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContestParticipation" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "userAnswer" TEXT NOT NULL,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "ContestParticipation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContestParticipation_customerId_contestId_key" ON "ContestParticipation"("customerId", "contestId");
CREATE INDEX "ContestParticipation_contestId_idx" ON "ContestParticipation"("contestId");
CREATE INDEX "ContestParticipation_customerId_idx" ON "ContestParticipation"("customerId");

-- AddForeignKey
ALTER TABLE "ContestParticipation" ADD CONSTRAINT "ContestParticipation_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Contest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
