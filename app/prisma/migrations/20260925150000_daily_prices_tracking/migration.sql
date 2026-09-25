-- CreateEnum
CREATE TYPE "DailySource" AS ENUM ('ppt_ebay', 'poketrace_ebay', 'poketrace_tcgplayer');

-- CreateTable
CREATE TABLE "daily_prices" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "gradeTier" "GradeTier" NOT NULL,
    "source" "DailySource" NOT NULL,
    "date" DATE NOT NULL,
    "avgPriceCents" INTEGER NOT NULL,
    "medianPriceCents" INTEGER,
    "lowPriceCents" INTEGER,
    "highPriceCents" INTEGER,
    "saleCount" INTEGER NOT NULL,
    "approxSaleCount" BOOLEAN NOT NULL DEFAULT false,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracked_cards" (
    "cardId" TEXT NOT NULL,
    "trackedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tcgplayerId" TEXT,
    "poketraceId" TEXT,
    "mappedAt" TIMESTAMP(3),
    "mappingError" TEXT,
    "fetchStartedAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "lastRefreshedAt" TIMESTAMP(3),
    "lastError" TEXT,

    CONSTRAINT "tracked_cards_pkey" PRIMARY KEY ("cardId")
);

-- CreateTable
CREATE TABLE "source_quotas" (
    "source" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "remaining" INTEGER,
    "exhaustedUntil" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_quotas_pkey" PRIMARY KEY ("source")
);

-- CreateIndex
CREATE INDEX "daily_prices_cardId_date_idx" ON "daily_prices"("cardId", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "daily_prices_cardId_gradeTier_source_date_key" ON "daily_prices"("cardId", "gradeTier", "source", "date");

-- CreateIndex
CREATE INDEX "tracked_cards_lastRefreshedAt_idx" ON "tracked_cards"("lastRefreshedAt");

-- AddForeignKey
ALTER TABLE "daily_prices" ADD CONSTRAINT "daily_prices_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracked_cards" ADD CONSTRAINT "tracked_cards_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

