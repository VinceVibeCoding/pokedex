-- Bulk daily price snapshots (pokemontcg.io) for market-wide trend analysis.
CREATE TABLE "card_price_snapshots" (
    "cardId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "tcgVariant" TEXT,
    "tcgMarketCents" INTEGER,
    "tcgLowCents" INTEGER,
    "cmTrendCents" INTEGER,
    "cmAvg1Cents" INTEGER,
    "cmAvg7Cents" INTEGER,
    "cmAvg30Cents" INTEGER,
    "cmUpdatedAt" DATE,

    CONSTRAINT "card_price_snapshots_pkey" PRIMARY KEY ("cardId","date")
);

CREATE INDEX "card_price_snapshots_date_idx" ON "card_price_snapshots"("date");

ALTER TABLE "card_price_snapshots" ADD CONSTRAINT "card_price_snapshots_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "snapshot_cursor" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "nextPage" INTEGER NOT NULL DEFAULT 1,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "snapshot_cursor_pkey" PRIMARY KEY ("id")
);
