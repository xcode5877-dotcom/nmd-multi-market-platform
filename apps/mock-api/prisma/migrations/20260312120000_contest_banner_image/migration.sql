-- AlterTable: add banner image for contest popup (celebration/banner)
ALTER TABLE "Contest" ADD COLUMN IF NOT EXISTS "bannerImageUrl" TEXT;
