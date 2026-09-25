// Serving plane — assembles the full CardLookupResponse for a card ID.
// Reads ONLY the Card row plus its trailing-90d individual sales (comps) and daily
// summaries (daily_prices); series.ts picks one series per tier. CompRollup is not
// read yet — switch to it if comp volume makes this query slow. NO external API calls.
// Every tier with no data is a valid null state, never an error.

import { getPrisma } from "../lib/prisma";
import {
  computeBuyScore,
  computeGradePremium,
  computeMarketSignals,
  computePriceGuide,
  computeStabilityIndex,
  defaultSellCosts,
} from "../analysis";
import type {
  Card,
  CardSnapshot,
  Comp,
  CompSource,
  GradeTier,
  MarketSignals,
  TierSnapshot,
} from "../types/domain";
import { chooseSeries } from "./series";
import type { PriceObservation } from "../analysis";

export const ALL_TIERS: GradeTier[] = ["raw", "psa8", "psa9", "psa10"];
const ANALYSIS_WINDOW_DAYS = 90;
const MAX_RECENT_SALES = 60; // enough for a 90d chart + list; keeps the payload small

/** One fetch for the whole snapshot: card + its last 90d of sales, individual and daily. */
async function loadCardWithComps(cardId: string) {
  const prisma = getPrisma();
  const since = new Date(Date.now() - ANALYSIS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return prisma.card.findUnique({
    where: { id: cardId },
    include: {
      comps: {
        where: { soldAt: { gte: since } },
        orderBy: { soldAt: "desc" },
      },
      dailyPrices: {
        where: { date: { gte: since } },
        orderBy: { date: "desc" },
      },
    },
  });
}

function toDomainCard(row: NonNullable<Awaited<ReturnType<typeof loadCardWithComps>>>): Card {
  return {
    id: row.id,
    name: row.name,
    setName: row.setName,
    setCode: row.setCode,
    releaseDate: row.releaseDate.toISOString().slice(0, 10),
    cardType: row.cardType,
    rarity: row.rarity,
    pullRate: row.pullRate,
    artist: row.artist,
    printVariant: row.printVariant,
    number: row.number,
    imageUrl: row.imageUrl,
    imageUrlLarge: row.imageUrlLarge,
  };
}

function toDomainComp(row: {
  id: string;
  cardId: string;
  gradeTier: GradeTier;
  priceCents: number;
  currency: string;
  soldAt: Date;
  condition: string | null;
  source: CompSource;
  sourceUrl: string | null;
}): Comp {
  return { ...row, soldAt: row.soldAt.toISOString() };
}

/**
 * Builds the self-contained snapshot for a card — every tier, in one object.
 * Grade-independent so it can be cached by card ID; the caller picks the tier.
 * Returns null only when the card ID is unknown.
 */
export async function getCardSnapshot(cardId: string): Promise<CardSnapshot | null> {
  const row = await loadCardWithComps(cardId);
  if (!row) return null;

  const card = toDomainCard(row);
  const now = new Date();
  const seriesByTier = new Map(
    ALL_TIERS.map((t) => [
      t,
      chooseSeries(
        row.comps.filter((c) => c.gradeTier === t).map(toDomainComp),
        row.dailyPrices.filter((d) => d.gradeTier === t),
      ),
    ]),
  );
  const observationsByTier = new Map<GradeTier, PriceObservation[]>(
    ALL_TIERS.map((t) => [t, seriesByTier.get(t)?.observations ?? []]),
  );

  const tiers: TierSnapshot[] = ALL_TIERS.map((gradeTier) => {
    const series = seriesByTier.get(gradeTier);
    if (!series) {
      return {
        gradeTier,
        signals: null,
        stability: null,
        priceGuide: null,
        buyScore: null,
        basis: null,
        recentSales: [],
        dailySales: [],
      };
    }
    const { observations, comps } = series;
    const signals: MarketSignals = computeMarketSignals(cardId, gradeTier, observations, now);
    return {
      gradeTier,
      signals,
      stability: computeStabilityIndex(signals, now),
      priceGuide: computePriceGuide(observations, defaultSellCosts(gradeTier), undefined, now),
      // Each tier gets its own score — a PSA 10 verdict must come from PSA 10 sales.
      buyScore: computeBuyScore(signals, observations, now),
      basis: series.basis,
      dailySales: series.dailySales,
      recentSales: comps.slice(0, MAX_RECENT_SALES).map(({ soldAt, priceCents, source, sourceUrl }) => ({
        soldAt,
        priceCents,
        source,
        sourceUrl,
      })),
    };
  });

  const gradePremium = computeGradePremium(cardId, observationsByTier, undefined, now);

  // Default view = the tier with the most sales (most reliable numbers).
  const defaultTier = [...tiers].sort(
    (a, b) => (b.signals?.salesTotal ?? 0) - (a.signals?.salesTotal ?? 0),
  )[0].gradeTier;

  // Freshness = when ingestion last wrote prices for this card, not when it last sold.
  const lastIngest = [...row.comps.map((c) => c.ingestedAt), ...row.dailyPrices.map((d) => d.fetchedAt)].reduce<Date | null>(
    (max, t) => (max === null || t > max ? t : max),
    null,
  );

  return {
    card,
    tiers,
    gradePremium,
    defaultTier,
    dataFreshnessAt: lastIngest?.toISOString() ?? null,
    computedAt: now.toISOString(),
  };
}
