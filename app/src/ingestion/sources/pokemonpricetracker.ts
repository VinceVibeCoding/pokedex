// PokemonPriceTracker (https://www.pokemonpricetracker.com/api-reference) — free tier:
// 100 credits/day, 60 calls/min, personal/hobby use only (commercial needs Business).
// Used for GRADED prices: `includeEbay=true` returns eBay sales per grade, including
// a daily history `ebay.priceHistory[grade][YYYY-MM-DD] = { average, count }`.
// Cost: 2 credits per card (1 base + 1 eBay) with limit=1. Free plans cap history
// depth (`days` ≤ 3), so graded history builds up by refreshing daily.
// Individual sold listings (`soldListings`) are Business-plan only — not used.
// Auth: Bearer token. Keyed by TCGplayer product ID. Prices are in dollars.

import type { GradeTier } from "../../types/domain";
import { getJson } from "./http";
import { dollarsToCents, type DailyPoint } from "./types";

const BASE_URL = process.env.PPT_BASE_URL ?? "https://www.pokemonpricetracker.com/api/v2";
const COST_PER_CARD = 2;

/** Grade keys as PokemonPriceTracker writes them → our tiers. Other graders are ignored. */
const GRADE_KEYS: Record<string, GradeTier> = { psa10: "psa10", psa9: "psa9", psa8: "psa8" };

interface EbayDay {
  average?: number | null;
  count?: number | null;
}

export interface PptCard {
  tcgPlayerId?: string | number;
  ebay?: {
    priceHistory?: Record<string, Record<string, EbayDay>>;
  } | null;
}

interface PptResponse {
  data: PptCard[] | PptCard | null;
}

export function isPptConfigured(): boolean {
  return Boolean(process.env.POKEMONPRICETRACKER_API_KEY);
}

/** Pure: eBay daily history per grade → daily points. */
export function parseEbayHistory(card: PptCard | null): DailyPoint[] {
  const history = card?.ebay?.priceHistory ?? {};
  const points: DailyPoint[] = [];
  for (const [gradeKey, days] of Object.entries(history)) {
    const gradeTier = GRADE_KEYS[gradeKey.toLowerCase()];
    if (!gradeTier || !days) continue;
    for (const [date, day] of Object.entries(days)) {
      const avg = dollarsToCents(day?.average);
      if (avg === null) continue;
      points.push({
        source: "ppt_ebay",
        gradeTier,
        date: date.slice(0, 10),
        avgPriceCents: avg,
        medianPriceCents: null,
        lowPriceCents: null,
        highPriceCents: null,
        saleCount: Math.max(0, day?.count ?? 0),
        approxSaleCount: false,
      });
    }
  }
  return points;
}

/** Graded eBay daily history for one card. 2 credits. */
export async function fetchGradedHistory(tcgplayerId: string): Promise<DailyPoint[]> {
  const url = new URL(`${BASE_URL}/cards`);
  url.searchParams.set("tcgPlayerId", tcgplayerId);
  url.searchParams.set("includeEbay", "true");
  url.searchParams.set("days", "90"); // capped by plan (free: 3)
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
  return parseEbayHistory(card);
}

export const PPT_COST_PER_CARD = COST_PER_CARD;
