// Track-record queries. A flag's outcome is the card's TCGplayer snapshot price exactly N days
// after the flag date vs the price logged when it was flagged. The baseline is the median
// return of every card priced ≥ $3 over the same start dates, so a rising tide doesn't count
// as skill. A flag whose date+N snapshot is missing (a skipped cron day) is left out, not guessed.

import { getPrisma } from "../lib/prisma";
import { describeTrackStats, summarizeFlagReturns, type FlagReturn, type TrackStats } from "../analysis/trackRecord";

export const HORIZONS = [7, 30] as const;
export type Tag = "trending" | "undervalued";

export interface TrackRecord {
  firstFlagDate: string | null;
  lastFlagDate: string | null;
  flagDays: number;
  results: Array<{ tag: Tag; horizon: number; stats: TrackStats; summary: string }>;
}

export async function getTrackRecord(): Promise<TrackRecord | null> {
  const prisma = getPrisma();
  let range: Array<{ first: Date | null; last: Date | null; days: number }>;
  try {
    range = await prisma.$queryRaw`SELECT min(date) AS first, max(date) AS last, count(DISTINCT date)::int AS days FROM flag_log`;
  } catch {
    return null; // table missing: the page shows a "not started" notice
  }
  const { first, last, days } = range[0];
  const empty: TrackRecord = { firstFlagDate: null, lastFlagDate: null, flagDays: 0, results: [] };
  if (!first || !last) return empty;

  const results: TrackRecord["results"] = [];
  for (const horizon of HORIZONS) {
    const flagRows = await prisma.$queryRaw<Array<{ tag: Tag; date: Date; p0: number; p1: number }>>`
      SELECT f.tag, f.date, f."priceCents" AS p0, s."tcgMarketCents" AS p1
      FROM flag_log f
      JOIN card_price_snapshots s ON s."cardId" = f."cardId" AND s.date = f.date + ${horizon}::int
      WHERE s."tcgMarketCents" IS NOT NULL AND f."priceCents" > 0
    `;
    const baseRows = await prisma.$queryRaw<Array<{ date: Date; med: number }>>`
      SELECT a.date, (percentile_cont(0.5) WITHIN GROUP (ORDER BY b."tcgMarketCents"::float8 / a."tcgMarketCents" - 1) * 100)::float8 AS med
      FROM card_price_snapshots a
      JOIN card_price_snapshots b ON b."cardId" = a."cardId" AND b.date = a.date + ${horizon}::int
      WHERE a.date IN (SELECT DISTINCT date FROM flag_log) AND a."tcgMarketCents" >= 300 AND b."tcgMarketCents" > 0
      GROUP BY a.date
    `;
    const baselineByDate = new Map(baseRows.map((r) => [r.date.toISOString().slice(0, 10), r.med]));
    for (const tag of ["trending", "undervalued"] as const) {
      const returns: FlagReturn[] = flagRows
        .filter((r) => r.tag === tag)
        .map((r) => ({ date: r.date.toISOString().slice(0, 10), returnPct: ((r.p1 - r.p0) / r.p0) * 100 }));
      const stats = summarizeFlagReturns(returns, baselineByDate);
      results.push({ tag, horizon, stats, summary: describeTrackStats(tag, horizon, stats) });
    }
  }
  return { firstFlagDate: first.toISOString().slice(0, 10), lastFlagDate: last.toISOString().slice(0, 10), flagDays: days, results };
}
