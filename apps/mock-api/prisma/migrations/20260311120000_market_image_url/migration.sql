-- AlterTable: add imageUrl to Market for persistent market banner/card image (admin settings)
ALTER TABLE "Market" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
