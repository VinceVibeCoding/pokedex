// Daily flag log for the track record: after each snapshot, record every card the screener
// flags "trending" or "undervalued" with its price at that moment. Idempotent per day
// (re-running the same day changes nothing); append-only across days.

import { getPrisma } from "../lib/prisma";
import { getScreener, resetScreenerCache } from "../serving/screener";

export async function logFlags(now: Date = new Date()): Promise<{ day: string; logged: number } | null> {
  resetScreenerCache();
  const date = new Date(now.toISOString().slice(0, 10));
  let logged = 0;
  for (const tag of ["trending", "undervalued"] as const) {
    const res = await getScreener({ tag, pageSize: 5000 });
    if (res.day === null) return null; // no snapshot to flag from
    const created = await getPrisma().flagLog.createMany({
      data: res.rows.map((r) => ({
        date,
        cardId: r.cardId,
        tag,
        basis: r.trendSource,
        priceCents: r.priceCents,
        trendPct: r.trendPct,
      })),
      skipDuplicates: true,
    });
    logged += created.count;
  }
  return { day: date.toISOString().slice(0, 10), logged };
}
