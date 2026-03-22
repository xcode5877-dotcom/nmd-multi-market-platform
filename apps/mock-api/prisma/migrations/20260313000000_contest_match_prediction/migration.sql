-- AlterTable: add match prediction team names
ALTER TABLE "Contest" ADD COLUMN IF NOT EXISTS "teamAName" TEXT;
ALTER TABLE "Contest" ADD COLUMN IF NOT EXISTS "teamBName" TEXT;
