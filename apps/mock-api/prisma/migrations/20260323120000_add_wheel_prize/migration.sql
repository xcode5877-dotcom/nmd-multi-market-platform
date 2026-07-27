-- CreateTable
CREATE TABLE "WheelPrize" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "chanceWeight" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "WheelPrize_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WheelPrize_isActive_idx" ON "WheelPrize"("isActive");
