// Market indexes — one equal-weighted basket per grade tier, built from every
// tracked card's daily prices. Method (shown on the Indexes page):
//   1. per card + tier, take one daily series (best source, days with sales only)
//   2. forward-fill gaps so a card that skipped a day keeps its last price
//   3. rebase each card to 100 on its first day in the window
//   4. the index on a day is the mean of the rebased cards that have started
// Equal weighting means one expensive card can't swamp the index. Cards enter the
// basket only once they have ≥ MIN_DAYS of data.

import { getPrisma } from "../lib/prisma";
import { GRADE_TIERS } from "../lib/grade";
import type { GradeTier } from "../types/domain";
import type { DailySourceName } from "../ingestion/sources/types";

const WINDOW_DAYS = 30;
const MIN_DAYS = 3;
const SOURCE_PREFERENCE: DailySourceName[] = ["ppt_ebay", "poketrace_ebay", "poketrace_tcgplayer"];

export interface IndexPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface MarketIndex {
  gradeTier: GradeTier;
  points: IndexPoint[];
  level: number | null;
  change7dPct: number | null;
  change30dPct: number | null;
  cardCount: number;
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export async function getMarketIndexes(now: Date = new Date()): Promise<MarketIndex[]> {
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);
  const rows = await getPrisma().dailyPrice.findMany({
    where: { date: { gte: since }, saleCount: { gt: 0 } },
    select: { cardId: true, gradeTier: true, source: true, date: true, avgPriceCents: true },
  });

  const days: string[] = [];
  for (let i = WINDOW_DAYS; i >= 0; i--) days.push(dayKey(new Date(now.getTime() - i * 86_400_000)));

  return GRADE_TIERS.map((gradeTier) => {
    // card → day → {price, source rank}, keeping the preferred source per day
    const perCard = new Map<string, Map<string, { price: number; rank: number }>>();
    for (const r of rows) {
      if (r.gradeTier !== gradeTier) continue;
      const byDay = perCard.get(r.cardId) ?? new Map();
      const day = dayKey(r.date);
      const rank = SOURCE_PREFERENCE.indexOf(r.source);
      const cur = byDay.get(day);
      if (!cur || rank < cur.rank) byDay.set(day, { price: r.avgPriceCents, rank });
      perCard.set(r.cardId, byDay);
    }

    const series: Array<Array<number | null>> = [];
    for (const byDay of perCard.values()) {
      if (byDay.size < MIN_DAYS) continue;
      let base: number | null = null;
      let last: number | null = null;
      series.push(
        days.map((day) => {
          const p = byDay.get(day)?.price;
          if (p !== undefined) {
            base ??= p;
            last = p;
          }
          return base && last ? (last / base) * 100 : null;
        }),
      );
    }

    const points: IndexPoint[] = [];
    days.forEach((date, i) => {
      const vals = series.map((s) => s[i]).filter((v): v is number => v !== null);
      if (vals.length > 0) points.push({ date, value: vals.reduce((a, b) => a + b, 0) / vals.length });
    });

    const level = points.length > 0 ? points[points.length - 1].value : null;
    const changeOver = (n: number) => {
      if (level === null || points.length < 2) return null;
      const target = dayKey(new Date(now.getTime() - n * 86_400_000));
      const ref = points.find((p) => p.date >= target) ?? points[0];
      return ref.value > 0 ? ((level - ref.value) / ref.value) * 100 : null;
    };

    return { gradeTier, points, level, change7dPct: changeOver(7), change30dPct: changeOver(30), cardCount: series.length };
  });
}
