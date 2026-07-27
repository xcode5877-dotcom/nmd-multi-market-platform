-- CreateTable
CREATE TABLE "CustomerCoin" (
    "customerPhone" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TEXT NOT NULL,

    CONSTRAINT "CustomerCoin_pkey" PRIMARY KEY ("customerPhone")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerCoin_customerPhone_key" ON "CustomerCoin"("customerPhone");

-- CreateIndex
CREATE INDEX "CustomerCoin_customerPhone_idx" ON "CustomerCoin"("customerPhone");
