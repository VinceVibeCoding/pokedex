// Home page "top movers" — short-term price direction across every card with
// live prices. Reads DailyPrice directly (not CompRollup, which only ever gets
// populated from individual Comp rows written by the tcgplayer/collectr/one30point
// adapters — the real price sources, PokeTrace and PokemonPriceTracker, write
// DailyPrice only; see src/ingestion/refresh.ts). Grouped in JS rather than SQL:
// the row count here is bounded by the ingestion budget (at most a few hundred
// tracked cards), so this stays cheap without needing a rollup table of its own.

import { getPrisma } from "../lib/prisma";
import type { GradeTier } from "../types/domain";

const LOOKBACK_DAYS = 10;
const RECENT_DAYS = 3; // "now"
const PRIOR_DAYS = 4; // the 4 days before the recent window
const MIN_SALES_PER_WINDOW = 2; // thin data (0-1 sales) is too noisy to call a "move"
const RESULTS_PER_SIDE = 5;

export interface Mover {
  cardId: string;
  cardName: string;
  setName: string;
  imageUrl: string | null;
  gradeTier: GradeTier;
  priceCents: number; // current (recent-window) price
  changePct: number;
}

/** Sale-count-weighted average of daily prices — exported for unit testing. */
export function weightedAvg(rows: Array<{ avgPriceCents: number; saleCount: number }>): number | null {
  const weight = rows.reduce((sum, r) => sum + Math.max(r.saleCount, 1), 0);
  if (weight === 0) return null;
  return Math.round(rows.reduce((sum, r) => sum + r.avgPriceCents * Math.max(r.saleCount, 1), 0) / weight);
}

export async function getTopMovers(now: Date = new Date()): Promise<{ gainers: Mover[]; losers: Mover[] }> {
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000);
  const recentCutoff = new Date(now.getTime() - RECENT_DAYS * 86_400_000);
  const priorCutoff = new Date(now.getTime() - (RECENT_DAYS + PRIOR_DAYS) * 86_400_000);

  const rows = await getPrisma().dailyPrice.findMany({
    where: { date: { gte: since } },
    select: { cardId: true, gradeTier: true, date: true, avgPriceCents: true, saleCount: true },
  });
  if (rows.length === 0) return { gainers: [], losers: [] };

  const byGroup = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.cardId}:${row.gradeTier}`;
    const bucket = byGroup.get(key) ?? [];
    bucket.push(row);
    byGroup.set(key, bucket);
  }

  type Candidate = { cardId: string; gradeTier: GradeTier; priceCents: number; changePct: number; salesTotal: number };
  const candidates: Candidate[] = [];
  for (const [key, bucket] of byGroup) {
    const [cardId, gradeTier] = key.split(":") as [string, GradeTier];
    const recent = bucket.filter((r) => r.date >= recentCutoff);
    const prior = bucket.filter((r) => r.date >= priorCutoff && r.date < recentCutoff);
    const recentSales = recent.reduce((s, r) => s + r.saleCount, 0);
    const priorSales = prior.reduce((s, r) => s + r.saleCount, 0);
    if (recentSales < MIN_SALES_PER_WINDOW || priorSales < MIN_SALES_PER_WINDOW) continue;

    const recentAvg = weightedAvg(recent);
    const priorAvg = weightedAvg(prior);
    if (recentAvg === null || priorAvg === null || priorAvg === 0) continue;

    candidates.push({
      cardId,
      gradeTier,
      priceCents: recentAvg,
      changePct: ((recentAvg - priorAvg) / priorAvg) * 100,
      salesTotal: recentSales + priorSales,
    });
  }

  // One entry per card — its most-traded tier, so the list isn't dominated by a
  // single card's raw/psa8/psa9/psa10 rows.
  const bestPerCard = new Map<string, Candidate>();
  for (const c of candidates) {
    const existing = bestPerCard.get(c.cardId);
    if (!existing || c.salesTotal > existing.salesTotal) bestPerCard.set(c.cardId, c);
  }
  const ranked = [...bestPerCard.values()];

  const gainers = ranked.filter((c) => c.changePct > 0).sort((a, b) => b.changePct - a.changePct).slice(0, RESULTS_PER_SIDE);
  const losers = ranked.filter((c) => c.changePct < 0).sort((a, b) => a.changePct - b.changePct).slice(0, RESULTS_PER_SIDE);

  const cards = await getPrisma().card.findMany({
    where: { id: { in: [...gainers, ...losers].map((c) => c.cardId) } },
    select: { id: true, name: true, setName: true, imageUrl: true },
  });
  const cardById = new Map(cards.map((c) => [c.id, c]));

  const toMover = (c: Candidate): Mover | null => {
    const card = cardById.get(c.cardId);
    if (!card) return null;
    return { cardId: c.cardId, cardName: card.name, setName: card.setName, imageUrl: card.imageUrl, gradeTier: c.gradeTier, priceCents: c.priceCents, changePct: c.changePct };
  };

  return {
    gainers: gainers.map(toMover).filter((m): m is Mover => m !== null),
    losers: losers.map(toMover).filter((m): m is Mover => m !== null),
  };
}
