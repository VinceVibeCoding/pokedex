// Market segments — sets, eras and rarities rolled up from the bulk price snapshot.
// A segment's change is LIKE-FOR-LIKE: only cards priced both then and now are compared,
// so a new card entering the feed can't fake growth. When we don't yet have ~30 days of our
// own history, the fallback is Cardmarket's 7-day vs 30-day average (fresh rows only),
// clearly labeled — the two are never blended into one number.

import { Prisma } from "../generated/prisma/client";
import { getPrisma } from "../lib/prisma";
import { ERAS, eraOf, MIN_SCREEN_PRICE_CENTS, segmentHeadline, type SegmentStats } from "../analysis/trends";
import { dataAnchor, getBestSourceSales, windowOf } from "./trackedSales";
import { freshCutoff, latestSnapshotDay, thenPrices } from "./snapshotSql";

export type SegmentBy = "set" | "era" | "rarity";

export interface Segment {
  key: string;
  cards: number;
  valueCents: number; // sum of TCGplayer market prices (USD) — a set's "market cap" of one copy of every card
  changePct: number | null;
  window: SegmentStats["window"] | null;
  pctUp: number | null;
  headline: string | null;
  valueShare: number; // this segment's share of the total value across all segments (0–1)
  volume: { trackedCards: number; sales7: number; salesPrev7: number } | null; // sold listings, tracked cards only
}

const MIN_CARDS = 10; // a segment of 3 cards says nothing
const MIN_LIKE_FOR_LIKE = 10; // cards with both prices before an own-history change is trusted
const CACHE_MS = 10 * 60_000;
const cache = new Map<string, { at: number; value: { day: string; segments: Segment[] } | null }>();

function keyExpr(by: SegmentBy): Prisma.Sql {
  if (by === "set") return Prisma.sql`c."setName"`;
  if (by === "rarity") return Prisma.sql`c.rarity`;
  const whens = [...ERAS].reverse().map((e) => Prisma.sql`WHEN EXTRACT(YEAR FROM c."releaseDate") >= ${e.fromYear} THEN ${e.label}::text`);
  return Prisma.sql`CASE ${Prisma.join(whens, " ")} ELSE ${ERAS[0].label}::text END`;
}

/** Sold-listing volume per segment: only tracked cards have it, so the tracked-card count is shown with it. */
async function volumeBySegment(by: SegmentBy): Promise<Map<string, { trackedCards: number; sales7: number; salesPrev7: number }>> {
  const sales = await getBestSourceSales(16);
  if (sales.size === 0) return new Map();
  const anchor = dataAnchor(sales);
  const cards = await getPrisma().card.findMany({
    where: { id: { in: [...sales.keys()] } },
    select: { id: true, setName: true, rarity: true, releaseDate: true },
  });
  const out = new Map<string, { trackedCards: number; sales7: number; salesPrev7: number }>();
  for (const c of cards) {
    const key = by === "set" ? c.setName : by === "rarity" ? c.rarity : eraOf(c.releaseDate.getUTCFullYear());
    const list = sales.get(c.id)!;
    const cur = out.get(key) ?? { trackedCards: 0, sales7: 0, salesPrev7: 0 };
    cur.trackedCards += 1;
    cur.sales7 += windowOf(list, 7, 0, anchor).n;
    cur.salesPrev7 += windowOf(list, 14, 7, anchor).n;
    out.set(key, cur);
  }
  return out;
}

export async function getMarketSegments(by: SegmentBy): Promise<{ day: string; segments: Segment[] } | null> {
  const hit = cache.get(by);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const day = await latestSnapshotDay();
  if (!day) return null;
  const fresh = freshCutoff(day);

  const rows = await getPrisma().$queryRaw<
    Array<{
      key: string; cards: number; value: number;
      cur30: number | null; then30: number | null; n30: number; up30: number;
      cur7: number | null; then7: number | null; n7: number; up7: number;
      cm_median: number | null; cm_n: number; cm_up: number;
    }>
  >`
    SELECT ${keyExpr(by)} AS key,
      count(*)::int AS cards,
      sum(s."tcgMarketCents")::float8 AS value,
      sum(s."tcgMarketCents") FILTER (WHERE p30.m IS NOT NULL)::float8 AS cur30, sum(p30.m)::float8 AS then30,
      count(p30.m)::int AS n30, count(*) FILTER (WHERE p30.m IS NOT NULL AND s."tcgMarketCents" > p30.m)::int AS up30,
      sum(s."tcgMarketCents") FILTER (WHERE p7.m IS NOT NULL)::float8 AS cur7, sum(p7.m)::float8 AS then7,
      count(p7.m)::int AS n7, count(*) FILTER (WHERE p7.m IS NOT NULL AND s."tcgMarketCents" > p7.m)::int AS up7,
      (percentile_cont(0.5) WITHIN GROUP (ORDER BY s."cmAvg7Cents"::float8 / s."cmAvg30Cents" - 1)
         FILTER (WHERE s."cmUpdatedAt" >= ${fresh}::date AND s."cmAvg7Cents" > 0 AND s."cmAvg30Cents" > 0))::float8 AS cm_median,
      count(*) FILTER (WHERE s."cmUpdatedAt" >= ${fresh}::date AND s."cmAvg7Cents" > 0 AND s."cmAvg30Cents" > 0)::int AS cm_n,
      count(*) FILTER (WHERE s."cmUpdatedAt" >= ${fresh}::date AND s."cmAvg7Cents" > s."cmAvg30Cents" AND s."cmAvg30Cents" > 0)::int AS cm_up
    FROM card_price_snapshots s
    JOIN cards c ON c.id = s."cardId"
    LEFT JOIN ${thenPrices(day, 30, 7)} p30 ON p30."cardId" = s."cardId"
    LEFT JOIN ${thenPrices(day, 7)} p7 ON p7."cardId" = s."cardId"
    WHERE s.date = ${day}::date AND s."tcgMarketCents" >= ${MIN_SCREEN_PRICE_CENTS}
    GROUP BY 1
    HAVING count(*) >= ${MIN_CARDS}
  `;

  const volume = await volumeBySegment(by);
  const totalValue = rows.reduce((a, r) => a + r.value, 0);
  const segments: Segment[] = rows.map((r) => {
    let changePct: number | null = null;
    let window: Segment["window"] = null;
    let pctUp: number | null = null;
    if (r.n30 >= MIN_LIKE_FOR_LIKE && r.then30) {
      changePct = ((r.cur30! - r.then30) / r.then30) * 100; window = "30d"; pctUp = (r.up30 / r.n30) * 100;
    } else if (r.n7 >= MIN_LIKE_FOR_LIKE && r.then7) {
      changePct = ((r.cur7! - r.then7) / r.then7) * 100; window = "7d"; pctUp = (r.up7 / r.n7) * 100;
    } else if (r.cm_n >= MIN_LIKE_FOR_LIKE && r.cm_median !== null) {
      changePct = r.cm_median * 100; window = "cm"; pctUp = (r.cm_up / r.cm_n) * 100;
    }
    const seg: Segment = { key: r.key, cards: r.cards, valueCents: r.value, changePct, window, pctUp, headline: null, valueShare: totalValue > 0 ? r.value / totalValue : 0, volume: volume.get(r.key) ?? null };
    seg.headline = window ? segmentHeadline({ label: r.key, cards: r.cards, changePct, pctUp, window }) : null;
    return seg;
  });

  const value = { day, segments };
  cache.set(by, { at: Date.now(), value });
  return value;
}
