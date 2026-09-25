// Market signals: the raw derived stats per grade tier.
// Pure functions — no DB, no I/O. All edge cases (0/1 sales, stale sales) are explicit.
// Input is price observations (see stats.ts): individual sales or daily summaries.
//
// Window conventions:
//   - sales counts are summed observation weights within trailing windows from `now`
//   - trend compares the trailing-30d MEDIAN vs the prior-30d median, and needs at
//     least MIN_TREND_SALES in each window — one freak sale must not flip the trend
//   - volatility is the coefficient of variation (stddev/mean) of trailing-90d prices

import type { GradeTier, MarketSignals } from "../types/domain";
import {
  between,
  totalWeight,
  weightedMean,
  weightedMedian,
  weightedStddev,
  within,
  type PriceObservation,
} from "./stats";

const MIN_TREND_SALES = 2;

/**
 * Computes market signals for one card + grade tier.
 * `observations` must already be filtered to the tier — never mix tiers (see CLAUDE.md).
 * Returns null fields where there is insufficient data.
 */
export function computeMarketSignals(
  cardId: string,
  gradeTier: GradeTier,
  observations: PriceObservation[],
  now: Date = new Date(),
): MarketSignals {
  const last =
    observations.length === 0
      ? null
      : observations.reduce((a, b) =>
          new Date(b.soldAt).getTime() > new Date(a.soldAt).getTime() ? b : a,
        );

  const last30 = within(observations, now, 30);
  const prior30 = between(observations, now, 30, 60);
  const last90 = within(observations, now, 90);

  const medianLast30 = totalWeight(last30) >= MIN_TREND_SALES ? weightedMedian(last30) : null;
  const medianPrior30 = totalWeight(prior30) >= MIN_TREND_SALES ? weightedMedian(prior30) : null;
  const priceTrendPct =
    medianLast30 !== null && medianPrior30 !== null && medianPrior30 > 0
      ? ((medianLast30 - medianPrior30) / medianPrior30) * 100
      : null;

  const mean90 = weightedMean(last90);
  const sd90 = weightedStddev(last90);
  const volatility = mean90 !== null && sd90 !== null && mean90 > 0 ? sd90 / mean90 : null;

  return {
    cardId,
    gradeTier,
    salesTotal: totalWeight(observations),
    salesPerDay: totalWeight(within(observations, now, 1)),
    salesPerWeek: totalWeight(within(observations, now, 7)),
    salesPerMonth: totalWeight(last30),
    lastSaleAt: last ? last.soldAt : null,
    lastSalePriceCents: last ? last.priceCents : null,
    priceTrendPct,
    volatility,
    computedAt: now.toISOString(),
  };
}
