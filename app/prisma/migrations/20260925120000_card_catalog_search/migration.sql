-- Card catalog + name search.
-- pg_trgm powers fuzzy/substring name search ("charizard 151") in milliseconds.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- AlterTable
ALTER TABLE "cards" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "imageUrlLarge" TEXT,
ADD COLUMN     "number" TEXT,
ADD COLUMN     "searchText" TEXT NOT NULL DEFAULT '';

-- Backfill search text for cards that already exist (mirrors buildSearchText()).
UPDATE "cards" SET "searchText" = lower(concat_ws(' ', "name", "setName", "setCode", "id"));

-- CreateIndex
CREATE INDEX "cards_searchText_idx" ON "cards" USING GIN ("searchText" gin_trgm_ops);
