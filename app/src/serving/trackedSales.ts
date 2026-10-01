// Real sold-listing activity for TRACKED cards (daily_prices, raw tier). Shared by the
// screener (per-card momentum/volume) and the market recaps (per-segment volume).
// Sources overlap (PokeTrace's eBay and TCGplayer feeds), so each card uses ONE source:
// the one with the most sales in the window. Never summed across sources.

import { getPrisma } from "../lib/prisma";

const DAY = 86_400_000;

export interface SaleDay {
  date: Date;
  price: number; // average sold price that day, cents
  n: number; // sales that day
}

/** cardId → that card's best-source daily sales within the last `days` days. */
export async function getBestSourceSales(days: number): Promise<Map<string, SaleDay[]>> {
  const since = new Date(Date.now() - days * DAY).toISOString().slice(0, 10);
  const rows = await getPrisma().$queryRaw<Array<{ cardId: string; source: string; date: Date; price: number; n: number }>>`
    SELECT "cardId", source::text AS source, date, "avgPriceCents" AS price, "saleCount" AS n FROM daily_prices
    WHERE "gradeTier" = 'raw' AND "saleCount" > 0 AND date >= ${since}::date
  `;
  const bySource = new Map<string, SaleDay[]>();
  for (const r of rows) {
    const key = `${r.cardId}|${r.source}`;
    bySource.set(key, [...(bySource.get(key) ?? []), { date: r.date, price: r.price, n: r.n }]);
  }
  const best = new Map<string, SaleDay[]>();
  const totalOf = (l: SaleDay[]) => l.reduce((a, r) => a + r.n, 0);
  for (const [key, list] of bySource) {
    const cardId = key.split("|")[0];
    const cur = best.get(cardId);
    if (!cur || totalOf(list) > totalOf(cur)) best.set(cardId, list);
  }
  return best;
}

/** Sales and sale-weighted average price for days in [now - fromDaysAgo, now - toDaysAgo). */
export function windowOf(list: SaleDay[], fromDaysAgo: number, toDaysAgo = 0, now = Date.now()): { n: number; avg: number | null } {
  const lo = now - fromDaysAgo * DAY;
  const hi = now - toDaysAgo * DAY;
  const inWin = list.filter((r) => r.date.getTime() >= lo && r.date.getTime() < hi);
  const n = inWin.reduce((a, r) => a + r.n, 0);
  return { n, avg: n > 0 ? inWin.reduce((a, r) => a + r.price * r.n, 0) / n : null };
}

/**
 * "Now" for window math: the day after the newest sale we hold. Providers lag by a day or two, so
 * measuring from the wall clock would give "the last 7 days" only 5–6 days of data and fake a drop
 * against the previous full week.
 */
export function dataAnchor(sales: Map<string, SaleDay[]>, fallback = Date.now()): number {
  let newest = 0;
  for (const list of sales.values()) for (const r of list) newest = Math.max(newest, r.date.getTime());
  return newest > 0 ? Math.min(newest + DAY, fallback + DAY) : fallback;
}
