// Screener — every card with a current price, scored by src/analysis/trends.ts and
// filterable by tag (trending / undervalued / high volume), set, rarity, era and price.
// Reads the bulk snapshot table (whole catalog) and, where a card is tracked, its
// sold-listing volume (daily_prices). The computed list is cached in memory for a few
// minutes — it is identical for every visitor and costs three grouped queries to build.

import { getPrisma } from "../lib/prisma";
import { computeTrendSignals, eraOf, MIN_SCREEN_PRICE_CENTS, type Tag, type TrendSignals } from "../analysis/trends";
import { freshCutoff, latestSnapshotDay, thenPrices } from "./snapshotSql";

export const SCREENER_PAGE_SIZE = 25;
const CACHE_MS = 10 * 60_000;

export interface ScreenerRow extends TrendSignals {
  cardId: string;
  name: string;
  setName: string;
  rarity: string;
  era: string;
  number: string | null;
  imageUrl: string | null;
  priceCents: number; // USD, TCGplayer market
  salesPerWeek: number | null;
}

export type ScreenerSort = "trend" | "dip" | "price" | "volume";

export interface ScreenerOptions {
  q?: string;
  tag?: Tag | null;
  set?: string | null;
  rarity?: string | null;
  era?: string | null;
  minCents?: number | null;
  maxCents?: number | null;
  sort?: ScreenerSort;
  page?: number;
}

interface Universe {
  day: string;
  rows: ScreenerRow[];
  builtAt: number;
}
const globalForScreener = globalThis as unknown as { screenerUniverse?: Universe };

async function buildUniverse(): Promise<Universe | null> {
  const day = await latestSnapshotDay();
  if (!day) return null;
  const prisma = getPrisma();
  const fresh = freshCutoff(day);

  const raw = await prisma.$queryRaw<
    Array<{
      cardId: string; name: string; setName: string; rarity: string; number: string | null; imageUrl: string | null; releaseDate: Date;
      price: number; a1: number | null; a7: number | null; a30: number | null; cmu: Date | null; p7: number | null; p30: number | null;
    }>
  >`
    SELECT s."cardId", c.name, c."setName", c.rarity, c.number, c."imageUrl", c."releaseDate",
           s."tcgMarketCents" AS price, s."cmAvg1Cents" AS a1, s."cmAvg7Cents" AS a7, s."cmAvg30Cents" AS a30, s."cmUpdatedAt" AS cmu,
           p7.m AS p7, p30.m AS p30
    FROM card_price_snapshots s
    JOIN cards c ON c.id = s."cardId"
    LEFT JOIN ${thenPrices(day, 7)} p7 ON p7."cardId" = s."cardId"
    LEFT JOIN ${thenPrices(day, 30, 7)} p30 ON p30."cardId" = s."cardId"
    WHERE s.date = ${day}::date AND s."tcgMarketCents" >= ${MIN_SCREEN_PRICE_CENTS}
  `;

  // Sold-listing volume exists only for tracked cards: raw-tier sales in the last 30 days, best single source.
  const sales = await prisma.$queryRaw<Array<{ cardId: string; n: number }>>`
    SELECT "cardId", max(n)::float8 AS n FROM (
      SELECT "cardId", source, sum("saleCount") AS n FROM daily_prices
      WHERE "gradeTier" = 'raw' AND date >= ${new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)}::date
      GROUP BY "cardId", source
    ) t GROUP BY "cardId"
  `;
  const perWeek = new Map(sales.map((r) => [r.cardId, (r.n / 30) * 7]));

  const rows: ScreenerRow[] = raw.map((r) => {
    const cmFresh = r.cmu !== null && r.cmu.toISOString().slice(0, 10) >= fresh;
    const signals = computeTrendSignals({
      priceCents: r.price,
      own7dCents: r.p7,
      own30dCents: r.p30,
      cm: cmFresh ? { avg1: r.a1, avg7: r.a7, avg30: r.a30 } : null,
      salesPerWeek: perWeek.get(r.cardId) ?? null,
    });
    return {
      cardId: r.cardId, name: r.name, setName: r.setName, rarity: r.rarity, era: eraOf(r.releaseDate.getUTCFullYear()),
      number: r.number, imageUrl: r.imageUrl, priceCents: r.price, salesPerWeek: perWeek.get(r.cardId) ?? null, ...signals,
    };
  });
  return { day, rows, builtAt: Date.now() };
}

async function universe(): Promise<Universe | null> {
  const cached = globalForScreener.screenerUniverse;
  if (cached && Date.now() - cached.builtAt < CACHE_MS) return cached;
  const built = await buildUniverse();
  if (built) globalForScreener.screenerUniverse = built;
  return built;
}

export interface ScreenerResult {
  rows: ScreenerRow[];
  total: number;
  day: string | null; // null = no snapshot loaded yet
  facets: { sets: string[]; rarities: string[]; eras: string[] };
  coverage: { cards: number; withOwnHistory: number; withCardmarket: number };
}

const num = (v: number | null, dflt: number) => (v === null ? dflt : v);

export async function getScreener(opts: ScreenerOptions = {}): Promise<ScreenerResult> {
  const { q = "", tag = null, set = null, rarity = null, era = null, minCents = null, maxCents = null, sort = "trend", page = 1 } = opts;
  const u = await universe();
  if (!u) return { rows: [], total: 0, day: null, facets: { sets: [], rarities: [], eras: [] }, coverage: { cards: 0, withOwnHistory: 0, withCardmarket: 0 } };

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = u.rows.filter(
    (r) =>
      (tag === null || r.tags.includes(tag)) &&
      (set === null || r.setName === set) &&
      (rarity === null || r.rarity === rarity) &&
      (era === null || r.era === era) &&
      (minCents === null || r.priceCents >= minCents) &&
      (maxCents === null || r.priceCents <= maxCents) &&
      words.every((w) => `${r.name} ${r.setName} ${r.number ?? ""}`.toLowerCase().includes(w)),
  );

  const order: Record<ScreenerSort, (a: ScreenerRow, b: ScreenerRow) => number> = {
    trend: (a, b) => num(b.trendPct, -Infinity) - num(a.trendPct, -Infinity),
    dip: (a, b) => num(a.cmDipPct, Infinity) - num(b.cmDipPct, Infinity),
    price: (a, b) => b.priceCents - a.priceCents,
    volume: (a, b) => num(b.salesPerWeek, -1) - num(a.salesPerWeek, -1),
  };
  // With a tag selected, hide rows that can't be ranked by the chosen sort rather than burying them.
  const anyTrend = u.rows.some((r) => r.trendPct !== null);
  const effectiveSort: ScreenerSort = sort === "trend" && !anyTrend ? "price" : sort;
  const ranked = filtered.filter((r) => (effectiveSort === "trend" ? r.trendPct !== null : effectiveSort === "dip" ? r.cmDipPct !== null : effectiveSort === "volume" ? r.salesPerWeek !== null : true));
  ranked.sort(order[effectiveSort]);

  const start = (Math.max(page, 1) - 1) * SCREENER_PAGE_SIZE;
  return {
    rows: ranked.slice(start, start + SCREENER_PAGE_SIZE),
    total: ranked.length,
    day: u.day,
    facets: {
      sets: [...new Set(u.rows.map((r) => r.setName))].sort(),
      rarities: [...new Set(u.rows.map((r) => r.rarity))].sort(),
      eras: [...new Set(u.rows.map((r) => r.era))],
    },
    coverage: {
      cards: u.rows.length,
      withOwnHistory: u.rows.filter((r) => r.change7dPct !== null).length,
      withCardmarket: u.rows.filter((r) => r.cmMomentumPct !== null).length,
    },
  };
}

