// Rollup computation — rebuilds CompRollup rows (daily/weekly/monthly) from raw
// comps, per card + grade tier. Called by the ingestion job after new comps land.
// The serving plane reads these tables only.

import type { Prisma } from "../generated/prisma/client";
import { getPrisma } from "../lib/prisma";

type Window = "daily" | "weekly" | "monthly";
const WINDOW_DAYS: Record<Window, number> = { daily: 1, weekly: 7, monthly: 30 };
/** How far back to (re)build rollups. */
const LOOKBACK_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function windowStartUTC(date: Date, window: Window): Date {
  const d = new Date(date);
  if (window === "daily") {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  if (window === "monthly") {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }
  // weekly: ISO week starting Monday
  const dayStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (dayStart.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(dayStart.getTime() - dow * DAY_MS);
}

/**
 * Rebuilds rollups for one card over the trailing LOOKBACK_DAYS.
 * Deletes and recreates windows in range — rollups are derived data,
 * so replacement is safe and keeps the logic idempotent.
 */
export async function recomputeRollups(cardId: string, now: Date = new Date()) {
  const prisma = getPrisma();
  const since = new Date(now.getTime() - LOOKBACK_DAYS * DAY_MS);

  const comps = await prisma.comp.findMany({
    where: { cardId, soldAt: { gte: since } },
    orderBy: { soldAt: "desc" },
  });

  await prisma.compRollup.deleteMany({
    where: { cardId, windowStart: { gte: windowStartUTC(since, "daily") } },
  });

  const rows: Prisma.CompRollupCreateManyInput[] = [];
  const tiers = [...new Set(comps.map((c) => c.gradeTier))];

  for (const tier of tiers) {
    const tierComps = comps.filter((c) => c.gradeTier === tier);
    for (const window of Object.keys(WINDOW_DAYS) as Window[]) {
      // Group comps into window buckets.
      const buckets = new Map<number, typeof tierComps>();
      for (const comp of tierComps) {
        const start = windowStartUTC(comp.soldAt, window).getTime();
        const bucket = buckets.get(start) ?? [];
        bucket.push(comp);
        buckets.set(start, bucket);
      }
      for (const [startMs, bucket] of buckets) {
        const prices = bucket.map((c) => c.priceCents);
        const newest = bucket[0]; // comps are pre-sorted desc
        rows.push({
          cardId,
          gradeTier: tier,
          window,
          windowStart: new Date(startMs),
          salesCount: bucket.length,
          minPriceCents: Math.min(...prices),
          maxPriceCents: Math.max(...prices),
          avgPriceCents: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
          medianPriceCents: median(prices),
          lastSaleAt: newest.soldAt,
          lastSalePriceCents: newest.priceCents,
        });
      }
    }
  }

  if (rows.length > 0) {
    await prisma.compRollup.createMany({ data: rows, skipDuplicates: true });
  }
  return rows.length;
}
