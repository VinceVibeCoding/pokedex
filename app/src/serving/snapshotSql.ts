// Shared SQL for the snapshot-based views (screener + market segments).

import { Prisma } from "../generated/prisma/client";
import { getPrisma } from "../lib/prisma";

const DAY = 86_400_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Latest snapshot day, or null when the table is empty or not migrated yet. */
export async function latestSnapshotDay(): Promise<string | null> {
  try {
    const [row] = await getPrisma().$queryRaw<Array<{ d: Date | null }>>`SELECT max(date) AS d FROM card_price_snapshots`;
    return row?.d ? row.d.toISOString().slice(0, 10) : null;
  } catch {
    return null; // table missing: the pages show a "not loaded yet" notice instead of a 500
  }
}

/**
 * Each card's most recent snapshot within [latest - daysAgo - slack, latest - daysAgo] — the
 * "then" side of a change. Slack absorbs missed snapshot days (cron failures, weekends).
 */
export function thenPrices(latest: string, daysAgo: number, slack = 4): Prisma.Sql {
  const t = new Date(`${latest}T00:00:00Z`).getTime();
  return Prisma.sql`(SELECT DISTINCT ON ("cardId") "cardId", "tcgMarketCents" AS m
    FROM card_price_snapshots
    WHERE date <= ${iso(t - daysAgo * DAY)}::date AND date >= ${iso(t - (daysAgo + slack) * DAY)}::date AND "tcgMarketCents" IS NOT NULL
    ORDER BY "cardId", date DESC)`;
}

/** Cardmarket rows older than this are stale and excluded from trend math. */
export function freshCutoff(latest: string, maxAgeDays = 3): string {
  return iso(new Date(`${latest}T00:00:00Z`).getTime() - maxAgeDays * DAY);
}
