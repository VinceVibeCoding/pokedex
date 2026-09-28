// Sold History — the most recent days on which each card + grade actually sold.
// Reads DailyPrice (the real price source; see movers.ts). Sources overlap (the same
// eBay sales appear in PokeTrace and PokemonPriceTracker), so rows are NEVER summed:
//   sources "all"  → every source is its own row, labeled (the /sold page)
//   sources "best" → one row per card + grade + day, by SOURCE_PREFERENCE (home strip)

import { getPrisma } from "../lib/prisma";
import { searchCardIds } from "./search";
import type { GradeTier } from "../types/domain";
import type { DailySourceName } from "../ingestion/sources/types";

export const SOURCE_SHORT_LABELS: Record<DailySourceName, string> = {
  ppt_ebay: "eBay · PPT",
  poketrace_ebay: "eBay · PokeTrace",
  poketrace_tcgplayer: "TCGplayer",
};
export const SOLD_SOURCES = Object.keys(SOURCE_SHORT_LABELS) as DailySourceName[];

const SOURCE_PREFERENCE: DailySourceName[] = ["ppt_ebay", "poketrace_ebay", "poketrace_tcgplayer"];
const LOOKBACK_DAYS = 30;
export const SOLD_PAGE_SIZE = 40;

export interface SoldEntry {
  cardId: string;
  cardName: string;
  setName: string;
  imageUrl: string | null;
  gradeTier: GradeTier;
  date: string; // ISO
  avgPriceCents: number;
  lowPriceCents: number | null;
  highPriceCents: number | null;
  saleCount: number;
  source: DailySourceName;
}

export type SoldSort = "recent" | "price";

export async function getSoldHistory(opts: { grade?: GradeTier | null; sort?: SoldSort; limit?: number; sources?: "all" | "best"; source?: DailySourceName | null; q?: string } = {}): Promise<SoldEntry[]> {
  const { grade = null, sort = "recent", limit = SOLD_PAGE_SIZE, sources = "best", source = null, q = "" } = opts;
  const cardIds = q.trim() ? await searchCardIds(q) : null;
  if (cardIds && cardIds.length === 0) return [];
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);

  const rows = await getPrisma().dailyPrice.findMany({
    where: { date: { gte: since }, saleCount: { gt: 0 }, ...(grade ? { gradeTier: grade } : {}), ...(source ? { source } : {}), ...(cardIds ? { cardId: { in: cardIds } } : {}) },
    orderBy: { date: "desc" },
    select: {
      cardId: true,
      gradeTier: true,
      source: true,
      date: true,
      avgPriceCents: true,
      lowPriceCents: true,
      highPriceCents: true,
      saleCount: true,
    },
  });

  const best = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const key = `${row.cardId}:${row.gradeTier}:${row.date.toISOString()}${sources === "all" ? `:${row.source}` : ""}`;
    const existing = best.get(key);
    if (!existing || SOURCE_PREFERENCE.indexOf(row.source) < SOURCE_PREFERENCE.indexOf(existing.source)) best.set(key, row);
  }

  const picked = [...best.values()]
    .sort((a, b) => (sort === "price" ? b.avgPriceCents - a.avgPriceCents : b.date.getTime() - a.date.getTime()))
    .slice(0, limit);

  const cards = await getPrisma().card.findMany({
    where: { id: { in: [...new Set(picked.map((r) => r.cardId))] } },
    select: { id: true, name: true, setName: true, imageUrl: true },
  });
  const cardById = new Map(cards.map((c) => [c.id, c]));

  return picked.flatMap((r) => {
    const card = cardById.get(r.cardId);
    if (!card) return [];
    return [
      {
        cardId: r.cardId,
        cardName: card.name,
        setName: card.setName,
        imageUrl: card.imageUrl,
        gradeTier: r.gradeTier,
        date: r.date.toISOString(),
        avgPriceCents: r.avgPriceCents,
        lowPriceCents: r.lowPriceCents,
        highPriceCents: r.highPriceCents,
        saleCount: r.saleCount,
        source: r.source,
      },
    ];
  });
}
