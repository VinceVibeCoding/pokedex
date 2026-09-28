// Serving plane for a signed-in user's watchlist: joins their WatchlistItem rows
// with each card's live snapshot (via the same lookupCard() every other UI uses,
// so pricing logic never forks) and computes P&L. No external API calls here —
// ingestion freshness is whatever refreshCard() last wrote.

import { getPrisma } from "../lib/prisma";
import { lookupCard } from "./lookup";
import type { GradeTier } from "../types/domain";

export interface WatchlistRow {
  id: string;
  cardId: string;
  cardName: string;
  setName: string;
  imageUrl: string | null;
  gradeTier: GradeTier;
  quantity: number;
  acquiredPriceCents: number | null;
  acquiredAt: string | null;
  note: string | null;
  currentPriceCents: number | null; // null when the tier has no recent sales
  dataFreshnessAt: string | null;
  valueCents: number | null; // currentPriceCents * quantity
  costCents: number | null; // acquiredPriceCents * quantity
  plCents: number | null; // valueCents - costCents
  plPct: number | null;
  sparkline: Array<{ at: string; priceCents: number }>; // trailing daily/recent prices for this tier, oldest first
}

export interface WatchlistSummary {
  rows: WatchlistRow[];
  totalValueCents: number | null; // null when every row lacks a current price
  totalCostCents: number | null; // null when every row lacks a cost basis
  totalPlCents: number | null;
  totalPlPct: number | null;
}

function sumOrNull(values: Array<number | null>): number | null {
  const known = values.filter((v): v is number => v !== null);
  return known.length > 0 ? known.reduce((a, b) => a + b, 0) : null;
}

export interface HoldingPl {
  valueCents: number | null;
  costCents: number | null;
  plCents: number | null;
  plPct: number | null;
}

/** Pure P&L math for one holding — pulled out of getWatchlist() so it's unit-testable without a DB. */
export function computeHoldingPl({
  quantity,
  acquiredPriceCents,
  currentPriceCents,
}: {
  quantity: number;
  acquiredPriceCents: number | null;
  currentPriceCents: number | null;
}): HoldingPl {
  const valueCents = currentPriceCents !== null ? currentPriceCents * quantity : null;
  const costCents = acquiredPriceCents !== null ? acquiredPriceCents * quantity : null;
  const plCents = valueCents !== null && costCents !== null ? valueCents - costCents : null;
  const plPct = plCents !== null && costCents !== null && costCents > 0 ? (plCents / costCents) * 100 : null;
  return { valueCents, costCents, plCents, plPct };
}

export async function getWatchlist(userId: string): Promise<WatchlistSummary> {
  const items = await getPrisma().watchlistItem.findMany({
    where: { userId },
    include: { card: true },
    orderBy: { createdAt: "desc" },
  });

  // One lookup per distinct card (lookupCard covers every tier + is cached), not per row.
  const cardIds = [...new Set(items.map((i) => i.cardId))];
  const lookups = new Map(
    await Promise.all(
      cardIds.map(async (id) => [id, await lookupCard(id, null)] as const),
    ),
  );

  const rows: WatchlistRow[] = items.map((item) => {
    const lookup = lookups.get(item.cardId) ?? null;
    const tier = lookup?.tiers.find((t) => t.gradeTier === item.gradeTier) ?? null;
    const currentPriceCents = tier?.priceGuide?.marketPriceCents ?? null;
    const { valueCents, costCents, plCents, plPct } = computeHoldingPl({
      quantity: item.quantity,
      acquiredPriceCents: item.acquiredPriceCents,
      currentPriceCents,
    });
    const sparkline =
      tier?.basis?.kind === "daily"
        ? [...tier.dailySales].reverse().map((d) => ({ at: d.date, priceCents: d.avgPriceCents }))
        : [...(tier?.recentSales ?? [])].reverse().map((s) => ({ at: s.soldAt, priceCents: s.priceCents }));

    return {
      id: item.id,
      cardId: item.cardId,
      cardName: item.card.name,
      setName: item.card.setName,
      imageUrl: item.card.imageUrl,
      gradeTier: item.gradeTier,
      quantity: item.quantity,
      acquiredPriceCents: item.acquiredPriceCents,
      acquiredAt: item.acquiredAt?.toISOString() ?? null,
      note: item.note,
      currentPriceCents,
      dataFreshnessAt: lookup?.dataFreshnessAt ?? null,
      valueCents,
      costCents,
      plCents,
      plPct,
      sparkline,
    };
  });

  const totalValueCents = sumOrNull(rows.map((r) => r.valueCents));
  const totalCostCents = sumOrNull(rows.map((r) => r.costCents));
  const totalPlCents =
    totalValueCents !== null && totalCostCents !== null ? totalValueCents - totalCostCents : null;
  const totalPlPct =
    totalPlCents !== null && totalCostCents !== null && totalCostCents > 0
      ? (totalPlCents / totalCostCents) * 100
      : null;

  return { rows, totalValueCents, totalCostCents, totalPlCents, totalPlPct };
}
