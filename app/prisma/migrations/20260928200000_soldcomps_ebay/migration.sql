-- Individual eBay sold listings from SoldComps, plus a per-card "last fetched" marker.
ALTER TYPE "CompSource" ADD VALUE 'soldcomps_ebay';

ALTER TABLE "tracked_cards" ADD COLUMN "compsFetchedAt" TIMESTAMP(3);
