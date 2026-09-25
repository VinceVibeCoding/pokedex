// Buy Score — heuristic, explainable "is this a good buy / will it trend up".
// Deliberately transparent (no ML yet): every point contributed is listed in `reasons`
// so the UI can explain the verdict. Starts at 50 (neutral), adjusted by:
//   - trend:      +/- up to 25 based on priceTrendPct (clamped at +/-20%)
//   - velocity:   +10 if salesPerWeek >= 5, +5 if >= 2 (liquid markets are safer)
//   - deviation:  current price vs 30d moving average — buying below the mean adds up
//                 to +15, buying far above subtracts up to -15 (clamped at +/-15%)
// Verdicts: >=70 strong_buy, >=55 buy, >=40 hold, else avoid.
// Returns null when there are zero sales. Input: price observations (stats.ts).

import type { BuyScore, MarketSignals } from "../types/domain";
import { weightedMean, within, type PriceObservation } from "./stats";

export function computeBuyScore(
  signals: MarketSignals,
  observations: PriceObservation[],
  now: Date = new Date(),
): BuyScore | null {
  if (signals.salesTotal === 0) return null;

  const reasons: string[] = [];
  let score = 50;

  if (signals.priceTrendPct !== null) {
    const clamped = Math.max(-20, Math.min(20, signals.priceTrendPct));
    const points = (clamped / 20) * 25;
    score += points;
    reasons.push(
      `Price trend ${signals.priceTrendPct >= 0 ? "+" : ""}${signals.priceTrendPct.toFixed(1)}% (30d vs prior 30d) → ${points >= 0 ? "+" : ""}${points.toFixed(0)} pts`,
    );
  } else {
    reasons.push("Not enough history to compute a price trend (needs 2+ sales in each of the last two months) → +0 pts");
  }

  if (signals.salesPerWeek >= 5) {
    score += 10;
    reasons.push(`High liquidity (${signals.salesPerWeek} sales/week) → +10 pts`);
  } else if (signals.salesPerWeek >= 2) {
    score += 5;
    reasons.push(`Moderate liquidity (${signals.salesPerWeek} sales/week) → +5 pts`);
  } else {
    reasons.push(`Low liquidity (${signals.salesPerWeek} sales/week) → +0 pts`);
  }

  const movingAvg = weightedMean(within(observations, now, 30));
  let deviationFromMovingAvgPct: number | null = null;

  if (movingAvg !== null && signals.lastSalePriceCents !== null) {
    deviationFromMovingAvgPct =
      ((signals.lastSalePriceCents - movingAvg) / movingAvg) * 100;
    const clamped = Math.max(-15, Math.min(15, deviationFromMovingAvgPct));
    const points = -(clamped / 15) * 15; // below average = good buy
    score += points;
    reasons.push(
      `Last sale ${deviationFromMovingAvgPct >= 0 ? "+" : ""}${deviationFromMovingAvgPct.toFixed(1)}% vs 30d average → ${points >= 0 ? "+" : ""}${points.toFixed(0)} pts`,
    );
  }

  const rounded = Math.round(Math.max(0, Math.min(100, score)));
  const verdict: BuyScore["verdict"] =
    rounded >= 70 ? "strong_buy" : rounded >= 55 ? "buy" : rounded >= 40 ? "hold" : "avoid";

  const trendSlope =
    signals.priceTrendPct !== null ? signals.priceTrendPct / 30 : null; // % per day

  return { score: rounded, verdict, trendSlope, deviationFromMovingAvgPct, reasons };
}
