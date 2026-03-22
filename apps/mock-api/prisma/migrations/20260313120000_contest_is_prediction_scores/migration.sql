-- AlterTable Contest: isPrediction, finalScoreA, finalScoreB
ALTER TABLE "Contest" ADD COLUMN IF NOT EXISTS "isPrediction" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Contest" ADD COLUMN IF NOT EXISTS "finalScoreA" INTEGER;
ALTER TABLE "Contest" ADD COLUMN IF NOT EXISTS "finalScoreB" INTEGER;

-- AlterTable ContestParticipation: scoreA, scoreB
ALTER TABLE "ContestParticipation" ADD COLUMN IF NOT EXISTS "scoreA" INTEGER;
ALTER TABLE "ContestParticipation" ADD COLUMN IF NOT EXISTS "scoreB" INTEGER;
