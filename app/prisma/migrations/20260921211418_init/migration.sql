-- CreateEnum
CREATE TYPE "GradeTier" AS ENUM ('raw', 'psa8', 'psa9', 'psa10');

-- CreateEnum
CREATE TYPE "CompSource" AS ENUM ('tcgplayer', 'collectr', 'one30point');

-- CreateEnum
CREATE TYPE "RollupWindow" AS ENUM ('daily', 'weekly', 'monthly');

-- CreateTable
CREATE TABLE "cards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "setName" TEXT NOT NULL,
    "setCode" TEXT NOT NULL,
    "releaseDate" DATE NOT NULL,
    "cardType" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "pullRate" DOUBLE PRECISION,
    "artist" TEXT,
    "printVariant" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comps" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "gradeTier" "GradeTier" NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "soldAt" TIMESTAMP(3) NOT NULL,
    "condition" TEXT,
    "source" "CompSource" NOT NULL,
    "sourceUrl" TEXT,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comp_rollups" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "gradeTier" "GradeTier" NOT NULL,
    "window" "RollupWindow" NOT NULL,
    "windowStart" DATE NOT NULL,
    "salesCount" INTEGER NOT NULL,
    "minPriceCents" INTEGER,
    "maxPriceCents" INTEGER,
    "avgPriceCents" INTEGER,
    "medianPriceCents" INTEGER,
    "lastSaleAt" TIMESTAMP(3),
    "lastSalePriceCents" INTEGER,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comp_rollups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comps_cardId_gradeTier_soldAt_idx" ON "comps"("cardId", "gradeTier", "soldAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "comps_source_sourceUrl_key" ON "comps"("source", "sourceUrl");

-- CreateIndex
CREATE INDEX "comp_rollups_cardId_gradeTier_window_windowStart_idx" ON "comp_rollups"("cardId", "gradeTier", "window", "windowStart" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "comp_rollups_cardId_gradeTier_window_windowStart_key" ON "comp_rollups"("cardId", "gradeTier", "window", "windowStart");

-- AddForeignKey
ALTER TABLE "comps" ADD CONSTRAINT "comps_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comp_rollups" ADD CONSTRAINT "comp_rollups_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
