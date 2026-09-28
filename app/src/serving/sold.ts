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

// ---------- grouped feed (one row per card + grade), the /sold page ----------

const FEED_LOOKBACK_DAYS = 365;
export const FEED_PAGE_SIZE = 25;
const LAST_SALES_SHOWN = 6;

export interface SoldGroup {
  cardId: string;
  cardName: string;
  setName: string;
  number: string | null;
  imageUrl: string | null;
  gradeTier: GradeTier;
  latest: { date: string; priceCents: number; saleCount: number; source: DailySourceName };
  vsLastPct: number | null; // latest sale day vs the sale day before it
  totalSales: number; // sales across the lookback, best source only
  history: Array<{ date: string; value: number }>; // ascending, best source only
  lastSales: Array<{ date: string; source: DailySourceName; priceCents: number; saleCount: number }>; // every source, newest first
}

export interface SoldFeedOptions {
  grade?: GradeTier | null;
  sort?: SoldSort;
  q?: string;
  source?: DailySourceName | null;
  minCents?: number | null;
  maxCents?: number | null;
  days?: number | null; // only groups whose latest sale is within N days
  set?: string | null;
  page?: number;
}

/**
 * One row per card + grade. Headline price, "vs last sale" and the chart come from ONE
 * source (the one with the most sales; ties → SOURCE_PREFERENCE) so overlapping eBay
 * feeds are never double counted; the "last sales" list shows every source, labeled.
 */
export async function getSoldFeed(opts: SoldFeedOptions = {}): Promise<{ groups: SoldGroup[]; total: number; sets: string[] }> {
  const { grade = null, sort = "recent", q = "", source = null, minCents = null, maxCents = null, days = null, set = null, page = 1 } = opts;
  const since = new Date(Date.now() - FEED_LOOKBACK_DAYS * 86_400_000);
  const cardIds = q.trim() ? await searchCardIds(q) : null;
  if (cardIds && cardIds.length === 0) return { groups: [], total: 0, sets: [] };

  const rows = await getPrisma().dailyPrice.findMany({
    where: {
      date: { gte: since },
      saleCount: { gt: 0 },
      ...(grade ? { gradeTier: grade } : {}),
      ...(source ? { source } : {}),
      ...(cardIds ? { cardId: { in: cardIds } } : {}),
    },
    orderBy: { date: "desc" },
    select: { cardId: true, gradeTier: true, source: true, date: true, avgPriceCents: true, saleCount: true },
  });

  const byGroup = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = `${r.cardId}:${r.gradeTier}`;
    const bucket = byGroup.get(key) ?? [];
    bucket.push(r);
    byGroup.set(key, bucket);
  }

  const cards = await getPrisma().card.findMany({
    where: { id: { in: [...new Set(rows.map((r) => r.cardId))] } },
    select: { id: true, name: true, setName: true, number: true, imageUrl: true },
  });
  const cardById = new Map(cards.map((c) => [c.id, c]));

  const cutoff = days ? Date.now() - days * 86_400_000 : null;
  const all: SoldGroup[] = [];
  for (const bucket of byGroup.values()) {
    const card = cardById.get(bucket[0].cardId);
    if (!card) continue;

    const salesBySource = new Map<DailySourceName, number>();
    for (const r of bucket) salesBySource.set(r.source, (salesBySource.get(r.source) ?? 0) + r.saleCount);
    const best = [...salesBySource.entries()].sort(
      (a, b) => b[1] - a[1] || SOURCE_PREFERENCE.indexOf(a[0]) - SOURCE_PREFERENCE.indexOf(b[0]),
    )[0][0];

    const primary = bucket.filter((r) => r.source === best); // newest first
    const latest = primary[0];
    const prev = primary[1];
    all.push({
      cardId: card.id,
      cardName: card.name,
      setName: card.setName,
      number: card.number,
      imageUrl: card.imageUrl,
      gradeTier: latest.gradeTier,
      latest: { date: latest.date.toISOString(), priceCents: latest.avgPriceCents, saleCount: latest.saleCount, source: best },
      vsLastPct: prev && prev.avgPriceCents > 0 ? ((latest.avgPriceCents - prev.avgPriceCents) / prev.avgPriceCents) * 100 : null,
      totalSales: salesBySource.get(best) ?? 0,
      history: [...primary].reverse().map((r) => ({ date: r.date.toISOString().slice(0, 10), value: r.avgPriceCents })),
      lastSales: bucket
        .slice(0, LAST_SALES_SHOWN)
        .map((r) => ({ date: r.date.toISOString(), source: r.source, priceCents: r.avgPriceCents, saleCount: r.saleCount })),
    });
  }

  const sets = [...new Set(all.map((g) => g.setName))].sort();
  const filtered = all.filter(
    (g) =>
      (minCents === null || g.latest.priceCents >= minCents) &&
      (maxCents === null || g.latest.priceCents <= maxCents) &&
      (cutoff === null || new Date(g.latest.date).getTime() >= cutoff) &&
      (set === null || g.setName === set),
  );
  filtered.sort((a, b) =>
    sort === "price"
      ? b.latest.priceCents - a.latest.priceCents
      : b.latest.date.localeCompare(a.latest.date) || b.totalSales - a.totalSales,
  );

  const start = (Math.max(page, 1) - 1) * FEED_PAGE_SIZE;
  return { groups: filtered.slice(start, start + FEED_PAGE_SIZE), total: filtered.length, sets };
}
