// PokemonPriceTracker (https://www.pokemonpricetracker.com/api-reference) — free tier:
// 100 credits/day, 60 calls/min, personal/hobby use only (commercial needs Business).
// Used for GRADED prices: `includeEbay=true` returns `ebay.salesByGrade[grade]`, a
// rolling AGGREGATE per grade (average/median/min/max price, a sale count, and
// lastSaleDate) — NOT a day-by-day history (the API has no such field; an earlier
// version of this adapter assumed `ebay.priceHistory[grade][date]`, which the real
// API never returns, so graded prices silently never populated). `count` covers
// PPT's own internal lookback window (`smartMarketPrice.daysUsed`, commonly 90-400+
// days) — treating it as "sales today" would badly inflate salesPerDay/salesPerWeek
// and the buy score's liquidity bonus, so we store weight 1 (one fresh snapshot)
// and flag `approxSaleCount: true`; the real count isn't surfaced. The row is dated
// at `lastSaleDate`, not the fetch date, so "last sale" stays accurate and repeat
// refreshes with no new sale just update the same day's row (upsert) instead of
// fabricating a new one.
// Individual sold listings (`soldListings`) are Business-plan only — not used.
// Cost: 2 credits per card (1 base + 1 eBay) with limit=1.
// Auth: Bearer token. Keyed by TCGplayer product ID. Prices are in dollars.

import type { GradeTier } from "../../types/domain";
import { getJson } from "./http";
import { dollarsToCents, type DailyPoint } from "./types";

const BASE_URL = process.env.PPT_BASE_URL ?? "https://www.pokemonpricetracker.com/api/v2";
const COST_PER_CARD = 2;

/** Grade keys as PokemonPriceTracker writes them → our tiers. Other graders (e.g. psa8_5) are ignored. */
const GRADE_KEYS: Record<string, GradeTier> = { psa10: "psa10", psa9: "psa9", psa8: "psa8" };

interface EbayGradeSales {
  count?: number | null;
  averagePrice?: number | null;
  medianPrice?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  lastSaleDate?: string | null;
}

export interface PptCard {
  tcgPlayerId?: string | number;
  ebay?: {
    salesByGrade?: Record<string, EbayGradeSales>;
  } | null;
}

interface PptResponse {
  data: PptCard[] | PptCard | null;
}

export function isPptConfigured(): boolean {
  return Boolean(process.env.POKEMONPRICETRACKER_API_KEY);
}

/** Pure: eBay per-grade aggregates → one daily point per grade, dated at its last real sale. */
export function parseEbaySales(card: PptCard | null): DailyPoint[] {
  const byGrade = card?.ebay?.salesByGrade ?? {};
  const points: DailyPoint[] = [];
  for (const [gradeKey, sales] of Object.entries(byGrade)) {
    const gradeTier = GRADE_KEYS[gradeKey.toLowerCase()];
    if (!gradeTier || !sales || !sales.count || !sales.lastSaleDate) continue;
    const avg = dollarsToCents(sales.averagePrice);
    if (avg === null) continue;
    points.push({
      source: "ppt_ebay",
      gradeTier,
      date: sales.lastSaleDate.slice(0, 10),
      avgPriceCents: avg,
      medianPriceCents: dollarsToCents(sales.medianPrice),
      lowPriceCents: dollarsToCents(sales.minPrice),
      highPriceCents: dollarsToCents(sales.maxPrice),
      saleCount: 1, // weight of "one fresh snapshot" — see file header on why not the real count
      approxSaleCount: true,
    });
  }
  return points;
}

/** Graded eBay sales aggregate for one card. 2 credits. */
export async function fetchGradedHistory(tcgplayerId: string): Promise<DailyPoint[]> {
  const url = new URL(`${BASE_URL}/cards`);
  url.searchParams.set("tcgPlayerId", tcgplayerId);
  url.searchParams.set("includeEbay", "true");
  url.searchParams.set("days", "90"); // unverified effect on salesByGrade; kept as-observed rather than guessed away
  url.searchParams.set("limit", "1"); // billing is on `limit`, not results — keep it at 1

  const res = await getJson<PptResponse>({
    source: "pokemonpricetracker",
    url: url.toString(),
    headers: { Authorization: `Bearer ${process.env.POKEMONPRICETRACKER_API_KEY ?? ""}` },
    cost: COST_PER_CARD,
    minIntervalMs: 1100, // 60 calls/min
    remainingHeader: "x-ratelimit-daily-remaining",
  });
  const card = Array.isArray(res.data) ? (res.data[0] ?? null) : res.data;
  return parseEbaySales(card);
}

export const PPT_COST_PER_CARD = COST_PER_CARD;
