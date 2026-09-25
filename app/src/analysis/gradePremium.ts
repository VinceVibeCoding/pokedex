// Grade Premium Analysis — which tier (raw / PSA 8 / 9 / 10) is most worth buying.
//
// Method: for each tier, take the median trailing-90d price. valueScore expresses
// price relative to the "raw + grading cost" baseline — a tier priced below what
// its rarity-adjusted baseline implies is the better buy. Simplified heuristic:
//   valueScore = tierMedian / (rawMedian + gradingCost)
// Lower is better value relative to raw; the recommended tier is the cheapest
// valueScore among tiers with data, excluding tiers whose premium over raw is
// unexplained by typical grading outcomes (left as a heuristic constant set).
// Returns null when even the raw tier has no data.

import type { GradePremiumAnalysis, GradeTier } from "../types/domain";
import { weightedMedian, within, type PriceObservation } from "./stats";

export const DEFAULT_GRADING_COST_CENTS = 2500; // ~$25 bulk grading

const ALL_TIERS: GradeTier[] = ["raw", "psa8", "psa9", "psa10"];

function medianRecentPriceCents(observations: PriceObservation[], now: Date, days = 90): number | null {
  return weightedMedian(within(observations, now, days));
}

export function computeGradePremium(
  cardId: string,
  observationsByTier: Map<GradeTier, PriceObservation[]>,
  gradingCostCents: number = DEFAULT_GRADING_COST_CENTS,
  now: Date = new Date(),
): GradePremiumAnalysis | null {
  const medians = new Map<GradeTier, number | null>(
    ALL_TIERS.map((t) => [t, medianRecentPriceCents(observationsByTier.get(t) ?? [], now)]),
  );

  const rawMedian = medians.get("raw") ?? null;
  if (rawMedian === null) return null;

  const baseline = rawMedian + gradingCostCents;

  const tiers = ALL_TIERS.map((gradeTier) => {
    const marketPriceCents = medians.get(gradeTier) ?? null;
    const premiumOverRawPct =
      marketPriceCents !== null && rawMedian > 0
        ? ((marketPriceCents - rawMedian) / rawMedian) * 100
        : null;
    // Raw is the baseline by definition (valueScore 1).
    const valueScore =
      marketPriceCents === null
        ? null
        : gradeTier === "raw"
          ? 1
          : marketPriceCents / baseline;
    return { gradeTier, marketPriceCents, premiumOverRawPct, valueScore };
  });

  const candidates = tiers.filter((t) => t.valueScore !== null);
  const recommendedTier =
    candidates.length === 0
      ? null
      : candidates.reduce((best, t) =>
          t.valueScore! < best.valueScore! ? t : best,
        ).gradeTier;

  return { cardId, gradingCostCents, tiers, recommendedTier };
}
